import { BlockEvent, Finding, getJsonRpcUrl } from 'forta-agent';
import BigNumber from 'bignumber.js';
import Web3 from 'web3';
import { CompoundConfig, TokenRateStorage, formatNumber } from './utils';
import { createFinding, Direction } from './findings';

const agentConfig = require('../agent-config.json');

const web3 = new Web3(getJsonRpcUrl());
const storage = new TokenRateStorage(agentConfig.watchInterval);

function provideHandleBlock(
  alertChangeRate: number,
  watchTokens: string[],
  tokenStorage: TokenRateStorage,
  web3: Web3
) {
  return async (blockEvent: BlockEvent) => {
    const findings: Finding[] = [];

    // @ts-ignore
    const compound = CompoundConfig.getInstance(blockEvent.network);

    for (const cToken of compound.cTokens) {
      if (!watchTokens.includes(cToken.symbol)) continue;

      const tokenContract = new web3.eth.Contract(cToken.abi, cToken.address);

      // Fetch pool values
      const [cash, borrows, reserves] = await Promise.all([
        tokenContract.methods.getCash().call(),
        tokenContract.methods.totalBorrowsCurrent().call(),
        tokenContract.methods.totalReserves().call()
      ]);

      // Find the lowest and highest rates before we process this block
      const { lowestRate, highestRate } = tokenStorage.getRateStats(cToken.symbol);

      // Calculate current utilization rate
      const currentRate = new BigNumber(borrows).div(new BigNumber(cash).plus(borrows).minus(reserves));

      // Save current rate after we found the lowest and highest rates
      tokenStorage.add(cToken.symbol, currentRate, blockEvent.block.timestamp);

      // Skip if data are not enough
      if (tokenStorage.get(cToken.symbol).length < 2) continue;

      let direction: Direction;
      let relativeChange: BigNumber;

      if (currentRate.isLessThan(lowestRate)) {
        direction = 'down';
        relativeChange = currentRate.minus(highestRate).div(highestRate);
      } else if (currentRate.isGreaterThan(highestRate)) {
        direction = 'up';
        relativeChange = currentRate.minus(lowestRate).div(lowestRate);
      } else {
        continue;
      }

      // get updated stats after we added the current utilization rate
      const updatedStats = tokenStorage.getRateStats(cToken.symbol);

      if (relativeChange.abs().isGreaterThanOrEqualTo(alertChangeRate)) {
        const percent = formatNumber(relativeChange.abs().multipliedBy(100), 2);
        const minutes = Math.ceil(tokenStorage.expireTime / 60);

        findings.push(
          createFinding(
            cToken.symbol,
            cToken.address,
            direction,
            percent,
            minutes,
            updatedStats.lowestRate.toString(),
            updatedStats.highestRate.toString(),
            relativeChange.toString()
          )
        );
      }
    }

    return findings;
  };
}

export default {
  provideHandleBlock,
  handleBlock: provideHandleBlock(agentConfig.alertChangeRate, agentConfig.watchTokens, storage, web3)
};
