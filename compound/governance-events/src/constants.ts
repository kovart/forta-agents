import { Network } from 'forta-agent';

import GoerliConfig from 'compound-config/networks/goerli.json';
import GoerliAbiConfig from 'compound-config/networks/goerli-abi.json';
import MainnetConfig from 'compound-config/networks/mainnet.json';
import MainnetAbiConfig from 'compound-config/networks/mainnet-abi.json';
import RinkebyConfig from 'compound-config/networks/rinkeby.json';
import RinkebyAbiConfig from 'compound-config/networks/rinkeby-abi.json';
import RopstenConfig from 'compound-config/networks/ropsten.json';
import RopstenAbiConfig from 'compound-config/networks/ropsten-abi.json';

export const GovernanceSignature = {
  PROPOSAL_CREATED:
    'ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)',
  VOTE_CAST: 'VoteCast(address,uint256,uint8,uint256,string)',
  PROPOSAL_CANCELED: 'ProposalCanceled(uint256)',
  PROPOSAL_QUEUED: 'ProposalQueued(uint256,uint256)',
  PROPOSAL_EXECUTED: 'ProposalExecuted(uint256)',
  VOTING_DELAY_SET: 'VotingDelaySet(uint256,uint256)',
  VOTING_PERIOD_SET: 'VotingPeriodSet(uint256,uint256)',
  NEW_IMPLEMENTATION: 'NewImplementation(address,address)',
  PROPOSAL_THRESHOLD_SET: 'ProposalThresholdSet(uint256,uint256)',
  NEW_PENDING_ADMIN: 'NewPendingAdmin(address,address)',
  NEW_ADMIN: 'NewAdmin(address,address)'
};

export const CompoundNetworkConfig = {
  [Network.GOERLI]: GoerliConfig,
  [Network.MAINNET]: MainnetConfig,
  [Network.RINKEBY]: RinkebyConfig,
  [Network.ROPSTEN]: RopstenConfig
};

export const CompoundNetworkABI = {
  [Network.GOERLI]: GoerliAbiConfig,
  [Network.MAINNET]: MainnetAbiConfig,
  [Network.RINKEBY]: RinkebyAbiConfig,
  [Network.ROPSTEN]: RopstenAbiConfig
};
