import BigNumber from 'bignumber.js';
import { HandleBlock, HandleTransaction, Log } from 'forta-agent';
import { TestTransactionEvent, TestBlockEvent, createAddress } from 'forta-agent-tools';
import { DELEGATE_VOTES_CHANGED_EVENT, PROPOSAL_CREATED_EVENT, VOTE_CAST_EVENT } from './constants';
import { AgentDependenciesConfig } from './types';
import Agent from './agent';
import Findings from './findings';

type MockedDependenciesConfig = AgentDependenciesConfig & {
  uniToken: {
    getPriorVotes: jest.Mock;
  };
};

let mockEthers: any;

jest.mock('ethers', () => {
  const originalModule = jest.requireActual('ethers');

  mockEthers = {
    utils: { Interface: jest.fn() },
    providers: { JsonRpcProvider: jest.fn() },
    Contract: jest.fn()
  };

  return {
    __esModule: true,
    ...originalModule,
    ...mockEthers
  };
});

const { provideInitialize, provideHandleBlock, provideHandleTransaction } = Agent;

describe('uniswap governance votes agent', () => {
  let mockDependenciesConfig: MockedDependenciesConfig;

  const createMockDependencyConfig = (config?: any): MockedDependenciesConfig => ({
    everestId: '0xa2e07f422b5d7cbbfca764e53b251484ecf945fa',
    protocolName: 'Uniswap V3',
    votesChangeThreshold: 10000,
    observableBlocksBeforeProposalCreated: 3,
    observableBlocksAfterVoteCast: 3,
    uniTokenAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'.toLowerCase(),
    governorBravoAddress: '0x408ED6354d4973f66138C91495F2f2FCbd8724C3'.toLowerCase(),
    store: { proposalsMap: {}, votersMap: {}, votesMap: {} },
    uniToken: {
      getPriorVotes: jest.fn()
    },
    isInitialized: true,
    ...config
  });

  const autoAddress: () => string = (() => {
    let index = 1;
    return () => createAddress('0x' + index++);
  })();

  beforeEach(() => {
    mockDependenciesConfig = createMockDependencyConfig();
  });

  describe('initialize', () => {
    it('mutates dependencies config', async () => {
      const config = {} as any;
      const params = {
        everestId: '0xa2e07f422b5d7cbbfca764e53b251484ecf945fa',
        protocolName: 'Uniswap V3',
        votesChangeThreshold: 10000,
        observableBlocksAfterVoteCast: 100,
        observableBlocksBeforeProposalCreated: 100,
        uniTokenAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
        governorBravoAddress: '0x408ED6354d4973f66138C91495F2f2FCbd8724C3'
      };

      const mockProvider = {};
      const mockUniTokenIface = {};
      const mockUniTokenContract = {};

      mockEthers.utils.Interface.mockReturnValue(mockUniTokenIface);
      mockEthers.Contract.mockReturnValue(mockUniTokenContract);

      const initialize = provideInitialize(config, params, mockProvider as any);

      await initialize();

      expect(config).toMatchObject({
        ...params,
        uniTokenAddress: params.uniTokenAddress.toLowerCase(),
        governorBravoAddress: params.governorBravoAddress.toLowerCase(),
        votesChangeThreshold: new BigNumber(params.votesChangeThreshold).multipliedBy(
          new BigNumber(10).pow(18)
        )
      });
      expect(config.store).toStrictEqual({ proposalsMap: {}, votersMap: {}, votesMap: {} });
      expect(mockEthers.utils.Interface).toHaveBeenCalledTimes(1);
      expect(mockEthers.Contract).toHaveBeenNthCalledWith(
        1,
        params.uniTokenAddress,
        mockUniTokenIface,
        mockProvider
      );
      expect(config.uniToken).toStrictEqual(mockUniTokenContract);
    });
  });

  describe('handleBlock', () => {
    let blockEvent: TestBlockEvent;
    let handleBlock: HandleBlock;

    beforeEach(() => {
      blockEvent = new TestBlockEvent();
      handleBlock = provideHandleBlock(mockDependenciesConfig as any);
    });

    it('throws error on non-initialized dependencies config', async () => {
      mockDependenciesConfig.isInitialized = false;

      await expect(handleBlock(blockEvent)).rejects.toThrow();
    });

    it("returns empty findings if delta doesn't exceed the threshold", async () => {
      const proposal = {
        id: '1',
        proposer: autoAddress(),
        startBlock: 333,
        endBlock: 444
      };

      const voter = {
        address: autoAddress(),
        oldVotes: new BigNumber(11),
        newVotes: new BigNumber(1)
      };

      mockDependenciesConfig.votesChangeThreshold = new BigNumber(10);
      mockDependenciesConfig.store.proposalsMap[proposal.id] = proposal;
      mockDependenciesConfig.store.votesMap[voter.address] = voter.newVotes;
      mockDependenciesConfig.store.votersMap[voter.address] = {
        [proposal.id]: { votes: voter.oldVotes, support: 1, blockNumber: proposal.startBlock }
      };

      const findings = await handleBlock(blockEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if voter observable period is over', async () => {
      const proposal = {
        id: '1',
        proposer: autoAddress(),
        startBlock: 333,
        endBlock: 444
      };

      const voter = {
        address: autoAddress(),
        oldVotes: new BigNumber(12),
        newVotes: new BigNumber(1),
        blockNumber: proposal.startBlock + 1,
        support: 1
      };

      mockDependenciesConfig.votesChangeThreshold = new BigNumber(10);
      mockDependenciesConfig.store.proposalsMap[proposal.id] = proposal;
      mockDependenciesConfig.store.votesMap[voter.address] = voter.newVotes;
      mockDependenciesConfig.store.votersMap[voter.address] = {
        [proposal.id]: {
          votes: voter.oldVotes,
          support: voter.support,
          blockNumber: proposal.startBlock
        }
      };

      blockEvent.setNumber(
        voter.blockNumber + mockDependenciesConfig.observableBlocksAfterVoteCast
      );

      const findings = await handleBlock(blockEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns "Votes Decrease" finding if delta exceeds the threshold and voter ', async () => {
      const proposal = {
        id: '1',
        proposer: autoAddress(),
        startBlock: 333,
        endBlock: 444
      };

      const voter = {
        address: autoAddress(),
        oldVotes: new BigNumber(12),
        newVotes: new BigNumber(1),
        blockNumber: proposal.startBlock + 1,
        support: 1
      };

      mockDependenciesConfig.votesChangeThreshold = new BigNumber(10);
      mockDependenciesConfig.store.proposalsMap[proposal.id] = proposal;
      mockDependenciesConfig.store.votesMap[voter.address] = voter.newVotes;
      mockDependenciesConfig.store.votersMap[voter.address] = {
        [proposal.id]: {
          votes: voter.oldVotes,
          support: voter.support,
          blockNumber: proposal.startBlock
        }
      };

      blockEvent.setNumber(voter.blockNumber + 1);

      const findings = await handleBlock(blockEvent);

      const finding = Findings.votesDecreaseAfterVoteCast(
        mockDependenciesConfig.everestId,
        mockDependenciesConfig.protocolName,
        proposal.id,
        voter.address,
        voter.newVotes,
        voter.oldVotes.minus(voter.newVotes),
        voter.support,
        mockDependenciesConfig.observableBlocksAfterVoteCast
      );

      expect(findings).toStrictEqual([finding]);
    });

    it('returns "Votes Decrease" finding but then empty findings for the same voter', async () => {
      const proposal = {
        id: '1',
        proposer: autoAddress(),
        startBlock: 333,
        endBlock: 444
      };

      const voter = {
        address: autoAddress(),
        oldVotes: new BigNumber(12),
        newVotes: new BigNumber(1),
        blockNumber: proposal.startBlock + 1,
        support: 1
      };

      mockDependenciesConfig.votesChangeThreshold = new BigNumber(10);
      mockDependenciesConfig.store.proposalsMap[proposal.id] = proposal;
      mockDependenciesConfig.store.votesMap[voter.address] = voter.newVotes;
      mockDependenciesConfig.store.votersMap[voter.address] = {
        [proposal.id]: {
          votes: voter.oldVotes,
          support: voter.support,
          blockNumber: proposal.startBlock
        }
      };

      blockEvent.setNumber(voter.blockNumber + 1);

      let findings = await handleBlock(blockEvent);

      const finding = Findings.votesDecreaseAfterVoteCast(
        mockDependenciesConfig.everestId,
        mockDependenciesConfig.protocolName,
        proposal.id,
        voter.address,
        voter.newVotes,
        voter.oldVotes.minus(voter.newVotes),
        voter.support,
        mockDependenciesConfig.observableBlocksAfterVoteCast
      );

      expect(findings).toStrictEqual([finding]);

      blockEvent.setNumber(voter.blockNumber + 2);

      findings = await handleBlock(blockEvent);

      expect(findings).toStrictEqual([]);
    });

    it('clears expired data', async () => {
      const createUserStory = (voter: string, proposal: any, blockNumber: number) => ({
        voter: voter,
        proposal: proposal,
        voteCast: {
          votes: new BigNumber(1),
          blockNumber: blockNumber,
          support: 0
        }
      });

      const observableBlocksAfterVoteCast = 10;
      const { votersMap, votesMap, proposalsMap } = mockDependenciesConfig.store;

      mockDependenciesConfig.observableBlocksAfterVoteCast = observableBlocksAfterVoteCast;

      const proposal1 = {
        id: 1,
        proposer: autoAddress(),
        startBlock: 100,
        endBlock: 200
      };
      const proposal2 = {
        id: 2,
        proposer: autoAddress(),
        startBlock: 200,
        endBlock: 300
      };
      const proposal3 = {
        id: 3,
        proposer: autoAddress(),
        startBlock: 300,
        endBlock: 400
      };

      proposalsMap[proposal1.id] = proposal1;
      proposalsMap[proposal2.id] = proposal2;
      proposalsMap[proposal3.id] = proposal3;

      const [voter1, voter2, voter3] = [autoAddress(), autoAddress(), autoAddress()];

      const userStories = [
        createUserStory(voter1, proposal1, proposal1.startBlock + 1),
        createUserStory(voter1, proposal2, proposal2.startBlock + 1),
        createUserStory(voter2, proposal2, proposal2.endBlock - 1),
        createUserStory(voter3, proposal3, proposal3.startBlock + 1)
      ];

      for (const story of userStories) {
        votesMap[story.voter] = story.voteCast.votes;
        votersMap[story.voter] = votersMap[story.voter] || {};
        votersMap[story.voter][story.proposal.id] = story.voteCast;
      }

      // ----------------------------------

      blockEvent.setNumber(proposal1.startBlock + 2);

      await handleBlock(blockEvent);

      expect(Object.keys(votersMap)).toHaveLength(3);
      expect(Object.keys(votersMap)).toEqual(expect.arrayContaining([voter1, voter2, voter3]));
      expect(Object.keys(votesMap)).toHaveLength(3);
      expect(Object.keys(votesMap)).toEqual(expect.arrayContaining([voter1, voter2, voter3]));
      expect(Object.keys(proposalsMap)).toHaveLength(3);
      expect(Object.keys(proposalsMap)).toEqual(
        expect.arrayContaining([proposal1.id, proposal2.id, proposal3.id].map((v) => v.toString()))
      );

      // ----------------------------------

      blockEvent.setNumber(proposal1.endBlock + observableBlocksAfterVoteCast + 1);

      await handleBlock(blockEvent);

      expect(Object.keys(proposalsMap)).toHaveLength(2);
      expect(Object.keys(proposalsMap)).toEqual(
        expect.arrayContaining([proposal2.id, proposal3.id].map((v) => v.toString()))
      );

      // ----------------------------------

      blockEvent.setNumber(proposal2.endBlock + observableBlocksAfterVoteCast + 1);

      await handleBlock(blockEvent);

      expect(Object.keys(votersMap)).toHaveLength(1);
      expect(Object.keys(votersMap)).toEqual(expect.arrayContaining([voter3]));
      expect(Object.keys(votesMap)).toHaveLength(1);
      expect(Object.keys(votesMap)).toEqual(expect.arrayContaining([voter3]));
      expect(Object.keys(proposalsMap)).toHaveLength(1);
      expect(Object.keys(proposalsMap)).toEqual(
        expect.arrayContaining([proposal3.id].map((v) => v.toString()))
      );

      // ----------------------------------

      blockEvent.setNumber(proposal3.endBlock + observableBlocksAfterVoteCast + 1);

      await handleBlock(blockEvent);

      expect(Object.keys(votersMap)).toHaveLength(0);
      expect(Object.keys(votesMap)).toHaveLength(0);
      expect(Object.keys(proposalsMap)).toHaveLength(0);
    });
  });

  describe('handleTransaction', () => {
    let txEvent: TestTransactionEvent;
    let handleTransaction: HandleTransaction;

    const { utils, BigNumber: EthersBigNumber } = jest.requireActual('ethers');

    const createLog = (abi: string, address: string, data: ReadonlyArray<any>): Log => {
      const iface = new utils.Interface([abi]);
      const fragment = Object.values(iface.events)[0];

      return {
        ...iface.encodeEventLog(fragment, data),
        address: address
      } as Log;
    };

    beforeEach(() => {
      txEvent = new TestTransactionEvent();
      handleTransaction = provideHandleTransaction(mockDependenciesConfig as any);
    });

    it('throws error on non-initialized dependencies config', async () => {
      mockDependenciesConfig.isInitialized = false;

      await expect(handleTransaction(txEvent)).rejects.toThrow();
    });

    it('returns empty findings if there are no observable logs', async () => {
      txEvent.receipt.logs.push(
        createLog('event RandomEvent(address voter)', mockDependenciesConfig.uniTokenAddress, [
          autoAddress()
        ])
      );
      txEvent.receipt.logs.push(
        createLog(
          'event Event2(uint256 val1, address val2)',
          mockDependenciesConfig.governorBravoAddress,
          [1, autoAddress()]
        )
      );

      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([]);
    });

    it("returns empty findings if delta doesn't exceed the threshold", async () => {
      const proposal = {
        id: 1,
        proposer: autoAddress(),
        startBlock: 333,
        endBlock: 444
      };

      const voter = {
        address: autoAddress(),
        oldVotes: EthersBigNumber.from(2),
        newVotes: EthersBigNumber.from(10),
        blockNumber: proposal.startBlock + 1,
        support: 1
      };

      txEvent.receipt.logs.push(
        createLog(PROPOSAL_CREATED_EVENT, mockDependenciesConfig.governorBravoAddress, [
          5555,
          autoAddress(),
          [],
          [],
          [],
          [],
          1,
          1,
          ''
        ])
      );

      txEvent.receipt.logs.push(
        createLog(VOTE_CAST_EVENT, mockDependenciesConfig.governorBravoAddress, [
          voter.address,
          proposal.id,
          voter.support,
          voter.newVotes,
          ''
        ])
      );

      mockDependenciesConfig.votesChangeThreshold = new BigNumber(10);
      mockDependenciesConfig.uniToken.getPriorVotes.mockResolvedValue(voter.oldVotes);
      txEvent.setBlock(proposal.startBlock + 1);

      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns "Votes Increase" finding if delta exceeds the threshold', async () => {
      const threshold = 10;

      const proposal = {
        id: 1,
        proposer: autoAddress(),
        startBlock: 111,
        endBlock: 222
      };

      const voter = {
        address: autoAddress(),
        oldVotes: EthersBigNumber.from(0),
        newVotes: EthersBigNumber.from(threshold + 1),
        blockNumber: proposal.startBlock + 1,
        support: 1
      };

      txEvent.receipt.logs.push(
        createLog(PROPOSAL_CREATED_EVENT, mockDependenciesConfig.governorBravoAddress, [
          proposal.id,
          autoAddress(),
          [],
          [],
          [],
          [],
          0,
          0,
          ''
        ])
      );

      txEvent.receipt.logs.push(
        createLog(VOTE_CAST_EVENT, mockDependenciesConfig.governorBravoAddress, [
          voter.address,
          proposal.id,
          voter.support,
          voter.newVotes,
          ''
        ])
      );

      mockDependenciesConfig.votesChangeThreshold = new BigNumber(threshold);
      mockDependenciesConfig.uniToken.getPriorVotes.mockResolvedValue(voter.oldVotes);
      txEvent.setBlock(proposal.startBlock + 1);

      const findings = await handleTransaction(txEvent);

      const finding = Findings.votesIncreaseBeforeProposalCreated(
        mockDependenciesConfig.everestId,
        mockDependenciesConfig.protocolName,
        proposal.id.toString(),
        voter.address,
        new BigNumber(voter.newVotes.toString()),
        new BigNumber(voter.newVotes.toString()).minus(voter.oldVotes.toString()),
        voter.support,
        mockDependenciesConfig.observableBlocksBeforeProposalCreated
      );

      expect(findings).toStrictEqual([finding]);
    });

    it('updates account votes on DelegateVotesChanged event', async () => {
      const voter = autoAddress();
      const newBalance = EthersBigNumber.from(200);

      // make it non-empty
      mockDependenciesConfig.store.votersMap[voter] = {};

      txEvent.receipt.logs.push(
        createLog(DELEGATE_VOTES_CHANGED_EVENT, mockDependenciesConfig.uniTokenAddress, [
          voter,
          100,
          newBalance.toNumber()
        ])
      );

      await handleTransaction(txEvent);

      expect(mockDependenciesConfig.store.votesMap[voter].toString(10)).toStrictEqual(
        newBalance.toString()
      );
    });
  });
});
