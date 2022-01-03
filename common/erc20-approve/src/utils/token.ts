import BigNumber from 'bignumber.js';
import { Contract, ethers, providers } from 'ethers';
import Erc20Abi from '../abi/erc20.json';

export type ApprovalEvent = {
  owner: string;
  spender: string;
  amount: BigNumber;
  timestamp: number;
};

export class ERC20Token {
  private _provider: providers.JsonRpcProvider;
  private _contract: Contract | null = null;
  private _symbol: string | null = null;
  private _decimals: number | null = null;

  public address: string;
  public approvals: ApprovalEvent[];

  constructor(address: string, provider: providers.JsonRpcProvider) {
    this.approvals = [];
    this.address = address;
    this._provider = provider;
  }

  public approve(owner: string, spender: string, amount: BigNumber, timestamp: number) {
    this._approve(owner, spender, amount, timestamp);
  }

  public async increaseAllowance(
    owner: string,
    spender: string,
    timestamp: number,
    blockTag: number | string
  ) {
    // spender may have already some allowance
    const newAllowance = await this.allowance(owner, spender, blockTag);
    this._approve(owner, spender, newAllowance, timestamp);
  }

  public async allowance(owner: string, spender: string, blockTag: number | string) {
    const contract = this.getContract();
    try {
      return new BigNumber((await contract.allowance(owner, spender, { blockTag })).toHexString());
    } catch {
      // Not an ERC20 token ¯\_(ツ)_/¯
      return new BigNumber(0);
    }
  }

  public async balanceOf(address: string, blockTag: number | string) {
    const contract = this.getContract();
    try {
      const balance = await contract.balanceOf(address, { blockTag });
      return new BigNumber(balance.toHexString());
    } catch {
      // Not an ERC20 token ¯\_(ツ)_/¯
      return new BigNumber(0);
    }
  }

  public async symbol(): Promise<string> {
    if (this._symbol) return this._symbol;

    try {
      const contract = this.getContract();
      const symbol = await contract.symbol();
      this._symbol = symbol;
      return symbol;
    } catch {
      // Not an ERC20 token ¯\_(ツ)_/¯
      this._symbol = 'UNKNOWN';
      return this._symbol;
    }
  }

  public async decimals(): Promise<number> {
    if (this._decimals) return this._decimals;

    try {
      const contract = this.getContract();
      const decimals = await contract.decimals();
      this._decimals = decimals;
      return decimals;
    } catch {
      // Not an ERC20 token ¯\_(ツ)_/¯
      this._decimals = 1;
      return this._decimals;
    }
  }

  private _approve(owner: string, spender: string, amount: BigNumber, timestamp: number) {
    this.approvals.push({
      owner,
      spender,
      timestamp,
      amount
    });
  }

  private getContract() {
    if (this._contract) return this._contract;

    const iface = new ethers.utils.Interface(Erc20Abi);
    this._contract = new Contract(this.address, iface, this._provider);

    return this._contract;
  }
}
