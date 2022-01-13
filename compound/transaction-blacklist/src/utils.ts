import Web3 from 'web3';
import { getJsonRpcUrl, Network } from 'forta-agent';
import { CompoundAddressEntry } from './types';

import GoerliConfig from 'compound-config/networks/goerli.json';
import MainnetConfig from 'compound-config/networks/mainnet.json';
import RinkebyConfig from 'compound-config/networks/rinkeby.json';
import RopstenConfig from 'compound-config/networks/ropsten.json';

export const web3 = new Web3(getJsonRpcUrl());

export const CompoundNetworkConfigs = {
  [Network.GOERLI]: GoerliConfig,
  [Network.MAINNET]: MainnetConfig,
  [Network.RINKEBY]: RinkebyConfig,
  [Network.ROPSTEN]: RopstenConfig
};

export class CompoundRegistry {
  private _addressMap: { [address: string]: CompoundAddressEntry } = {};

  constructor(config: object) {
    const entries = this.parseNetworkConfig(config);

    for (const entry of entries) {
      this._addressMap[entry.address] = entry;
    }
  }

  public getAddressEntry(address: string) {
    return this._addressMap[address];
  }

  private parseNetworkConfig(networkConfig: object) {
    function walk(obj: any, objPath?: string): CompoundAddressEntry[] {
      const addresses: CompoundAddressEntry[] = [];

      for (const [key, value] of Object.entries(obj)) {
        const keyPath = [objPath, key].filter((v) => v).join('.');
        if (value && typeof value === 'object') {
          addresses.push(...walk(value, keyPath));
        } else if (typeof value === 'string' && web3.utils.isAddress(value)) {
          const item: CompoundAddressEntry = { path: keyPath, address: value.toLowerCase() };

          if (obj.name) {
            item.name = obj.name;
          }

          if (obj.description) {
            item.description = obj.description;
          }

          addresses.push(item);
        }
      }

      return addresses;
    }

    // do not walk in Contract addresses
    networkConfig = { ...networkConfig, Contracts: null };

    return walk(networkConfig);
  }
}
