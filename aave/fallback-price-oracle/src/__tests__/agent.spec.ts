import { Finding, FindingSeverity, FindingType } from 'forta-agent';
import agent, {
  GET_FALLBACK_ADDRESS_ALERT_ID,
  GET_FALLBACK_PRICE_ALERT_ID,
  PROTOCOL
} from '../agent';
import { GET_ASSET_PRICE_FUNCTION_ABI, GET_FALLBACK_ORACLE_FUNCTION_ABI } from '../constants';
import { TestUtils } from './utils';
import { TokenConfig } from '../utils';

const { provideHandleTransaction } = agent;

const utils = new TestUtils();

describe('aave fallback oracle agent', () => {
  describe('handleTransaction', () => {
    const createTokenConfig = (symbol: string, address: string = '0x0123'): TokenConfig => ({
      symbol,
      address,
      decimals: 18
    });

    const createAaveUtilsMock = (
      oracleAddress: string = '0x01',
      fallbackOracleAddress: string = '0x02',
      tokens: Array<TokenConfig> = []
    ) => ({
      tokens: tokens,
      oracleAddress: oracleAddress,
      fallbackOracleAddress: fallbackOracleAddress,
      handleTransaction: jest.fn()
    });

    it('returns empty findings if price oracle address is not involved', async () => {
      const aaveUtilsMock = createAaveUtilsMock();

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any);

      const txEvent = utils.createTxEvent([]);

      const findings = await handleTransaction(txEvent);

      expect(aaveUtilsMock.handleTransaction.mock.calls.length).toBe(1);
      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if neither getFallbackOracle() nor getAssetPrice() is called', async () => {
      const aaveUtilsMock = createAaveUtilsMock();
      const { oracleAddress, fallbackOracleAddress } = aaveUtilsMock;

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any);

      const trace1 = utils.createTrace('function test1()', [], oracleAddress);
      const trace2 = utils.createTrace('function test2()', [], fallbackOracleAddress);

      const txEvent = utils.createTxEvent([trace1, trace2]);

      const findings = await handleTransaction(txEvent);

      expect(aaveUtilsMock.handleTransaction.mock.calls.length).toBe(1);

      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if getFallbackOracle() is called', async () => {
      const fromAddress = '0x0666';

      const aaveUtilsMock = createAaveUtilsMock();
      const { oracleAddress, fallbackOracleAddress } = aaveUtilsMock;

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any);

      const trace = utils.createTrace(GET_FALLBACK_ORACLE_FUNCTION_ABI, [], oracleAddress);

      const txEvent = utils.createTxEvent([trace], fromAddress);

      const findings = await handleTransaction(txEvent);

      const finding = Finding.fromObject({
        name: 'Aave getFallbackOracle() Function Call',
        description: `Price Oracle function getFallbackOracle() was called by ${fromAddress}`,
        alertId: GET_FALLBACK_ADDRESS_ALERT_ID,
        protocol: PROTOCOL,
        severity: FindingSeverity.Medium,
        type: FindingType.Info,
        metadata: {
          from: fromAddress,
          oracleAddress: oracleAddress,
          fallbackOracleAddress: fallbackOracleAddress
        }
      });

      expect(aaveUtilsMock.handleTransaction.mock.calls.length).toBe(1);

      expect(findings).toStrictEqual([finding]);
    });

    it('returns a finding if fallback oracle getAssetPrice() is called for an unknown asset', async () => {
      const fromAddress = '0x0666';
      const assetAddress = '0x7C1e2f858d25D56fA9e33Eb55a24485D08868192';

      const aaveUtilsMock = createAaveUtilsMock();
      const { oracleAddress, fallbackOracleAddress } = aaveUtilsMock;

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any);

      const trace1 = utils.createTrace(GET_ASSET_PRICE_FUNCTION_ABI, [assetAddress], oracleAddress);
      const trace2 = utils.createTrace(
        GET_ASSET_PRICE_FUNCTION_ABI,
        [assetAddress],
        fallbackOracleAddress
      );

      const txEvent = utils.createTxEvent([trace1, trace2], fromAddress);

      const findings = await handleTransaction(txEvent);

      const finding = Finding.fromObject({
        name: 'Aave Fallback Price Oracle Usage',
        description: `Fallback Price Oracle was used to get the price of the asset at address ${assetAddress}`,
        alertId: GET_FALLBACK_PRICE_ALERT_ID,
        protocol: PROTOCOL,
        severity: FindingSeverity.Medium,
        type: FindingType.Suspicious,
        metadata: {
          from: fromAddress,
          asset: assetAddress,
          oracleAddress: oracleAddress,
          fallbackOracleAddress: fallbackOracleAddress
        }
      });

      expect(aaveUtilsMock.handleTransaction.mock.calls.length).toBe(1);

      expect(findings).toStrictEqual([finding]);
    });

    it('returns a finding if fallback oracle getAssetPrice() is called for a known asset', async () => {
      const fromAddress = '0x0666';
      const tokenConfig = createTokenConfig('USDT', '0x7C1e2f858d25D56fA9e33Eb55a24485D08868192');

      const aaveUtilsMock = createAaveUtilsMock(undefined, undefined, [tokenConfig]);
      const { oracleAddress, fallbackOracleAddress } = aaveUtilsMock;

      const handleTransaction = provideHandleTransaction(aaveUtilsMock as any);

      const trace1 = utils.createTrace(
        GET_ASSET_PRICE_FUNCTION_ABI,
        [tokenConfig.address],
        oracleAddress
      );
      const trace2 = utils.createTrace(
        GET_ASSET_PRICE_FUNCTION_ABI,
        [tokenConfig.address],
        fallbackOracleAddress
      );

      const txEvent = utils.createTxEvent([trace1, trace2], fromAddress);

      const findings = await handleTransaction(txEvent);

      const finding = Finding.fromObject({
        name: 'Aave Fallback Price Oracle Usage',
        description: `Fallback Price Oracle was used to get the price of the ${tokenConfig.symbol} asset`,
        alertId: GET_FALLBACK_PRICE_ALERT_ID,
        protocol: PROTOCOL,
        severity: FindingSeverity.Medium,
        type: FindingType.Suspicious,
        metadata: {
          from: fromAddress,
          asset: tokenConfig.address,
          oracleAddress: oracleAddress,
          fallbackOracleAddress: fallbackOracleAddress
        }
      });

      expect(aaveUtilsMock.handleTransaction.mock.calls.length).toBe(1);

      expect(findings).toStrictEqual([finding]);
    });
  });
});
