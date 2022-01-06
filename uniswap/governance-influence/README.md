# Forta ERC20 Allowance Agent

## Description

This agent detects possible phishing attacks on ERC-20 compatible tokens.

---

Example phishing attack: [BadgerDAO](https://rekt.news/badger-rekt/)

## Configs

File with configurable variables [is placed here](src/configs/agent-config.json).

##### callsThreshold: `number`

- Number of approvals after which the agent starts firing alerts.
- Default `9` calls (alert if > 9)

##### secondsKeepApprovals: `number`

- Observation period of token transfer approvals
- The agent fires alert if it detects more than `callsThreshold` approvals to the same EOA over this period.
- Default `21600` seconds (6 hours)

##### secondsKeepFindings: `number`

- Extended observation period of token transfer approvals for detected phishing EOAs. 
- Default `604800` seconds (7 days)

##### secondsRegistryCache: `number`

- The period of address inactivity, after which we remove the address from the cache.
- Default `2678400` seconds (31 days)

## Features

- Minimum API calls
- Cache optimizations
- Memory optimizations
- Observable period in seconds (supports different networks)
- Extended observable period for detected attacks
- Amounts of involved tokens

## Supported Chains

- Ethereum

## Alerts

- KOVART-ERC-20-EOA-ALLOWANCE-0
    - Fired when detected a high number (`callsThreshold`) of EOA's call the 
    `approve()` and `increaseAllowance()` methods for the same target EOA over `secondsKeepApprovals`
    - Severity is always set to `high`
    - Type is always set to `suspicious`
    - Metadata:
        - `attacker`: address of the target EOA 
        - `tokens`: a stringified JSON array of token objects with amounts of tokens involved
            - Token object: `{ address, symbol, amount }`
        - `approvalsCount`: number of the approval calls to the attacker EOA
        - `affectedAddresses`: a stringified JSON array of affected addresses

## Test data

The agent should trigger when run against the following block range: 13650638 to 13652198.

```shell script
$ npm run range 13650638...13652198
```
