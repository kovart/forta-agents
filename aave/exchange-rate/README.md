# Aave Exchange Rate Agent

## Description

This agent detects changes in exchange rates for specified pairs of tokens.

Default pairs:
- USDC / DAI 
- USDT / DAI 
- USDP / DAI 
- GUSD / DAI 

## Variables

##### CHECK_INTERVAL: `number`

- Time interval, indicates how often the agent needs to check
- Default `300000` ms (every 5 minutes)

##### ENABLE_REVERSE_ORDER: `boolean`

- Mode, that makes the agent also check reverse pairs (USDC/DAI -> DAI/USDC)
- With this mode the agent detects down movements for both ratios
- Default `true`

##### TOKEN_PAIRS: `string[][]`

- Array of token pairs that the agent needs to monitor
- You can find a complete list of supported tokens in the documentation [on the website.](https://docs.aave.com/developers/deployed-contracts/deployed-contracts)
- Default:
```javascript
[
  ['USDC', 'DAI'],
  ['USDT', 'DAI'],
  ['USDP', 'DAI'],
  ['GUSD', 'DAI']
]
````

## Supported Chains

- Ethereum (Mainnet)

## Alerts

- AAVE-EXCHANGE-RATE-0
  - Fired when exchange rate for specified pairs of tokens goes down
  - Severity depends on the deviation percent (`X`)
    - `info` X < 0.5%
    - `low` 0.5% <= X < 1%
    - `medium` 1 <= X < 1.5%
    - `high` 1.5 <= X < 3%
    - `critical` X >= 3%
  - Type is always set to "suspicious"
  - Metadata
    - `token1` address of the first token in the pair
    - `token2` address of the second token in the pair
    - `price1` price of the first token in the pair
    - `price2` price of the second token in the pair
    - `exchangeRate` exchange rate calculated by the formula: `price1`/`price2`
