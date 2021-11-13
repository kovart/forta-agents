import axios from 'axios';
import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import { getJsonRpcUrl, TransactionEvent } from 'forta-agent';
import AaveOracle from '@aave/protocol-v2/artifacts/contracts/misc/AaveOracle.sol/AaveOracle.json';
import IPriceOracleGetter from '@aave/protocol-v2/artifacts/contracts/interfaces/IPriceOracleGetter.sol/IPriceOracleGetter.json';
import ILendingPoolAddressesProvider from '@aave/protocol-v2/artifacts/contracts/interfaces/ILendingPoolAddressesProvider.sol/ILendingPoolAddressesProvider.json';
import {
  LENDING_POOL_ADDRESSES_PROVIDER_ADDRESS,
  FALLBACK_ORACLE_UPDATED_EVENT_ABI,
  PRICE_ORACLE_UPDATED_EVENT_ABI,
  MAINNET_TOKENS_CONFIG_URL
} from './constants';

export type TokenConfig = {
  symbol: string;
  address: string;
};

export class AaveUtils {
  private oracleAddress!: string;
  private oracleContract!: ethers.Contract;
  private fallbackOracleAddress!: string;
  private fallbackOracleContract!: ethers.Contract;
  private jsonRpcProvider: ethers.providers.JsonRpcProvider;

  public tokens: TokenConfig[] = [];

  constructor() {
    this.jsonRpcProvider = new ethers.providers.StaticJsonRpcProvider(getJsonRpcUrl());
  }

  public async fetchConfigs() {
    // This contract is immutable and the address will never change
    const lendingPoolAddressesProvider = new ethers.Contract(
      LENDING_POOL_ADDRESSES_PROVIDER_ADDRESS,
      ILendingPoolAddressesProvider.abi,
      this.jsonRpcProvider
    );

    const oracleAddress = await lendingPoolAddressesProvider.getPriceOracle();
    await this.setOracleAddress(oracleAddress);

    const fallbackOracleAddress = await this.oracleContract.getFallbackOracle();
    await this.setFallbackOracleAddress(fallbackOracleAddress);

    const { data } = await axios.get(MAINNET_TOKENS_CONFIG_URL);
    const tokenConfigs = data.proto as Array<any>;

    for (const config of tokenConfigs) {
      this.tokens.push({
        address: config.address,
        symbol: config.symbol
      });
    }
  }

  public async handleTransaction(txEvent: TransactionEvent) {
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
      this.setOracleAddress(lastUpdateLog.args.newAddress);
      const fallbackOracleAddress = await this.oracleContract.getFallbackOracle();
      this.setFallbackOracleAddress(fallbackOracleAddress);
    }

    // "Fallback Oracle Updated" events
    logs = txEvent.filterLog(FALLBACK_ORACLE_UPDATED_EVENT_ABI, this.oracleAddress);
    if (logs.length > 0) {
      const lastUpdateLog = logs[logs.length - 1];
      this.setFallbackOracleAddress(lastUpdateLog.args.fallbackOracle);
    }
  }

  public async getOracleAssetPrice(assetAddress: string): Promise<BigNumber> {
    const price = await this.oracleContract.getAssetPrice(assetAddress);
    return new BigNumber(price.toString());
  }

  public async getFallbackOracleAssetPrice(assetAddress: string): Promise<BigNumber> {
    const price = await this.fallbackOracleContract.getAssetPrice(assetAddress);
    return new BigNumber(price.toString());
  }

  public getOracleAddress() {
    return this.oracleAddress;
  }

  private setOracleAddress(newAddress: string): ethers.Contract {
    this.oracleAddress = newAddress;
    this.oracleContract = new ethers.Contract(newAddress, AaveOracle.abi, this.jsonRpcProvider);

    return this.oracleContract;
  }

  public getFallbackOracleAddress() {
    return this.fallbackOracleAddress;
  }

  private setFallbackOracleAddress(newAddress: string): ethers.Contract {
    this.fallbackOracleAddress = newAddress;
    this.fallbackOracleContract = new ethers.Contract(
      newAddress,
      IPriceOracleGetter.abi,
      this.jsonRpcProvider
    );

    return this.fallbackOracleContract;
  }
}

export function formatNumber(value: string | number | BigNumber, decimalPlaces: number = 2) {
  return new BigNumber(new BigNumber(value).toFormat(decimalPlaces)).toString();
}
