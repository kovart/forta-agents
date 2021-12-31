import axios from 'axios';
import { providers, constants } from 'ethers';
import BigNumber from 'bignumber.js';
import {
  HandleTransaction,
  HandleBlock,
  TransactionEvent,
  BlockEvent,
  Finding,
  getEthersProvider
} from 'forta-agent';
import { ERC20_APPROVE_FUNCTION, ERC20_INCREASE_ALLOWANCE_FUNCTION } from './constants';
import { EthereumAddressRegistry } from './utils/registry';
import { AllowanceStore } from './utils/store';
import { createPhishingFinding } from './findings';
import { AgentDependenciesConfig } from './types';

const provider = getEthersProvider();
// basic configuration variables
import agentParameters from './configs/agent-config.json';
// etherscan address labels grabbed from here: https://github.com/W-McDonald/etherscan
import addressLabels from './configs/address-labels.json';

const dependenciesConfig: AgentDependenciesConfig = {} as AgentDependenciesConfig;

function provideInitialize(
  dependenciesConfig: AgentDependenciesConfig,
  provider: providers.JsonRpcProvider,
  parameters: typeof agentParameters,
  labels: typeof addressLabels
) {
  return async function initialize() {
    const { callsThreshold, secondsKeepApprovals, secondsKeepFindings, secondsRegistryCache } =
      parameters;
    const exchangeAddresses = labels.filter((l) => l.type === 'Exchange').map((l) => l.address);

    dependenciesConfig.callsThreshold = callsThreshold; // max function calls
    dependenciesConfig.secondsKeepApprovals = secondsKeepApprovals; // observe period
    dependenciesConfig.secondsKeepFindings = secondsKeepFindings; // how long we need to keep the traces of attackers
    dependenciesConfig.secondsRegistryCache = secondsRegistryCache; // how long we need to keep an address in the cache
    dependenciesConfig.store = new AllowanceStore(provider);
    dependenciesConfig.registry = new EthereumAddressRegistry(axios, provider, exchangeAddresses);
    dependenciesConfig.isInitialized = true;
  };
}

function provideHandleBlock(dependenciesConfig: AgentDependenciesConfig): HandleBlock {
  // Used to keep tracking the attacker's approvals after secondsKeepApprovals is over
  const attackersMap: {
    [attacker: string]: {
      modified: number;
      approvalsCount: number;
    };
  } = {};

  function clearOutdatedAttackers(minTimestamp: number) {
    for (const [attacker, { modified }] of Object.entries(attackersMap)) {
      if (modified < minTimestamp) {
        delete attackersMap[attacker];
      }
    }
  }

  return async function handleBlock(blockEvent: BlockEvent) {
    if (!dependenciesConfig.isInitialized)
      throw new Error('Agent dependencies are not initialized');

    const findings: Finding[] = [];

    const { timestamp } = blockEvent.block;
    const {
      store,
      registry,
      callsThreshold,
      secondsKeepApprovals,
      secondsKeepFindings,
      secondsRegistryCache
    } = dependenciesConfig;

    // We rely on timestamp instead of block number, because it makes the agent more universal
    // and allows to scan different networks in future.
    // ---------------------------------------------
    // Also, to make the agent output more helpful,
    // we force clearOutdatedData() not to touch the attackers traces
    // within `secondsKeepFindings` from the last `modified` timestamp.

    store.clearOutdatedData(timestamp - secondsKeepApprovals, Object.keys(attackersMap));
    registry.clearOutdatedCache(Date.now() - secondsRegistryCache * 1000);

    const summaries = store.getSpenderSummaries();

    for (const summary of summaries) {
      const { address: spender, tokens, owners, amounts, approvalsCount } = summary;

      // continue if it's a known attacker and there are no new approvals
      if (attackersMap[spender]?.approvalsCount === approvalsCount) {
        continue;
      }

      if (
        attackersMap[spender] ||
        (approvalsCount > callsThreshold &&
          // we use external API only after all passed conditions to minimize calls to etherscan as much as possible
          !(await registry.isExchange(spender, { useExternalApi: true })))
      ) {
        const affectedTokens = await Promise.all(
          tokens.map(async (token) => ({
            amount: amounts[token.address],
            symbol: await token.symbol(),
            address: token.address
          }))
        );

        findings.push(createPhishingFinding(approvalsCount, spender, owners, affectedTokens));

        attackersMap[spender] = { modified: timestamp, approvalsCount };
      }
    }

    clearOutdatedAttackers(timestamp - secondsKeepFindings);

    return findings;
  };
}

function provideHandleTransaction(config: AgentDependenciesConfig): HandleTransaction {
  return async function handleTransaction(txEvent: TransactionEvent) {
    if (!config.isInitialized) throw new Error('Agent dependencies are not initialized');

    // Ignore failed transactions
    if (!txEvent.status) return [];

    const { store, registry } = config;
    const { timestamp, blockNumber } = txEvent;

    const fromAddress = txEvent.transaction.from.toLowerCase();
    const toAddress = txEvent.transaction.to?.toLowerCase();

    if (!toAddress) return [];

    // Ignore transactions from a smart contract
    if (await registry.isContract(fromAddress)) return [];

    const functions = [
      {
        calls: txEvent.filterFunction(ERC20_APPROVE_FUNCTION),
        log: store.approve.bind(store)
      },
      {
        calls: txEvent.filterFunction(ERC20_INCREASE_ALLOWANCE_FUNCTION),
        log: store.increaseAllowance.bind(store)
      }
    ];

    for (const fn of functions) {
      for (const call of fn.calls) {
        const spender = call.args[0].toLowerCase();
        const amount = new BigNumber(call.args[1].toHexString());

        if (amount.isZero() || spender === constants.AddressZero) continue;

        // Filter out calls where spender is a EOAs of a centralized exchange.
        // We disable usage of external API to optimize third-party calls,
        // we will check it in the handleBlock() further if we break through the threshold
        if (await registry.isExchange(spender, { useExternalApi: false })) continue;

        // Filter out calls where spender is a smart contract
        if (await registry.isContract(spender)) continue;

        await fn.log(toAddress, fromAddress, spender, amount, timestamp, blockNumber);
      }
    }

    return [];
  };
}

export default {
  provideInitialize,
  provideHandleBlock,
  provideHandleTransaction,

  initialize: provideInitialize(dependenciesConfig, provider, agentParameters, addressLabels),
  handleBlock: provideHandleBlock(dependenciesConfig),
  handleTransaction: provideHandleTransaction(dependenciesConfig)
};
