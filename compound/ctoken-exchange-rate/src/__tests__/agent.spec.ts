import {
  createBlockEvent,
  EventType,
  Finding,
  FindingSeverity,
  FindingType,
  Network
} from 'forta-agent';
import { provideHandleBlockMock } from './utils';
import { EVENT_ALERT_ID } from '../agent';

const NETWORK = Network.MAINNET;

describe('compound cToken exchange rate agent', () => {
  describe('handleBlock', () => {
    const dummyBlock = createBlockEvent({
      network: NETWORK,
      type: EventType.BLOCK,
      block: {} as any
    });

    it('returns empty findings if exchange rate has not changed', async () => {
      const handleBlock = provideHandleBlockMock({
        previousExchangeRate: '100000',
        currentExchangeRate: '100000',
        alertDropRate: 0.2,
        tokenSymbol: 'cCOMP'
      });

      const findings = await handleBlock(dummyBlock);

      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if exchange rate has changed less than alertDropRate', async () => {
      const handleBlock = provideHandleBlockMock({
        previousExchangeRate: '100000',
        currentExchangeRate: '80001',
        alertDropRate: 0.2,
        tokenSymbol: 'cCOMP'
      });

      const findings = await handleBlock(dummyBlock);

      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if exchange rate has dropped by amount of alertDropRate', async () => {
      const params = {
        previousExchangeRate: '100000',
        currentExchangeRate: '80000',
        alertDropRate: 0.2,
        tokenSymbol: 'cCOMP'
      };

      const handleBlock = provideHandleBlockMock(params);

      const findings = await handleBlock(dummyBlock);

      const finding = Finding.fromObject({
        name: `Compound ${params.tokenSymbol} Exchange Rate Down`,
        description: `Exchange rate of ${params.tokenSymbol} dropped by 20%.`,
        alertId: EVENT_ALERT_ID,
        protocol: 'Compound',
        severity: FindingSeverity.Medium,
        type: FindingType.Suspicious,
        metadata: {
          currentRate: params.currentExchangeRate,
          previousRate: params.previousExchangeRate
        }
      });

      expect(findings).toStrictEqual([finding]);
    });

    it('returns a finding if exchange rate has dropped by more than alertDropRate', async () => {
      const params = {
        previousExchangeRate: '100000',
        currentExchangeRate: '50000',
        alertDropRate: 0.4,
        tokenSymbol: 'cCOMP'
      };

      const handleBlock = provideHandleBlockMock(params);

      const findings = await handleBlock(dummyBlock);

      const finding = Finding.fromObject({
        name: `Compound ${params.tokenSymbol} Exchange Rate Down`,
        description: `Exchange rate of ${params.tokenSymbol} dropped by 50%.`,
        alertId: EVENT_ALERT_ID,
        protocol: 'Compound',
        severity: FindingSeverity.Medium,
        type: FindingType.Suspicious,
        metadata: {
          currentRate: params.currentExchangeRate,
          previousRate: params.previousExchangeRate
        }
      });

      expect(findings).toStrictEqual([finding]);
    });

    it('returns a finding if exchange rate has increased by more than alertDropRate', async () => {
      const params = {
        previousExchangeRate: '100000',
        currentExchangeRate: '120000',
        alertDropRate: -0.2,
        tokenSymbol: 'cCOMP'
      };

      const handleBlock = provideHandleBlockMock(params);

      const findings = await handleBlock(dummyBlock);

      const finding = Finding.fromObject({
        name: `Compound ${params.tokenSymbol} Exchange Rate Down`,
        description: `Exchange rate of ${params.tokenSymbol} increased by 20%.`,
        alertId: EVENT_ALERT_ID,
        protocol: 'Compound',
        severity: FindingSeverity.Medium,
        type: FindingType.Info,
        metadata: {
          currentRate: params.currentExchangeRate,
          previousRate: params.previousExchangeRate
        }
      });

      expect(findings).toStrictEqual([finding]);
    });
  });
});
