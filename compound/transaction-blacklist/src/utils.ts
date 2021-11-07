import Web3 from 'web3';
import { getJsonRpcUrl } from 'forta-agent';

import GoerliConfig from 'compound-config/networks/goerli.json';
import KovanConfig from 'compound-config/networks/kovan.json';
import MainnetConfig from 'compound-config/networks/mainnet.json';
import RinkebyConfig from 'compound-config/networks/rinkeby.json';
import RopstenConfig from 'compound-config/networks/ropsten.json';

type CompoundAddressInfo = {
  path: string;
  address: string;
  description?: string;
  name?: string;
};

export const web3 = new Web3(getJsonRpcUrl());

export const CompoundNetworkNames = {
  GOERLI: 'goerli',
  KOVAN: 'kovan',
  MAINNET: 'mainnet',
  RINKEBY: 'rinkeby',
  ROPSTEN: 'ropsten'
};

export const CompoundNetworkConfigs = {
  [CompoundNetworkNames.GOERLI]: GoerliConfig,
  [CompoundNetworkNames.KOVAN]: KovanConfig,
  [CompoundNetworkNames.MAINNET]: MainnetConfig,
  [CompoundNetworkNames.RINKEBY]: RinkebyConfig,
  [CompoundNetworkNames.ROPSTEN]: RopstenConfig
};

function getCompoundAddresses(networkConfig: object) {
  function walk(obj: any, objPath?: string): CompoundAddressInfo[] {
    const addresses: CompoundAddressInfo[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const keyPath = [objPath, key].filter((v) => v).join('.');
      if (value && typeof value === 'object') {
        addresses.push(...walk(value, keyPath));
      } else if (typeof value === 'string' && web3.utils.isAddress(value)) {
        const item: CompoundAddressInfo = { path: keyPath, address: value };

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

export class CompoundHelper {
  private _addressMap: { [x: string]: CompoundAddressInfo } = {};

  constructor(networkName: string) {
    const config = CompoundNetworkConfigs[networkName];

    const addresses = getCompoundAddresses(config);

    for (const address of addresses) {
      this._addressMap[address.address] = address;
    }
  }

  public isCompoundAddress(address: string): boolean {
    return !!this._addressMap[address];
  }

  public getAddressInfo(address: string) {
    return this._addressMap[address];
  }
}
