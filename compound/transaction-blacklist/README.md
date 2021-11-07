# Compound Transaction Blacklist Agent

## Description

This agent monitors Ethereum network and detects Compound transactions that involve blacklisted addresses.

## Compound Network

To make the agent more testable, all network addresses are parsed from the [compound-finance/compound-config](https://github.com/compound-finance/compound-config) official repository and used depending on the network specified in the `COMPOUND_NETWORK` constant.

## Settings

First of all, it is necessary to provide the desired network: 

```js
export const COMPOUND_NETWORK = CompoundNetworkNames.MAINNET;
``` 

Then, specify all the blacklisted addresses you want to warn about:

```js
export const BLACKLISTED_ADDRESSES = [
  '0xb4f011d8ce90e13cdec209deb06025fbd9c0cba5',
  '0xa9497fd9d1dd0d00de1bf988e0e36794848900f9',
  // ... and others
];
```

That's it 😎

## Supported Chains

- Ethereum

## Alerts

- COMP-BLACKLIST
  - Fired when a transaction or subtransaction involves one of the blacklisted addresses
  - Severity is always set to "high"
  - Type is always set to "suspicious"
  - Metadata:
    - `compoundAddresses` - detected Compound addresses
    - `blacklistedAddresses` - detected blacklisted addresses

## Test Data

The agent behaviour can be verified with the following transactions (Mainnet):

- 0x4a9a92d30d0e95f7846a84cf155801db01710f01729370d40f242d537cc7477a
- 0xf225b72f5bd9f880dd99acd69ded17556e278f62ec3af516a27a623bf77294a6
