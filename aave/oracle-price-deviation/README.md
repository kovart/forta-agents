# Aave Oracle Deviation Agent

## Description

This agent detects deviation in the prices delivered by Aave Price Oracle and its Fallback Oracle.
If the deviation is more than **10%**, the agent fires an alert.

---

Formula:

```js
Deviation = ABS((FallbackOraclePrice - OraclePrice) / OraclePrice) * 100%
```

## Variables

##### CHECK_INTERVAL: `number`

- Time interval, indicates how often the agent needs to check
- Default `900000` ms (every 15 minutes)

##### DEVIATION_THRESHOLD: `number`

- Minimum deviation percent, after which the agent can alert
- Default `10` (10%)

## Supported Chains

- Ethereum (Mainnet)

## Alerts

- AAVE-PRICE-DEVIATION-0
  - Fired if Fallback Oracle returns a price that deviates more than **10%** from last price delivered by Price Oracle
  - Severity is always set to "high"
  - Type is always set to "suspicious"
  - Metadata
    - `tokenSymbol` the asset symbol (e.g. USDT, DAI, Aave etc)
    - `tokenAddress` the asset address
    - `oraclePrice` the price delivered by Price Oracle
    - `fallbackOraclePrice` the price delivered by Fallback Price Oracle 
    - `oracleAddress` the address of Price Oracle 
    - `fallbackOracleAddress` the address of Fallback Oracle 
