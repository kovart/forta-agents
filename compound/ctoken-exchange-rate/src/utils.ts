import { FindingSeverity, Log, Network } from 'forta-agent';
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';

import { CompoundNetworkABI, CompoundNetworkConfig } from './constants';

type CTokenContract = {
  address: string;
  name: string;
  symbol: string;
  abi: AbiItem[];
  contract: Contract;
};

export class CompoundUtils {
  private static readonly instanceMap: Map<Network, CompoundUtils> = new Map();

  public cTokens: CTokenContract[];

  constructor(network: Network) {
    const networkConfig = CompoundNetworkConfig[network] as any;
    const abuConfig = CompoundNetworkABI[network] as any;

    this.cTokens = Object.values(networkConfig.cTokens || {});

    if (!(this.cTokens.length > 0)) {
      throw new Error(`No cTokens config found in "${Network[network]}" network`);
    }

    for (const cToken of this.cTokens) {
      cToken.abi = abuConfig[cToken.symbol];
    }
  }

  static getInstance(network: Network): CompoundUtils {
    if (!this.instanceMap.has(network)) {
      this.instanceMap.set(network, new CompoundUtils(network));
    }

    return this.instanceMap.get(network)!;
  }

  static removeInstance(network: Network) {
    this.instanceMap.delete(network);
  }
}

export class TokenStorage {
  private readonly maxBlocksInMemory: number;
  public exchangeRateHistory: { [x: string]: Array<string> };

  constructor(maxBlocksInMemory: number = 100) {
    this.maxBlocksInMemory = maxBlocksInMemory;
    this.exchangeRateHistory = {};
  }

  save(tokenSymbol: string, rate: string) {
    if (!this.exchangeRateHistory[tokenSymbol]) {
      this.exchangeRateHistory[tokenSymbol] = [];
    }

    if (this.exchangeRateHistory[tokenSymbol].length > this.maxBlocksInMemory) {
      const arr = this.exchangeRateHistory[tokenSymbol];
      const removeLength = arr.length - this.maxBlocksInMemory;
      this.exchangeRateHistory[tokenSymbol] = arr.splice(0, removeLength);
    }

    this.exchangeRateHistory[tokenSymbol].push(rate);
  }

  getLastExchangeRate(tokenSymbol: string): string {
    const rates = this.exchangeRateHistory[tokenSymbol] || ['0'];
    return rates[rates.length - 1];
  }
}
