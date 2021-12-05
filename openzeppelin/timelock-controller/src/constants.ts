import { abi as TimelockControllerAbi } from '@openzeppelin/contracts/build/contracts/TimelockController.json';
import { utils } from 'ethers';

export const PROTOCOL = 'openzeppelin';
export const ZERO_DELAY_ALERT_ID = 'OPENZEPPELIN-TIMELOCK-CONTROLLER-0';
export const EXPLOIT_ALERT_ID = 'OPENZEPPELIN-TIMELOCK-CONTROLLER-1';
export const ROLE_GRANTED_ALERT_ID = 'OPENZEPPELIN-TIMELOCK-CONTROLLER-2';
export const ROLE_REVOKED_ALERT_ID = 'OPENZEPPELIN-TIMELOCK-CONTROLLER-3';
export const ROLE_RENOUNCED_ALERT_ID = 'OPENZEPPELIN-TIMELOCK-CONTROLLER-4';
export const NO_SELF_ADMINISTRATION_ALERT_ID = 'OPENZEPPELIN-TIMELOCK-CONTROLLER-5';
export const ARCHIVE_DATA_MODE = true; // https://infura.io/docs/ethereum/add-ons/archiveData

export const TimelockControllerRoles = {
  TIMELOCK_ADMIN: 'TIMELOCK_ADMIN',
  PROPOSER: 'PROPOSER',
  EXECUTOR: 'EXECUTOR'
};

export const TimelockControllerEvents = {
  MinDelayChange: getEvent('MinDelayChange'),
  CallScheduled: getEvent('CallScheduled'),
  CallExecuted: getEvent('CallExecuted'),
  RoleGranted: getEvent('RoleGranted'),
  RoleRevoked: getEvent('RoleRevoked')
};

export { TimelockControllerAbi };

function getEvent(name: string) {
  const abi = TimelockControllerAbi.find((item) => item.name === name);

  if (!abi) throw new Error(`Cannot find abi for event: ${name}`);

  return {
    abi: abi,
    signature: utils.EventFragment.from(abi).format('sighash')
  };
}
