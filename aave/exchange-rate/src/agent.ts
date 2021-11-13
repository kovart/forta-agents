import BigNumber from 'bignumber.js';
import { Finding, FindingSeverity, FindingType, TransactionEvent } from 'forta-agent';
import { AaveUtils, TokenConfig } from './utils/aave-utils';
import { ExchangeRateHistory } from './utils/history';
import { formatNumber } from './utils/helpers';

export const PROTOCOL = 'aave';
export const ALERT_ID = 'AAVE-EXCHANGE-RATE-0';
export const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
export const ENABLE_REVERSE_ORDER = true; // should add reverse pairs? (USDC/DAI => USDC/DAI + DAI/USDC)
export const TOKEN_PAIRS = [
  ['USDC', 'DAI'],
  ['USDT', 'DAI'],
  ['USDP', 'DAI'],
  ['GUSD', 'DAI']
];

const aaveUtils = new AaveUtils(TOKEN_PAIRS);
const tokenPairs = ENABLE_REVERSE_ORDER
  ? TOKEN_PAIRS.map((pair) => [pair, pair.slice().reverse()]).flat()
  : TOKEN_PAIRS;

async function initialize() {
  await aaveUtils.fetchConfigs();
}

function provideHandleTransaction(
  aaveUtils: AaveUtils,
  checkInterval: number,
  tokenPairs: string[][]
) {
  let lastCheckTimestamp: number | null = null;
  const exchangeRateHistory = new ExchangeRateHistory();

  return async function handleTransaction(txEvent: TransactionEvent) {
    const now = Number(new Date());
    const findings: Finding[] = [];

    // this methods allows us to minimize contract calls,
    // it updates oracle address if update event is found in the logs
    aaveUtils.handleTransaction(txEvent);

    // check if it's too early to check the exchange rates
    if (lastCheckTimestamp && lastCheckTimestamp + checkInterval > now) {
      return findings;
    }

    // one contract call to get all the asset prices (super optimization)
    const pricesMap = await aaveUtils.getTokenPricesMap();

    for (const tokenPair of tokenPairs) {
      const token1 = aaveUtils.tokenConfigsMap[tokenPair[0]];
      const token2 = aaveUtils.tokenConfigsMap[tokenPair[1]];
      const price1 = pricesMap[token1.symbol];
      const price2 = pricesMap[token2.symbol];

      const currentExchangeRate = price1.dividedBy(price2);
      const previousExchangeRate = exchangeRateHistory.getLast(token1.symbol, token2.symbol);

      if (previousExchangeRate && currentExchangeRate.isLessThan(previousExchangeRate)) {
        const oracleAddress = aaveUtils.getOracleAddress();
        const deviationPercent = new BigNumber(1)
          .minus(currentExchangeRate.dividedBy(previousExchangeRate))
          .multipliedBy(100);

        findings.push(
          createFinding(
            token1,
            token2,
            price1.toString(),
            price2.toString(),
            currentExchangeRate.toString(),
            previousExchangeRate.toString(),
            oracleAddress,
            formatNumber(deviationPercent),
            getSeverity(deviationPercent)
          )
        );
      }

      exchangeRateHistory.push(token1.symbol, token2.symbol, currentExchangeRate);
    }

    lastCheckTimestamp = now;

    return findings;
  };
}

function getSeverity(deviationPercent: BigNumber) {
  if (deviationPercent.isLessThan(0.5)) return FindingSeverity.Info;
  if (deviationPercent.isLessThan(1)) return FindingSeverity.Low;
  if (deviationPercent.isLessThan(1.5)) return FindingSeverity.Medium;
  if (deviationPercent.isLessThan(3)) return FindingSeverity.High;

  return FindingSeverity.Critical;
}

function createFinding(
  token1: TokenConfig,
  token2: TokenConfig,
  token1Price: string,
  token2Price: string,
  currentExchangeRate: string,
  previousExchangeRate: string,
  oracleAddress: string,
  deviation: string,
  severity: FindingSeverity
) {
  return Finding.fromObject({
    name: 'Aave Exchange Rate Down',
    description: `${token1.symbol}/${token2.symbol} exchange rate went down ${deviation}%`,
    alertId: ALERT_ID,
    protocol: PROTOCOL,
    severity: severity,
    type: FindingType.Suspicious,
    metadata: {
      token1: token1.address,
      token2: token2.address,
      price1: token1Price,
      price2: token2Price,
      exchangeRate: currentExchangeRate
    }
  });
}

export default {
  initialize,
  getSeverity,
  createFinding,
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(aaveUtils, CHECK_INTERVAL, tokenPairs)
};
