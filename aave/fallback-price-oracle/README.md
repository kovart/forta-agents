# Aave Fallback Price Oracle Agent

## Description

This agent scans Price Oracle transactions of the [Aave Protocol](https://aave.com/) and detects:

- External call to [`getFallbackOracle()`](https://docs.aave.com/developers/the-core-protocol/price-oracle#getfallbackoracle) function
- Internal call to [`getAssetPrice()`](https://docs.aave.com/developers/the-core-protocol/price-oracle#getassetprice) function of the fallback oracle

## Supported Chains

- Ethereum

## Alerts

- AAVE-FALLBACK-ORACLE-CALL-0
  - Fired when a transaction trace contains a call to `getFallbackOracle()` function
  - Severity is always set to "medium"
  - Type is always set to "info"
  - Metadata
    - `from` address that initiated the transaction
    - `oracleAddress` address of the Price Oracle contract
    - `fallbackOracleAddress` address of the Fallback Price Oracle contract

- AAVE-FALLBACK-ORACLE-CALL-1
  - Fired when a transaction trace contains a call to `getAssetPrice()` fallback function
  - Severity is always set to "medium"
  - Type is always set to "suspicious"
  - Metadata
    - `from` address that initiated the transaction
    - `asset` address of the asset to which the fallback oracle was called
    - `oracleAddress` address of the Price Oracle contract
    - `fallbackOracleAddress` address of the Fallback Price Oracle contract