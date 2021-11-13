import AaveGovernanceV2 from '@aave/governance-v2/artifacts/contracts/governance/AaveGovernanceV2.sol/AaveGovernanceV2.json';

// https://docs.aave.com/developers/protocol-governance/governance#deployed-contracts
export const AAVE_GOVERNANCE_ADDRESS = '0xEC568fffba86c094cf06b22134B23074DFE2252c';

export const AAVE_GOVERNANCE_ABI = AaveGovernanceV2.abi;

// https://github.com/aave/governance-v2/blob/master/contracts/interfaces/IAaveGovernanceV2.sol#L104
export const PROPOSAL_EXECUTED_EVENT_ABI =
  'event ProposalExecuted(uint256 id, address indexed initiatorExecution)';

export const PROPOSAL_EXECUTED_EVENT_SIGNATURE = 'ProposalExecuted(uint256, address)';

export const IPFS_ENDPOINT = 'https://cloudflare-ipfs.com/ipfs';
