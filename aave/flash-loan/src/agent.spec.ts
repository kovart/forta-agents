import BigNumber from 'bignumber.js';
import { createAddress, TestTransactionEvent, TraceProps } from 'forta-agent-tools';
import { utils } from 'ethers';
import agent from './agent';
import { FLASH_LOAN_FUNCTION_ABI, LENDING_POOL_ADDRESS } from './constants';

const { createFinding, provideHandleTransaction } = agent;

describe('aave flash loan agent', () => {
  describe('handleTransaction', () => {
    let aaveUtilsMock: any;

    const usdt = { symbol: 'USDT', decimals: 8, address: createAddress('0x1') };
    const weth = { symbol: 'WETH', decimals: 18, address: createAddress('0x2') };
    const wbtc = { symbol: 'WBTC', decimals: 18, address: createAddress('0x3') };

    const createTrace = (abi: string, data: ReadonlyArray<any> = [], to: string): TraceProps => {
      const iface = new utils.Interface([abi]);
      const fragment = Object.values(iface.functions)[0];

      // Encode trace data according to the parse function in Forta SDK
      // https://github.com/forta-protocol/forta-agent-sdk/blob/master/sdk/transaction.event.ts#L107
      return {
        to: to,
        input: iface.encodeFunctionData(fragment, data),
        value: null
      } as any;
    };

    beforeEach(() => {
      aaveUtilsMock = {
        tokenConfigsMap: {
          [usdt.address]: usdt,
          [weth.address]: weth,
          [wbtc.address]: wbtc
        },
        usdtConfig: usdt,
        handleTransaction: jest.fn(),
        getTokenPricesMap: jest.fn()
      };
    });

    it('returns empty findings if no traces provided', async () => {
      const handleTransaction = provideHandleTransaction(aaveUtilsMock, 100);

      const txEvent = new TestTransactionEvent();

      const findings = await handleTransaction(txEvent);

      expect(aaveUtilsMock.handleTransaction.mock.calls.length).toBe(1);
      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if Aave Landing Pool address is not involved', async () => {
      const handleTransaction = provideHandleTransaction(aaveUtilsMock, 100);

      const txEvent = new TestTransactionEvent();
      txEvent.addTraces(
        createTrace(
          FLASH_LOAN_FUNCTION_ABI,
          [createAddress('0x111'), [usdt.address], [100], [0], createAddress('0x222'), [], 0],
          createAddress('0x01234')
        )
      );

      const findings = await handleTransaction(txEvent);

      expect(aaveUtilsMock.handleTransaction.mock.calls.length).toBe(1);
      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if price threshold is greater', async () => {
      const handleTransaction = provideHandleTransaction(aaveUtilsMock, 10001);

      const etheremPrice = new BigNumber(5000); // usdt
      const ethereumAmount = new BigNumber(2);

      aaveUtilsMock.getTokenPricesMap.mockResolvedValueOnce({
        [usdt.address]: new BigNumber(1).dividedBy(etheremPrice),
        [weth.address]: new BigNumber(1)
      });

      const txEvent = new TestTransactionEvent();
      txEvent.addTraces(
        createTrace(
          FLASH_LOAN_FUNCTION_ABI,
          [
            createAddress('0x111'),
            [weth.address],
            [ethereumAmount.multipliedBy(new BigNumber(10).pow(weth.decimals)).toString()],
            [0, 0],
            createAddress('0x222'),
            [],
            0
          ],
          LENDING_POOL_ADDRESS
        )
      );

      const findings = await handleTransaction(txEvent);

      expect(aaveUtilsMock.handleTransaction.mock.calls.length).toBe(1);
      expect(aaveUtilsMock.getTokenPricesMap.mock.calls.length).toBe(1);
      expect(findings).toEqual([]);
    });

    it('returns a finding if price threshold is equal', async () => {
      const handleTransaction = provideHandleTransaction(aaveUtilsMock, 10000);

      const etheremPrice = new BigNumber(5000); // usdt
      const ethereumAmount = new BigNumber(2);
      const ethereumTotal = new BigNumber(etheremPrice).multipliedBy(ethereumAmount);

      aaveUtilsMock.getTokenPricesMap.mockResolvedValueOnce({
        [usdt.address]: new BigNumber(1).dividedBy(etheremPrice),
        [weth.address]: new BigNumber(1)
      });

      const txEvent = new TestTransactionEvent();
      txEvent.addTraces(
        createTrace(
          FLASH_LOAN_FUNCTION_ABI,
          [
            createAddress('0x111'),
            [weth.address],
            [ethereumAmount.multipliedBy(new BigNumber(10).pow(weth.decimals)).toString()],
            [0, 0],
            createAddress('0x222'),
            [],
            0
          ],
          LENDING_POOL_ADDRESS
        )
      );

      const findings = await handleTransaction(txEvent);

      const finding = createFinding(ethereumTotal.toFormat(0), [
        {
          ...weth,
          price: etheremPrice.toString(),
          amount: ethereumAmount.toString(),
          total: ethereumTotal.toString()
        }
      ]);

      expect(aaveUtilsMock.handleTransaction.mock.calls.length).toBe(1);
      expect(aaveUtilsMock.getTokenPricesMap.mock.calls.length).toBe(1);
      expect(findings).toEqual([finding]);
    });

    it('returns a finding if price threshold is less', async () => {
      const handleTransaction = provideHandleTransaction(aaveUtilsMock, 9999);

      const etheremPrice = new BigNumber(5000); // usdt
      const ethereumAmount = new BigNumber(2);
      const ethereumTotal = new BigNumber(etheremPrice).multipliedBy(ethereumAmount);

      aaveUtilsMock.getTokenPricesMap.mockResolvedValueOnce({
        [usdt.address]: new BigNumber(1).dividedBy(etheremPrice),
        [weth.address]: new BigNumber(1)
      });

      const txEvent = new TestTransactionEvent();
      txEvent.addTraces(
        createTrace(
          FLASH_LOAN_FUNCTION_ABI,
          [
            createAddress('0x111'),
            [weth.address],
            [ethereumAmount.multipliedBy(new BigNumber(10).pow(weth.decimals)).toString()],
            [0, 0],
            createAddress('0x222'),
            [],
            0
          ],
          LENDING_POOL_ADDRESS
        )
      );

      const findings = await handleTransaction(txEvent);

      const finding = createFinding(ethereumTotal.toFormat(0), [
        {
          ...weth,
          price: etheremPrice.toString(),
          amount: ethereumAmount.toString(),
          total: ethereumTotal.toString()
        }
      ]);

      expect(aaveUtilsMock.handleTransaction.mock.calls.length).toBe(1);
      expect(aaveUtilsMock.getTokenPricesMap.mock.calls.length).toBe(1);
      expect(findings).toEqual([finding]);
    });
  });
});
