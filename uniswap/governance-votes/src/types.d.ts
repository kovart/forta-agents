import BigNumber from 'bignumber.js';
import { Contract } from 'ethers';

export type AgentDependenciesConfig = {
  everestId: string;
  protocolName: string;
  uniToken: Contract;
  uniTokenAddress: string;
  governorBravoAddress: string;
  votesChangeThreshold: BigNumber;
  observableBlocksBeforeProposalCreated: number;
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
  isInitialized: boolean;
};
