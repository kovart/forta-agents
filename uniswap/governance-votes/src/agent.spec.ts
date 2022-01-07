import { utils, BigNumber as EthersBigNumber } from 'ethers';
import BigNumber from 'bignumber.js';
import { HandleBlock, HandleTransaction, Log } from 'forta-agent';
import { TestTransactionEvent, TestBlockEvent, createAddress } from 'forta-agent-tools';
import Agent from './agent';
import Findings from './findings';
import { DELEGATE_VOTES_CHANGED_EVENT, PROPOSAL_CREATED_EVENT, VOTE_CAST_EVENT } from './constants';

const { provideHandleBlock, provideHandleTransaction } = Agent;

type MockedDependenciesConfig = {
  everestId: string;
  protocolName: string;
  uniToken: {
    getPriorVotes: jest.Mock;
  };
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
  });

  describe('handleTransaction', () => {
    let txEvent: TestTransactionEvent;
    let handleTransaction: HandleTransaction;

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

    it('returns "Votes Increase" if delta exceeds the threshold', async () => {
      const proposal = {
        id: 1,
        proposer: autoAddress(),
        startBlock: 333,
        endBlock: 444
      };

      const voter = {
        address: autoAddress(),
        oldVotes: EthersBigNumber.from(9),
        newVotes: EthersBigNumber.from(20),
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

      mockDependenciesConfig.votesChangeThreshold = new BigNumber(10);
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
      const voterNewBalance = EthersBigNumber.from(200);

      // make it non-empty
      mockDependenciesConfig.store.votersMap[voter] = { };

      txEvent.receipt.logs.push(
        createLog(DELEGATE_VOTES_CHANGED_EVENT, mockDependenciesConfig.uniTokenAddress, [
          voter,
          100,
          voterNewBalance.toNumber()
        ])
      );

      await handleTransaction(txEvent);

      expect(mockDependenciesConfig.store.votesMap[voter].toString(10)).toStrictEqual(
        voterNewBalance.toString()
      );
    });
  });
});
