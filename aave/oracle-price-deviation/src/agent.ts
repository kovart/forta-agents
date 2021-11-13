import { TransactionEvent, Finding, FindingSeverity, FindingType } from 'forta-agent';
import { AaveUtils, TokenConfig, formatNumber } from './utils';

export const PROTOCOL = 'aave';
export const ALERT_ID = 'AAVE-PRICE-DEVIATION-0';
export const CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes
export const DEVIATION_THRESHOLD = 10; // alert if deviation is more than 10%

const aaveUtils = new AaveUtils();

async function initialize() {
  await aaveUtils.fetchConfigs();
}

function provideHandleTransaction(
  aaveUtils: AaveUtils,
  checkInterval: number,
  deviationThreshold: number
) {
  let lastCheckTimestamp: number | null = null;

  return async function handleTransaction(txEvent: TransactionEvent) {
    const now = Number(new Date());
    const findings: Finding[] = [];

    // this methods allows us to minimize contract calls,
    // it updates contract addresses if update events are found in the logs
    await aaveUtils.handleTransaction(txEvent);

    // check if it's too early to check the prices
    if (lastCheckTimestamp && lastCheckTimestamp + checkInterval > now) {
      return findings;
    }

    for (const token of aaveUtils.tokens) {
      const oraclePrice = await aaveUtils.getOracleAssetPrice(token.address);
      const fallbackOraclePrice = await aaveUtils.getFallbackOracleAssetPrice(token.address);

      if (oraclePrice.isZero() || fallbackOraclePrice.isZero()) continue;

      const deviationPercent = fallbackOraclePrice
        .minus(oraclePrice)
        .dividedBy(oraclePrice)
        .abs()
        .multipliedBy(100);

      if (deviationPercent.isGreaterThan(deviationThreshold)) {
        const oracleAddress = aaveUtils.getOracleAddress();
        const fallbackOracleAddress = aaveUtils.getFallbackOracleAddress();

        findings.push(
          createFinding(
            token,
            formatNumber(deviationPercent),
            oraclePrice.toString(),
            fallbackOraclePrice.toString(),
            oracleAddress,
            fallbackOracleAddress
          )
        );
      }
    }

    lastCheckTimestamp = now;

    return findings;
  };
}

function createFinding(
  token: TokenConfig,
  deviationPercent: string,
  oraclePrice: string,
  fallbackOraclePrice: string,
  oracleAddress: string,
  fallbackOracleAddress: string
) {
  const description =
    `Price Oracle and Fallback Price Oracle returned prices for ${token.symbol} asset ` +
    `with a deviation of more than ${deviationPercent}%`;

  return Finding.fromObject({
    name: 'Aave Oracle Price Deviation',
    description: description,
    alertId: ALERT_ID,
    protocol: PROTOCOL,
    severity: FindingSeverity.High,
    type: FindingType.Suspicious,
    metadata: {
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
      oraclePrice: oraclePrice,
      fallbackOraclePrice: fallbackOraclePrice,
      oracleAddress: oracleAddress,
      fallbackOracleAddress: fallbackOracleAddress
    }
  });
}

export default {
  initialize,
  createFinding,
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(aaveUtils, CHECK_INTERVAL, DEVIATION_THRESHOLD)
};
