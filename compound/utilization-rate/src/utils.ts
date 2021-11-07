import BigNumber from 'bignumber.js';
import { Network } from 'forta-agent';
import { AbiItem } from 'web3-utils';

import { CompoundNetworkABI, CompoundNetworkConfig } from './constants';

type CTokenContract = {
  address: string;
  name: string;
  symbol: string;
  abi: AbiItem[];
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

type TokenRecord = {
  rate: BigNumber;
  timestamp: number;
};

export class TokenRateStorage {
  public expireTime: number;
  public utilizationRateMap: { [x: string]: Array<TokenRecord> };

  constructor(expireTime: number = 60 * 60) {
    this.expireTime = expireTime; // time after which the rate expired
    this.utilizationRateMap = {};
  }

  get(tokenSymbol: string): Array<TokenRecord> {
    return this.utilizationRateMap[tokenSymbol] || [];
  }

  save(tokenSymbol: string, rate: BigNumber, timestamp: number) {
    // normalize to block timestamp
    const now = Math.floor(Number(new Date()) / 1000);

    if (!this.utilizationRateMap[tokenSymbol]) {
      this.utilizationRateMap[tokenSymbol] = [];
    }

    this.utilizationRateMap[tokenSymbol].push({ rate, timestamp });

    // clear expired rates
    for (const [tokenSymbol, records] of Object.entries(this.utilizationRateMap)) {
      this.utilizationRateMap[tokenSymbol] = records.filter(
        (record) => record.timestamp + this.expireTime >= now
      );
    }
  }

  public getRateStats(tokenSymbol: string) {
    let lowestRate = new BigNumber(0);
    let highestRate = new BigNumber(0);

    const records = this.utilizationRateMap[tokenSymbol] || [];

    for (const record of records) {
      if (record.rate.isGreaterThan(highestRate)) {
        highestRate = record.rate;
      }
      if (lowestRate.isZero() || record.rate.isLessThan(lowestRate)) {
        lowestRate = record.rate;
      }
    }

    return { lowestRate, highestRate };
  }
}

export function formatNumber(value: string | number | BigNumber, decimalPlaces: number = 2) {
  return new BigNumber(new BigNumber(value).toFormat(decimalPlaces)).toString();
}
