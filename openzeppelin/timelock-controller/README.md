# OpenZeppelin TimelockController Vulnerability Agent

## Description

This agent detects exploits of the OpenZeppelin `TimelockController` contract and helps to monitor role changes in it.

---

For a detailed description of the contract vulnerability refer to the [post-mortem.](https://forum.openzeppelin.com/t/timelockcontroller-vulnerability-post-mortem/14958)

## Supported roles

This agent fires alert if one of the following roles is detected in `RoleGranted` and `RoleRevoked` events:

- TIMELOCK_ADMIN_ROLE
- PROPOSER_ROLE
- EXECUTOR_ROLE
- DEFAULT_ADMIN_ROLE
- ADMIN_ROLE
- MINTER_ROLE
- BURNER_ROLE
- SWAPPER_ROLE
- SETTER_ROLE
- PAUSER_ROLE
- UNPAUSER_ROLE
- RELAY_ROLE
- ACTION_ROLE
- SNAPSHOT_ROLE

## Variables

Variables can be configured in the `constants.ts` file.

##### ARCHIVE_DATA_MODE: `boolean`

- Allows to get the state at the block an event was emitted
- Enable only if JSON-RPC Provider supports this mode
- Read more: https://infura.io/docs/ethereum/add-ons/archiveData
- Default `true`

## Supported Chains

- Ethereum

## Alerts

- OPENZEPPELIN-TIMELOCK-CONTROLLER-0
  - Fired if TimelockController minDelay has been set to 0
  - Severity is always set to `"critical"`
  - Type is always set to `"exploit"`
  - Metadata
    - `from` address of the sender
    - `contract` affected contract address

- OPENZEPPELIN-TIMELOCK-CONTROLLER-1
  - Fired if TimelockController executed operation before it was scheduled
  - Severity is always set to `"critical"`
  - Type is always set to `"exploit"`
  - Metadata
    - `from` address of the sender
    - `contract` affected contract address
    - `operationId` id of the executed operation
    - `callData` stringified operation params ({ target, value, data }) 
    - `delay` delay of the executed operation

- OPENZEPPELIN-TIMELOCK-CONTROLLER-2
  - Fired when a new role has been granted
  - Severity: 
    - `"critical"` if EXECUTOR became PROPOSER or TIMELOCK_ADMIN
    - `"info"` if it's a normal role granting
  - Type:
    - `"suspicious"` if EXECUTOR became PROPOSER or TIMELOCK_ADMIN
    - `"info"` if it's a normal role granting
  - Metadata
    - `sender` the account that originated the contract call
    - `account` granted account address
    - `contract` contract address
    - `grantedRole` granted role name
    - `accountRoles` all known roles of the account

- OPENZEPPELIN-TIMELOCK-CONTROLLER-3
  - Fired when role has been revoked
  - Severity is always set to `"medium"`
  - Type is always set to `"info"`
  - Metadata
    - `sender` the account that originated the contract call
    - `account` revoked account address
    - `contract` contract address
    - `revokedRole` revoked role name
    - `accountRoles` all known roles of the account without the revoked one

- OPENZEPPELIN-TIMELOCK-CONTROLLER-4
  - Fired when role has been renounced
  - Severity is always set to `"medium"`
  - Type is always set to `"info"`
  - Metadata
    - `account` renounced account address
    - `contract` contract address
    - `revokedRole` name of the renounced role

- OPENZEPPELIN-TIMELOCK-CONTROLLER-5
  - Fired if contract address has been revoked from `TIMELOCK_ADMIN` role
  - Severity is always set to `"high"`
  - Type is always set to `"suspicious"`
  - Metadata
    - `sender` the account that originated the contract call
    - `contract` contract address
    - `accountRoles` all known roles of the contract address

## Test data

- [0x7bd1f5a46bdc7b92696a877df186cfcfd350694b4d1ad9cffa073a2b19f051d7](https://etherscan.io/tx/0x7bd1f5a46bdc7b92696a877df186cfcfd350694b4d1ad9cffa073a2b19f051d7) (RoleRevoked)
- [0x940ca438b31e8c4a6f192b1af78918299c4f37e395c68f7927be3a4c1f944242](https://etherscan.io/tx/0x940ca438b31e8c4a6f192b1af78918299c4f37e395c68f7927be3a4c1f944242) (RoleGranted)
