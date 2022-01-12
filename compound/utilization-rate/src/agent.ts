import { BlockEvent, Finding, FindingSeverity, FindingType, getJsonRpcUrl } from 'forta-agent';
import BigNumber from 'bignumber.js';
import Web3 from 'web3';
import { CompoundUtils, TokenRateStorage, formatNumber } from './utils';

export const EVENT_ALERT_ID = 'COMP-UTILIZATION-RATE-0';
export const ALERT_CHANGE_RATE = 0.1; // alert if changed by 10% or more
export const WATCH_INTERVAL = 60 * 60; // seconds (60 minutes window)
export const WATCH_TOKENS = ['cUSDC', 'cDAI', 'cETH']; // cToken pools

const web3 = new Web3(getJsonRpcUrl());
const storage = new TokenRateStorage(WATCH_INTERVAL);

function provideHandleBlock(
  alertChangeRate: number,
  watchTokens: string[],
  storage: TokenRateStorage,
  web3: Web3
) {
  return async (blockEvent: BlockEvent) => {
    const findings: Finding[] = [];

    const compound = CompoundUtils.getInstance(blockEvent.network);

    for (const cToken of compound.cTokens) {
      if (!watchTokens.includes(cToken.symbol)) continue;

      const contract = new web3.eth.Contract(cToken.abi, cToken.address);

      // Fetch pool values
      const [cash, borrow, reserves] = await Promise.all([
        contract.methods.getCash().call(),
        contract.methods.totalBorrowsCurrent().call(),
        contract.methods.totalReserves().call()
      ]);

      // Find lowest and highest rates before we process this block
      let { lowestRate, highestRate } = storage.getRateStats(cToken.symbol);

      // Calculate current utilization rate
      const currentRate = new BigNumber(borrow).div(new BigNumber(cash).plus(borrow).minus(reserves));

      // Save current rate after we find the lowest and highest
      storage.save(cToken.symbol, currentRate, blockEvent.block.timestamp);

      // Move to another token if it is first event
      if (storage.get(cToken.symbol).length < 2) continue;

      let direction: string | null = null;
      let changeRate: BigNumber | null;

      // We use smart alerts and fire them only when we touch the extremum (the biggest value)
      if (currentRate.isLessThan(lowestRate)) {
        direction = 'down';
        lowestRate = currentRate;
        changeRate = new BigNumber(1).minus(new BigNumber(lowestRate).dividedBy(highestRate));
      } else if (currentRate.isGreaterThan(highestRate)) {
        direction = 'up';
        highestRate = currentRate;
        changeRate = new BigNumber(highestRate).dividedBy(lowestRate);
      }

      // No direction means we have already alerted about the same or smaller change
      if (!direction) continue;

      const change = highestRate.minus(lowestRate);
      const percent = formatNumber(changeRate!.multipliedBy(100), 2);
      const minutes = Math.ceil(storage.expireTime / 60);

      if (changeRate!.isGreaterThanOrEqualTo(alertChangeRate)) {
        findings.push(
          Finding.fromObject({
            name: `Compound ${cToken.symbol} Utilization Rate Change`,
            description: `Utilization rate of ${cToken.symbol} is ${direction} ${percent}% within ${minutes} minutes`,
            alertId: EVENT_ALERT_ID,
            protocol: 'Compound',
            severity: FindingSeverity.Medium,
            type: FindingType.Suspicious,
            metadata: {
              lowestRate: lowestRate.toString(),
              highestRate: highestRate.toString(),
              change: change.toString()
            }
          })
        );
      }
    }

    return findings;
  };
}

export default {
  EVENT_ALERT_ID,
  provideHandleBlock,
  handleBlock: provideHandleBlock(ALERT_CHANGE_RATE, WATCH_TOKENS, storage, web3)
};
