import axios from 'axios';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { getJsonRpcUrl, TransactionEvent } from 'forta-agent';
import AaveOracle from '@aave/protocol-v2/artifacts/contracts/misc/AaveOracle.sol/AaveOracle.json';
import ILendingPoolAddressesProvider from '@aave/protocol-v2/artifacts/contracts/interfaces/ILendingPoolAddressesProvider.sol/ILendingPoolAddressesProvider.json';
import {
  LENDING_POOL_ADDRESSES_PROVIDER_ADDRESS,
  PRICE_ORACLE_UPDATED_EVENT_ABI,
  MAINNET_TOKENS_CONFIG_URL
} from './constants';
import { TokenConfig } from './types';

export class AaveUtils {
  private oracleContract!: ethers.Contract;
  private jsonRpcProvider: ethers.providers.JsonRpcProvider;

  public tokenConfigsMap: { [address: string]: TokenConfig } = {};
  public usdtConfig!: TokenConfig;

  constructor() {
    this.jsonRpcProvider = new ethers.providers.StaticJsonRpcProvider(getJsonRpcUrl());
  }

  public async fetchConfigs(): Promise<void> {
    // This contract is immutable and the address will never change
    const lendingPoolAddressesProvider = new ethers.Contract(
      LENDING_POOL_ADDRESSES_PROVIDER_ADDRESS,
      ILendingPoolAddressesProvider.abi,
      this.jsonRpcProvider
    );

    // Fetch current oracle address and initialize contract for it
    const oracleAddress = await lendingPoolAddressesProvider.getPriceOracle();
    this.oracleContract = new ethers.Contract(oracleAddress, AaveOracle.abi, this.jsonRpcProvider);

    // Fetch token configs
    const { data } = await axios.get(MAINNET_TOKENS_CONFIG_URL);
    const configs = (data?.proto as Array<TokenConfig>) || [];

    for (const config of configs) {
      this.tokenConfigsMap[config.address] = {
        symbol: config.symbol,
        address: config.address,
        decimals: config.decimals
      };
    }

    this.usdtConfig = configs.find((c) => c.symbol === 'USDT')!;

    // We can also try to get this data from ProtocolDataProvider (https://etherscan.io/address/0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d#readContract)

    if (!configs.length || !this.usdtConfig) {
      throw new Error('Cannot fetch token configs');
    }
  }

  public handleTransaction(txEvent: TransactionEvent) {
    // This method optimizes getPriceOracle() calls to a minimum
    // by detecting state changes in transaction logs.

    // "Price Oracle Updated" events
    const logs = txEvent.filterLog(
      PRICE_ORACLE_UPDATED_EVENT_ABI,
      LENDING_POOL_ADDRESSES_PROVIDER_ADDRESS
    );
    if (logs.length > 0) {
      const lastUpdateLog = logs[logs.length - 1];
      this.oracleContract = new ethers.Contract(
        lastUpdateLog.args.newAddress,
        AaveOracle.abi,
        this.jsonRpcProvider
      );
    }
  }

  public async getTokenPricesMap(assetsAddresses: string[], blockTag: number) {
    // You can uncomment this if your json-rpc provider allows you to specify block
    // --------------------------------------
    // const prices = (await this.oracleContract.getAssetsPrices(assetsAddresses, {
    //   blockTag
    // })) as Array<any>;

    const prices = (await this.oracleContract.getAssetsPrices(assetsAddresses)) as Array<any>;

    const map: { [x: string]: BigNumber } = {};

    for (let i = 0; i < prices.length; i++) {
      map[assetsAddresses[i]] = new BigNumber(prices[i].toString());
    }

    return map;
  }
}
