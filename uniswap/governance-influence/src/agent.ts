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
      uniTokenAddress,
      governorBravoAddress,
      votesChangeThreshold,
      observableBlocksBeforeProposal,
      observableBlocksAfterVoteCast
    } = configParameters;

    dependenciesConfig.uniTokenAddress = uniTokenAddress;
    dependenciesConfig.governorBravoAddress = governorBravoAddress;
    dependenciesConfig.observableBlocksBeforeProposal = observableBlocksBeforeProposal;
    dependenciesConfig.observableBlocksAfterVoteCast = observableBlocksAfterVoteCast;

    // normalize UNI amount (ether -> wei)
    dependenciesConfig.votesChangeThreshold = new BigNumber(votesChangeThreshold).multipliedBy(
      new BigNumber(10).pow(18)
    );

    const uniTokenIface = new utils.Interface(UniTokenAbi);

    dependenciesConfig.provider = provider;
    dependenciesConfig.uniToken = new Contract(uniTokenAddress, uniTokenIface, provider);
    dependenciesConfig.store = { proposalsMap: {}, votersMap: {}, votesMap: {} };

    dependenciesConfig.isInitialized = true;
  };
}

function provideHandleBlock(config: AgentDependenciesConfig): HandleBlock {
  return async function handleBlock(blockEvent: BlockEvent) {
    if (!config.isInitialized) throw new Error('Agent dependencies are not initialized');

    console.log('handleBlock');

    const {
      uniToken,
      votesChangeThreshold,
      observableBlocksAfterVoteCast,
      store: { proposalsMap, votersMap }
    } = config;

    const findings: Finding[] = [];

    // clear ended proposals
    for (const [proposalId, proposalMeta] of [...Object.entries(proposalsMap)]) {
      if (proposalMeta.endBlock > blockEvent.blockNumber) {
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
        } else {
          // unlike monitoring changes before a proposal is created,
          // we get votes for every observable block since immediate findings can help prevent attacks
          const currentVotes = new BigNumber(
            (await uniToken.getPriorVotes(voter, blockEvent.blockNumber)).toHexString()
          );

          const delta = currentVotes.minus(voteCast.votes);

          // check if we break through the threshold
          if (delta.negated().isLessThanOrEqualTo(votesChangeThreshold)) continue;

          if (currentVotes.isZero()) {
            findings.push(Findings.zeroVotesAfterVoteCast());
          } else {
            findings.push(Findings.votesDecreaseAfterVoteCast());
          }

          // we've pushed an alert so we no longer need to observe this voter
          delete voterProposals[proposalId];
        }
      }

      // clear empty voters
      if (!Object.values(voterProposals || {}).length) {
        delete votersMap[voter];
      }
    }

    return findings;
  };
}

function provideHandleTransaction(config: AgentDependenciesConfig): HandleTransaction {
  return async function handleTransaction(txEvent: TransactionEvent) {
    if (!config.isInitialized) throw new Error('Agent dependencies are not initialized');

    console.log('handleTransaction');

    const {
      uniToken,
      uniTokenAddress,
      governorBravoAddress,
      votesChangeThreshold,
      observableBlocksBeforeProposal,
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

      console.log(id, typeof id, { [id]: id }, endBlock);
    }

    // To minimize contract calls, we handle all DelegateVotesChanged events
    // that are emitted when a delegate account's vote balance changes.

    const mixedLogs = txEvent.filterLog([VOTE_CAST_EVENT, DELEGATE_VOTES_CHANGED_EVENT]);

    // Since a transaction can have several contract interactions,
    // we need to process the logs sequentially.

    for (const log of mixedLogs) {
      if (log.address === uniTokenAddress) {
        // ----------------------------------
        // DelegateVotesChanged event
        // ----------------------------------

        const delegate = log.args.delegate.toLowerCase();
        // we only handle accounts that have cast a vote
        if (votersMap[delegate]) {
          votesMap[delegate] = new BigNumber(log.args.newBalance.toHexString());
        }
      } else if (log.address === governorBravoAddress) {
        // ----------------------------------
        // VoteCast event
        // ----------------------------------

        const { voter, proposalId, support, votes } = log.args;

        // if the agent is started after the proposal was created
        if (!proposalsMap[proposalId]) continue;

        const proposal = proposalsMap[proposalId];
        // GovernorBravo counts votes in a block when the proposal was created
        const proposalBlockVotes = new BigNumber(votes.toHexString());
        // calc the oldest observable block
        const priorBlockNumber = proposal.startBlock - observableBlocksBeforeProposal;
        // get votes in the oldest observable block
        const priorBlockVotes = new BigNumber(
          (await uniToken.getPriorVotes(voter, priorBlockNumber)).toHexString()
        );

        votesMap[voter] = votes;
        votersMap[voter] = votersMap[voter] || {};
        votersMap[voter][proposalId] = {
          blockNumber: txEvent.blockNumber,
          support: Number(support.toString()),
          votes: proposalBlockVotes
        };

        const delta = proposalBlockVotes.minus(priorBlockVotes);

        // check if we break through the threshold
        if (delta.isLessThanOrEqualTo(votesChangeThreshold)) continue;

        if (priorBlockVotes.isZero()) {
          findings.push(Findings.zeroVotesBeforeProposal());
        } else {
          const relativeChange = delta.div(priorBlockVotes);
          findings.push(Findings.votesIncreaseBeforeProposal());
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
