import { GovernanceSignature } from './constants';
import { LogDescription } from 'ethers/lib/utils';

type GovernanceEvent = {
  name: string;
  signature: string;
  getDescription: (log: LogDescription) => string;
};

export const GovernanceEvents: GovernanceEvent[] = [
  {
    name: 'ProposalCreated',
    signature: GovernanceSignature.PROPOSAL_CREATED,
    getDescription(log: LogDescription) {
      const batch = [
        `Proposal ${log.args.id} created by ${log.args.proposer}.`,
        `Blocks [${log.args.startBlock}-${log.args.endBlock}].`
      ];

      if (log.args.description) {
        batch.push(`Description: \n${log.args.description}`);
      }

      return batch.join('\n');
    }
  },
  {
    name: 'ProposalCanceled',
    signature: GovernanceSignature.PROPOSAL_CANCELED,
    getDescription(log: LogDescription) {
      return `Proposal ${log.args.id} canceled.`;
    }
  },
  {
    name: 'ProposalQueued',
    signature: GovernanceSignature.PROPOSAL_QUEUED,
    getDescription(log: LogDescription) {
      return `Proposal ${log.args.id} queued with ETA: ${log.args.eta}.`;
    }
  },
  {
    name: 'ProposalThresholdSet',
    signature: GovernanceSignature.PROPOSAL_THRESHOLD_SET,
    getDescription(log: LogDescription) {
      return `Proposal threshold updated from ${log.args.oldProposalThreshold} to ${log.args.newProposalThreshold}.`;
    }
  },
  {
    name: 'ProposalExecuted',
    signature: GovernanceSignature.PROPOSAL_EXECUTED,
    getDescription(log: LogDescription) {
      return `Proposal ${log.args.id} executed.`;
    }
  },
  {
    name: 'VoteCast',
    signature: GovernanceSignature.VOTE_CAST,
    getDescription(log: LogDescription) {
      const supportKeys: { [x: string]: string } = {
        0: 'AGAINST',
        1: 'IN-FAVOR OF',
        2: 'ABSTAIN FROM'
      };

      const actionInterpretation = supportKeys[log.args.support] || log.args.support;

      const batch = [
        `${log.args.voter} voted "${actionInterpretation}" ${log.args.proposalId} proposal.`,
        `Votes: ${log.args.votes}.`
      ];

      if (log.args.reason) {
        batch.push(`Reason: ${log.args.reason}`);
      }

      return batch.join('\n');
    }
  },
  {
    name: 'VotingDelaySet',
    signature: GovernanceSignature.VOTING_DELAY_SET,
    getDescription(log: LogDescription) {
      return `Voting delay updated from ${log.args.oldVotingDelay} to ${log.args.newVotingDelay}.`;
    }
  },
  {
    name: 'VotingPeriodSet',
    signature: GovernanceSignature.VOTING_PERIOD_SET,
    getDescription(log: LogDescription) {
      return `Voting period updated from ${log.args.oldVotingPeriod} to ${log.args.newVotingPeriod}.`;
    }
  },
  {
    name: 'NewImplementation',
    signature: GovernanceSignature.NEW_IMPLEMENTATION,
    getDescription(log: LogDescription) {
      return `Implementation changed from ${log.args.oldImplementation} to ${log.args.newImplementation}.`;
    }
  },
  {
    name: 'NewPendingAdmin',
    signature: GovernanceSignature.NEW_PENDING_ADMIN,
    getDescription(log: LogDescription) {
      return `Pending admin changed from ${log.args.oldPendingAdmin} to ${log.args.newPendingAdmin}.`;
    }
  },
  {
    name: 'NewAdmin',
    signature: GovernanceSignature.NEW_ADMIN,
    getDescription(log: LogDescription) {
      return `Admin updated from ${log.args.oldAdmin} to ${log.args.newAdmin}.`;
    }
  }
];
