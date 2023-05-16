import uniq from 'lodash/uniq';
import { TransactionEvent, Finding, FindingSeverity, FindingType } from 'forta-agent';
import { LogUtils } from './utils';
import {
  ZERO_DELAY_ALERT_ID,
  EXPLOIT_ALERT_ID,
  TimelockControllerAbi,
  TimelockControllerEvents
} from './constants';

const { MinDelayChange, CallExecuted, CallScheduled } = TimelockControllerEvents;

const logUtils = new LogUtils();

function provideHandleTransaction(logUtils: LogUtils) {
  return async function handleTransaction(txEvent: TransactionEvent) {
    const findings: Finding[] = [];

    const logs = logUtils.parse(txEvent.logs, TimelockControllerAbi);
    const minDelayChangeLogs = logs.filter((log) => log.signature === MinDelayChange.signature);
    const involvedContractAddresses = uniq(minDelayChangeLogs.map((log) => log.address));

    // it is possible that transaction affects several contracts
    for (const contractAddress of involvedContractAddresses) {
      const contractLogs = logs.filter((log) => log.address === contractAddress);

      // find event where the minimum delay was changed to 0
      const minDelayChangeLog = contractLogs.find(
        (log) =>
          log.signature === MinDelayChange.signature && log.args['newDuration'].toString() === '0'
      );

      // if there are no min delay changes, isOperationReady() will revert the call
      if (!minDelayChangeLog) continue;

      findings.push(createZeroDelayFinding(txEvent.from, contractAddress));

      const logsAfterMinDelayChange = contractLogs.filter(
        (log) => log.logIndex > minDelayChangeLog.logIndex
      );

      const callExecutedLogs = logsAfterMinDelayChange.filter(
        (log) => log.signature === CallExecuted.signature
      );

      for (const callExecutedLog of callExecutedLogs) {
        const { id: operationId } = callExecutedLog.args;

        // find CallScheduled after CallExecuted with the same operation id parameter
        const callScheduledLog = logsAfterMinDelayChange.find(
          (log) =>
            log.signature === CallScheduled.signature &&
            log.args['id'] === operationId &&
            log.logIndex > callExecutedLog.logIndex
        );

        if (callScheduledLog) {
          const { target, value, data, delay } = callScheduledLog.args;

          findings.push(
            createLifecycleViolationFinding(
              txEvent.from,
              contractAddress,
              operationId,
              delay.toString(),
              JSON.stringify({ target, value: value.toString(), data })
            )
          );
        }
      }
    }

    return findings;
  };
}

function createZeroDelayFinding(fromAddress: string, contractAddress: string) {
  return Finding.fromObject({
    name: 'TimelockController Minimum Delay Changed To Zero',
    description: `TimelockController can now instantly execute dangerous maintenance operations`,
    alertId: ZERO_DELAY_ALERT_ID,
    severity: FindingSeverity.Critical,
    type: FindingType.Exploit,
    metadata: {
      from: fromAddress,
      contract: contractAddress
    }
  });
}

function createLifecycleViolationFinding(
  fromAddress: string,
  contractAddress: string,
  operationId: string,
  delay: string,
  callData: string // JSON
) {
  return Finding.fromObject({
    name: 'TimelockController Has Been Exploited',
    description:
      `TimelockController executed operation before it was scheduled.\n` +
      `Contract address: ${contractAddress}. Sender: ${fromAddress}.\n` +
      `Read more: https://forum.openzeppelin.com/t/timelockcontroller-vulnerability-post-mortem/14958`,
    alertId: EXPLOIT_ALERT_ID,
    severity: FindingSeverity.Critical,
    type: FindingType.Exploit,
    metadata: {
      from: fromAddress,
      operationId: operationId,
      contract: contractAddress,
      callData: callData,
      delay: delay
    }
  });
}

export default {
  createZeroDelayFinding,
  createLifecycleViolationFinding,
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(logUtils)
};
