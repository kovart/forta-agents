import BigNumber from 'bignumber.js';
import { createAddress, TestTransactionEvent } from 'forta-agent-tools';
import { TokenConfig } from '../utils';
import agent from '../agent';

const { provideHandleTransaction, createFinding } = agent;

describe('aave oracle deviation agent', () => {
  describe('handleTransaction', () => {
    const basicTxEvent = new TestTransactionEvent();
    const usdtToken: TokenConfig = {
      symbol: 'USDT',
      address: createAddress('0x1234')
    };
    const aaveToken: TokenConfig = {
      symbol: 'Aave',
      address: createAddress('0x2345')
    };

    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const big = (num: number) => new BigNumber(num);

    it('returns empty findings if oracle price is zero', async () => {
      const aaveUtilsMock = {
        tokens: [usdtToken],
        handleTransaction: jest.fn(),
        getOracleAssetPrice: jest
          .fn()
          .mockResolvedValueOnce(big(0))
          .mockResolvedValueOnce(big(100)),
        getFallbackOracleAssetPrice: jest
          .fn()
          .mockResolvedValueOnce(big(100))
          .mockResolvedValueOnce(big(0))
      };

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any, 0, 10);

      let findings = null;

      findings = await handleTransaction(basicTxEvent);

      expect(findings).toStrictEqual([]);

      findings = await handleTransaction(basicTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if oracle prices are equal', async () => {
      const aaveUtilsMock = {
        tokens: [usdtToken],
        handleTransaction: jest.fn(),
        getOracleAssetPrice: jest.fn().mockResolvedValue(big(100)),
        getFallbackOracleAssetPrice: jest.fn().mockResolvedValue(big(100))
      };

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any, 0, 10);

      const findings = await handleTransaction(basicTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it("returns empty findings if it's too early to check", async () => {
      const aaveUtilsMock = {
        tokens: [usdtToken],
        handleTransaction: jest.fn(),
        getOracleAssetPrice: jest.fn().mockResolvedValueOnce(big(10)).mockResolvedValue(big(20)),
        getFallbackOracleAssetPrice: jest
          .fn()
          .mockResolvedValueOnce(big(10))
          .mockResolvedValue(big(10))
      };

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any, 4000, 10);

      let findings = null;

      findings = await handleTransaction(basicTxEvent);

      expect(findings).toStrictEqual([]);

      await wait(300);

      findings = await handleTransaction(basicTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if threshold is greater', async () => {
      const aaveUtilsMock = {
        tokens: [usdtToken],
        handleTransaction: jest.fn(),
        getOracleAssetPrice: jest.fn().mockResolvedValue(big(10)),
        getFallbackOracleAssetPrice: jest.fn().mockResolvedValue(big(20))
      };

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any, 0, 101);

      const findings = await handleTransaction(basicTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if threshold is equal', async () => {
      const aaveUtilsMock = {
        tokens: [usdtToken],
        handleTransaction: jest.fn(),
        getOracleAssetPrice: jest.fn().mockResolvedValue(big(10)),
        getFallbackOracleAssetPrice: jest.fn().mockResolvedValue(big(20))
      };

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any, 0, 100);

      const findings = await handleTransaction(basicTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if threshold is less', async () => {
      const params = {
        oracleAssetPrice: big(10),
        fallbackOracleAssetPrice: big(20),
        oracleAddress: createAddress('0x0'),
        fallbackOracleAddress: createAddress('0x1')
      };

      const aaveUtilsMock = {
        tokens: [usdtToken],
        handleTransaction: jest.fn(),
        getOracleAssetPrice: jest.fn().mockResolvedValue(params.oracleAssetPrice),
        getFallbackOracleAssetPrice: jest.fn().mockResolvedValue(params.fallbackOracleAssetPrice),
        getOracleAddress: jest.fn().mockReturnValue(params.oracleAddress),
        getFallbackOracleAddress: jest.fn().mockReturnValue(params.fallbackOracleAddress)
      };

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any, 0, 99);

      const findings = await handleTransaction(basicTxEvent);

      const finding = createFinding(
        usdtToken,
        '100',
        params.oracleAssetPrice.toString(),
        params.fallbackOracleAssetPrice.toString(),
        params.oracleAddress,
        params.fallbackOracleAddress
      );

      expect(findings).toStrictEqual([finding]);
    });

    it('returns multiple findings if threshold is less', async () => {
      const params = {
        oracleAsset1Price: big(10),
        oracleAsset2Price: big(10),
        fallbackOracleAsset1Price: big(20),
        fallbackOracleAsset2Price: big(15),
        oracleAddress: createAddress('0x0'),
        fallbackOracleAddress: createAddress('0x1')
      };

      const aaveUtilsMock = {
        tokens: [usdtToken, aaveToken],
        handleTransaction: jest.fn(),
        getOracleAssetPrice: jest
          .fn()
          .mockResolvedValueOnce(params.oracleAsset1Price)
          .mockResolvedValueOnce(params.oracleAsset2Price),
        getFallbackOracleAssetPrice: jest
          .fn()
          .mockResolvedValueOnce(params.fallbackOracleAsset1Price)
          .mockResolvedValueOnce(params.fallbackOracleAsset2Price),
        getOracleAddress: jest.fn().mockReturnValue(params.oracleAddress),
        getFallbackOracleAddress: jest.fn().mockReturnValue(params.fallbackOracleAddress)
      };

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any, 0, 10);

      const findings = await handleTransaction(basicTxEvent);

      const finding1 = createFinding(
        usdtToken,
        '100',
        params.oracleAsset1Price.toString(),
        params.fallbackOracleAsset1Price.toString(),
        params.oracleAddress,
        params.fallbackOracleAddress
      );

      const finding2 = createFinding(
        aaveToken,
        '50',
        params.oracleAsset2Price.toString(),
        params.fallbackOracleAsset2Price.toString(),
        params.oracleAddress,
        params.fallbackOracleAddress
      );

      expect(findings).toStrictEqual([finding1, finding2]);
    });

    it('returns a finding after check interval pause', async () => {
      const params = {
        oracleAssetPrice: big(10),
        fallbackOracleAssetPrice: big(20),
        oracleAddress: createAddress('0x0'),
        fallbackOracleAddress: createAddress('0x1')
      };

      const checkInterval = 500; // 500ms

      const aaveUtilsMock = {
        tokens: [usdtToken],
        handleTransaction: jest.fn(),
        getOracleAssetPrice: jest
          .fn()
          .mockResolvedValueOnce(big(10))
          .mockResolvedValue(params.oracleAssetPrice),
        getFallbackOracleAssetPrice: jest
          .fn()
          .mockResolvedValueOnce(big(10))
          .mockResolvedValue(params.fallbackOracleAssetPrice),
        getOracleAddress: jest.fn().mockReturnValue(params.oracleAddress),
        getFallbackOracleAddress: jest.fn().mockReturnValue(params.fallbackOracleAddress)
      };

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any, checkInterval, 99);

      let findings = null;

      findings = await handleTransaction(basicTxEvent);

      expect(findings).toStrictEqual([]);

      await wait(checkInterval);

      findings = await handleTransaction(basicTxEvent);

      const finding = createFinding(
        usdtToken,
        '100',
        params.oracleAssetPrice.toString(),
        params.fallbackOracleAssetPrice.toString(),
        params.oracleAddress,
        params.fallbackOracleAddress
      );

      expect(findings).toStrictEqual([finding]);
    });
  });
});
