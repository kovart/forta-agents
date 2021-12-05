import { Finding, TransactionEvent } from 'forta-agent';
import reentrancyAgent from './execute.reentrancy';
import roleAgent from './role.change.event';

type Agent = {
  handleTransaction: (txEvent: TransactionEvent) => Promise<Finding[]>;
};

function provideHandleTransaction(executeReentrancyAgent: Agent, roleChangeEventAgent: Agent) {
  return async function handleTransaction(txEvent: TransactionEvent) {
    return (
      await Promise.all([
        executeReentrancyAgent.handleTransaction(txEvent),
        roleChangeEventAgent.handleTransaction(txEvent)
      ])
    ).flat();
  };
}

export default {
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(reentrancyAgent, roleAgent)
};
