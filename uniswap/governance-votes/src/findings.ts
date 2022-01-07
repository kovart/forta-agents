import BigNumber from 'bignumber.js';
import { Finding, FindingSeverity, FindingType } from 'forta-agent';

function formatSupportValue(support: number) {
  if (support === 0) {
    return 'AGAINST';
  } else if (support === 1) {
    return 'IN FAVOR OF';
  } else if (support === 2) {
    return 'ABSTAIN FROM';
  }

  return 'UNKNOWN FOR';
}

function formatWeiToEther(value: BigNumber) {
  return value.div(new BigNumber(10).pow(18)).toString(10);
}

function votesIncreaseBeforeProposalCreated(
  everestId: string,
  protocolName: string,
  proposalId: string,
  voter: string,
  votes: BigNumber,
  delta: BigNumber,
  support: number,
  observableBlocks: number
) {
  const supportString = formatSupportValue(support);
  const votesInEther = formatWeiToEther(votes);
  const deltaInEther = formatWeiToEther(delta);

  return Finding.fromObject({
    name: `Significant Increase of Voting Power "${supportString}" Proposal #${proposalId}`,
    description:
      `Voter ${voter} who cast ${votesInEther} votes "${supportString}" proposal #${proposalId} ` +
      `had a significant increase of ${deltaInEther} votes in ${observableBlocks} blocks ` +
      `before the proposal was created.`,
    alertId: 'KOVART-UNISWAPV3-VOTES-INCREASE-BEFORE-PROPOSAL-CREATED',
    severity: FindingSeverity.High,
    type: FindingType.Suspicious,
    everestId: everestId,
    protocol: protocolName,
    metadata: {
      voter: voter,
      votes: votes.toString(10),
      delta: delta.toString(10),
      support: support.toString(),
      proposalId: proposalId
    }
  });
}

function votesDecreaseAfterVoteCast(
  everestId: string,
  protocolName: string,
  proposalId: string,
  voter: string,
  votes: BigNumber,
  delta: BigNumber,
  support: number,
  observableBlocks: number
) {
  const supportString = formatSupportValue(support);
  const votesInEther = formatWeiToEther(votes);
  const deltaInEther = formatWeiToEther(delta);

  return Finding.fromObject({
    name: `Significant Decrease of Voting Power After Voting "${supportString}" Proposal #${proposalId}`,
    description:
      `Voter ${voter} who cast ${votesInEther} votes "${supportString}" proposal #${proposalId} ` +
      `had a significant decrease of ${deltaInEther} votes in ${observableBlocks} blocks after the vote is cast.`,
    alertId: 'KOVART-UNISWAPV3-VOTES-DECREASE-AFTER-VOTE-CAST',
    severity: FindingSeverity.High,
    type: FindingType.Suspicious,
    everestId: everestId,
    protocol: protocolName,
    metadata: {
      voter: voter,
      votes: votes.toString(10),
      delta: delta.toString(10),
      support: support.toString(),
      proposalId: proposalId
    }
  });
}

const Findings = {
  votesIncreaseBeforeProposalCreated,
  votesDecreaseAfterVoteCast
};

export default Findings;
