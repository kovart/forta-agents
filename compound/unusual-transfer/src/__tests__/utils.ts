import { createTransactionEvent, Network } from 'forta-agent';
import { utils } from 'ethers';
import keccak256 from 'keccak256';
import { CompoundUtils } from '../utils';

type CreateTxEventParams = {
  logs?: any;
  network?: Network;
};

export class TestUtils {
  private compound: CompoundUtils;
  private network: Network;

  constructor(network: Network) {
    this.network = network;
    this.compound = CompoundUtils.getInstance(network);
  }

  createTxEvent({ logs = [], network = this.network }: CreateTxEventParams) {
    const receipt: any = { logs, status: true };

    return createTransactionEvent({
      transaction: {} as any,
      block: {} as any,
      addresses: [] as any,
      network,
      receipt
    });
  }

  encode(types: Array<string>, data: Array<any>) {
    return utils.defaultAbiCoder.encode(types, data);
  }

  generateHash(signature: string): string {
    const hash = keccak256(signature).toString('hex');
    return '0x' + hash;
  }
}
