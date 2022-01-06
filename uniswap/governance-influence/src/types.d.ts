import BigNumber from 'bignumber.js';
import { providers, Contract } from 'ethers';

export type AgentDependenciesConfig = {
  uniToken: Contract;
  uniTokenAddress: string;
  governorBravoAddress: string;
  votesChangeThreshold: BigNumber;
  observableBlocksBeforeProposal: number;
  observableBlocksAfterVoteCast: number;
  store: {
    proposalsMap: {
      [proposalId: string]: {
        proposer: string;
        startBlock: number;
        endBlock: number;
      };
    };
    votersMap: {
      [voter: string]: {
        [proposalId: string]: {
          support: number;
          votes: BigNumber;
          blockNumber: number;
        };
      };
    };
    votesMap: {
      [voter: string]: BigNumber; // current votes balance
    };
  };
  provider: providers.JsonRpcProvider;
  isInitialized: boolean;
};
