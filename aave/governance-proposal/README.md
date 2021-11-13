# Aave Governance Agent

## Description

This agents detects execution of [Aave Governance](https://governance.aave.com/) proposals.

## Supported Chains

- Ethereum (Mainnet)

## Alerts

- AAVE-GOVERNANCE-EVENT-0
  - Fired when a transaction contains logs with ProposalExecuted event 
  - Severity is always set to "medium"
  - Type is always set to "info"
  - Metadata
      - `proposalId`: proposal id
      - `basename`: basename (e.g. AIP-30)
      - `author`: proposal author
      - `creator`: address of the proposal creator
      - `title`: proposal title
      - `description`: proposal description
      - `discussions`: url link of the proposal discussion 
      - `created`: time when the proposal was created

## Test data

- 0x4dbfad3bed63aab882a0f8774eb0a147fd033f2d51e807961485c84476699aba (Mainnet)
- 0x55390f9ad5c1b325bc32f10f24c5a75d34a9d79869512f56ad95987044686ca1 (Mainnet)
- 0x56b5694adad6994206dae5573ecb78530a11fd50fde37aa996375c7bb3a70b0f (Mainnet)
- 0x50110967aa7137c493ce8c258388f76458bfe9beecd6d3b5da1f32015297c5fd (Mainnet)
- 0x742e32cd4f97161ea3d5928e71367bd09c859964998f8600a125e4e0a3baa408 (Mainnet)
