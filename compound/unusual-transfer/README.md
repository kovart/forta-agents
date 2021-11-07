# Compound Unusual Transfer Agent

## Description

This agent monitors Ethereum network and detects large/unusual transfers out of Comptroller Contract.

## Compound Configs

To make the agent more testable, all Compound configs are parsed
from the [compound-finance/compound-config](https://github.com/compound-finance/compound-config)
official repository and used depending on the `network` property provided in the transaction event.

## Settings

Basic setup contains four variables:

```js
const MAX_AMOUNT = utils.parseEther('10000'); // alert if transfer amount is more than 10000 COMP Tokens
const MIN_ORGANIC_TRANSACTIONS = 1000; // start analyzing organic increase rate after 1000 transactions
const ORGANIC_INCREASE_RATE = 5.5; // alert if amount is increased by more than 550% from the previous max amount
const EXPIRE_INTERVAL = 10 * 24 * 60 * 60 * 1000; // keep history for 10 days
```

## Supported Chains

- Ethereum

## Alerts

- COMP-COMPTROLLER-UNUSUAL-TRANSFER-0
  - Fired when Comptroller contract transfers a large amount of COMP tokens or if the transfer amount looks inorganic
  - Severity is set to "high" if it is an unusual transfer, and "critical" if it is a large transfer
  - Type is always set to "suspicious"
  - `Metadata` 
    - `from` From address
    - `to` To address
    - `amount` Amount of COMP tokens 
  


## Test Data

The agent behaviour can be verified with the following transactions (Mainnet):

- 0x63e1d1eb27f05813b1e7034379a8849d2ce12f90b366ab3a61efdbcdb3724c11 ([Large amount](https://etherscan.io/tx/0x63e1d1eb27f05813b1e7034379a8849d2ce12f90b366ab3a61efdbcdb3724c11))
- 0x2f644eb0cd32b83e9d5aa7e633e3d8ad35355201cbb218210203ec95dc95c720 ([Large amount](https://etherscan.io/tx/0x2f644eb0cd32b83e9d5aa7e633e3d8ad35355201cbb218210203ec95dc95c720))


> Unfortunately, the detection of unusual (inorganic) transactions can only be tested with continuous event processing.
