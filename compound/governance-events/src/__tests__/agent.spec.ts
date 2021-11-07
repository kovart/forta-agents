import { Finding, FindingSeverity, FindingType, Network } from 'forta-agent';

import agent from '../agent';
import { GovernanceSignature } from '../constants';
import { CompoundUtils } from '../utils';
import { TestUtils } from './utils';

const { handleTransaction, FAILED_EVENT_ALERT_ID, SUCCESS_EVENT_ALERT_ID } = agent;

const utils = new TestUtils(Network.MAINNET);

describe('compound governance agent', () => {
  describe('handleTransaction', () => {
    it('returns empty findings if governance address is not involved', async () => {
      const txEvent = utils.createTxEvent({});

      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if event has no address', async () => {
      const topicHash = utils.generateHash(GovernanceSignature.PROPOSAL_CREATED);

      const txEvent = utils.createTxEvent({
        logs: [
          {
            topics: [topicHash],
            address: ''
          }
        ]
      });

      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if event has wrong address', async () => {
      const topicHash = utils.generateHash(GovernanceSignature.PROPOSAL_CREATED);

      const txEvent = utils.createTxEvent({
        logs: [
          {
            topics: [topicHash],
            address: '0x01'
          }
        ]
      });

      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([]);
    });

    it("throws an error if network doesn't support GovernorBravo protocol", async () => {
      expect.assertions(1);

      const testFunc = async () => {
        const compound = CompoundUtils.getInstance(Network.GOERLI);
        const metadata = { id: '1234' };

        const { data, topics } = compound.encodeLog(GovernanceSignature.PROPOSAL_CANCELED, [
          Number(metadata.id)
        ]);

        const txEvent = utils.createTxEvent({
          logs: [
            {
              address: compound.GOVERNANCE_ADDRESS,
              topics: topics,
              data: data
            }
          ]
        });

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Event: ProposalCanceled',
          description: `Proposal ${metadata.id} canceled.`,
          alertId: SUCCESS_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Unknown,
          severity: FindingSeverity.Info,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      };

      await expect(testFunc()).rejects.toEqual(
        new Error(`No GovernorBravo address found in "${Network[Network.GOERLI]}" network`)
      );
    });

    describe('success events', () => {
      it('returns a finding if success ProposalCreated event (Ethers.js fails this test)', async () => {
        // This test is failed due to unknown decoding issue of Ethers library.
        // Unfortunately, decoder loses 'values' property and returns odd-length array of args ¯\_(ツ)_/¯

        const { metadata, txEvent } = utils.prepareTestData(GovernanceSignature.PROPOSAL_CREATED, [
          { id: 1234 },
          { proposer: '0x0000111122223333444455556666E33277111100' },
          { targets: ['0x0000111122223333444455556666E33277111100'] },
          { values: [666] },
          { signatures: ['123123'] },
          { calldatas: [] },
          { startBlock: 1000 },
          { endBlock: 2000 },
          { description: 'ProposalCreated description' }
        ]);

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Event: ProposalCreated',
          description:
            `Proposal ${metadata.id} created by ${metadata.proposer}.\n` +
            `Blocks [${metadata.startBlock}-${metadata.endBlock}].\n` +
            `Description: \n${metadata.description}`,
          alertId: SUCCESS_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Unknown,
          severity: FindingSeverity.Info,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if success ProposalCanceled event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(GovernanceSignature.PROPOSAL_CANCELED, [
          { id: 1234 }
        ]);

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Event: ProposalCanceled',
          description: `Proposal ${metadata.id} canceled.`,
          alertId: SUCCESS_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Unknown,
          severity: FindingSeverity.Info,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if success ProposalQueued event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(GovernanceSignature.PROPOSAL_QUEUED, [
          { id: 1234 },
          { eta: 44444 }
        ]);

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Event: ProposalQueued',
          description: `Proposal ${metadata.id} queued with ETA: ${metadata.eta}.`,
          alertId: SUCCESS_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Unknown,
          severity: FindingSeverity.Info,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if success ProposalThresholdSet event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(
          GovernanceSignature.PROPOSAL_THRESHOLD_SET,
          [{ oldProposalThreshold: 100 }, { newProposalThreshold: 200 }]
        );

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Event: ProposalThresholdSet',
          description: `Proposal threshold updated from ${metadata.oldProposalThreshold} to ${metadata.newProposalThreshold}.`,
          alertId: SUCCESS_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Unknown,
          severity: FindingSeverity.Info,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if success ProposalExecuted event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(GovernanceSignature.PROPOSAL_EXECUTED, [
          { id: 333 }
        ]);

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Event: ProposalExecuted',
          description: `Proposal ${metadata.id} executed.`,
          alertId: SUCCESS_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Unknown,
          severity: FindingSeverity.Info,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if success VoteCast event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(GovernanceSignature.VOTE_CAST, [
          { voter: '0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E' },
          { proposalId: 33 },
          { support: 0 },
          { votes: 33 },
          { reason: 'I am testing' }
        ]);

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Event: VoteCast',
          description:
            `${metadata.voter} voted "AGAINST" ${metadata.proposalId} proposal.\n` +
            `Votes: ${metadata.votes}.\n` +
            `Reason: ${metadata.reason}`,
          alertId: SUCCESS_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Unknown,
          severity: FindingSeverity.Info,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if success VotingDelaySet event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(GovernanceSignature.VOTING_DELAY_SET, [
          { oldVotingDelay: 200 },
          { newVotingDelay: 100 }
        ]);

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Event: VotingDelaySet',
          description: `Voting delay updated from ${metadata.oldVotingDelay} to ${metadata.newVotingDelay}.`,
          alertId: SUCCESS_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Unknown,
          severity: FindingSeverity.Info,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if success VotingPeriodSet event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(GovernanceSignature.VOTING_PERIOD_SET, [
          { oldVotingPeriod: 333 },
          { newVotingPeriod: 666 }
        ]);

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Event: VotingPeriodSet',
          description: `Voting period updated from ${metadata.oldVotingPeriod} to ${metadata.newVotingPeriod}.`,
          alertId: SUCCESS_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Unknown,
          severity: FindingSeverity.Info,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if success NewImplementation event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(
          GovernanceSignature.NEW_IMPLEMENTATION,
          [
            { oldImplementation: '0x29D7d1dd5B6f9C864d9db560D72a247c178aE86B' },
            { newImplementation: '0x9b4F8D5B6cB9Be1d98B169fC3aD686e156CB61Ce' }
          ]
        );

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Event: NewImplementation',
          description: `Implementation changed from ${metadata.oldImplementation} to ${metadata.newImplementation}.`,
          alertId: SUCCESS_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Unknown,
          severity: FindingSeverity.Info,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if success NewPendingAdmin event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(GovernanceSignature.NEW_PENDING_ADMIN, [
          { oldPendingAdmin: '0x29D7d1dd5B6f9C864d9db560D72a247c178aE86B' },
          { newPendingAdmin: '0x9b4F8D5B6cB9Be1d98B169fC3aD686e156CB61Ce' }
        ]);

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Event: NewPendingAdmin',
          description: `Pending admin changed from ${metadata.oldPendingAdmin} to ${metadata.newPendingAdmin}.`,
          alertId: SUCCESS_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Unknown,
          severity: FindingSeverity.Info,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if success NewAdmin event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(GovernanceSignature.NEW_ADMIN, [
          { oldAdmin: '0x29D7d1dd5B6f9C864d9db560D72a247c178aE86B' },
          { newAdmin: '0x9b4F8D5B6cB9Be1d98B169fC3aD686e156CB61Ce' }
        ]);

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Event: NewAdmin',
          description: `Admin updated from ${metadata.oldAdmin} to ${metadata.newAdmin}.`,
          alertId: SUCCESS_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Unknown,
          severity: FindingSeverity.Info,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });
    });

    describe('failed events', () => {
      it('returns a finding if failed ProposalCreated event (Ethers.js fails this test)', async () => {
        // This test is failed due to unknown decoding issue of Ethers library.
        // Unfortunately, decoder loses 'values' property and returns odd-length array of args ¯\_(ツ)_/¯

        const { metadata, txEvent } = utils.prepareTestData(
          GovernanceSignature.PROPOSAL_CREATED,
          [
            { id: 1234 },
            { proposer: '0x0000111122223333444455556666E33277111100' },
            { targets: ['0x0000111122223333444455556666E33277111100'] },
            { values: [666] },
            { signatures: ['123123'] },
            { calldatas: [] },
            { startBlock: 1000 },
            { endBlock: 2000 },
            { description: 'ProposalCreated description' }
          ],
          false
        );

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Failed Event: ProposalCreated',
          description:
            `Proposal ${metadata.id} created by ${metadata.proposer}.\n` +
            `Blocks [${metadata.startBlock}-${metadata.endBlock}].\n` +
            `Description: \n${metadata.description}`,
          alertId: FAILED_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Suspicious,
          severity: FindingSeverity.High,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if failed ProposalCanceled event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(
          GovernanceSignature.PROPOSAL_CANCELED,
          [{ id: 1234 }],
          false
        );

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Failed Event: ProposalCanceled',
          description: `Proposal ${metadata.id} canceled.`,
          alertId: FAILED_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Suspicious,
          severity: FindingSeverity.High,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if failed ProposalQueued event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(
          GovernanceSignature.PROPOSAL_QUEUED,
          [{ id: 1234 }, { eta: 44444 }],
          false
        );

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Failed Event: ProposalQueued',
          description: `Proposal ${metadata.id} queued with ETA: ${metadata.eta}.`,
          alertId: FAILED_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Suspicious,
          severity: FindingSeverity.High,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if failed ProposalThresholdSet event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(
          GovernanceSignature.PROPOSAL_THRESHOLD_SET,
          [{ oldProposalThreshold: 100 }, { newProposalThreshold: 200 }],
          false
        );

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Failed Event: ProposalThresholdSet',
          description: `Proposal threshold updated from ${metadata.oldProposalThreshold} to ${metadata.newProposalThreshold}.`,
          alertId: FAILED_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Suspicious,
          severity: FindingSeverity.High,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if failed ProposalExecuted event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(
          GovernanceSignature.PROPOSAL_EXECUTED,
          [{ id: 333 }],
          false
        );

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Failed Event: ProposalExecuted',
          description: `Proposal ${metadata.id} executed.`,
          alertId: FAILED_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Suspicious,
          severity: FindingSeverity.High,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if failed VoteCast event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(
          GovernanceSignature.VOTE_CAST,
          [
            { voter: '0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E' },
            { proposalId: 33 },
            { support: 0 },
            { votes: 33 },
            { reason: 'I am testing' }
          ],
          false
        );

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Failed Event: VoteCast',
          description:
            `${metadata.voter} voted "AGAINST" ${metadata.proposalId} proposal.\n` +
            `Votes: ${metadata.votes}.\n` +
            `Reason: ${metadata.reason}`,
          alertId: FAILED_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Suspicious,
          severity: FindingSeverity.High,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if failed VotingDelaySet event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(
          GovernanceSignature.VOTING_DELAY_SET,
          [{ oldVotingDelay: 200 }, { newVotingDelay: 100 }],
          false
        );

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Failed Event: VotingDelaySet',
          description: `Voting delay updated from ${metadata.oldVotingDelay} to ${metadata.newVotingDelay}.`,
          alertId: FAILED_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Suspicious,
          severity: FindingSeverity.High,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if failed VotingPeriodSet event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(
          GovernanceSignature.VOTING_PERIOD_SET,
          [{ oldVotingPeriod: 333 }, { newVotingPeriod: 666 }],
          false
        );

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Failed Event: VotingPeriodSet',
          description: `Voting period updated from ${metadata.oldVotingPeriod} to ${metadata.newVotingPeriod}.`,
          alertId: FAILED_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Suspicious,
          severity: FindingSeverity.High,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if failed NewImplementation event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(
          GovernanceSignature.NEW_IMPLEMENTATION,
          [
            { oldImplementation: '0x29D7d1dd5B6f9C864d9db560D72a247c178aE86B' },
            { newImplementation: '0x9b4F8D5B6cB9Be1d98B169fC3aD686e156CB61Ce' }
          ],
          false
        );

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Failed Event: NewImplementation',
          description: `Implementation changed from ${metadata.oldImplementation} to ${metadata.newImplementation}.`,
          alertId: FAILED_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Suspicious,
          severity: FindingSeverity.High,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if failed NewPendingAdmin event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(
          GovernanceSignature.NEW_PENDING_ADMIN,
          [
            { oldPendingAdmin: '0x29D7d1dd5B6f9C864d9db560D72a247c178aE86B' },
            { newPendingAdmin: '0x9b4F8D5B6cB9Be1d98B169fC3aD686e156CB61Ce' }
          ],
          false
        );

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Failed Event: NewPendingAdmin',
          description: `Pending admin changed from ${metadata.oldPendingAdmin} to ${metadata.newPendingAdmin}.`,
          alertId: FAILED_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Suspicious,
          severity: FindingSeverity.High,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });

      it('returns a finding if failed NewAdmin event', async () => {
        const { metadata, txEvent } = utils.prepareTestData(
          GovernanceSignature.NEW_ADMIN,
          [
            { oldAdmin: '0x29D7d1dd5B6f9C864d9db560D72a247c178aE86B' },
            { newAdmin: '0x9b4F8D5B6cB9Be1d98B169fC3aD686e156CB61Ce' }
          ],
          false
        );

        const findings = await handleTransaction(txEvent);

        const finding = Finding.fromObject({
          name: 'Compound Governance Failed Event: NewAdmin',
          description: `Admin updated from ${metadata.oldAdmin} to ${metadata.newAdmin}.`,
          alertId: FAILED_EVENT_ALERT_ID,
          protocol: 'Compound',
          type: FindingType.Suspicious,
          severity: FindingSeverity.High,
          metadata: metadata
        });

        expect(findings).toStrictEqual([finding]);
      });
    });
  });
});
