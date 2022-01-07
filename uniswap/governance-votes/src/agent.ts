import BigNumber from 'bignumber.js';
import { providers, Contract, utils } from 'ethers';
import { abi as UniTokenAbi } from '@uniswap/governance/build/Uni.json';
import {
  HandleTransaction,
  HandleBlock,
  BlockEvent,
  TransactionEvent,
  Finding,
  getEthersProvider
} from 'forta-agent';
import Findings from './findings';
import { DELEGATE_VOTES_CHANGED_EVENT, PROPOSAL_CREATED_EVENT, VOTE_CAST_EVENT } from './constants';
import { AgentDependenciesConfig } from './types';

// basic configuration variables
import agentConfig from './configs/agent-config.json';

const provider = getEthersProvider();

const dependenciesConfig: AgentDependenciesConfig = {} as AgentDependenciesConfig;

function provideInitialize(
  dependenciesConfig: AgentDependenciesConfig,
  configParameters: typeof agentConfig,
  provider: providers.JsonRpcProvider
) {
  return async function initialize() {
    const {
      everestId,
      protocolName,
      uniTokenAddress,
      governorBravoAddress,
      votesChangeThreshold,
      observableBlocksAfterVoteCast,
      observableBlocksBeforeProposalCreated
    } = configParameters;

    dependenciesConfig.everestId = everestId;
    dependenciesConfig.protocolName = protocolName;
    dependenciesConfig.uniTokenAddress = uniTokenAddress.toLowerCase();
    dependenciesConfig.governorBravoAddress = governorBravoAddress.toLowerCase();
    dependenciesConfig.observableBlocksAfterVoteCast = observableBlocksAfterVoteCast;
    dependenciesConfig.observableBlocksBeforeProposalCreated =
      observableBlocksBeforeProposalCreated;

    // normalize UNI amount
    dependenciesConfig.votesChangeThreshold = new BigNumber(votesChangeThreshold).multipliedBy(
      new BigNumber(10).pow(18)
    );

    const uniTokenIface = new utils.Interface(UniTokenAbi);

    dependenciesConfig.uniToken = new Contract(uniTokenAddress, uniTokenIface, provider);
    dependenciesConfig.store = { proposalsMap: {}, votersMap: {}, votesMap: {} };

    dependenciesConfig.isInitialized = true;
  };
}

function provideHandleBlock(config: AgentDependenciesConfig): HandleBlock {
  return async function handleBlock(blockEvent: BlockEvent) {
    if (!config.isInitialized) throw new Error('Agent dependencies are not initialized');

    const {
      everestId,
      protocolName,
      votesChangeThreshold,
      observableBlocksAfterVoteCast,
      store: { proposalsMap, votersMap, votesMap }
    } = config;

    const findings: Finding[] = [];

    // clear ended proposals
    for (const [proposalId, proposalMeta] of [...Object.entries(proposalsMap)]) {
      // we add observableBlocks since we can use proposal meta
      // to check the latest voters after the proposal has ended
      if (blockEvent.blockNumber > proposalMeta.endBlock + observableBlocksAfterVoteCast) {
        delete proposalsMap[proposalId];
      }
    }

    for (const [voter, voterProposals] of [...Object.entries(votersMap)]) {
      for (const [proposalId, voteCast] of [...Object.entries(voterProposals)]) {
        if (
          // if the proposal has ended
          !proposalsMap[proposalId] ||
          // if the observation period for the current voter has ended
          blockEvent.blockNumber > voteCast.blockNumber + observableBlocksAfterVoteCast
        ) {
          delete voterProposals[proposalId];
          continue;
        }

        const { support, votes } = voteCast;

        const currentVotes = votesMap[voter];
        const delta = currentVotes.minus(votes).negated();

        // check if we break through the threshold
        if (delta.isLessThanOrEqualTo(votesChangeThreshold)) continue;

        findings.push(
          Findings.votesDecreaseAfterVoteCast(
            everestId,
            protocolName,
            proposalId,
            voter,
            currentVotes,
            delta,
            support,
            observableBlocksAfterVoteCast
          )
        );
        // we've pushed an alert so we no longer need to observe this voter/proposer
        delete voterProposals[proposalId];
      }

      // clear data if voter no longer has observable proposals
      if (!Object.values(voterProposals || {}).length) {
        delete votersMap[voter];
        delete votesMap[voter];
      }
    }

    return findings;
  };
}

function provideHandleTransaction(config: AgentDependenciesConfig): HandleTransaction {
  return async function handleTransaction(txEvent: TransactionEvent) {
    if (!config.isInitialized) throw new Error('Agent dependencies are not initialized');

    const {
      uniToken,
      everestId,
      protocolName,
      uniTokenAddress,
      governorBravoAddress,
      votesChangeThreshold,
      observableBlocksBeforeProposalCreated,
      store: { proposalsMap, votersMap, votesMap }
    } = config;

    const findings: Finding[] = [];

    const proposalCreatedLogs = txEvent.filterLog(PROPOSAL_CREATED_EVENT, governorBravoAddress);

    for (const log of proposalCreatedLogs) {
      const { id, proposer, startBlock, endBlock } = log.args;

      proposalsMap[id] = {
        proposer: proposer.toLowerCase(),
        startBlock: Number(startBlock.toString()),
        endBlock: Number(endBlock.toString())
      };
    }

    // To minimize contract calls, we handle all DelegateVotesChanged events
    // that are emitted when a delegate account's vote balance changes.

    const mixedLogs = txEvent.filterLog([VOTE_CAST_EVENT, DELEGATE_VOTES_CHANGED_EVENT]);

    // Since a transaction can have several contract interactions,
    // we need to process the logs sequentially.

    for (const log of mixedLogs) {
      const contractAddress = log.address.toLowerCase();

      if (contractAddress === uniTokenAddress) {
        // ----------------------------------
        // DelegateVotesChanged event
        // ----------------------------------

        const delegate = log.args.delegate.toLowerCase();
        // we only handle accounts that have cast a vote
        if (votersMap[delegate]) {
          votesMap[delegate] = new BigNumber(log.args.newBalance.toHexString());
        }
      } else if (contractAddress === governorBravoAddress) {
        // ----------------------------------
        // VoteCast event
        // ----------------------------------

        const proposalId = log.args.proposalId.toString();
        const votes = new BigNumber(log.args.votes.toHexString());
        const support = Number(log.args.support.toString());
        const voter = log.args.voter.toLowerCase();

        // if the agent is started after the proposal was created
        if (!proposalsMap[proposalId]) continue;

        const proposal = proposalsMap[proposalId];
        // calc the oldest observable block
        const priorBlockNumber = proposal.startBlock - observableBlocksBeforeProposalCreated;
        // get votes in the oldest observable block
        const priorBlockVotes = new BigNumber(
          (await uniToken.getPriorVotes(voter, priorBlockNumber)).toHexString()
        );

        votesMap[voter] = votes;
        votersMap[voter] = votersMap[voter] || {};
        votersMap[voter][proposalId] = {
          blockNumber: txEvent.blockNumber,
          support: support,
          votes: votes
        };

        const delta = votes.minus(priorBlockVotes);

        // check if we break through the threshold
        if (delta.isGreaterThan(votesChangeThreshold)) {
          findings.push(
            Findings.votesIncreaseBeforeProposalCreated(
              everestId,
              protocolName,
              proposalId,
              voter,
              votes,
              delta,
              support,
              observableBlocksBeforeProposalCreated
            )
          );
        }
      }
    }

    return findings;
  };
}

export default {
  provideInitialize,
  provideHandleBlock,
  provideHandleTransaction,

  initialize: provideInitialize(dependenciesConfig, agentConfig, provider),
  handleBlock: provideHandleBlock(dependenciesConfig),
  handleTransaction: provideHandleTransaction(dependenciesConfig)
};
