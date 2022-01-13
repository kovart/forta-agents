# Compound Blacklist Agent

## Description

This agent detects transactions involving Compound Protocol and blacklisted addresses.

### Compound Protocol Address Registry

A list of Compound Protocol addresses was parsed from the 
[compound-finance/compound-config](https://github.com/compound-finance/compound-config) 
official repository.

### Blacklisted Address Registry

A list of addresses that deserve to be accompanied by an alert was taken from [MyEtherWallet repository.](https://github.com/MyEtherWallet/ethereum-lists)

## Supported Chains

- Ethereum

## Alerts

- KOVART-COMPOUND-BLACKLIST
  - Fired when a transaction involved addresses contains involves Compound Protocol and blacklisted address
  - Severity is always set to `"high"`
  - Type is always set to `"suspicious"`
  - Metadata:
    - `"compoundAddresses"` - detected Compound addresses (JSON)
        - Format: [{ address, comment? }]
    - `"blacklistedAddresses"` - detected blacklisted addresses (JSON)
        - Format: [{ address, path, name?, description? }]
