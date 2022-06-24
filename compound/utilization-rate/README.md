# Compound Utilization Rate

## Description

This agent monitors Ethereum network and alerts if utilization rate of
the provided pools changes by a certain percentage within a certain period.

## Agent Config

You can setup your configuration in [agent-config.json](./agent-config.json) file.

##### alertChangeRate: `number`

- The minimum change needed to trigger the agent
- Default `0.1` (10%)

##### watchInterval: `number`

- The interval during which the change is detected
- Default `3600` (60 minutes)

##### watchTokens: `Array<string>`

- Compound cToken pools
- Default `cFEI`, `cUSDP`, `cAAVE`, `cSUSHI`, `cYFI`, `cTUSD`, `cLINK`, `cWBTC2`, `cCOMP`, `cUSDC`, `cDAI`, `cUSDT`, `cBAT`, `cETH`, `cSAI`, `cREP`, `cZRX`, `cWBTC`, `cUNI`, `cMKR`

## Compound Configs

To make the agent more testable, all Compound configs are parsed
from the [compound-finance/compound-config](https://github.com/compound-finance/compound-config)
official repository and used depending on the `network` property provided in the block event.

## Supported Chains

- Ethereum

## Alerts

- AK-COMP-UTILIZATION-RATE
  - Fired when utilization rate in specified pools changes by a specified percentage or more within a specified interval
  - Severity is always set to "medium"
  - Severity is always set to "suspicious"
  - `Metadata`
    - `tokenSymbol` token symbol
    - `tokenAddress` token address
    - `lowestRate` the lowest utilization rate within current interval
    - `highestRate` the highest utilization rate within current interval
    - `changeRate` change rate that caused the alert
