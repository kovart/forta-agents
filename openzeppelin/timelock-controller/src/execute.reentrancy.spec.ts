import {createAddress} from "forta-agent-tools";
import { HandleTransaction } from 'forta-agent';
import { TestTransactionEvent } from 'forta-agent-tools/lib/test';
import { utils } from 'ethers';
import { TestUtils } from './utils';
import Agent from './execute.reentrancy';

const { provideHandleTransaction, createZeroDelayFinding, createLifecycleViolationFinding } = Agent;

describe('execute reentrancy agent', () => {
  let mockLogUtils: any;
  let txEvent: TestTransactionEvent;
  let handleTransaction: HandleTransaction;

  const testUtils = new TestUtils();
  const operationId = utils.formatBytes32String('444');

  beforeEach(() => {
    txEvent = new TestTransactionEvent();
    mockLogUtils = { parse: jest.fn() };
    handleTransaction = provideHandleTransaction(mockLogUtils);
  });

  it('returns empty findings if there are no logs', async () => {
    mockLogUtils.parse.mockReturnValue([]);

    const findings = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([]);
  });

  it('returns empty findings if minDelay has not changed to 0', async () => {
    mockLogUtils.parse.mockReturnValue([testUtils.createMinDelayChangeLog(0)(1000, 1).parsedLog]);

    const findings = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([]);
  });

  it('returns empty findings if events have expected lifecycle', async () => {
    const logs = [
      testUtils.createCallScheduledLog(1)(operationId, 0, createAddress('0x0'), 0, [], '', 10),
      testUtils.createCallExecutedLog(2)(operationId, 1, createAddress('0x0'), 0, [])
    ];

    mockLogUtils.parse.mockReturnValue(logs.map((l) => l.parsedLog));

    const findings = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([]);
  });

  it('returns a finding if minDelay has been set to 0', async () => {
    const caller = createAddress('0x111');
    const contract = createAddress('0x222');

    txEvent.setFrom(caller);

    const log = testUtils.createMinDelayChangeLog(0, contract)(1000, 0);

    mockLogUtils.parse.mockReturnValue([log.parsedLog]);

    const findings = await handleTransaction(txEvent);

    const finding = createZeroDelayFinding(caller, contract);

    expect(findings).toStrictEqual([finding]);
  });

  it('returns "ZeroDelay" finding if minDelay has been set to 0 but CallExecuted and CallScheduled events have different contract addresses', async () => {
    const caller = createAddress('0x111');
    const contract1 = createAddress('0x222');
    const contract2 = createAddress('0x333');

    txEvent.setFrom(caller);

    const logs = [
      testUtils.createMinDelayChangeLog(0, contract1)(1000, 0),
      testUtils.createCallExecutedLog(1, contract1)(operationId, 0, contract1, 0, []),
      testUtils.createCallScheduledLog(2, contract2)(operationId, 1, contract2, 0, [], '', 0)
    ];

    mockLogUtils.parse.mockReturnValue(logs.map((l) => l.parsedLog));

    const findings = await handleTransaction(txEvent);

    const finding = createZeroDelayFinding(caller, contract1);

    expect(findings).toStrictEqual([finding]);
  });

  it('returns findings if detects lifecycle violation', async () => {
    const caller = createAddress('0x111');
    const contract = createAddress('0x222');

    txEvent.setFrom(caller);

    const logs = [
      testUtils.createMinDelayChangeLog(0, contract)(1000, 0),
      testUtils.createCallExecutedLog(1, contract)(operationId, 0, contract, 123, []),
      testUtils.createCallScheduledLog(2, contract)(operationId, 1, contract, 123, [], '', 0)
    ];

    mockLogUtils.parse.mockReturnValue(logs.map((l) => l.parsedLog));

    const findings = await handleTransaction(txEvent);

    const minChangeFinding = createZeroDelayFinding(caller, contract);
    const lifecycleViolationFinding = createLifecycleViolationFinding(
      caller,
      contract,
      operationId,
      '0',
      JSON.stringify({ target: contract, value: '123', data: '0x' })
    );

    expect(findings).toStrictEqual([minChangeFinding, lifecycleViolationFinding]);
  });

  it('returns findings for two exploited contracts', async () => {
    const caller = createAddress('0x111');
    const contract1 = createAddress('0x222');
    const contract2 = createAddress('0x333');

    txEvent.setFrom(caller);

    const logs = [
      testUtils.createMinDelayChangeLog(0, contract1)(1000, 0),
      testUtils.createCallExecutedLog(1, contract1)(operationId, 0, contract1, 0, []),
      testUtils.createCallScheduledLog(2, contract1)(operationId, 1, contract1, 0, [], '', 0),
      testUtils.createMinDelayChangeLog(3, contract2)(1000, 0),
      testUtils.createCallExecutedLog(4, contract2)(operationId, 0, contract2, 1, []),
      testUtils.createCallScheduledLog(5, contract2)(operationId, 1, contract2, 1, [], '', 0)
    ];

    mockLogUtils.parse.mockReturnValue(logs.map((l) => l.parsedLog));

    const findings = await handleTransaction(txEvent);

    const minChangeFinding1 = createZeroDelayFinding(caller, contract1);
    const lifecycleViolationFinding1 = createLifecycleViolationFinding(
      caller,
      contract1,
      operationId,
      '0',
      JSON.stringify({ target: contract1, value: '0', data: '0x' })
    );

    const minChangeFinding2 = createZeroDelayFinding(caller, contract2);
    const lifecycleViolationFinding2 = createLifecycleViolationFinding(
      caller,
      contract2,
      operationId,
      '0',
      JSON.stringify({ target: contract2, value: '1', data: '0x' })
    );

    expect(findings).toStrictEqual([
      minChangeFinding1,
      lifecycleViolationFinding1,
      minChangeFinding2,
      lifecycleViolationFinding2
    ]);
  });
});
