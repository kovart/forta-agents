import { providers } from 'ethers';
import { AxiosStatic } from 'axios';

export class EthereumAddressRegistry {
  private client: AxiosStatic;
  private provider: providers.JsonRpcProvider;
  private lookups: { [address: string]: number }; // timestamp map
  private cache: {
    exchanges: { [address: string]: boolean | undefined };
    contracts: { [address: string]: boolean | undefined };
  };

  constructor(
    client: AxiosStatic,
    provider: providers.JsonRpcProvider,
    exchangeAddresses: string[]
  ) {
    this.client = client;
    this.provider = provider;

    this.lookups = {};
    this.cache = {
      exchanges: {},
      contracts: {}
    };

    for (let address of exchangeAddresses) {
      address = address.toLowerCase();
      this.cache.exchanges[address] = true;
      this.lookups[address] = Infinity; // permanent cache
    }
  }

  public async isContract(address: string): Promise<boolean> {
    address = address.toLowerCase();

    if (this.lookups[address] !== Infinity) {
      this.lookups[address] = Date.now();
    }

    const cachedValue = this.cache.contracts[address];
    if (typeof cachedValue === 'boolean') return cachedValue;

    const isContract = (await this.provider.getCode(address)) !== '0x';
    this.cache.contracts[address] = isContract;

    return isContract;
  }

  public async isExchange(
    address: string,
    options?: { useExternalApi: boolean }
  ): Promise<boolean> {
    const { useExternalApi = true } = options || {};

    address = address.toLowerCase();

    if (this.lookups[address] !== Infinity) {
      this.lookups[address] = Date.now();
    }

    const cachedValue = this.cache.exchanges[address];
    if (typeof cachedValue === 'boolean') return cachedValue;

    if (useExternalApi) {
      try {
        const { data } = await this.client.get(`https://etherscan.io/address/${address}`);
        const isExchange = data.indexOf("href='/accounts/label/exchange'>Exchange<") > -1;
        this.cache.exchanges[address] = isExchange;
        return isExchange;
      } catch {
        // ignore client errors
      }
    }

    return false;
  }

  public clearOutdatedCache(minTimestamp: number) {
    const entries = [...Object.entries(this.lookups)];

    for (const [address, timestamp] of entries) {
      if (timestamp >= minTimestamp) continue;

      delete this.cache.contracts[address];
      delete this.cache.exchanges[address];
      delete this.lookups[address];
    }
  }
}
