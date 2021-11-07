import { Log, Network } from 'forta-agent';
import { utils } from 'ethers';
import { LogDescription } from 'ethers/lib/utils';
import uniqBy from 'lodash/uniqBy';

import { CompoundNetworkABI, CompoundNetworkConfig } from './constants';

export class CompoundUtils {
  private static readonly instanceMap: Map<Network, CompoundUtils> = new Map();
  private readonly compoundInterface: utils.Interface;

  public readonly GOVERNANCE_ADDRESS: string;

  constructor(network: Network) {
    const networkConfig = CompoundNetworkConfig[network] as any;
    const abiConfig = CompoundNetworkABI[network] as any;

    this.GOVERNANCE_ADDRESS = networkConfig.Governor?.GovernorBravo?.address;

    if (!this.GOVERNANCE_ADDRESS) {
      throw new Error(`No GovernorBravo address found in "${Network[network]}" network`);
    }

    if (!abiConfig.GovernorBravo) {
      throw new Error(`No GovernorBravo ABI found in "${Network[network]}" network`);
    }

    // official configs contains duplicates
    const governanceAbi = uniqBy(abiConfig.GovernorBravo, (e: any) => e.name);

    this.compoundInterface = new utils.Interface(governanceAbi);
  }

  public parseLog(log: Log) {
    return this.compoundInterface.parseLog(log);
  }

  public parseMetadata(log: LogDescription) {
    const metadata: { [x: string]: string } = {};

    // get named properties
    let index = 0;
    const shift = log.args.length; // named properties are not countable
    for (const key in log.args) {
      if (index >= shift) metadata[key] = log.args[key].toString();
      index++;
    }

    return metadata;
  }

  public encodeLog(signature: string, data: ReadonlyArray<any>) {
    return this.compoundInterface.encodeEventLog(signature as any, data);
  }

  static getInstance(network: Network): CompoundUtils {
    if (!this.instanceMap.has(network)) {
      this.instanceMap.set(network, new CompoundUtils(network));
    }

    return this.instanceMap.get(network)!;
  }
}
