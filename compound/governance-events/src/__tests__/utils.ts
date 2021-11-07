import { createTransactionEvent, Network } from 'forta-agent';
import keccak256 from 'keccak256';
import { CompoundUtils } from '../utils';

type CreateTxEventParams = {
  addresses?: any;
  logs?: any;
  status?: boolean;
  network?: Network;
};

export class TestUtils {
  private compound: CompoundUtils;
  private network: Network;

  constructor(network: Network) {
    this.network = network;
    this.compound = CompoundUtils.getInstance(network);
  }

  prepareTestData(signature: string, params: Array<any>, status = true) {
    const metadata: { [x: string]: string } = {};
    const paramsArr = params.map((p) => Object.values(p)[0]);

    for (const item of params) {
      const [key, value] = Object.entries(item)[0];
      metadata[key] = (<any>value ?? '').toString();
    }

    const { topics, data } = this.compound.encodeLog(signature, paramsArr);

    const txEvent = this.createTxEvent({
      status,
      logs: [
        {
          address: this.compound.GOVERNANCE_ADDRESS,
          topics: topics,
          data: data
        }
      ]
    });

    return { txEvent, metadata };
  }

  createTxEvent({
    addresses = [],
    logs = [],
    status = true,
    network = this.network
  }: CreateTxEventParams) {
    const receipt: any = { logs, status };

    return createTransactionEvent({
      transaction: {} as any,
      block: {} as any,
      addresses,
      network,
      receipt
    });
  }

  generateHash(signature: string): string {
    const hash = keccak256(signature).toString('hex');
    return '0x' + hash;
  }
}
