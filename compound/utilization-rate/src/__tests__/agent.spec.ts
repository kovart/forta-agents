import { BlockEvent, Finding, FindingSeverity, FindingType } from 'forta-agent';
import { createBlockEventMock, Web3Mock } from './utils';
import { TokenRateStorage } from '../utils';
import agent from '../agent';

const { provideHandleBlock, EVENT_ALERT_ID } = agent;

describe('compound cToken utilization rate agent', () => {
  describe('handleBlock', () => {
    let dummyBlockEvent: BlockEvent;

    beforeEach(() => {
      dummyBlockEvent = createBlockEventMock();
    });

    it('returns empty findings if it is a first event', async () => {
      const storage = new TokenRateStorage();
      const web3Mock = new Web3Mock('1000', '100', '100') as any;
      const handleBlock = provideHandleBlock(0.2, ['cETH'], storage, web3Mock);

      const findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if utilization rate has not changed', async () => {
      const storage = new TokenRateStorage();
      const web3Mock = new Web3Mock('1000', '100', '100') as any;
      const handleBlock = provideHandleBlock(0.2, ['cETH'], storage, web3Mock);

      let findings: any[] = [];

      for (let i = 0; i < 10; i++) {
        if (!findings.length) {
          findings = await handleBlock(dummyBlockEvent);
        }
      }

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if utilization rate changed by less than alert rate', async () => {
      const storage = new TokenRateStorage();
      const web3Mock = new Web3Mock('1000', '100', '100') as any;
      const handleBlock = provideHandleBlock(1.99, ['cETH'], storage, web3Mock);

      // Handle first block
      let findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);

      // Change cash amount in the cETH market
      web3Mock.cash = '2000';

      findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if utilization rate increased by alert rate', async () => {
      const storage = new TokenRateStorage();
      const web3Mock = new Web3Mock('1000', '100', '100') as any;
      const handleBlock = provideHandleBlock(1, ['cETH'], storage, web3Mock);

      // Handle first block
      let findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);

      // Change cash amount in the cETH market
      web3Mock.cash = '500';

      findings = await handleBlock(dummyBlockEvent);

      const finding = Finding.fromObject({
        alertId: EVENT_ALERT_ID,
        name: 'Compound cETH Utilization Rate Change',
        description: 'Utilization rate of cETH is up 200% within 60 minutes',
        protocol: 'Compound',
        severity: FindingSeverity.Medium,
        type: FindingType.Suspicious,
        metadata: {
          highestRate: '0.2',
          lowestRate: '0.1',
          change: '0.1'
        }
      });

      expect(findings).toStrictEqual([finding]);
    });

    it('returns a finding if utilization rate decreased by alert rate', async () => {
      const storage = new TokenRateStorage();
      const web3Mock = new Web3Mock('1000', '100', '100') as any;
      const handleBlock = provideHandleBlock(0.5, ['cETH'], storage, web3Mock);

      // Handle first block
      let findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);

      // Change cash amount in the cETH market
      web3Mock.cash = '2000';

      findings = await handleBlock(dummyBlockEvent);

      const finding = Finding.fromObject({
        alertId: EVENT_ALERT_ID,
        name: 'Compound cETH Utilization Rate Change',
        description: 'Utilization rate of cETH is down 50% within 60 minutes',
        protocol: 'Compound',
        severity: FindingSeverity.Medium,
        type: FindingType.Suspicious,
        metadata: {
          highestRate: '0.1',
          lowestRate: '0.05',
          change: '0.05'
        }
      });

      expect(findings).toStrictEqual([finding]);
    });

    it('returns a finding if utilization rate changed by more than alert rate', async () => {
      const storage = new TokenRateStorage();
      const web3Mock = new Web3Mock('1000', '100', '100') as any;
      const handleBlock = provideHandleBlock(0.9, ['cETH'], storage, web3Mock);

      // Handle first block
      let findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);

      // Change cash amount in the cETH market
      web3Mock.cash = '500';

      findings = await handleBlock(dummyBlockEvent);

      const finding = Finding.fromObject({
        alertId: EVENT_ALERT_ID,
        name: 'Compound cETH Utilization Rate Change',
        description: 'Utilization rate of cETH is up 200% within 60 minutes',
        protocol: 'Compound',
        severity: FindingSeverity.Medium,
        type: FindingType.Suspicious,
        metadata: {
          highestRate: '0.2',
          lowestRate: '0.1',
          change: '0.1'
        }
      });

      expect(findings).toStrictEqual([finding]);
    });

    it('returns multiple pool findings if utilization rate changed by more than alert rate', async () => {
      const storage = new TokenRateStorage();
      const web3Mock = new Web3Mock('1000', '100', '100') as any;
      const handleBlock = provideHandleBlock(0.1, ['cETH', 'cDAI'], storage, web3Mock);

      // Handle first block
      let findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);

      // Change cash amount in the cETH and cDAI markets
      web3Mock.cash = '500';

      findings = await handleBlock(dummyBlockEvent);

      // The agent does not guarantee findings order so we have to compare them separately

      expect(findings.find((f) => f.name.indexOf('cETH') > -1)).toStrictEqual(
        Finding.fromObject({
          alertId: EVENT_ALERT_ID,
          name: 'Compound cETH Utilization Rate Change',
          description: 'Utilization rate of cETH is up 200% within 60 minutes',
          protocol: 'Compound',
          severity: FindingSeverity.Medium,
          type: FindingType.Suspicious,
          metadata: {
            highestRate: '0.2',
            lowestRate: '0.1',
            change: '0.1'
          }
        })
      );

      expect(findings.find((f) => f.name.indexOf('cDAI') > -1)).toStrictEqual(
        Finding.fromObject({
          alertId: EVENT_ALERT_ID,
          name: 'Compound cDAI Utilization Rate Change',
          description: 'Utilization rate of cDAI is up 200% within 60 minutes',
          protocol: 'Compound',
          severity: FindingSeverity.Medium,
          type: FindingType.Suspicious,
          metadata: {
            highestRate: '0.2',
            lowestRate: '0.1',
            change: '0.1'
          }
        })
      );
    });

    it('returns finding for change up then change down', async () => {
      const storage = new TokenRateStorage();
      const web3Mock = new Web3Mock('1000', '100', '100') as any;
      const handleBlock = provideHandleBlock(0.1, ['cETH'], storage, web3Mock);

      // Handle first block
      let findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);

      web3Mock.cash = '500';

      // Expect a 200% change up
      findings = await handleBlock(dummyBlockEvent);

      let finding = Finding.fromObject({
        alertId: EVENT_ALERT_ID,
        name: 'Compound cETH Utilization Rate Change',
        description: 'Utilization rate of cETH is up 200% within 60 minutes',
        protocol: 'Compound',
        severity: FindingSeverity.Medium,
        type: FindingType.Suspicious,
        metadata: {
          highestRate: '0.2',
          lowestRate: '0.1',
          change: '0.1'
        }
      });

      expect(findings).toStrictEqual([finding]);

      web3Mock.cash = '2000';

      // Then expect a 75%% change down
      findings = await handleBlock(dummyBlockEvent);

      finding = Finding.fromObject({
        alertId: EVENT_ALERT_ID,
        name: 'Compound cETH Utilization Rate Change',
        description: 'Utilization rate of cETH is down 75% within 60 minutes',
        protocol: 'Compound',
        severity: FindingSeverity.Medium,
        type: FindingType.Suspicious,
        metadata: {
          highestRate: '0.2',
          lowestRate: '0.05',
          change: '0.15'
        }
      });

      expect(findings).toStrictEqual([finding]);
    });

    it('returns finding only once if next changes are less than the first one', async () => {
      const storage = new TokenRateStorage();
      const web3Mock = new Web3Mock('1000', '100', '100') as any;
      const handleBlock = provideHandleBlock(0.1, ['cETH'], storage, web3Mock);

      // Handle first block
      let findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);

      web3Mock.cash = '500';

      // Expect a 200% change up
      findings = await handleBlock(dummyBlockEvent);

      let finding = Finding.fromObject({
        alertId: EVENT_ALERT_ID,
        name: 'Compound cETH Utilization Rate Change',
        description: 'Utilization rate of cETH is up 200% within 60 minutes',
        protocol: 'Compound',
        severity: FindingSeverity.Medium,
        type: FindingType.Suspicious,
        metadata: {
          highestRate: '0.2',
          lowestRate: '0.1',
          change: '0.1'
        }
      });

      expect(findings).toStrictEqual([finding]);

      web3Mock.cash = '550';

      findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);

      findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);
    });
  });
});
