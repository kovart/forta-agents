import BigNumber from 'bignumber.js';
import { TransactionEvent, Finding, FindingSeverity, FindingType } from 'forta-agent';
import { AaveUtils } from './utils';
import { FLASH_LOAN_FUNCTION_ABI, LENDING_POOL_ADDRESS } from './constants';
import { AssetMetadata } from './types';

export const PROTOCOL = 'aave';
export const ALERT_ID = 'AAVE-FLASH-LOAN-0';
export const VALUE_THRESHOLD = 10000000; // $10,000,000

const aaveUtils = new AaveUtils();

async function initialize() {
  await aaveUtils.fetchConfigs();
}

function provideHandleTransaction(aaveUtils: AaveUtils, valueThreshold: number) {
  return async function handleTransaction(txEvent: TransactionEvent) {
    const findings: Finding[] = [];

    // this methods allows us to minimize contract calls,
    // it updates contract addresses if update events are found in the logs
    await aaveUtils.handleTransaction(txEvent);

    const logs = txEvent.filterFunction(FLASH_LOAN_FUNCTION_ABI, LENDING_POOL_ADDRESS);

    for (const log of logs) {
      const { assets, amounts } = log.args;

      // get ETH prices for all the used assets + usdt asset
      const pricesMap = await aaveUtils.getTokenPricesMap(
        [...assets, aaveUtils.usdtConfig.address],
        txEvent.blockNumber
      );

      const metadata: AssetMetadata[] = [];

      let usdtSum = new BigNumber(0);
      const usdtPrice = pricesMap[aaveUtils.usdtConfig.address]; // in wei

      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        const config = aaveUtils.tokenConfigsMap[asset] || {};
        const price = pricesMap[asset].dividedBy(usdtPrice); // in USDT
        const amount = new BigNumber(amounts[i].toString()).dividedBy(
          new BigNumber(10).pow(config.decimals || 18)
        );
        const totalUsdt = amount.multipliedBy(price);

        usdtSum = usdtSum.plus(totalUsdt);

        metadata.push({
          ...config,
          address: asset,
          price: price.toString(),
          amount: amount.toString(),
          total: totalUsdt.toString()
        });
      }

      if (usdtSum.isGreaterThanOrEqualTo(valueThreshold)) {
        findings.push(createFinding(usdtSum.toFormat(0), metadata));
      }
    }

    return findings;
  };
}

function createFinding(sum: string, metadata: Array<AssetMetadata>) {
  return Finding.fromObject({
    name: 'Aave Flash Loan Large Transfer',
    description:
      `Flash Loan transaction in the amount of $${sum} ` +
      `(${metadata
        .map((m) => m.symbol)
        .filter((v) => v)
        .join(', ')})`,
    alertId: ALERT_ID,
    protocol: PROTOCOL,
    severity: FindingSeverity.High,
    type: FindingType.Suspicious,
    metadata: {
      assets: JSON.stringify(metadata)
    }
  });
}

export default {
  initialize,
  createFinding,
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(aaveUtils, VALUE_THRESHOLD)
};
