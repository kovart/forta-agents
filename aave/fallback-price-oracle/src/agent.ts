import { TransactionEvent, Finding, FindingSeverity, FindingType } from 'forta-agent';
import { AaveUtils } from './utils';
import { GET_ASSET_PRICE_FUNCTION_ABI, GET_FALLBACK_ORACLE_FUNCTION_ABI } from './constants';

export const PROTOCOL = 'aave';
export const GET_FALLBACK_ADDRESS_ALERT_ID = 'AAVE-FALLBACK-ORACLE-CALL-0';
export const GET_FALLBACK_PRICE_ALERT_ID = 'AAVE-FALLBACK-ORACLE-CALL-1';

const aaveUtils = new AaveUtils();

async function initialize() {
  await aaveUtils.fetchConfigs();
}

function provideHandleTransaction(aaveUtils: AaveUtils) {
  return async function handleTransaction(txEvent: TransactionEvent) {
    const findings: Finding[] = [];

    // this methods allows us to minimize contract calls,
    // it updates contract addresses if update events are found in the logs
    aaveUtils.handleTransaction(txEvent);

    // look for traces of getFallbackOracle() function on Price Oracle contract
    const getFallbackFunctionCalls = txEvent.filterFunction(
      GET_FALLBACK_ORACLE_FUNCTION_ABI,
      aaveUtils.oracleAddress
    );

    // fire alert if we find getFallbackOracle() call
    if (getFallbackFunctionCalls.length > 0) {
      findings.push(
        Finding.fromObject({
          name: 'Aave getFallbackOracle() Function Call',
          description: `Price Oracle function getFallbackOracle() was called by ${txEvent.from}`,
          alertId: GET_FALLBACK_ADDRESS_ALERT_ID,
          protocol: PROTOCOL,
          severity: FindingSeverity.Medium,
          type: FindingType.Info,
          metadata: {
            from: txEvent.from,
            oracleAddress: aaveUtils.oracleAddress,
            fallbackOracleAddress: aaveUtils.fallbackOracleAddress
          }
        })
      );
    }

    // look for traces of getAssetPrice() function on Price Oracle contract
    const getAssetPriceCalls = txEvent.filterFunction(
      GET_ASSET_PRICE_FUNCTION_ABI,
      aaveUtils.oracleAddress
    );

    // fallback oracle can only be called inside the getAssetPrice() function of the price oracle
    if (!getAssetPriceCalls.length) return findings;

    // look for traces of getAssetPrice() function on Fallback Price Oracle contract
    const getFallbackAssetPriceCalls = txEvent.filterFunction(
      GET_ASSET_PRICE_FUNCTION_ABI,
      aaveUtils.fallbackOracleAddress
    );

    // fire alerts for each getAssetPrice() fallback call
    for (const transaction of getFallbackAssetPriceCalls) {
      const { asset } = transaction.args;
      const token = aaveUtils.tokens.find((t) => t.address === asset);
      const description =
        `Fallback Price Oracle was used to get the price of ` +
        (token ? `the ${token!.symbol} asset` : `the asset at address ${asset}`);

      findings.push(
        Finding.fromObject({
          name: 'Aave Fallback Price Oracle Usage',
          description: description,
          alertId: GET_FALLBACK_PRICE_ALERT_ID,
          protocol: PROTOCOL,
          severity: FindingSeverity.Medium,
          type: FindingType.Suspicious,
          metadata: {
            asset: asset,
            from: txEvent.from,
            oracleAddress: aaveUtils.oracleAddress,
            fallbackOracleAddress: aaveUtils.fallbackOracleAddress
          }
        })
      );
    }

    return findings;
  };
}

export default {
  initialize,
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(aaveUtils)
};
