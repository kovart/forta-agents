# Compound cToken Exchange Rate Agent

## Description

This agent monitors Ethereum network and alert if cToken exchange rate has changed.

## Compound Configs

To make the agent more testable, all Compound configs are parsed
from the [compound-finance/compound-config](https://github.com/compound-finance/compound-config)
official repository and used depending on the `network` property provided in the block event.

## Variables

#### ALERT_DROP_RATE: `number`
- Describes the minimum change needed to trigger the alert.
- Can be positive or negative

Examples:
```javascript
const ALERT_DROP_RATE = 0.2; // alert if dropped by 20% or more

const ALERT_DROP_RATE = -2.5; // alert if increased by 250% or more
```


## Supported Chains

- Ethereum

## Alerts

- COMP-CTOKEN-RATE-0
  - Fired when cToken exchange rate has changed by `ALERT_DROP_RATE` or more
  - Severity is always set to "medium"
  - Type is set to "high" if the rate decreased, and "info" if it increased
  - `Metadata` 
    - `currentRate` Current exchange rate
    - `previousRate` Previous exchange rate
