import { createAddress, TestTransactionEvent } from 'forta-agent-tools';
import { utils } from 'ethers';
import {
  AAVE_GOVERNANCE_ADDRESS,
  PROPOSAL_EXECUTED_EVENT_ABI,
  PROPOSAL_EXECUTED_EVENT_SIGNATURE
} from './constants';
import agent from './agent';

const { provideHandleTransaction, createFinding } = agent;

describe('aave governance proposal agent', () => {
  describe('handleTransaction', () => {
    let governanceUtilsMock: any = null;

    const encode = (type: string, val: any) => utils.defaultAbiCoder.encode([type], [val]);

    beforeEach(() => {
      governanceUtilsMock = {
        getProposalById: jest.fn(),
        getProposalMetadata: jest.fn()
      };
    });

    it('returns empty findings if no logs are provided', async () => {
      const handleTransaction = provideHandleTransaction(governanceUtilsMock);

      const txEvent = new TestTransactionEvent();

      const findings = await handleTransaction(txEvent);

      expect(governanceUtilsMock.getProposalById.mock.calls.length).toBe(0);
      expect(governanceUtilsMock.getProposalMetadata.mock.calls.length).toBe(0);
      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if no ProposalExecuted logs are provided', async () => {
      const handleTransaction = provideHandleTransaction(governanceUtilsMock);

      const txEvent = new TestTransactionEvent();
      const signature = 'TestEvent(address)';
      const data = encode('address', AAVE_GOVERNANCE_ADDRESS);
      txEvent.addEventLog(signature, AAVE_GOVERNANCE_ADDRESS, data);

      const findings = await handleTransaction(txEvent);

      expect(governanceUtilsMock.getProposalById.mock.calls.length).toBe(0);
      expect(governanceUtilsMock.getProposalMetadata.mock.calls.length).toBe(0);
      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if ProposalExecuted log is provided', async () => {
      const proposalData = {
        id: 4321,
        creator: createAddress('0x01'),
        forVotes: '1234',
        againstVotes: '333'
      };

      const proposalMeta = {
        title: 'Risk Parameter Updates',
        basename: 'AIP-1234',
        author: 'Artem Kovalchuk',
        description: 'Test description',
        shortDescription: 'Test short description',
        discussions: 'https://github.com/kovart',
        created: '2021-10-25T00:00:00.000Z'
      };

      governanceUtilsMock.getProposalById.mockResolvedValueOnce(proposalData);
      governanceUtilsMock.getProposalMetadata.mockResolvedValueOnce(proposalMeta);

      const handleTransaction = provideHandleTransaction(governanceUtilsMock);

      const iface = new utils.Interface([PROPOSAL_EXECUTED_EVENT_ABI]);
      const { data, topics } = iface.encodeEventLog(PROPOSAL_EXECUTED_EVENT_SIGNATURE as any, [
        proposalData.id,
        createAddress('0x0222')
      ]);

      const txEvent = new TestTransactionEvent();
      txEvent.receipt.logs.push({
        address: AAVE_GOVERNANCE_ADDRESS,
        topics: topics,
        data: data
      } as any);

      const findings = await handleTransaction(txEvent);

      expect(governanceUtilsMock.getProposalById.mock.calls.length).toBe(1);
      expect(governanceUtilsMock.getProposalMetadata.mock.calls.length).toBe(1);
      expect(findings).toStrictEqual([
        createFinding(
          proposalData.id.toString(),
          proposalData.creator,
          proposalMeta.basename,
          proposalMeta.title,
          proposalData.forVotes,
          proposalData.againstVotes,
          proposalMeta.shortDescription,
          proposalMeta.description,
          proposalMeta.discussions,
          proposalMeta.author,
          proposalMeta.created
        )
      ]);
    });
  });
});
