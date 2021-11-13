import { TestTransactionEvent, createAddress } from 'forta-agent-tools';
import { createAaveUtilsMock, createTokenConfig, big } from './utils';
import { TokenConfig } from '../utils/aave-utils';
import agent from '../agent';

const { provideHandleTransaction, createFinding, getSeverity } = agent;

describe('aave exchange rate agent', () => {
  describe('handleTransaction', () => {
    const basicTxEvent = new TestTransactionEvent();
    const usdcToken: TokenConfig = createTokenConfig('USDC');
    const usdtToken: TokenConfig = createTokenConfig('USDT');
    const daiToken: TokenConfig = createTokenConfig('DAI');

    it("returns empty findings if it's a first time handling", async () => {
      const tokenPairs = [[usdtToken.symbol, daiToken.symbol]];

      const aaveUtilsMock = createAaveUtilsMock([usdtToken, daiToken]).mockTokenPricesOnce({
        [usdtToken.symbol]: 10,
        [daiToken.symbol]: 100
      });

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any, 0, tokenPairs);

      const findings = await handleTransaction(basicTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it("returns empty findings if it's too early to check the rate", async () => {
      const tokenPairs = [[usdtToken.symbol, daiToken.symbol]];

      const aaveUtilsMock = createAaveUtilsMock([usdtToken, daiToken]).mockTokenPricesOnce({
        [usdtToken.symbol]: 10,
        [daiToken.symbol]: 100
      });

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any, 999999, tokenPairs);

      let findings = null;

      findings = await handleTransaction(basicTxEvent);

      expect(findings).toStrictEqual([]);

      findings = await handleTransaction(basicTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if the rate has not changed', async () => {
      const tokenPairs = [[usdtToken.symbol, daiToken.symbol]];

      const aaveUtilsMock = createAaveUtilsMock([usdtToken, daiToken])
        .mockTokenPricesOnce({
          [usdtToken.symbol]: 97,
          [daiToken.symbol]: 100
        })
        .mockTokenPricesOnce({
          [usdtToken.symbol]: 97,
          [daiToken.symbol]: 100
        });

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any, 0, tokenPairs);

      let findings = null;

      findings = await handleTransaction(basicTxEvent);

      expect(findings).toStrictEqual([]);

      findings = await handleTransaction(basicTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if the rate went down', async () => {
      const tokenPairs = [[usdtToken.symbol, daiToken.symbol]];

      const aaveUtilsMock = createAaveUtilsMock([usdtToken, daiToken])
        .mockTokenPricesOnce({
          [usdtToken.symbol]: 100,
          [daiToken.symbol]: 100
        })
        .mockTokenPricesOnce({
          [usdtToken.symbol]: 97,
          [daiToken.symbol]: 100
        });

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any, 0, tokenPairs);

      let findings = null;

      findings = await handleTransaction(basicTxEvent);

      expect(findings).toStrictEqual([]);

      findings = await handleTransaction(basicTxEvent);

      const finding = createFinding(
        usdtToken,
        daiToken,
        '97',
        '100',
        big(97).dividedBy(100).toString(),
        '1',
        aaveUtilsMock.getOracleAddress(),
        '3',
        getSeverity(big(3))
      );

      expect(findings).toStrictEqual([finding]);
    });

    it('returns multiple findings if the rate went down', async () => {
      const tokenPairs = [
        [usdtToken.symbol, daiToken.symbol],
        [usdcToken.symbol, daiToken.symbol]
      ];

      const aaveUtilsMock = createAaveUtilsMock([usdtToken, usdcToken, daiToken])
        .mockTokenPricesOnce({
          [usdtToken.symbol]: 100,
          [usdcToken.symbol]: 100,
          [daiToken.symbol]: 100
        })
        .mockTokenPricesOnce({
          [usdtToken.symbol]: 97,
          [usdcToken.symbol]: 50,
          [daiToken.symbol]: 100
        });

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any, 0, tokenPairs);

      let findings = null;

      findings = await handleTransaction(basicTxEvent);

      expect(findings).toStrictEqual([]);

      findings = await handleTransaction(basicTxEvent);

      const finding1 = createFinding(
        usdtToken,
        daiToken,
        '97',
        '100',
        big(97).dividedBy(100).toString(),
        '1',
        aaveUtilsMock.getOracleAddress(),
        '3',
        getSeverity(big(3))
      );

      const finding2 = createFinding(
        usdcToken,
        daiToken,
        '50',
        '100',
        big(50).dividedBy(100).toString(),
        '1',
        aaveUtilsMock.getOracleAddress(),
        '50',
        getSeverity(big(50))
      );

      expect(findings).toStrictEqual([finding1, finding2]);
    });
  });
});
