import { Finding, FindingType, TransactionEvent } from 'forta-agent';
import { utils } from 'ethers';
import { CompoundUtils, TransactionAnalyzer } from './utils';
import { ERC20_TRANSFER_SIGNATURE } from './constants';

export const EVENT_ALERT_ID = 'COMP-COMPTROLLER-UNUSUAL-TRANSFER-0';

// REAL WORLD VARIABLES MAY BE DIFFERENT
// -----------------------------------------
const MAX_AMOUNT = utils.parseEther('10'); // alert if transfer amount is more than 10000 COMP Tokens
const MIN_ORGANIC_TRANSACTIONS = 1000; // start analyzing organic increase rate after 1000 transactions
const ORGANIC_INCREASE_RATE = 1.5; // alert if amount is increased by more than 150% from the previous max amount
const EXPIRE_INTERVAL = 5 * 24 * 60 * 60 * 1000; // keep history for 5 days

const analyzer = new TransactionAnalyzer({
  expireTime: EXPIRE_INTERVAL,
  maxTransferAmount: MAX_AMOUNT.toString(),
  organicIncreaseRate: ORGANIC_INCREASE_RATE,
  minOrganicTransactions: MIN_ORGANIC_TRANSACTIONS
});

function provideHandlerTransaction(analyzer: TransactionAnalyzer) {
  return async (txEvent: TransactionEvent) => {
    const findings: Finding[] = [];

    const compound = CompoundUtils.getInstance(txEvent.network);

    const transferLogs = txEvent.filterEvent(
      ERC20_TRANSFER_SIGNATURE,
      compound.COMPOUND_TOKEN_ADDRESS
    );

    if (!transferLogs.length) return findings;

    for (const transferLog of transferLogs) {
      const log = compound.parseTransferLog(transferLog);
      const [from, to, amount] = log.args;

      if (from !== compound.COMPTROLLER_ADDRESS) continue;

      const { isUsual, description, severity } = analyzer.analyze(from, to, amount.toString());

      if (!isUsual) {
        findings.push(
          Finding.fromObject({
            name: `Compound Comptroller Unusual Transfer`,
            description: description,
            alertId: EVENT_ALERT_ID,
            protocol: 'Compound',
            severity: severity,
            type: FindingType.Suspicious,
            metadata: { from, to, amount: amount.toString() }
          })
        );
      }
    }

    return findings;
  };
}

export default {
  EVENT_ALERT_ID,
  provideHandlerTransaction,
  handleTransaction: provideHandlerTransaction(analyzer)
};
