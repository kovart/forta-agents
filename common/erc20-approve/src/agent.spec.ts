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

type MockedDependenciesConfig = AgentDependenciesConfig & {
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
    let blockEvent: TestBlockEvent;

    beforeEach(() => {
      blockEvent = new TestBlockEvent();
      handleBlock = provideHandleBlock(mockDependenciesConfig as any);
    });

    it('should throw error on non-initialized dependencies config', async () => {
      mockDependenciesConfig.isInitialized = false;

      await expect(handleBlock(blockEvent)).rejects.toThrow();
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

      const findings = await handleBlock(blockEvent);

      expect(findings).toStrictEqual([]);
    });

    it('should clear store data with correct minTimestamp', async () => {
      mockDependenciesConfig.secondsKeepApprovals = 100;
      mockDependenciesConfig.store.getSpenderSummaries.mockImplementation(() => []);

      blockEvent.setTimestamp(100);

      await handleBlock(blockEvent);

      expect(mockDependenciesConfig.store.clearOutdatedData).toBeCalledWith(0, []);
    });

    it('should return finding if number of approvals exceeds threshold', async () => {
      const spender = createAddress('0x1');
      const owner1 = createAddress('0x2');
      const owner2 = createAddress('0x3');
      const tokenAddress = createAddress('0x4');
      const tokenSymbol = 'TKN';
      const tokenDecimals = 18;
      const tokenDenominator = new BigNumber(10).pow(tokenDecimals);
      const amount = new BigNumber(100);
      const approvals = 4;

      mockDependenciesConfig.callsThreshold = approvals - 1;
      mockDependenciesConfig.registry.isExchange.mockResolvedValue(false);
      mockDependenciesConfig.store.getSpenderSummaries.mockReturnValue([
        {
          address: spender,
          owners: [owner1, owner2],
          amounts: { [tokenAddress]: amount },
          approvalsCount: approvals,
          tokens: [
            {
              address: tokenAddress,
              symbol: jest.fn().mockResolvedValue(tokenSymbol),
              decimals: jest.fn().mockResolvedValue(tokenDecimals),
              denominator: jest.fn().mockResolvedValue(tokenDenominator)
            }
          ]
        }
      ]);

      const findings = await handleBlock(blockEvent);

      const finding = createPhishingFinding(
        approvals,
        spender,
        [owner1, owner2],
        [
          {
            address: tokenAddress,
            amount: amount.div(tokenDenominator),
            symbol: tokenSymbol
          }
        ]
      );

      expect(findings).toHaveLength(1);

      finding.metadata.tokens = JSON.parse(finding.metadata.tokens);
      findings[0].metadata.tokens = JSON.parse(findings[0].metadata.tokens);

      expect(findings).toStrictEqual([finding]);
    });

    it('should return multiple findings', async () => {
      const autoAddress: () => string = (() => {
        let index = 1;
        return () => createAddress('0x' + index++);
      })();

      const createToken = (symbol: string, decimals: number) => ({
        address: autoAddress(),
        symbol: symbol,
        decimals: decimals,
        denominator: new BigNumber(10).pow(decimals)
      });

      const createTokenInstance = (token: {
        address: string;
        symbol: string;
        decimals: number;
        denominator: BigNumber;
      }) => ({
        address: token.address,
        symbol: jest.fn().mockResolvedValue(token.symbol),
        decimals: jest.fn().mockResolvedValue(token.decimals),
        denominator: jest.fn().mockResolvedValue(token.denominator)
      });

      const createSummary = (
        spender: string,
        owners: string[],
        tokens: any[],
        amounts: BigNumber[],
        approvals: number
      ) => {
        return {
          address: spender,
          owners: owners,
          amounts: Object.assign({}, ...tokens.map((t, i) => ({ [t.address]: amounts[i] }))),
          tokens: tokens.map((t) => createTokenInstance(t)),
          approvalsCount: approvals
        };
      };

      const [token1, token2] = [createToken('TKN1', 16), createToken('TKN2', 8)];
      const [owner1, owner2] = [autoAddress(), autoAddress()];
      const approvalsThreshold = 3;

      const spender1 = {
        address: autoAddress(),
        tokens: [token1, token2],
        amounts: [new BigNumber(100), new BigNumber(200)],
        owners: [owner1, owner2],
        approvals: approvalsThreshold + 1
      };

      const spender2 = {
        address: autoAddress(),
        tokens: [token1],
        amounts: [new BigNumber(12345)],
        owners: [owner2],
        approvals: approvalsThreshold
      };

      const spender3 = {
        address: autoAddress(),
        tokens: [token2],
        amounts: [new BigNumber(333)],
        owners: [owner2],
        approvals: approvalsThreshold + 2
      };

      const [summary1, summary2, summary3] = [spender1, spender2, spender3].map((spender) =>
        createSummary(
          spender.address,
          spender.owners,
          spender.tokens,
          spender.amounts,
          spender.approvals
        )
      );

      mockDependenciesConfig.callsThreshold = approvalsThreshold;
      mockDependenciesConfig.registry.isExchange.mockResolvedValue(false);
      mockDependenciesConfig.store.getSpenderSummaries.mockReturnValue([
        summary1,
        summary2,
        summary3
      ]);

      const findings = await handleBlock(blockEvent);

      expect(findings).toHaveLength(2);

      const finding1 = createPhishingFinding(
        spender1.approvals,
        spender1.address,
        spender1.owners,
        summary1.tokens.map((t, i) => ({
          address: spender1.tokens[i].address,
          amount: spender1.amounts[i].div(spender1.tokens[i].denominator),
          symbol: spender1.tokens[i].symbol
        }))
      );

      const finding2 = createPhishingFinding(
        spender3.approvals,
        spender3.address,
        spender3.owners,
        summary3.tokens.map((t, i) => ({
          address: spender3.tokens[i].address,
          amount: spender3.amounts[i].div(spender3.tokens[i].denominator),
          symbol: spender3.tokens[i].symbol
        }))
      );

      findings[0].metadata.tokens = JSON.parse(findings[0].metadata.tokens);
      findings[1].metadata.tokens = JSON.parse(findings[1].metadata.tokens);
      finding1.metadata.tokens = JSON.parse(finding1.metadata.tokens);
      finding2.metadata.tokens = JSON.parse(finding2.metadata.tokens);

      expect(findings).toStrictEqual([finding1, finding2]);
    });

    it('should return empty findings if attacker has no new approvals', async () => {
      const spender = createAddress('0x1');
      const owner1 = createAddress('0x2');
      const owner2 = createAddress('0x3');
      const tokenAddress = createAddress('0x4');
      const tokenSymbol = 'TKN';
      const tokenDecimals = 18;
      const tokenDenominator = new BigNumber(10).pow(tokenDecimals);
      const amount = new BigNumber(100);
      const approvals = 4;

      mockDependenciesConfig.callsThreshold = approvals - 1;
      mockDependenciesConfig.registry.isExchange.mockResolvedValue(false);
      mockDependenciesConfig.store.getSpenderSummaries.mockReturnValue([
        {
          address: spender,
          owners: [owner1, owner2],
          amounts: { [tokenAddress]: amount },
          approvalsCount: approvals,
          tokens: [
            {
              address: tokenAddress,
              symbol: jest.fn().mockResolvedValue(tokenSymbol),
              decimals: jest.fn().mockResolvedValue(tokenDecimals),
              denominator: jest.fn().mockResolvedValue(tokenDenominator)
            }
          ]
        }
      ]);

      let findings = await handleBlock(blockEvent);

      expect(findings).toHaveLength(1);

      findings = await handleBlock(blockEvent);

      expect(findings).toStrictEqual([]);
    });

    it('should pass attackers to store.clearOutdatedData()', async () => {
      const spender = createAddress('0x1');
      const owner1 = createAddress('0x2');
      const owner2 = createAddress('0x3');
      const tokenAddress = createAddress('0x4');
      const tokenSymbol = 'TKN';
      const tokenDecimals = 18;
      const tokenDenominator = new BigNumber(10).pow(tokenDecimals);
      const amount = new BigNumber(100);
      const approvals = 4;

      blockEvent.setTimestamp(10);

      mockDependenciesConfig.secondsKeepFindings = 10;
      mockDependenciesConfig.secondsKeepApprovals = 10;
      mockDependenciesConfig.callsThreshold = approvals - 1;
      mockDependenciesConfig.registry.isExchange.mockResolvedValue(false);
      mockDependenciesConfig.store.getSpenderSummaries.mockReturnValue([
        {
          address: spender,
          owners: [owner1, owner2],
          amounts: { [tokenAddress]: amount },
          tokens: [
            {
              address: tokenAddress,
              symbol: jest.fn().mockResolvedValue(tokenSymbol),
              decimals: jest.fn().mockResolvedValue(tokenDecimals),
              denominator: jest.fn().mockResolvedValue(tokenDenominator)
            }
          ],
          approvalsCount: approvals
        }
      ]);

      const findings = await handleBlock(blockEvent);

      expect(findings).toHaveLength(1);

      await handleBlock(blockEvent);

      expect(mockDependenciesConfig.store.clearOutdatedData).toBeCalledWith(0, [spender]);
    });
  });
});
