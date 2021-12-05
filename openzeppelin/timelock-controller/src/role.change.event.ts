import {
  Finding,
  FindingSeverity,
  FindingType,
  TransactionEvent,
  getEthersProvider
} from 'forta-agent';
import { LogUtils, TimelockUtils } from './utils';
import {
  PROTOCOL,
  ARCHIVE_DATA_MODE,
  ROLE_GRANTED_ALERT_ID,
  ROLE_REVOKED_ALERT_ID,
  ROLE_RENOUNCED_ALERT_ID,
  NO_SELF_ADMINISTRATION_ALERT_ID,
  TimelockControllerAbi,
  TimelockControllerEvents,
  TimelockControllerRoles
} from './constants';

const { RoleGranted, RoleRevoked } = TimelockControllerEvents;

const logUtils = new LogUtils();
const timelockUtils = new TimelockUtils(getEthersProvider(), ARCHIVE_DATA_MODE);

function provideHandleTransaction(timelockUtils: TimelockUtils, logUtils: LogUtils) {
  return async function handleTransaction(txEvent: TransactionEvent) {
    const findings: Finding[] = [];

    const logs = logUtils.parse(txEvent.receipt.logs, TimelockControllerAbi);

    const roleGrantedLogs = logs.filter((log) => log.signature === RoleGranted.signature);
    const roleRevokedLogs = logs.filter((log) => log.signature === RoleRevoked.signature);

    // nothing happened
    if (!roleGrantedLogs.length && !roleRevokedLogs.length) return findings;

    // we use it to get the state at a specific block
    const { blockNumber: blockTag } = txEvent;

    try {
      for (const roleGrantedLog of roleGrantedLogs) {
        const contractAddress = roleGrantedLog.address;
        const { role, account, sender } = roleGrantedLog.args;
        // get granted role name by its keccak256 hash
        const grantedRole = timelockUtils.getRoleNameByHash(role);
        // get current account roles including granted one (contract call)
        const accountRoles = await timelockUtils.getRoleNames(contractAddress, account, blockTag);
        // get current account roles except granted one
        const previousRoles = accountRoles.filter((role) => role !== grantedRole);

        const isSuspicious =
          previousRoles.includes(TimelockControllerRoles.EXECUTOR) &&
          (grantedRole === TimelockControllerRoles.PROPOSER ||
            grantedRole === TimelockControllerRoles.TIMELOCK_ADMIN);

        findings.push(
          createRoleGrantedFinding(
            contractAddress,
            previousRoles,
            grantedRole,
            account,
            sender,
            isSuspicious ? FindingSeverity.Critical : FindingSeverity.Info,
            isSuspicious ? FindingType.Suspicious : FindingType.Info
          )
        );
      }

      for (const roleRevokedLog of roleRevokedLogs) {
        const contractAddress = roleRevokedLog.address;
        const { role, account, sender } = roleRevokedLog.args;
        // get revoked role name by its keccak256 hash
        const revokedRole = timelockUtils.getRoleNameByHash(role);
        // get current account roles without revoked one
        const accountRoles = await timelockUtils.getRoleNames(contractAddress, account, blockTag);

        if (revokedRole === TimelockControllerRoles.TIMELOCK_ADMIN && account === contractAddress) {
          findings.push(createNoSelfAdministrationFinding(contractAddress, accountRoles, sender));
        } else if (account === sender) {
          findings.push(
            createRoleRenouncedFinding(contractAddress, accountRoles, revokedRole, account)
          );
        } else {
          findings.push(
            createRoleRevokedFinding(contractAddress, accountRoles, revokedRole, account, sender)
          );
        }
      }
    } catch {
      // contracts may have same event signatures, but different implementation
      // e.g. no hasRole() function
    }

    return findings;
  };
}

const joinRoleNames = (roles: string[]) =>
  roles.length > 0 ? `${roles.join(' and ')} ${roles.length > 1 ? 'roles' : 'role'}` : '';

function createRoleGrantedFinding(
  contract: string,
  previousRoles: string[],
  grantedRole: string,
  account: string,
  sender: string,
  severity: FindingSeverity,
  type: FindingType
) {
  return Finding.fromObject({
    name: `${grantedRole} Role Granted`,
    description:
      `Account ${account} ` +
      `${previousRoles.length > 0 ? `with ${joinRoleNames(previousRoles)} ` : ''}` +
      `has been granted a new ${grantedRole} role for contract ${contract}`,
    alertId: ROLE_GRANTED_ALERT_ID,
    protocol: PROTOCOL,
    severity: severity,
    type: type,
    metadata: {
      sender: sender,
      account: account,
      contract: contract,
      grantedRole: grantedRole,
      previousRoles: JSON.stringify(previousRoles)
    }
  });
}

function createNoSelfAdministrationFinding(
  contract: string,
  currentRoles: string[],
  sender: string
) {
  return Finding.fromObject({
    name: `Contract Lost Its Self-Administration`,
    description: `Contract address ${contract} has been revoked from ${TimelockControllerRoles.TIMELOCK_ADMIN} role`,
    alertId: NO_SELF_ADMINISTRATION_ALERT_ID,
    protocol: PROTOCOL,
    severity: FindingSeverity.High,
    type: FindingType.Suspicious,
    metadata: {
      sender: sender,
      contract: contract,
      contractRoles: JSON.stringify(currentRoles)
    }
  });
}

function createRoleRenouncedFinding(
  contract: string,
  currentRoles: string[],
  revokedRole: string,
  account: string
) {
  return Finding.fromObject({
    name: `${revokedRole} Role Renounced`,
    description:
      `Account ${account} ` +
      `${currentRoles.length > 0 ? `with ${joinRoleNames(currentRoles)} ` : ''}` +
      `has renounced ${revokedRole} role for contract ${contract}`,
    alertId: ROLE_RENOUNCED_ALERT_ID,
    protocol: PROTOCOL,
    severity: FindingSeverity.Medium,
    type: FindingType.Info,
    metadata: {
      account: account,
      contract: contract,
      revokedRole: revokedRole
    }
  });
}

function createRoleRevokedFinding(
  contract: string,
  currentRoles: string[],
  revokedRole: string,
  account: string,
  sender: string
) {
  return Finding.fromObject({
    name: `${revokedRole} Role Revoked`,
    description:
      `Account ${account} ` +
      `${currentRoles.length > 0 ? `with ${joinRoleNames(currentRoles)} ` : ''}` +
      `has been revoked ${revokedRole} role for contract ${contract}`,
    alertId: ROLE_REVOKED_ALERT_ID,
    protocol: PROTOCOL,
    severity: FindingSeverity.Medium,
    type: FindingType.Info,
    metadata: {
      sender: sender,
      account: account,
      contract: contract,
      revokedRole: revokedRole,
      currentRoles: JSON.stringify(currentRoles)
    }
  });
}

export default {
  createRoleGrantedFinding,
  createRoleRevokedFinding,
  createRoleRenouncedFinding,
  createNoSelfAdministrationFinding,
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(timelockUtils, logUtils)
};
