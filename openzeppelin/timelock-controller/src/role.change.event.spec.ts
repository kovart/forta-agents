import { FindingSeverity, FindingType, HandleTransaction } from 'forta-agent';
import { createAddress, TestTransactionEvent } from 'forta-agent-tools';
import { TestUtils } from './utils';
import { TimelockControllerRoles } from './constants';
import Agent from './role.change.event';

const {
  provideHandleTransaction,
  createRoleGrantedFinding,
  createRoleRevokedFinding,
  createRoleRenouncedFinding,
  createNoSelfAdministrationFinding
} = Agent;

describe('role change event agent', () => {
  let mockLogUtils: any;
  let mockTimelockUtils: any;
  let txEvent: TestTransactionEvent;
  let handleTransaction: HandleTransaction;

  const testUtils = new TestUtils();

  beforeEach(() => {
    txEvent = new TestTransactionEvent();
    mockLogUtils = { parse: jest.fn() };
    mockTimelockUtils = { getRoleNameByHash: jest.fn(), getRoleNames: jest.fn() };
    handleTransaction = provideHandleTransaction(mockTimelockUtils, mockLogUtils);
  });

  it('returns empty findings if there are no logs', async () => {
    mockLogUtils.parse.mockReturnValue([]);

    const findings = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([]);
  });

  it('returns empty findings if there are no logs we are looking for', async () => {
    const log = testUtils.createMinDelayChangeLog()(1000, 400);

    mockLogUtils.parse.mockReturnValue([log.parsedLog]);

    const findings = await handleTransaction(txEvent);

    expect(findings).toStrictEqual([]);
  });

  it('returns RoleGranted finding with "Info" type', async () => {
    const contract = createAddress('0x111');
    const account = createAddress('0x222');
    const sender = createAddress('0x333');
    const role = TimelockControllerRoles.PROPOSER;

    const log = testUtils.createRoleGrantedLog(contract)(role, account, sender);
    const { role: roleHash } = log.parsedLog.args;

    mockLogUtils.parse.mockReturnValue([log.parsedLog]);
    mockTimelockUtils.getRoleNames.mockResolvedValueOnce([]);
    mockTimelockUtils.getRoleNameByHash.mockImplementationOnce((hash: string) => {
      if (roleHash === hash) return role;
    });

    const findings = await handleTransaction(txEvent);

    const finding = createRoleGrantedFinding(
      contract,
      [],
      role,
      account,
      sender,
      FindingSeverity.Info,
      FindingType.Info
    );

    expect(findings).toStrictEqual([finding]);
  });

  it('returns RoleGranted findings with "Suspicious" type', async () => {
    const contract = createAddress('0x111');
    const account = createAddress('0x222');
    const sender = createAddress('0x333');

    let finding, findings;

    // EXECUTOR became PROPOSER
    //--------------------------------------

    const proposerLogGranted = testUtils.createRoleGrantedLog(contract)(
      TimelockControllerRoles.PROPOSER,
      account,
      sender
    );
    const proposerRoleHash: string = proposerLogGranted.parsedLog.args.role;

    mockLogUtils.parse.mockReturnValueOnce([proposerLogGranted.parsedLog]);
    mockTimelockUtils.getRoleNames.mockResolvedValueOnce([TimelockControllerRoles.EXECUTOR]);
    mockTimelockUtils.getRoleNameByHash.mockImplementationOnce((hash: string) => {
      if (hash === proposerRoleHash) return TimelockControllerRoles.PROPOSER;
    });

    findings = await handleTransaction(txEvent);

    finding = createRoleGrantedFinding(
      contract,
      [TimelockControllerRoles.EXECUTOR],
      TimelockControllerRoles.PROPOSER,
      account,
      sender,
      FindingSeverity.Critical,
      FindingType.Suspicious
    );

    expect(findings).toStrictEqual([finding]);

    // EXECUTOR became TIMELOCK_ADMIN
    //--------------------------------------

    const adminRoleGrantedLog = testUtils.createRoleGrantedLog(contract)(
      TimelockControllerRoles.EXECUTOR,
      account,
      sender
    );
    const adminRoleHash: string = adminRoleGrantedLog.parsedLog.args.role;

    mockLogUtils.parse.mockReturnValueOnce([adminRoleGrantedLog.parsedLog]);
    mockTimelockUtils.getRoleNames.mockResolvedValueOnce([TimelockControllerRoles.EXECUTOR]);
    mockTimelockUtils.getRoleNameByHash.mockImplementationOnce((hash: string) => {
      if (hash === adminRoleHash) return TimelockControllerRoles.TIMELOCK_ADMIN;
    });

    findings = await handleTransaction(txEvent);

    finding = createRoleGrantedFinding(
      contract,
      [TimelockControllerRoles.EXECUTOR],
      TimelockControllerRoles.TIMELOCK_ADMIN,
      account,
      sender,
      FindingSeverity.Critical,
      FindingType.Suspicious
    );

    expect(findings).toStrictEqual([finding]);
  });

  it('returns RoleRevoked finding', async () => {
    const contract = createAddress('0x111');
    const account = createAddress('0x222');
    const sender = createAddress('0x333');
    const role = TimelockControllerRoles.PROPOSER;

    const log = testUtils.createRoleRevokedLog(contract)(role, account, sender);
    const { role: roleHash } = log.parsedLog.args;

    mockLogUtils.parse.mockReturnValue([log.parsedLog]);
    mockTimelockUtils.getRoleNames.mockResolvedValueOnce([]);
    mockTimelockUtils.getRoleNameByHash.mockImplementationOnce((hash: string) => {
      if (roleHash === hash) return role;
    });

    const findings = await handleTransaction(txEvent);

    const finding = createRoleRevokedFinding(contract, [], role, account, sender);

    expect(findings).toStrictEqual([finding]);
  });

  it('returns RoleRenounced finding', async () => {
    const contract = createAddress('0x111');
    const account = createAddress('0x222');
    const role = TimelockControllerRoles.EXECUTOR;

    const log = testUtils.createRoleRevokedLog(contract)(role, account, account);
    const { role: roleHash } = log.parsedLog.args;

    mockLogUtils.parse.mockReturnValue([log.parsedLog]);
    mockTimelockUtils.getRoleNames.mockResolvedValueOnce([]);
    mockTimelockUtils.getRoleNameByHash.mockImplementationOnce((hash: string) => {
      if (roleHash === hash) return role;
    });

    const findings = await handleTransaction(txEvent);

    const finding = createRoleRenouncedFinding(contract, [], role, account);

    expect(findings).toStrictEqual([finding]);
  });

  it('returns NoSelfAdministration finding', async () => {
    const contract = createAddress('0x111');
    const role = TimelockControllerRoles.TIMELOCK_ADMIN;

    const log = testUtils.createRoleRevokedLog(contract)(role, contract, contract);
    const { role: roleHash } = log.parsedLog.args;

    mockLogUtils.parse.mockReturnValue([log.parsedLog]);
    mockTimelockUtils.getRoleNames.mockResolvedValueOnce([]);
    mockTimelockUtils.getRoleNameByHash.mockImplementationOnce((hash: string) => {
      if (roleHash === hash) return role;
    });

    const findings = await handleTransaction(txEvent);

    const finding = createNoSelfAdministrationFinding(contract, [], contract);

    expect(findings).toStrictEqual([finding]);
  });

  it('returns multiple findings', async () => {
    const contract1 = createAddress('0x111');
    const contract2 = createAddress('0x122');
    const sender1 = createAddress('0x211');
    const sender2 = createAddress('0x222');
    const account1 = createAddress('0x311');
    const account2 = createAddress('0x322');
    const role1 = TimelockControllerRoles.PROPOSER;
    const role2 = TimelockControllerRoles.EXECUTOR;

    const log1 = testUtils.createRoleGrantedLog(contract1)(role1, account1, sender1);
    const log2 = testUtils.createRoleRevokedLog(contract2)(role2, account2, sender2);

    const { role: role1Hash } = log1.parsedLog.args;
    const { role: role2Hash } = log2.parsedLog.args;

    mockLogUtils.parse.mockReturnValue([log1.parsedLog, log2.parsedLog]);
    mockTimelockUtils.getRoleNames.mockResolvedValue([]);
    mockTimelockUtils.getRoleNameByHash.mockImplementation((hash: string) => {
      if (role1Hash === hash) return role1;
      if (role2Hash === hash) return role2;
    });

    const findings = await handleTransaction(txEvent);

    const finding1 = createRoleGrantedFinding(
      contract1,
      [],
      role1,
      account1,
      sender1,
      FindingSeverity.Info,
      FindingType.Info
    );

    const finding2 = createRoleRevokedFinding(contract2, [], role2, account2, sender2);

    expect(findings).toStrictEqual([finding1, finding2]);
  });
});
