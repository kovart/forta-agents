import BigNumber from 'bignumber.js';
import { BigNumber as EthersBigNumber } from 'ethers';
import { ERC20Token } from './token';

let mockContractImplementation: any;

jest.mock('ethers', () => {
  const originalModule = jest.requireActual('ethers');

  return {
    __esModule: true,
    ...originalModule,
    Contract: jest.fn().mockImplementation(() => mockContractImplementation)
  };
});

describe('ERC20Token abstraction', () => {
  beforeEach(() => {
    mockContractImplementation = null;
  });

  it('should return balance', async () => {
    const owner = '0xOWNER';
    const blockNumber = 123456;
    const balance = 1234;

    const token = new ERC20Token('0xTOKENADDRESS', {} as any);

    mockContractImplementation = {
      balanceOf: jest.fn().mockResolvedValueOnce(EthersBigNumber.from(balance))
    };

    const receivedBalance = await token.balanceOf(owner, blockNumber);

    expect(mockContractImplementation.balanceOf).toHaveBeenCalledWith(owner, {
      blockTag: blockNumber
    });
    expect(mockContractImplementation.balanceOf).toHaveBeenCalledTimes(1);
    expect(receivedBalance.toString()).toStrictEqual(balance.toString());
  });

  it('should return allowance', async () => {
    const owner = '0xOWNER';
    const spender = '0xSPENDER';
    const blockNumber = 123456;
    const allowance = 1234;

    const token = new ERC20Token('0xTOKENADDRESS', {} as any);

    mockContractImplementation = {
      allowance: jest.fn().mockResolvedValueOnce(EthersBigNumber.from(allowance))
    };

    const receivedAllowance = await token.allowance(owner, spender, blockNumber);

    expect(mockContractImplementation.allowance).toHaveBeenCalledWith(owner, spender, {
      blockTag: blockNumber
    });
    expect(mockContractImplementation.allowance).toHaveBeenCalledTimes(1);
    expect(receivedAllowance.toString()).toStrictEqual(allowance.toString());
  });

  it('should log approvals', async () => {
    const owner1 = '0xOWNER1';
    const owner2 = '0xOWNER2';
    const spender1 = '0xSPENDER1';
    const spender2 = '0xSPENDER2';
    const amount1 = new BigNumber(111);
    const amount2 = new BigNumber(222);
    const blockNumber = 123456;
    const timestamp = 654321;

    const token = new ERC20Token('0xTOKENADDRESS', {} as any);

    mockContractImplementation = {
      allowance: jest.fn()
    };

    await token.approve(owner1, spender1, amount1, timestamp);

    const firstApproval = {
      spender: spender1,
      owner: owner1,
      amount: amount1,
      timestamp
    };

    // we don't need to know that since it will always be the same as approved amount
    expect(mockContractImplementation.allowance).toHaveBeenCalledTimes(0);
    expect(token.approvals).toStrictEqual([firstApproval]);

    mockContractImplementation.allowance.mockResolvedValueOnce(
      EthersBigNumber.from(amount2.toString())
    );

    await token.increaseAllowance(owner2, spender2, timestamp, blockNumber);

    const secondApproval = {
      spender: spender2,
      owner: owner2,
      amount: amount2,
      timestamp
    };

    expect(mockContractImplementation.allowance).toHaveBeenCalledTimes(1);
    expect(token.approvals).toStrictEqual([firstApproval, secondApproval]);
  });

  it('should return 0 for non-ERC20 contracts', async () => {
    const owner = '0xOWNER';
    const spender = '0xSPENDER';
    const token = new ERC20Token('0xTOKENADDRESS', {} as any);

    mockContractImplementation = {
      balanceOf: jest.fn().mockRejectedValue('Not supported balanceOf()'),
      allowance: jest.fn().mockRejectedValue('Not supported allowance()')
    };

    const balance = await token.balanceOf(owner, 123);
    const allowance = await token.allowance(owner, spender, 123);

    expect(balance.toString()).toBe('0');
    expect(allowance.toString()).toBe('0');
  });
});
