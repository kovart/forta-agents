import { BigNumber } from 'bignumber.js';
import { AllowanceStore } from './store';
import { ERC20_APPROVE_FUNCTION, ERC20_INCREASE_ALLOWANCE_FUNCTION } from '../constants';

type MockedERC20Token = {
  address: string;
  approve: jest.MockedFunction<any>;
  increaseAllowance: jest.MockedFunction<any>;
  allowance: jest.MockedFunction<any>;
  balanceOf: jest.MockedFunction<any>;
  approvals: Array<any>;
};

let mockTokenInstances: { [x: string]: any } = {};

jest.mock('./token', () => {
  return {
    ERC20Token: jest.fn((address: string) => mockTokenInstances[address])
  };
});

describe('AllowanceStore', () => {
  let store: AllowanceStore;

  beforeEach(() => {
    store = new AllowanceStore({} as any);
    mockTokenInstances = {};
  });

  const createMockToken = (address: string): MockedERC20Token => {
    const approvals: any[] = [];

    return {
      address: address,
      approve: jest
        .fn()
        .mockImplementation((owner, spender, amount, timestamp) =>
          approvals.push({ owner, spender, timestamp })
        ),
      increaseAllowance: jest
        .fn()
        .mockImplementation((owner, spender, timestamp) =>
          approvals.push({ owner, spender, timestamp })
        ),
      allowance: jest.fn(),
      balanceOf: jest.fn(),
      approvals: approvals
    };
  };

  const getTimestamp = (index: number) => 10000 + index;

  it('should return empty summaries if there are no approvals', async () => {
    const summaries = store.getSpenderSummaries();

    expect(summaries).toHaveLength(0);
  });

  it('should return correct affected balance', async () => {
    const token = '0xTOKEN';
    const owner = '0xOWNER';
    const spender = '0xSPENDER';
    const allowance50 = new BigNumber(50);
    const allowance100 = new BigNumber(100);
    const allowance200 = new BigNumber(200);
    const balance50 = new BigNumber(50);
    const balance100 = new BigNumber(100);
    const balance300 = new BigNumber(300);
    const blockNumber = 222;

    const mockTokenInstance = createMockToken(token);

    mockTokenInstances[token] = mockTokenInstance;
    mockTokenInstance.balanceOf.mockResolvedValueOnce(balance50);

    await store.approve(token, owner, spender, allowance100, getTimestamp(0), blockNumber);

    let receivedBalance = store.getAffectedBalance(token, owner, spender);

    expect(mockTokenInstance.balanceOf).toHaveBeenCalledTimes(1);
    expect(receivedBalance.toString()).toStrictEqual(balance50.toString());

    // ----------------------------------

    mockTokenInstance.balanceOf.mockReset();
    mockTokenInstance.allowance.mockReset();
    mockTokenInstance.balanceOf.mockResolvedValueOnce(balance100);

    await store.approve(token, owner, spender, allowance50, getTimestamp(1), blockNumber);

    receivedBalance = store.getAffectedBalance(token, owner, spender);

    expect(mockTokenInstance.allowance).toHaveBeenCalledTimes(0);
    expect(mockTokenInstance.balanceOf).toHaveBeenCalledTimes(1);
    expect(receivedBalance.toString()).toStrictEqual(allowance50.toString());

    // ----------------------------------

    mockTokenInstance.balanceOf.mockReset();
    mockTokenInstance.allowance.mockReset();
    mockTokenInstance.balanceOf.mockResolvedValueOnce(balance300);
    mockTokenInstance.allowance.mockResolvedValueOnce(allowance200);

    // we pass random allowance since the store should get actual allowance from the JsonRpcProvider
    await store.increaseAllowance(
      token,
      owner,
      spender,
      new BigNumber(123),
      getTimestamp(2),
      blockNumber
    );

    receivedBalance = store.getAffectedBalance(token, owner, spender);

    expect(mockTokenInstance.allowance).toHaveBeenCalledTimes(1);
    expect(mockTokenInstance.balanceOf).toHaveBeenCalledTimes(1);
    expect(receivedBalance.toString()).toStrictEqual(allowance200.toString());
  });

  it('should return correct summaries', async () => {
    const token1 = '0xTOKEN1';
    const token2 = '0xTOKEN2';
    const owner1 = '0xOWNER1';
    const owner2 = '0xOWNER2';
    const owner3 = '0xOWNER3';
    const spender1 = '0xSPENDER1';
    const spender2 = '0xSPENDER2';
    const spender3 = '0xSPENDER3';
    const blockNumber = 222;

    const userStories: {
      [spender: string]: {
        [sig: string]: Array<{ owner: string; token: string; amount: BigNumber }>;
      };
    } = {
      [spender1]: {
        [ERC20_APPROVE_FUNCTION]: [
          { owner: owner1, token: token1, amount: new BigNumber(10) },
          { owner: owner1, token: token1, amount: new BigNumber(100) }
        ]
      },
      [spender2]: {
        [ERC20_INCREASE_ALLOWANCE_FUNCTION]: [
          { owner: owner1, token: token1, amount: new BigNumber(25) },
          { owner: owner2, token: token2, amount: new BigNumber(100) },
          { owner: owner3, token: token2, amount: new BigNumber(100) },
          { owner: owner3, token: token2, amount: new BigNumber(200) }
        ]
      },
      [spender3]: {
        [ERC20_APPROVE_FUNCTION]: [
          { owner: owner1, token: token1, amount: new BigNumber(10) },
          { owner: owner1, token: token2, amount: new BigNumber(100) }
        ],
        [ERC20_INCREASE_ALLOWANCE_FUNCTION]: [
          { owner: owner1, token: token1, amount: new BigNumber(1000) },
          { owner: owner2, token: token2, amount: new BigNumber(2000) }
        ]
      }
    };

    const mockTokenInstance1 = createMockToken(token1);
    const mockTokenInstance2 = createMockToken(token2);

    mockTokenInstances[token1] = mockTokenInstance1;
    mockTokenInstances[token2] = mockTokenInstance2;

    const token1Balances: { [owner: string]: BigNumber } = {
      [owner1]: new BigNumber(50),
      [owner2]: new BigNumber(100),
      [owner3]: new BigNumber(150)
    };

    const token2Balances: { [owner: string]: BigNumber } = {
      [owner1]: new BigNumber(10),
      [owner2]: new BigNumber(20),
      [owner3]: new BigNumber(30)
    };

    mockTokenInstance1.balanceOf.mockImplementation((owner: string) => token1Balances[owner]);
    mockTokenInstance2.balanceOf.mockImplementation((owner: string) => token2Balances[owner]);

    let counter = 0;
    for (const spender of [spender1, spender2, spender3]) {
      for (const signature of [ERC20_APPROVE_FUNCTION, ERC20_INCREASE_ALLOWANCE_FUNCTION]) {
        for (const action of userStories[spender][signature] || []) {
          const { owner, token, amount } = action;
          const timestamp = getTimestamp(counter++);

          if (signature === ERC20_APPROVE_FUNCTION) {
            // we don't call allowance() method as it's always equals the approve amount
            await store.approve(token, owner, spender, amount, timestamp, blockNumber);
          } else if (signature === ERC20_INCREASE_ALLOWANCE_FUNCTION) {
            mockTokenInstances[token].allowance.mockResolvedValueOnce(amount);
            await store.increaseAllowance(token, owner, spender, amount, timestamp, blockNumber);
          }
        }
      }
    }

    const summaries = store.getSpenderSummaries();

    const spender1Summary = summaries.find((s) => s.address === spender1)!;
    const spender2Summary = summaries.find((s) => s.address === spender2)!;
    const spender3Summary = summaries.find((s) => s.address === spender3)!;

    expect(summaries).toHaveLength(3);
    expect(spender1Summary).toBeDefined();
    expect(spender2Summary).toBeDefined();
    expect(spender3Summary).toBeDefined();
    // -------------------------------------
    expect(spender1Summary.approvalsCount).toStrictEqual(2);
    expect(spender1Summary.owners).toStrictEqual([owner1]);
    expect(spender1Summary.tokens).toStrictEqual([mockTokenInstance1]);
    expect(spender1Summary.amounts).toEqual({ [token1]: new BigNumber(50) });
    // -------------------------------------
    expect(spender2Summary.approvalsCount).toStrictEqual(4);
    expect(spender2Summary.owners).toStrictEqual([owner1, owner2, owner3]);
    expect(spender2Summary.tokens).toStrictEqual([mockTokenInstance1, mockTokenInstance2]);
    expect(spender2Summary.amounts).toEqual({
      [token1]: new BigNumber(25),
      [token2]: new BigNumber(50)
    });
    // -------------------------------------
    expect(spender3Summary.approvalsCount).toStrictEqual(4);
    expect(spender3Summary.owners).toStrictEqual([owner1, owner2]);
    expect(spender3Summary.tokens).toStrictEqual([mockTokenInstance1, mockTokenInstance2]);
    expect(spender3Summary.amounts).toEqual({
      [token1]: new BigNumber(50),
      [token2]: new BigNumber(30)
    });
  });

  it('should clear outdated data', async () => {
    const token1 = '0xTOKEN1';
    const token2 = '0xTOKEN2';
    const owner1 = '0xOWNER1';
    const owner2 = '0xOWNER2';
    const spender1 = '0xSPENDER1';
    const spender2 = '0xSPENDER2';
    const spender3 = '0xSPENDER3';
    const spender4 = '0xSPENDER4';

    const mockTokenInstance1 = createMockToken(token1);
    const mockTokenInstance2 = createMockToken(token2);

    mockTokenInstances[token1] = mockTokenInstance1;
    mockTokenInstances[token2] = mockTokenInstance2;

    mockTokenInstance1.balanceOf.mockResolvedValue(new BigNumber(1));
    mockTokenInstance1.allowance.mockResolvedValue(new BigNumber(1));
    mockTokenInstance2.balanceOf.mockResolvedValue(new BigNumber(1));
    mockTokenInstance2.allowance.mockResolvedValue(new BigNumber(1));

    await store.approve(token1, owner1, spender1, new BigNumber(1), 1, 0);
    await store.increaseAllowance(token1, owner1, spender2, new BigNumber(1), 10, 0);
    await store.increaseAllowance(token2, owner2, spender2, new BigNumber(1), 100, 0);
    await store.approve(token1, owner1, spender3, new BigNumber(1), 1000, 0);
    await store.increaseAllowance(token2, owner1, spender3, new BigNumber(1), 10000, 0);
    await store.approve(token1, owner2, spender3, new BigNumber(1), 1000000, 0);
    await store.approve(token1, owner1, spender4, new BigNumber(1), 10000000, 0);

    let summaries = store.getSpenderSummaries();

    let spender1Summary = summaries.find((s) => s.address === spender1)!;
    let spender2Summary = summaries.find((s) => s.address === spender2)!;
    let spender3Summary = summaries.find((s) => s.address === spender3)!;

    expect(summaries).toHaveLength(4);
    expect(spender1Summary.approvalsCount).toStrictEqual(1);
    expect(spender1Summary.owners).toStrictEqual([owner1]);
    expect(spender1Summary.tokens).toStrictEqual([mockTokenInstance1]);
    expect(spender1Summary.amounts).toStrictEqual({ [token1]: new BigNumber(1) });
    // -----------
    expect(spender2Summary.approvalsCount).toStrictEqual(2);
    expect(spender2Summary.owners).toStrictEqual([owner1, owner2]);
    expect(spender2Summary.tokens).toStrictEqual([mockTokenInstance1, mockTokenInstance2]);
    expect(spender2Summary.amounts).toStrictEqual({
      [token1]: new BigNumber(1),
      [token2]: new BigNumber(1)
    });
    // -----------
    expect(spender3Summary.approvalsCount).toStrictEqual(3);
    expect(spender3Summary.owners).toStrictEqual([owner1, owner2]);
    expect(spender3Summary.tokens).toStrictEqual([mockTokenInstance1, mockTokenInstance2]);
    expect(spender3Summary.amounts).toStrictEqual({
      [token1]: new BigNumber(2),
      [token2]: new BigNumber(1)
    });
    // we will clear it later
    expect(summaries.find((s) => s.address === spender4)).toBeDefined();

    // Let's check permanent spenders (used if we detect attacker and keep their traces for extended period)
    // -------------------------

    // should clear all except permanent spenders
    store.clearOutdatedData(100000000000, [spender1, spender2, spender3]);

    summaries = store.getSpenderSummaries();

    expect(summaries).toHaveLength(3);
    expect(summaries.find((s) => s.address === spender4)).not.toBeDefined();

    // Let's clear first approvals with timestamp <= 10
    // -------------------------

    store.clearOutdatedData(11, []);

    summaries = store.getSpenderSummaries();

    spender1Summary = summaries.find((s) => s.address === spender1)!;
    spender2Summary = summaries.find((s) => s.address === spender2)!;
    spender3Summary = summaries.find((s) => s.address === spender3)!;

    expect(summaries).toHaveLength(2);
    expect(spender1Summary).not.toBeDefined();
    // ---------------
    expect(spender2Summary.approvalsCount).toStrictEqual(1);
    expect(spender2Summary.owners).toStrictEqual([owner2]);
    expect(spender2Summary.tokens).toStrictEqual([mockTokenInstance2]);
    expect(spender2Summary.amounts).toStrictEqual({
      [token2]: new BigNumber(1)
    });
    // -----------
    expect(spender3Summary.approvalsCount).toStrictEqual(3);
    expect(spender3Summary.owners).toStrictEqual([owner1, owner2]);
    expect(spender3Summary.tokens).toStrictEqual([mockTokenInstance1, mockTokenInstance2]);
    expect(spender3Summary.amounts).toStrictEqual({
      [token1]: new BigNumber(2),
      [token2]: new BigNumber(1)
    });

    // Let's clear approvals <= 100000 timestamp
    // -------------------------

    store.clearOutdatedData(100001, []);

    summaries = store.getSpenderSummaries();

    spender2Summary = summaries.find((s) => s.address === spender2)!;
    spender3Summary = summaries.find((s) => s.address === spender3)!;

    expect(summaries).toHaveLength(1);
    expect(spender2Summary).not.toBeDefined();
    // ---------------
    expect(spender3Summary.approvalsCount).toStrictEqual(1);
    expect(spender3Summary.owners).toStrictEqual([owner2]);
    expect(spender3Summary.tokens).toStrictEqual([mockTokenInstance1]);
    expect(spender3Summary.amounts).toStrictEqual({
      [token1]: new BigNumber(2)
    });
  });
});
