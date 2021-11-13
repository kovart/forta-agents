import { Finding, FindingSeverity, FindingType, TransactionEvent } from 'forta-agent';
import { AAVE_GOVERNANCE_ADDRESS, PROPOSAL_EXECUTED_EVENT_ABI } from './constants';
import { AaveGovernanceUtils, IAaveGovernanceUtils } from './utils';

export const PROTOCOL = 'aave';
export const ALERT_ID = 'AAVE-GOVERNANCE-EVENT-0';

const governanceUtils = new AaveGovernanceUtils();

function provideHandleTransaction(governanceUtils: IAaveGovernanceUtils) {
  return async function handleTransaction(txEvent: TransactionEvent) {
    const findings: Finding[] = [];

    const executedProposalLogs = txEvent.filterLog(
      PROPOSAL_EXECUTED_EVENT_ABI,
      AAVE_GOVERNANCE_ADDRESS
    );

    if (!executedProposalLogs.length) return findings;

    for (const log of executedProposalLogs) {
      const proposalId = log.args.id;
      const proposal = await governanceUtils.getProposalById(proposalId);
      const metadata = await governanceUtils.getProposalMetadata(proposal.ipfsHash);

      const { creator, forVotes, againstVotes } = proposal;
      const { title, basename, author, shortDescription, description, discussions, created } =
        metadata;

      findings.push(
        createFinding(
          proposalId.toString(),
          creator.toString(),
          basename,
          title,
          forVotes.toString(),
          againstVotes.toString(),
          shortDescription,
          description,
          discussions,
          author,
          created
        )
      );
    }

    return findings;
  };
}

function createFinding(
  proposalId: string,
  creator: string,
  basename: string,
  title: string,
  forVotes: string,
  againstVotes: string,
  shortDescription: string,
  description: string,
  discussions: string,
  author: string,
  created: string
) {
  return Finding.fromObject({
    name: `Aave Governance Proposal Executed`,
    description:
      `Proposal ${basename} was executed. For votes: ${forVotes}. Against: ${againstVotes}.\n` +
      `Title: ${title}\n` +
      `Short description: ${shortDescription}` +
      `Discussions: ${discussions}\n`,
    alertId: ALERT_ID,
    protocol: PROTOCOL,
    severity: FindingSeverity.Medium,
    type: FindingType.Info,
    metadata: {
      proposalId: proposalId,
      basename: basename,
      author: author,
      creator: creator,
      title: title,
      description: description,
      discussions: discussions,
      created: created
    }
  });
}

export default {
  createFinding,
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(governanceUtils)
};
