import { Network } from 'forta-agent';

import GoerliConfig from './config/goerli.json';
import GoerliAbiConfig from './config/goerli-abi.json';
import MainnetConfig from './config/mainnet.json';
import MainnetAbiConfig from './config/mainnet-abi.json';
import RinkebyConfig from './config/rinkeby.json';
import RinkebyAbiConfig from './config/rinkeby-abi.json';
import RopstenConfig from './config/ropsten.json';
import RopstenAbiConfig from './config/ropsten-abi.json';

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
