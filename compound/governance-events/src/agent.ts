import {
  Finding,
  FindingType,
  FindingSeverity,
  TransactionEvent,
  HandleTransaction
} from 'forta-agent';
import { CompoundUtils } from './utils';
import { GovernanceEvents } from './events';

export const FAILED_EVENT_ALERT_ID = 'COMP-GOVERNMENT-0';
export const SUCCESS_EVENT_ALERT_ID = 'COMP-GOVERNMENT-1';

const handleTransaction: HandleTransaction = async (txEvent: TransactionEvent) => {
  const findings: Finding[] = [];

  const compound = CompoundUtils.getInstance(txEvent.network);

  for (const governanceEvent of GovernanceEvents) {
    const logs = txEvent.filterEvent(governanceEvent.signature, compound.GOVERNANCE_ADDRESS);

    for (const log of logs) {
      const parsedLog = compound.parseLog(log);
      const metadata = compound.parseMetadata(parsedLog);
      const description = governanceEvent.getDescription(parsedLog);

      if (txEvent.status) {
        findings.push(
          Finding.fromObject({
            name: `Compound Governance Event: ${parsedLog.name}`,
            description: description,
            alertId: SUCCESS_EVENT_ALERT_ID,
            protocol: 'Compound',
            severity: FindingSeverity.Info,
            type: FindingType.Unknown,
            metadata: metadata
          })
        );
      } else {
        findings.push(
          Finding.fromObject({
            name: `Compound Governance Failed Event: ${parsedLog.name}`,
            description: description,
            alertId: FAILED_EVENT_ALERT_ID,
            protocol: 'Compound',
            type: FindingType.Suspicious,
            severity: FindingSeverity.High,
            metadata: metadata
          })
        );
      }
    }
  }

  return findings;
};

export default {
  handleTransaction,
  SUCCESS_EVENT_ALERT_ID,
  FAILED_EVENT_ALERT_ID
};
