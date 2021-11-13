import axios from 'axios';
import uniq from 'lodash/uniq';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { getJsonRpcUrl, TransactionEvent } from 'forta-agent';
import AaveOracle from '@aave/protocol-v2/artifacts/contracts/misc/AaveOracle.sol/AaveOracle.json';
import ILendingPoolAddressesProvider from '@aave/protocol-v2/artifacts/contracts/interfaces/ILendingPoolAddressesProvider.sol/ILendingPoolAddressesProvider.json';
import {
  LENDING_POOL_ADDRESSES_PROVIDER_ADDRESS,
  MAINNET_TOKENS_CONFIG_URL,
  PRICE_ORACLE_UPDATED_EVENT_ABI
} from '../constants';

export type TokenConfig = {
  symbol: string;
  address: string;
};

export class AaveUtils {
  private oracleAddress!: string;
  private oracleContract!: ethers.Contract;
  private jsonRpcProvider: ethers.providers.JsonRpcProvider;

  public readonly interestingTokens: string[];
  public readonly tokenConfigsMap: { [x: string]: TokenConfig } = {};

  constructor(tokenPairs: string[][] = []) {
    this.jsonRpcProvider = new ethers.providers.StaticJsonRpcProvider(getJsonRpcUrl());
    this.interestingTokens = uniq(tokenPairs.flat());
  }

  public async fetchConfigs(): Promise<void> {
    // This contract is immutable and the address will never change
    const lendingPoolAddressesProvider = new ethers.Contract(
      LENDING_POOL_ADDRESSES_PROVIDER_ADDRESS,
      ILendingPoolAddressesProvider.abi,
      this.jsonRpcProvider
    );

    // Fetch current oracle address and initialize contract for it
    this.oracleAddress = await lendingPoolAddressesProvider.getPriceOracle();
    this.oracleContract = new ethers.Contract(
      this.oracleAddress,
      AaveOracle.abi,
      this.jsonRpcProvider
    );

    // Fetch token configs
    const { data } = await axios.get(MAINNET_TOKENS_CONFIG_URL);
    const tokenConfigs = data.proto as Array<any>;

    for (const config of tokenConfigs) {
      if (this.interestingTokens.includes(config.symbol)) {
        this.tokenConfigsMap[config.symbol] = {
          symbol: config.symbol,
          address: config.address
        };
      }
    }

    // Check if all interesting tokens are fetched
    const missingTokens = this.interestingTokens.filter((t) => !this.tokenConfigsMap[t]);
    if (missingTokens.length > 0) {
      throw new Error(`Cannot find token configs for: [${missingTokens.join(', ')}]`);
    }
  }

  public handleTransaction(txEvent: TransactionEvent) {
    // This method optimizes contract calls to a minimum
    // by detecting state changes in transaction logs.

    let logs = null;

    // "Price Oracle Updated" events
    logs = txEvent.filterLog(
      PRICE_ORACLE_UPDATED_EVENT_ABI,
      LENDING_POOL_ADDRESSES_PROVIDER_ADDRESS
    );
    if (logs.length > 0) {
      const lastUpdateLog = logs[logs.length - 1];
      this.oracleAddress = lastUpdateLog.args.newAddress;
      this.oracleContract = new ethers.Contract(
        this.oracleAddress,
        AaveOracle.abi,
        this.jsonRpcProvider
      );
    }
  }

  public async getTokenPricesMap() {
    const tokenConfigs = Object.values(this.tokenConfigsMap);
    const prices = (await this.oracleContract.getAssetsPrices(
      tokenConfigs.map((t) => t.address)
    )) as Array<any>;

    const map: { [x: string]: BigNumber } = {};

    for (let i = 0; i < prices.length; i++) {
      const token = tokenConfigs[i];
      map[token.symbol] = new BigNumber(prices[i].toString());
    }

    return map;
  }

  public getOracleAddress(): string {
    return this.oracleAddress;
  }
}
