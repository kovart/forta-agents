import { BlockEvent, Finding, FindingSeverity, FindingType, getJsonRpcUrl } from 'forta-agent';
import BigNumber from 'bignumber.js';
import Web3 from 'web3';
import { CompoundUtils, TokenStorage } from './utils';

export const EVENT_ALERT_ID = 'COMP-CTOKEN-RATE-0';
export const ALERT_DROP_RATE = 0.2; // alert if more than 20% rate drop

const web3 = new Web3(getJsonRpcUrl());
const storage = new TokenStorage();

function provideHandleBlock(web3: Web3, storage: TokenStorage, alertDropRate: number) {
  return async (block: BlockEvent) => {
    const findings: Finding[] = [];

    const compound = CompoundUtils.getInstance(block.network);

    for (const cToken of compound.cTokens) {
      const contract = new web3.eth.Contract(cToken.abi, cToken.address);
      const currentExchangeRate = await contract.methods.exchangeRateCurrent().call();
      const previousExchangeRate = storage.getLastExchangeRate(cToken.symbol);

      const dropRate = new BigNumber(1).minus(
        new BigNumber(currentExchangeRate).dividedBy(previousExchangeRate)
      );

      // format from 30.32323 to 30; 0.12444 to 0.12; 0.101212 to 0.1;
      const dropPercent = new BigNumber(new BigNumber(dropRate).multipliedBy(100).toFormat(2))
        .absoluteValue()
        .toString();

      storage.save(cToken.symbol, currentExchangeRate);

      const isDropped = dropRate.isGreaterThanOrEqualTo(0);
      const action = isDropped ? 'dropped' : 'increased';
      const type = isDropped ? FindingType.Suspicious : FindingType.Info;

      if (dropRate.isGreaterThanOrEqualTo(alertDropRate)) {
        findings.push(
          Finding.fromObject({
            name: `Compound ${cToken.symbol} Exchange Rate Down`,
            description: `Exchange rate of ${cToken.symbol} ${action} by ${dropPercent}%.`,
            alertId: EVENT_ALERT_ID,
            protocol: 'Compound',
            severity: FindingSeverity.Medium,
            type: type,
            metadata: {
              currentRate: currentExchangeRate.toString(),
              previousRate: previousExchangeRate.toString()
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
  handleBlock: provideHandleBlock(web3, storage, ALERT_DROP_RATE)
};
