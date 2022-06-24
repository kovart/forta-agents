import { Network } from 'forta-agent';
import { TestBlockEvent } from 'forta-agent-tools/lib/tests.utils';
import BigNumber from 'bignumber.js';
import { CompoundConfig, TokenRateStorage } from './utils';
import { createFinding } from './findings';
import agent from './agent';

const { provideHandleBlock } = agent;

const mockWeb3 = {
  cash: jest.fn(),
  borrows: jest.fn(),
  reserves: jest.fn(),

  eth: {
    Contract: jest.fn().mockReturnValue({
      methods: {
        getCash: () => ({ call: async () => String(await mockWeb3.cash()) }),
        totalBorrowsCurrent: () => ({ call: async () => String(await mockWeb3.borrows()) }),
        totalReserves: () => ({ call: async () => String(await mockWeb3.reserves()) })
      }
    })
  }
};

function createBlockEvent(timestamp?: number, network?: Network) {
  const block = new TestBlockEvent(network || Network.MAINNET);
  block.setTimestamp(timestamp || Math.floor(Number(new Date()) / 1000));
  return block;
}

describe('compound cToken utilization rate agent', () => {
  describe('handleBlock', () => {
    const cTokens = CompoundConfig.getInstance(Network.MAINNET).cTokens;
    let dummyBlockEvent: TestBlockEvent;
    let storage: TokenRateStorage;

    beforeEach(() => {
      dummyBlockEvent = createBlockEvent();
      storage = new TokenRateStorage();
    });

    it('calculates utilization rate correctly', async () => {
      const tokenSymbol1 = 'TKN1';
      const tokenSymbol2 = 'TKN2';
      const expireTime = 3;
      const mockGetTime = jest.fn().mockReturnValue(0);

      const storage = new TokenRateStorage(expireTime, mockGetTime);
      storage.add(tokenSymbol1, new BigNumber(1), 0);
      storage.add(tokenSymbol1, new BigNumber(2), 1);
      storage.add(tokenSymbol1, new BigNumber(3), 2);
      storage.add(tokenSymbol1, new BigNumber(4), 3);
      storage.add(tokenSymbol2, new BigNumber(1), 0);
      storage.add(tokenSymbol2, new BigNumber(2), 1);
      storage.add(tokenSymbol2, new BigNumber(3), 2);
      storage.add(tokenSymbol2, new BigNumber(4), 3);

      mockGetTime.mockReturnValue(expireTime);
      let stats = storage.getRateStats(tokenSymbol1);

      expect(stats.lowestRate.toNumber()).toStrictEqual(1);
      expect(stats.highestRate.toNumber()).toStrictEqual(4);

      mockGetTime.mockReturnValue(expireTime+1);
      stats = storage.getRateStats(tokenSymbol2);

      expect(stats.lowestRate.toNumber()).toStrictEqual(2);
      expect(stats.highestRate.toNumber()).toStrictEqual(4);
    });

    it('returns empty findings if it is a first event', async () => {
      const handleBlock = provideHandleBlock(0.000001, [cTokens[0].symbol], storage, mockWeb3 as any);

      mockWeb3.cash.mockResolvedValue(500);
      mockWeb3.borrows.mockResolvedValue(500);
      mockWeb3.reserves.mockResolvedValue(500);

      const findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);
      expect(mockWeb3.cash).toBeCalledTimes(1);
      expect(mockWeb3.borrows).toBeCalledTimes(1);
      expect(mockWeb3.reserves).toBeCalledTimes(1);
    });

    it('returns empty findings if utilization rate has not changed', async () => {
      const handleBlock = provideHandleBlock(0.00000001, [cTokens[0].symbol], storage, mockWeb3 as any);

      let findings: any[] = [];

      mockWeb3.cash.mockResolvedValue(500);
      mockWeb3.borrows.mockResolvedValue(500);
      mockWeb3.reserves.mockResolvedValue(500);

      for (let i = 0; i < 50; i++) {
        dummyBlockEvent.setTimestamp(dummyBlockEvent.block.timestamp + i * 60 * 60);
        if (!findings.length) {
          findings = await handleBlock(dummyBlockEvent);
        }
      }

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if utilization rate changed by less than alert rate', async () => {
      const alertChangeRate = 1;
      const handleBlock = provideHandleBlock(1, [cTokens[0].symbol], storage, mockWeb3 as any);

      // utilization rate = 1
      mockWeb3.cash.mockResolvedValue(500);
      mockWeb3.borrows.mockResolvedValue(500);
      mockWeb3.reserves.mockResolvedValue(500);

      let findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);

      // utilization rate = 0.50002...
      mockWeb3.cash.mockResolvedValue(500 * (1 + alertChangeRate - 0.0001));

      // change rate should be -0.9999...
      findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if utilization rate changed enough to alert but exceeds storage window', async () => {
      const alertChaneRate = 0.499999;
      const token = cTokens[0];
      const mockGetTime = jest.fn().mockReturnValue(0);
      const expireTime = 2;
      const storage = new TokenRateStorage(expireTime, mockGetTime);
      const handleBlock = provideHandleBlock(alertChaneRate, [token.symbol], storage, mockWeb3 as any);

      mockGetTime.mockReturnValue(0);
      dummyBlockEvent.setTimestamp(0);

      // utilization rate = 1
      mockWeb3.cash.mockResolvedValue(500);
      mockWeb3.borrows.mockResolvedValue(500);
      mockWeb3.reserves.mockResolvedValue(500);

      let findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);

      // utilization rate = 0.5
      mockWeb3.cash.mockResolvedValue(1000);
      mockGetTime.mockReturnValue(expireTime+1)
      dummyBlockEvent.setTimestamp(expireTime);

      // change rate should be -0.5 (-50%)
      findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if utilization rate decreased more than alert rate', async () => {
      const alertChaneRate = 0.499999;
      const token = cTokens[0];
      const handleBlock = provideHandleBlock(alertChaneRate, [token.symbol], storage, mockWeb3 as any);

      // utilization rate = 1
      mockWeb3.cash.mockResolvedValue(500);
      mockWeb3.borrows.mockResolvedValue(500);
      mockWeb3.reserves.mockResolvedValue(500);

      let findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);

      // utilization rate = 0.5
      mockWeb3.cash.mockResolvedValue(1000);

      // change rate should be -0.5 (-50%)
      findings = await handleBlock(dummyBlockEvent);

      const finding = createFinding(token.symbol, token.address, 'down', 50, 60, 0.5, 1, -0.5);

      expect(findings).toStrictEqual([finding]);
    });

    it('returns a finding if utilization rate increased more than alert rate', async () => {
      const alertChaneRate = 0.9999999;
      const token = cTokens[0];
      const handleBlock = provideHandleBlock(alertChaneRate, [token.symbol], storage, mockWeb3 as any);

      // utilization rate = 1
      mockWeb3.cash.mockResolvedValue(500);
      mockWeb3.borrows.mockResolvedValue(500);
      mockWeb3.reserves.mockResolvedValue(500);

      let findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);

      // utilization rate = 2
      mockWeb3.cash.mockResolvedValue(250);

      // change rate should be 1
      findings = await handleBlock(dummyBlockEvent);

      const finding = createFinding(token.symbol, token.address, 'up', 100, 60, 1, 2, 1);

      expect(findings).toStrictEqual([finding]);
    });

    it('returns multiple findings if utilization rate broke alertChangeRate multiple times', async () => {
      const alertChaneRate = 0.499999;
      const token = cTokens[0];
      const handleBlock = provideHandleBlock(alertChaneRate, [token.symbol], storage, mockWeb3 as any);

      // utilization rate = 1
      mockWeb3.cash.mockResolvedValue(500);
      mockWeb3.borrows.mockResolvedValue(500);
      mockWeb3.reserves.mockResolvedValue(500);

      let findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);

      // utilization rate = 0.5
      mockWeb3.cash.mockResolvedValue(1000);

      // change rate should be -0.5 (-50%)
      findings = await handleBlock(dummyBlockEvent);

      let finding = createFinding(token.symbol, token.address, 'down', 50, 60, 0.5, 1, -0.5);

      expect(findings).toStrictEqual([finding]);

      // utilization rate = 4
      mockWeb3.cash.mockResolvedValue(125);

      // change rate should be 7
      findings = await handleBlock(dummyBlockEvent);

      finding = createFinding(token.symbol, token.address, 'up', 700, 60, 0.5, 4, 7);

      expect(findings).toStrictEqual([finding]);
    });

    it('returns multiple findings for multiple tokens', async () => {
      const alertChaneRate = 0.499999;
      const token1 = cTokens[0];
      const token2 = cTokens[1];
      const token3 = cTokens[2];
      const handleBlock = provideHandleBlock(
        alertChaneRate,
        [token1, token2, token3].map((t) => t.symbol),
        storage,
        mockWeb3 as any
      );

      // utilization rate = 1
      mockWeb3.cash.mockResolvedValue(500);
      mockWeb3.borrows.mockResolvedValue(500);
      mockWeb3.reserves.mockResolvedValue(500);

      let findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);

      // utilization rate = 0.5
      mockWeb3.cash.mockResolvedValue(1000);

      // change rate should be -0.5 (-50%)
      findings = await handleBlock(dummyBlockEvent);

      const expectedFindings = [token1, token2, token3].map((token) =>
        createFinding(token.symbol, token.address, 'down', 50, 60, 0.5, 1, -0.5)
      );

      const sortFn = (a: any, b: any) => a.metadata.tokenSymbol.localeCompare(b.metadata.tokenSymbol);

      findings.sort(sortFn);
      expectedFindings.sort(sortFn);

      expect(findings).toStrictEqual(expectedFindings);
    });

    it('returns findings according to timestamp and min/max values', async () => {
      const alertChaneRate = 0.9999999;
      const token = cTokens[0];
      const handleBlock = provideHandleBlock(alertChaneRate, [token.symbol], storage, mockWeb3 as any);
      const now = Math.floor(Number(new Date()) / 1000); // seconds

      dummyBlockEvent.setTimestamp(now);

      // utilization rate = 1
      mockWeb3.cash.mockResolvedValue(500);
      mockWeb3.borrows.mockResolvedValue(500);
      mockWeb3.reserves.mockResolvedValue(500);

      let findings = await handleBlock(dummyBlockEvent);

      expect(findings).toStrictEqual([]);

      // utilization rate = 2
      mockWeb3.cash.mockResolvedValue(250);

      // change rate should be 1
      findings = await handleBlock(dummyBlockEvent);

      const finding = createFinding(token.symbol, token.address, 'up', 100, 60, 1, 2, 1);

      expect(findings).toStrictEqual([finding]);

      const interpolate = (start: number, end: number, step: number, steps: number) =>
        start + (step / steps) * (end - start);

      const iterations = 10;
      for (let i = 0; i <= iterations; i++) {
        // 2 > utilization rate > 1
        const cash = interpolate(251, 499, i, iterations);
        const timestamp = interpolate(now, storage.expireTime - 1, i, iterations);
        mockWeb3.cash.mockResolvedValue(cash);
        dummyBlockEvent.setTimestamp(timestamp);
        const findings = await handleBlock(dummyBlockEvent);
        expect(findings).toStrictEqual([]);
      }
    });
  });
});
