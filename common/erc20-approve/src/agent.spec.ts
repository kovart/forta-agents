import BigNumber from 'bignumber.js';
import { utils } from 'ethers';
import { HandleBlock, HandleTransaction } from 'forta-agent';
import { createAddress, TestBlockEvent, TestTransactionEvent, TraceProps } from 'forta-agent-tools';
import { AllowanceStore } from './utils/store';
import { AgentDependenciesConfig } from './types';
import { EthereumAddressRegistry } from './utils/registry';
import { ERC20_APPROVE_FUNCTION, ERC20_INCREASE_ALLOWANCE_FUNCTION } from './constants';
import { createPhishingFinding } from './findings';

import Agent from './agent';

const { provideInitialize, provideHandleTransaction, provideHandleBlock } = Agent;

type MockedDependenciesConfig = {
  secondsKeepApprovals: number;
  secondsKeepFindings: number;
  secondsRegistryCache: number;
  callsThreshold: number;
  isInitialized: boolean;
  registry: {
    isContract: jest.Mock;
    isExchange: jest.Mock;
    clearOutdatedCache: jest.Mock;
  };
  store: {
    getSpenderSummaries: jest.Mock;
    clearOutdatedData: jest.Mock;
    increaseAllowance: jest.Mock;
    approve: jest.Mock;
  };
};

describe('erc20 approval phishing agent', () => {
  let mockDependenciesConfig: MockedDependenciesConfig;

  const createMockDependenciesConfig = (config?: any): MockedDependenciesConfig => {
    return {
      callsThreshold: 3,
      secondsKeepApprovals: 300,
      secondsKeepFindings: 600,
      secondsRegistryCache: 900,
      isInitialized: true,
      store: {
        approve: jest.fn(),
        increaseAllowance: jest.fn(),
        getSpenderSummaries: jest.fn(),
        clearOutdatedData: jest.fn()
      },
      registry: {
        isContract: jest.fn(),
        isExchange: jest.fn(),
        clearOutdatedCache: jest.fn()
      },
      ...config
    };
  };

  beforeEach(() => {
    mockDependenciesConfig = createMockDependenciesConfig();
  });

  describe('initialize', () => {
    it('should mutate dependencies config', async () => {
      const dependenciesConfig: AgentDependenciesConfig = {} as any;
      const provider: any = {};
      const parameters = {
        callsThreshold: 9,
        secondsKeepApprovals: 21600,
        secondsKeepFindings: 604800,
        secondsRegistryCache: 2678400
      };
      const labels = [
        {
          label: 'Coinbase 1',
          address: '0x71660c4005ba85c37ccec55d0c4493e66fe775d3',
          type: 'Exchange'
        },
        {
          label: 'Coinbase 2',
          address: '0x503828976d22510aad0201ac7ec88293211d23da',
          type: 'Exchange'
        }
      ];

      const initialize = provideInitialize(dependenciesConfig as any, provider, parameters, labels);

      await initialize();

      expect(dependenciesConfig).toMatchObject({
        callsThreshold: 9,
        secondsKeepApprovals: 21600,
        secondsKeepFindings: 604800,
        secondsRegistryCache: 2678400,
        isInitialized: true
      });

      expect(dependenciesConfig.store).toBeInstanceOf(AllowanceStore);
      expect(dependenciesConfig.registry).toBeInstanceOf(EthereumAddressRegistry);
    });
  });

  describe('handleTransaction', () => {
    let txEvent: TestTransactionEvent;
    let handleTransaction: HandleTransaction;

    const createTrace = (abi: string, data: ReadonlyArray<any> = [], to: string): TraceProps => {
      const iface = new utils.Interface([abi]);
      const fragment = Object.values(iface.functions)[0];

      return {
        to: to,
        input: iface.encodeFunctionData(fragment, data)
      };
    };

    beforeEach(() => {
      txEvent = new TestTransactionEvent();
      handleTransaction = provideHandleTransaction(mockDependenciesConfig as any);
    });

    it('should throw error on non-initialized dependencies config', async () => {
      mockDependenciesConfig.isInitialized = false;

      const handleTransaction = provideHandleTransaction(mockDependenciesConfig as any);

      await expect(handleTransaction(txEvent)).rejects.toThrow();
    });

    it('should ignore failed transaction', async () => {
      txEvent.setStatus(false);

      await handleTransaction(txEvent);

      expect(mockDependenciesConfig.registry.isContract).toHaveBeenCalledTimes(0);
      expect(mockDependenciesConfig.registry.isExchange).toHaveBeenCalledTimes(0);
      expect(mockDependenciesConfig.store.approve).toHaveBeenCalledTimes(0);
      expect(mockDependenciesConfig.store.increaseAllowance).toHaveBeenCalledTimes(0);
    });

    it('should ignore empty "to" address', async () => {
      txEvent.setTo('');

      await handleTransaction(txEvent);

      expect(mockDependenciesConfig.registry.isContract).toHaveBeenCalledTimes(0);
      expect(mockDependenciesConfig.registry.isExchange).toHaveBeenCalledTimes(0);
      expect(mockDependenciesConfig.store.approve).toHaveBeenCalledTimes(0);
      expect(mockDependenciesConfig.store.increaseAllowance).toHaveBeenCalledTimes(0);
    });

    it('should ignore zero amount approvals', async () => {
      txEvent.addTraces(
        createTrace(ERC20_APPROVE_FUNCTION, [createAddress('0x1'), 0], createAddress('0x2'))
      );

      await handleTransaction(txEvent);

      expect(mockDependenciesConfig.store.approve).toHaveBeenCalledTimes(0);
      expect(mockDependenciesConfig.store.increaseAllowance).toHaveBeenCalledTimes(0);
    });

    it('should ignore exchange addresses', async () => {
      mockDependenciesConfig.registry.isContract.mockResolvedValue(false);
      mockDependenciesConfig.registry.isExchange.mockResolvedValueOnce(true);

      txEvent.addTraces(
        createTrace(ERC20_APPROVE_FUNCTION, [createAddress('0x1'), 100], createAddress('0x2'))
      );

      await handleTransaction(txEvent);

      expect(mockDependenciesConfig.registry.isExchange).toHaveBeenCalledTimes(1);
      expect(mockDependenciesConfig.store.approve).toHaveBeenCalledTimes(0);
      expect(mockDependenciesConfig.store.increaseAllowance).toHaveBeenCalledTimes(0);
    });

    it('should ignore contract addresses', async () => {
      const contractAddress = createAddress('0x1');

      txEvent.setFrom(contractAddress);

      mockDependenciesConfig.registry.isContract.mockImplementation(
        (address: string) => address === contractAddress
      );

      await handleTransaction(txEvent);

      expect(mockDependenciesConfig.registry.isContract).toHaveBeenCalledTimes(1);
      expect(mockDependenciesConfig.registry.isExchange).toHaveBeenCalledTimes(0);
      expect(mockDependenciesConfig.store.approve).toHaveBeenCalledTimes(0);
      expect(mockDependenciesConfig.store.increaseAllowance).toHaveBeenCalledTimes(0);

      // ----------------

      mockDependenciesConfig.registry.isContract.mockClear();

      txEvent.setFrom(createAddress('0x1'));
      txEvent.addTraces(
        createTrace(
          ERC20_APPROVE_FUNCTION,
          [createAddress('0x2'), 100],
          createAddress(contractAddress)
        )
      );

      await handleTransaction(txEvent);

      expect(mockDependenciesConfig.store.approve).toHaveBeenCalledTimes(0);
      expect(mockDependenciesConfig.store.increaseAllowance).toHaveBeenCalledTimes(0);
    });

    it('should log approve() function', async () => {
      txEvent.addTraces(
        createTrace(ERC20_APPROVE_FUNCTION, [createAddress('0x1'), 100], createAddress('0x2'))
      );

      await handleTransaction(txEvent);

      expect(mockDependenciesConfig.registry.isContract).toHaveBeenCalledTimes(2);
      expect(mockDependenciesConfig.registry.isExchange).toHaveBeenCalledTimes(1);
      expect(mockDependenciesConfig.store.approve).toHaveBeenCalledTimes(1);
      expect(mockDependenciesConfig.store.increaseAllowance).toHaveBeenCalledTimes(0);
    });

    it('should log increaseAllowance() function', async () => {
      txEvent.addTraces(
        createTrace(
          ERC20_INCREASE_ALLOWANCE_FUNCTION,
          [createAddress('0x1'), 100],
          createAddress('0x2')
        )
      );

      await handleTransaction(txEvent);

      expect(mockDependenciesConfig.registry.isContract).toHaveBeenCalledTimes(2);
      expect(mockDependenciesConfig.registry.isExchange).toHaveBeenCalledTimes(1);
      expect(mockDependenciesConfig.store.approve).toHaveBeenCalledTimes(0);
      expect(mockDependenciesConfig.store.increaseAllowance).toHaveBeenCalledTimes(1);
    });

    it('should log multiple approval functions', async () => {
      txEvent.addTraces(
        createTrace(ERC20_APPROVE_FUNCTION, [createAddress('0x1'), 100], createAddress('0x2'))
      );
      txEvent.addTraces(
        createTrace(
          ERC20_INCREASE_ALLOWANCE_FUNCTION,
          [createAddress('0x3'), 100],
          createAddress('0x4')
        )
      );

      await handleTransaction(txEvent);

      expect(mockDependenciesConfig.registry.isContract).toHaveBeenCalledTimes(3);
      expect(mockDependenciesConfig.registry.isExchange).toHaveBeenCalledTimes(2);
      expect(mockDependenciesConfig.store.approve).toHaveBeenCalledTimes(1);
      expect(mockDependenciesConfig.store.increaseAllowance).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleBlock', () => {
    let handleBlock: HandleBlock;
    let txBlock: TestBlockEvent;

    beforeEach(() => {
      txBlock = new TestBlockEvent();
      handleBlock = provideHandleBlock(mockDependenciesConfig as any);
    });

    it('should throw error on non-initialized dependencies config', async () => {
      mockDependenciesConfig.isInitialized = false;

      await expect(handleBlock(txBlock)).rejects.toThrow();
    });

    it("should return empty findings if number of approvals doesn't exceed threshold", async () => {
      mockDependenciesConfig.callsThreshold = 3;
      mockDependenciesConfig.registry.isExchange.mockResolvedValue(false);
      mockDependenciesConfig.store.getSpenderSummaries.mockReturnValue([
        {
          address: createAddress('0x1'),
          owners: [createAddress('0x2')],
          amounts: { [createAddress('0x2')]: new BigNumber(100) },
          tokens: [],
          approvalsCount: 3
        },
        {
          address: createAddress('0x1'),
          owners: [createAddress('0x2')],
          amounts: { [createAddress('0x2')]: new BigNumber(100) },
          tokens: [],
          approvalsCount: 1
        }
      ]);

      const findings = await handleBlock(txBlock);

      expect(findings).toStrictEqual([]);
    });

    it('should clear store data with correct minTimestamp', async () => {
      mockDependenciesConfig.secondsKeepApprovals = 100;
      mockDependenciesConfig.store.getSpenderSummaries.mockImplementation(() => []);

      txBlock.setTimestamp(100);

      await handleBlock(txBlock);

      expect(mockDependenciesConfig.store.clearOutdatedData).toBeCalledWith(0, []);
    });

    it('should return finding if number of approvals exceeds threshold', async () => {
      const spender = createAddress('0x1');
      const owner1 = createAddress('0x2');
      const owner2 = createAddress('0x3');
      const token = createAddress('0x4');
      const tokenSymbol = 'TKN';
      const amount = new BigNumber(100);
      const approvals = 4;

      mockDependenciesConfig.callsThreshold = approvals - 1;
      mockDependenciesConfig.registry.isExchange.mockResolvedValue(false);
      mockDependenciesConfig.store.getSpenderSummaries.mockReturnValue([
        {
          address: spender,
          owners: [owner1, owner2],
          amounts: { [token]: amount },
          tokens: [{ address: token, symbol: jest.fn().mockResolvedValue(tokenSymbol) }],
          approvalsCount: approvals
        }
      ]);

      const findings = await handleBlock(txBlock);

      const finding = createPhishingFinding(
        approvals,
        spender,
        [owner1, owner2],
        [
          {
            address: token,
            amount: amount,
            symbol: tokenSymbol
          }
        ]
      );

      expect(findings).toHaveLength(1);

      finding.metadata.tokens = JSON.parse(finding.metadata.tokens);
      findings[0].metadata.tokens = JSON.parse(findings[0].metadata.tokens);

      expect(findings).toStrictEqual([finding]);
    });

    it('should return empty findings if attacker has no new approvals', async () => {
      const spender = createAddress('0x1');
      const owner1 = createAddress('0x2');
      const owner2 = createAddress('0x3');
      const token = createAddress('0x4');
      const tokenSymbol = 'TKN';
      const amount = new BigNumber(100);
      const approvals = 4;

      mockDependenciesConfig.callsThreshold = approvals - 1;
      mockDependenciesConfig.registry.isExchange.mockResolvedValue(false);
      mockDependenciesConfig.store.getSpenderSummaries.mockReturnValue([
        {
          address: spender,
          owners: [owner1, owner2],
          amounts: { [token]: amount },
          tokens: [{ address: token, symbol: jest.fn().mockResolvedValue(tokenSymbol) }],
          approvalsCount: approvals
        }
      ]);

      let findings = await handleBlock(txBlock);

      expect(findings).toHaveLength(1);

      findings = await handleBlock(txBlock);

      expect(findings).toStrictEqual([]);
    });

    it('should pass detected attackers as permanent spenders to store.clearOutdatedData()', async () => {
      const spender = createAddress('0x1');
      const owner1 = createAddress('0x2');
      const owner2 = createAddress('0x3');
      const token = createAddress('0x4');
      const tokenSymbol = 'TKN';
      const amount = new BigNumber(100);
      const approvals = 4;

      txBlock.setTimestamp(10);

      mockDependenciesConfig.secondsKeepApprovals = 10;
      mockDependenciesConfig.callsThreshold = approvals - 1;
      mockDependenciesConfig.registry.isExchange.mockResolvedValue(false);
      mockDependenciesConfig.store.getSpenderSummaries.mockReturnValue([
        {
          address: spender,
          owners: [owner1, owner2],
          amounts: { [token]: amount },
          tokens: [{ address: token, symbol: jest.fn().mockResolvedValue(tokenSymbol) }],
          approvalsCount: approvals
        }
      ]);

      const findings = await handleBlock(txBlock);

      expect(findings).toHaveLength(1);

      await handleBlock(txBlock);

      expect(mockDependenciesConfig.store.clearOutdatedData).toBeCalledWith(0, [spender]);
    });

    it('should return multiple findings', async () => {
      const spender1 = createAddress('0x1');
      const spender2 = createAddress('0x2');
      const owner1 = createAddress('0x3');
      const owner2 = createAddress('0x4');
      const token = createAddress('0x5');
      const tokenSymbol = 'TKN';
      const amount = new BigNumber(100);
      const approvals = 4;

      mockDependenciesConfig.callsThreshold = approvals - 1;
      mockDependenciesConfig.registry.isExchange.mockResolvedValue(false);
      mockDependenciesConfig.store.getSpenderSummaries.mockReturnValue([
        {
          address: spender1,
          owners: [owner1, owner2],
          amounts: { [token]: amount },
          tokens: [{ address: token, symbol: jest.fn().mockResolvedValue(tokenSymbol) }],
          approvalsCount: approvals
        },
        {
          address: spender2,
          owners: [owner1],
          amounts: { [token]: amount },
          tokens: [{ address: token, symbol: jest.fn().mockResolvedValue(tokenSymbol) }],
          approvalsCount: approvals
        }
      ]);

      const findings = await handleBlock(txBlock);

      expect(findings).toHaveLength(2);

      const finding1 = createPhishingFinding(
        approvals,
        spender1,
        [owner1, owner2],
        [
          {
            address: token,
            amount: amount,
            symbol: tokenSymbol
          }
        ]
      );

      const finding2 = createPhishingFinding(
        approvals,
        spender2,
        [owner1],
        [
          {
            address: token,
            amount: amount,
            symbol: tokenSymbol
          }
        ]
      );

      findings[0].metadata.tokens = JSON.parse(findings[0].metadata.tokens);
      findings[1].metadata.tokens = JSON.parse(findings[1].metadata.tokens);
      finding1.metadata.tokens = JSON.parse(finding1.metadata.tokens);
      finding2.metadata.tokens = JSON.parse(finding2.metadata.tokens);

      expect(findings).toStrictEqual([finding1, finding2]);
    });
  });
});
