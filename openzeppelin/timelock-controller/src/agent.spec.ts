import { HandleTransaction } from 'forta-agent';
import { TestTransactionEvent } from 'forta-agent-tools/lib/test';
import agent from './agent';

const { provideHandleTransaction } = agent;

describe('TimelockController agent', () => {
  let handleTransaction: HandleTransaction;

  const mockRoleChangeEventAgent = {
    handleTransaction: jest.fn()
  };

  const mockExecuteReentrancyAgent = {
    handleTransaction: jest.fn()
  };

  beforeEach(() => {
    handleTransaction = provideHandleTransaction(
      mockExecuteReentrancyAgent,
      mockRoleChangeEventAgent
    );
  });

  it('invokes sub-agents and returns their findings', async () => {
    const roleChangeEventFinding = { target: 'roleChange' };
    const executeReentrancyFinding = { target: 'executeReentrancy' };

    mockRoleChangeEventAgent.handleTransaction.mockResolvedValueOnce(roleChangeEventFinding);
    mockExecuteReentrancyAgent.handleTransaction.mockResolvedValueOnce(executeReentrancyFinding);

    const txEvent = new TestTransactionEvent();
    const findings = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([executeReentrancyFinding, roleChangeEventFinding]);
    expect(mockRoleChangeEventAgent.handleTransaction).toHaveBeenCalledTimes(1);
    expect(mockRoleChangeEventAgent.handleTransaction).toHaveBeenCalledWith(txEvent);
    expect(mockExecuteReentrancyAgent.handleTransaction).toHaveBeenCalledTimes(1);
    expect(mockExecuteReentrancyAgent.handleTransaction).toHaveBeenCalledWith(txEvent);
  });
});
