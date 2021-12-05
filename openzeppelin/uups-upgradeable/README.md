# OpenZeppelin UUPSUpgradeable Exploit Agent

## Description

This agent detects `SELFDESTRUCT` exploits of the OpenZeppelin `UUPSUpgradeable` contract.

### UUPSUpgradeable vulnerability

Unlike transparent proxies, in which upgrade functionality is available on the proxy itself,
UUPS proxies have upgrade functionality embedded into the logic contract.
By calling the upgrade function, the storage slot on the proxy contract is updated to point to a new logic contract.
This is usually access controlled, preventing unauthorized users from upgrading the contract.
As a result, the logic contract will contain a `delegatecall` for the upgrade functionality, satisfying our first criterion.
If the logic contract is not initialized, it may be possible to take ownership of the logic contract by initializing it,
which may provide the requisite permissions to call the upgrade functionality, and in turn, access `delegatecall`.

If the attack is successful, any proxy contracts backed by this implementation become unusable,
as any calls to them are delegated to an address with no executable code.
Furthermore, since the upgrade logic resided in the implementation and not the proxy,
it is not possible to upgrade the proxy to a valid implementation.
This effectively bricks the contract, and impedes access to any assets held on it.

---

For a detailed description of the contract vulnerability refer to the 
[blog article](https://www.iosiro.com/blog/openzeppelin-uups-proxy-vulnerability-disclosure) 
and [post-mortem.](https://forum.openzeppelin.com/t/uupsupgradeable-vulnerability-post-mortem/15680)

## Supported Chains

- Ethereum

## Alerts

- OPENZEPPELIN-UUPS-UPGRADEABLE-0
  - Fired if a contract code is empty after `Upgraded` event is emitted
  - Severity is always set to `"critical"`
  - Type is always set to `"exploit"`
  - Metadata
    - `oldImplementation` address of the destroyed contract implementation
    - `newImplementation` address of the new contract implementation (attacker)

## Test data

Proof-of-Concept exploit can found here: [EXPLODING-KITTEN](https://github.com/yehjxraymond/exploding-kitten)
