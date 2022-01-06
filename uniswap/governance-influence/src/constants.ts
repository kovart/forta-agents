export const VOTE_CAST_EVENT =
  'event VoteCast(address indexed voter, uint proposalId, uint8 support, uint votes, string reason)';
export const PROPOSAL_CREATED_EVENT =
  'event ProposalCreated(uint id, address proposer, address[] targets, uint[] values, string[] signatures, bytes[] calldatas, uint startBlock, uint endBlock, string description)';
export const DELEGATE_VOTES_CHANGED_EVENT =
  'event DelegateVotesChanged(address indexed delegate, uint previousBalance, uint newBalance)';
