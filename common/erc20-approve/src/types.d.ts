import BigNumber from 'bignumber.js';
import { AllowanceStore } from './utils/store';
import { EthereumAddressRegistry } from './utils/registry';

export type AgentDependenciesConfig = {
  store: AllowanceStore;
  registry: EthereumAddressRegistry;
  callsThreshold: number;
  secondsKeepApprovals: number;
  secondsKeepFindings: number;
  secondsRegistryCache: number;
  isInitialized: boolean;
};

export type AffectedToken = {
  symbol: string;
  address: string;
  amount: BigNumber;
};
