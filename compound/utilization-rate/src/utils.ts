import BigNumber from 'bignumber.js';
import { Network } from 'forta-agent';
import { AbiItem } from 'web3-utils';

import { CompoundNetworkABI, CompoundNetworkConfig } from './constants';

type SupportedNetwork = keyof typeof CompoundNetworkConfig;

type CTokenContract = {
  address: string;
  name: string;
  symbol: string;
  abi: AbiItem[];
};

type TokenRecord = {
  rate: BigNumber;
  timestamp: number;
};

export class CompoundConfig {
  private static readonly instanceMap: Map<Network, CompoundConfig> = new Map();

  public cTokens: CTokenContract[];

  constructor(network: SupportedNetwork) {
    const networkConfig = CompoundNetworkConfig[network] as any;
    const abiConfig = CompoundNetworkABI[network] as any;

    this.cTokens = Object.values(networkConfig.cTokens || {});

    if (!(this.cTokens.length > 0)) {
      throw new Error(`No cTokens config found in "${Network[network]}" network`);
    }

    for (const cToken of this.cTokens) {
      cToken.abi = abiConfig[cToken.symbol];
    }
  }

  static getInstance(network: SupportedNetwork): CompoundConfig {
    if (!this.instanceMap.has(network)) {
      this.instanceMap.set(network, new CompoundConfig(network));
    }

    return this.instanceMap.get(network)!;
  }
}

export class TokenRateStorage {
  public expireTime: number;
  public utilizationRateMap: { [tokenSymbol: string]: Array<TokenRecord> };
  public getTime: () => number;

  constructor(expireTime: number = 60 * 60, getTime?: () => number) {
    this.expireTime = expireTime; // time after which the rate expired
    this.utilizationRateMap = {};
    this.getTime = getTime || (() => Math.floor(Number(new Date()) / 1000));
  }

  get(tokenSymbol: string): Array<TokenRecord> {
    return this.utilizationRateMap[tokenSymbol] || [];
  }

  add(tokenSymbol: string, rate: BigNumber, timestamp: number) {
    if (!this.utilizationRateMap[tokenSymbol]) {
      this.utilizationRateMap[tokenSymbol] = [];
    }

    this.utilizationRateMap[tokenSymbol].push({ rate, timestamp });
  }

  public getRateStats(tokenSymbol: string) {
    this.clearExpiredRates();

    const records = this.utilizationRateMap[tokenSymbol] || [];

    let lowestRate = records[0]?.rate;
    let highestRate = records[0]?.rate;
    for (let i = 1; i < records.length; i++) {
      const record = records[i];
      if (record.rate.isGreaterThan(highestRate)) {
        highestRate = record.rate;
      }
      if (record.rate.isLessThan(lowestRate)) {
        lowestRate = record.rate;
      }
    }

    return { lowestRate: lowestRate || new BigNumber(0), highestRate: highestRate || new BigNumber(0) };
  }

  private clearExpiredRates() {
    const now = this.getTime();

    // clear expired rates
    for (const [tokenSymbol, records] of Object.entries(this.utilizationRateMap)) {
      this.utilizationRateMap[tokenSymbol] = records.filter(
        (record) => record.timestamp + this.expireTime >= now
      );
    }
  }
}

export function formatNumber(value: string | number | BigNumber, decimalPlaces: number = 2) {
  return new BigNumber(new BigNumber(value).toFormat(decimalPlaces)).toString();
}
