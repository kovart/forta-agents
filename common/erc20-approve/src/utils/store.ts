import BigNumber from 'bignumber.js';
import { providers } from 'ethers';
import { ERC20Token } from './token';

export class AllowanceStore {
  private provider: providers.JsonRpcProvider;
  // Allows to quickly find token by its contract address
  private tokenInstances: { [address: string]: ERC20Token };
  // Allows to quickly find allowed token addresses by spender address
  private spenderTokens: { [spender: string]: Set<string> };
  // Allows to keep the initial available balance before the tokens are stolen
  private affectedBalances: {
    [token: string]: { [spender: string]: { [owner: string]: BigNumber } };
  };

  constructor(provider: providers.JsonRpcProvider) {
    this.provider = provider;
    this.tokenInstances = {};
    this.spenderTokens = {};
    this.affectedBalances = {};
  }

  public async approve(
    token: string,
    owner: string,
    spender: string,
    amount: BigNumber,
    timestamp: number,
    blockNumber: number
  ) {
    const tokenInstance = this.getLinkedTokenInstance(token, spender);
    tokenInstance.approve(owner, spender, amount, timestamp);
    this.affectedBalances[token] = this.affectedBalances[token] || {};
    this.affectedBalances[token][spender] = this.affectedBalances[token][spender] || {};
    this.affectedBalances[token][spender][owner] = BigNumber.min(
      amount,
      await tokenInstance.balanceOf(owner, blockNumber)
    );
  }

  public async increaseAllowance(
    token: string,
    owner: string,
    spender: string,
    addedValue: BigNumber,
    timestamp: number,
    blockNumber: number
  ) {
    const tokenInstance = this.getLinkedTokenInstance(token, spender);
    await tokenInstance.increaseAllowance(owner, spender, timestamp, blockNumber);
    this.affectedBalances[token] = this.affectedBalances[token] || {};
    this.affectedBalances[token][spender] = this.affectedBalances[token][spender] || {};
    this.affectedBalances[token][spender][owner] = BigNumber.min(
      ...(await Promise.all([
        tokenInstance.allowance(owner, spender, blockNumber),
        tokenInstance.balanceOf(owner, blockNumber)
      ]))
    );
  }

  public clearOutdatedData(minTimestamp: number, permanentSpenders: string[]) {
    const tokens = Object.values(this.tokenInstances);

    for (const token of tokens) {
      token.approvals = token.approvals.filter(
        (e) => e.timestamp >= minTimestamp || permanentSpenders.includes(e.spender)
      );

      // Remove empty token instance and all links to it
      if (!token.approvals.length) {
        // Delete cached token balances
        delete this.affectedBalances[token.address];
        // Delete token instance
        delete this.tokenInstances[token.address];
      }
    }

    for (const spender of Object.keys(this.spenderTokens)) {
      for (const tokenAddress of [...this.spenderTokens[spender]]) {
        const tokenApprovals = this.tokenInstances[tokenAddress]?.approvals || [];
        const spenderApprovals = tokenApprovals.filter((a) => a.spender === spender);

        if (!spenderApprovals.length) {
          this.spenderTokens[spender].delete(tokenAddress);
        }
      }

      if (this.spenderTokens[spender].size === 0) {
        delete this.spenderTokens[spender];
      }
    }
  }

  public getSpenderSummaries() {
    const spenders = [];

    for (const [spenderAddress, tokenAddresses] of Object.entries(this.spenderTokens)) {
      let approvalsCount = 0;
      const tokens: ERC20Token[] = [];
      const owners: Set<string> = new Set();
      const amounts: { [token: string]: BigNumber } = {};

      for (const tokenAddress of tokenAddresses) {
        const token = this.tokenInstances[tokenAddress];
        const approvals = token.approvals.filter((e) => e.spender === spenderAddress);
        tokens.push(token);
        approvals.forEach((approval) => owners.add(approval.owner));
        amounts[tokenAddress] = BigNumber.sum(
          ...Object.values(this.affectedBalances[tokenAddress]?.[spenderAddress] || {}),
          0
        );
        approvalsCount += approvals.length;
      }

      spenders.push({
        tokens: tokens,
        owners: [...owners],
        address: spenderAddress,
        amounts: amounts,
        approvalsCount: approvalsCount
      });
    }

    return spenders;
  }

  public getAffectedBalance(token: string, owner: string, spender: string): BigNumber {
    return this.affectedBalances[token]?.[spender]?.[owner] || new BigNumber(0);
  }

  private getLinkedTokenInstance(token: string, spender: string) {
    let tokenInstance = this.tokenInstances[token];

    if (!tokenInstance) {
      tokenInstance = new ERC20Token(token, this.provider);
      this.tokenInstances[token] = tokenInstance;
    }

    // Add pointer from spender to token
    this.spenderTokens[spender] = this.spenderTokens[spender] || new Set();
    this.spenderTokens[spender].add(token);

    return tokenInstance;
  }
}
