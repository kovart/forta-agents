# Compound Governance Agent

## Description

This agent monitors Ethereum network and detects Compound Governance Events of Governor Bravo protocol.

Supported governance events: 
- ProposalCreated
- ProposalCanceled
- ProposalQueued
- ProposalThresholdSet
- ProposalExecuted
- VoteCast
- VotingDelaySet
- VotingPeriodSet
- NewImplementation
- NewPendingAdmin
- NewAdmin

---

You can read more [about Governance Protocol.](https://compound.finance/docs/governance)

Check out Compound Governance proposals [on the website.](https://comp.vote/)

## Compound Configs

To make the agent more testable, all Compound configs are parsed
from the [compound-finance/compound-config](https://github.com/compound-finance/compound-config)
official repository and used depending on the `network` property provided in the transaction event.


At the moment, Governor Bravo is only supported **on the Mainnet network**. 

## Supported Chains

- Ethereum

## Alerts

- COMP-GOVERNMENT-0
  - Fired when **failed** governance transaction is detected
  - Severity is always set to "high"
  - Type is always set to "suspicious"
  - `Metadata` contains all the detected event arguments
  
- COMP-GOVERNMENT-1
  - Fired when **successful** governance transaction is detected
  - Severity is always set to "info"
  - Type is always set to "unknown"
  - `Metadata` contains all the detected event arguments
  


## Test Data

The agent behaviour can be verified with the following transactions (Mainnet):

- 0x1011bcbe8b2bf6aa274d53d22bbb509d38270818ecdf550366baafd1b4ad8729 ([Proposal Created](https://compound.finance/governance/proposals/63))
- 0xe6f1dfb569f5841758e4967cee6315c656134c7a92eedf8c9abc8e46f3b2e540 ([Proposal Queued](https://compound.finance/governance/proposals/56))
- 0xfb6330eb14b12e603f088b3dee2868bf753356b85563996d129fa62d01c66935 ([Vote Cast](https://etherscan.io/tx/0xfb6330eb14b12e603f088b3dee2868bf753356b85563996d129fa62d01c66935))
- 0x508fb41d92720531093f0ac8183aab74b509233c6f5680e83c10a17c15c21327 ([Proposal Executed](https://compound.finance/governance/proposals/56))
- 0xfb6330eb14b12e603f088b3dee2868bf753356b85563996d129fa62d01c66935 ([Proposal Canceled](https://compound.finance/governance/proposals/63))
