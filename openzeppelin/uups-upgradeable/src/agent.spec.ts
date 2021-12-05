import { HandleTransaction } from 'forta-agent';
import { createAddress, TestTransactionEvent } from 'forta-agent-tools';
import { ERC1967_UPGRADED_EVENT_ABI } from './constants';
import { createLog } from './utils';
import Agent from './agent';

const { provideHandleTransaction, createSelfDestructFinding } = Agent;

describe('UUPSUpgradeable exploit agent', () => {
  let txEvent: TestTransactionEvent;
  let handleTransaction: HandleTransaction;
  let mockJsonRpcProvider: any;

  beforeEach(() => {
    txEvent = new TestTransactionEvent();
    mockJsonRpcProvider = { getCode: jest.fn() };
    handleTransaction = provideHandleTransaction(mockJsonRpcProvider);
  });

  it('returns empty findings if there are no events', async () => {
    const findings = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([]);
    expect(mockJsonRpcProvider.getCode).toHaveBeenCalledTimes(0);
  });

  it('returns empty findings if there are no "Upgraded" events', async () => {
    txEvent.receipt.logs.push(
      createLog('event TestEvent(address indexed)', createAddress('0x111'), [
        createAddress('0x222')
      ])
    );

    const findings = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([]);
    expect(mockJsonRpcProvider.getCode).toHaveBeenCalledTimes(0);
  });

  it('returns empty findings if there is "Upgraded" event but code is still present', async () => {
    const blockNumber = 12345678;
    const implementation = createAddress('0x111');

    txEvent.setBlock(blockNumber);
    txEvent.receipt.logs.push(
      createLog(ERC1967_UPGRADED_EVENT_ABI, implementation, [createAddress('0x222')])
    );

    mockJsonRpcProvider.getCode.mockResolvedValue('contract {}');

    const findings = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([]);
    expect(mockJsonRpcProvider.getCode).toHaveBeenCalledTimes(1);
    expect(mockJsonRpcProvider.getCode).toHaveBeenCalledWith(implementation, blockNumber);
  });

  it('returns a finding if there is "Upgraded" event and code is not present', async () => {
    const blockNumber = 12345678;
    const oldImplementation = createAddress('0x111');
    const newImplementation = createAddress('0x222');

    txEvent.setBlock(blockNumber);
    txEvent.receipt.logs.push(
      createLog(ERC1967_UPGRADED_EVENT_ABI, oldImplementation, [newImplementation])
    );

    mockJsonRpcProvider.getCode.mockResolvedValue('0x');

    const findings = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([
      createSelfDestructFinding(oldImplementation, newImplementation)
    ]);
    expect(mockJsonRpcProvider.getCode).toHaveBeenCalledTimes(1);
    expect(mockJsonRpcProvider.getCode).toHaveBeenCalledWith(oldImplementation, blockNumber);
  });

  it('returns multiple findings if multiple exploits are applied', async () => {
    const blockNumber = 12345678;
    const oldImplementation1 = createAddress('0x111');
    const newImplementation1 = createAddress('0x222');
    const oldImplementation2 = createAddress('0x333');
    const newImplementation2 = createAddress('0x444');

    txEvent.setBlock(blockNumber);
    txEvent.receipt.logs.push(
      createLog(ERC1967_UPGRADED_EVENT_ABI, oldImplementation1, [newImplementation1])
    );
    txEvent.receipt.logs.push(
      createLog('event OffTop(address indexed)', oldImplementation2, [newImplementation2])
    );
    txEvent.receipt.logs.push(
      createLog(ERC1967_UPGRADED_EVENT_ABI, oldImplementation2, [newImplementation2])
    );

    mockJsonRpcProvider.getCode.mockImplementation((address: string, block: number) =>
      [oldImplementation1, oldImplementation2].includes(address) && block === blockNumber
        ? Promise.resolve('0x')
        : Promise.resolve('contract {}')
    );

    const findings = await handleTransaction(txEvent);

    const finding1 = createSelfDestructFinding(oldImplementation1, newImplementation1);
    const finding2 = createSelfDestructFinding(oldImplementation2, newImplementation2);

    expect(findings).toStrictEqual([finding1, finding2]);
    expect(mockJsonRpcProvider.getCode).toHaveBeenCalledTimes(2);
  });
});
