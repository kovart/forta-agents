# Forta Uniswap Governance Votes Agent

## Description

This agent monitors [Uniswap Governance](https://uniswap.org/governance) protocol and detects a significant increase of voting power before the proposal was created, 
and a decrease after the vote is cast. 

## Features

- Minimum API calls
- Memory optimizations

## Configs

File with configurable variables [is placed here](src/configs/agent-config.json).

##### votesChangeThreshold: `number`

- Amount of changed voting power, after which the agent starts firing alerts.
- Default `10,000` UNI

##### observableBlocksBeforeProposalCreated: `number`

- The number of blocks in which the agent checks for increase in voting power before proposal starting block number.
- Default `100` blocks

##### observableBlocksAfterVoteCast: `number`

- The number of blocks in which the agent checks for decrease in voting power after vote is cast.
- Default `100` blocks

## Supported Chains

- Ethereum

## Alerts

- KOVART-UNISWAPV3-VOTES-INCREASE-BEFORE-PROPOSAL-CREATED

  - Fired when an address casting a vote had a significant increase of voting power
    in the 100 blocks leading up to the proposal starting block number
  - Severity is always set to `"high"`
  - Type is always set to `"suspicious"`
  - Metadata:
    - `"voter"`: Voter address
    - `"votes"`: Amount of votes cast for the proposal
    - `"delta"`: Change amount (in votes)
    - `"support"`: The support value for the vote. 0=against, 1=for, 2=abstain
    - `"proposalId"`: Proposal identifier

- KOVART-UNISWAPV3-VOTES-DECREASE-AFTER-VOTE-CAST
  - Fired when an address casting a vote had a significant decrease of voting power after the vote is cast
  - Severity is always set to `"high"`
  - Type is always set to `"suspicious"`
  - Metadata:
    - `"voter"`: Voter address
    - `"votes"`: Amount of votes cast for the proposal
    - `"delta"`: Change amount (in votes)
    - `"support"`: The support value for the vote. 0=against, 1=for, 2=abstain
    - `"proposalId"`: Proposal identifier
