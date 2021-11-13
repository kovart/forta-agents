import BigNumber from 'bignumber.js';

export class ExchangeRateHistory {
  private historyLimit: number;
  private history: Map<string, BigNumber[]> = new Map();

  constructor(historyLimit: number = 5) {
    this.historyLimit = historyLimit;
  }

  public push(token1: string, token2: string, value: BigNumber) {
    const key = this.getKey(token1, token2);
    const items = this.history.get(key) || [];
    items.push(value);
    const lastItems = items.slice(-this.historyLimit);
    this.history.set(key, lastItems);
  }

  public getLast(token1: string, token2: string) {
    const key = this.getKey(token1, token2);
    const items = this.history.get(key) || [];
    return items[items.length - 1];
  }

  private getKey(token1: string, token2: string) {
    return `${token1} ${token2}`;
  }
}
