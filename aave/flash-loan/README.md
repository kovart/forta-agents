# Aave Flash Loan Agent

## Description

This agent detects flash loan transactions with a value ≥ $10,000,000. 

## Variables

##### VALUE_THRESHOLD: `number`

- Minimum transaction value needed to fire alerts
- Default `10000000` USDT

## Supported Chains

- Ethereum (Mainnet)

## Alerts

- AAVE-FLASH-LOAN-0
  - Fired when flash loan transaction value ≥ $10m
  - Severity is always set to "high"
  - Type is always set to "suspicious"
  - Metadata
    - assets: AssetMetadata[] (JSON String)
        - `symbol` token symbol
        - `address` token address
        - `decimals` token decimals
        - `price` token price in USDT
        - `amount` token amount 
        - `total` total price value in USDT

## Test data

You can find testing data in [the Etherscan explorer.](https://etherscan.io/address/0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9#events)
Filter `FlashLoan` events by the following topic: 0x631042c832b07452973831137f2d73e395028b44b250dedc5abb0ee766e168ac

----

Transactions with their required thresholds:

- 0x35513586bb48e808d4f6067ca5e79559b9e93c633704beb94a88bd39f42a28f3 (`PRICE_THRESHOLD` $300,000)
- 0x42b65ef0f48a345665a864b40fc3385e000bfad9df13360a956db56a2207d77c (`PRICE_THRESHOLD` $100,000)
- 0x38d67c325a56e31cd74e23ef75af4e5c6fc4fd4d7a9a3c8a9c2354aa65bb5e56 (`PRICE_THRESHOLD` $10,000)
