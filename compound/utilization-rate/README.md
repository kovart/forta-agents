# Compound Utilization Rate Agent

## Description

This agent monitors Ethereum network and alerts if utilization rate of
the provided pools changes by a certain percentage within a certain period.

## Alert strategy

The agent fires the alarm only once, when it reaches an extremum within a specified time interval.

## Variables

##### ALERT_CHANGE_RATE: `number`

- The minimum change needed to trigger the agent
- Default `0.1` (10%)

##### WATCH_INTERVAL: `number`

- The interval during which the change is detected
- Default `3600` (60 minutes)

##### WATCH_TOKENS: `Array<string>`

- Compound cToken pools
- Default `cUSDC`, `cDAI`, `cETH`

## Compound Configs

To make the agent more testable, all Compound configs are parsed
from the [compound-finance/compound-config](https://github.com/compound-finance/compound-config)
official repository and used depending on the `network` property provided in the block event.

## Supported Chains

- Ethereum

## Alerts

- COMP-UTILIZATION-RATE-0
  - Fired when utilization rate in specified pools changes by a specified percentage or more within a specified interval
  - Severity is always set to "medium"
  - Severity is always set to "suspicious"
  - `Metadata`
    - `lowestRate` the lowest utilization rate within current interval
    - `highestRate` the highest utilization rate within current interval
    - `change` current utilization rate change
