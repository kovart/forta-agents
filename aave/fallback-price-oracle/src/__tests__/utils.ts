import { utils } from 'ethers';
import { createTransactionEvent, Trace, TransactionEvent } from 'forta-agent';

export class TestUtils {
  createTrace(abi: string, data: ReadonlyArray<any> = [], to: string): Trace {
    const iface = new utils.Interface([abi]);
    const fragment = Object.values(iface.functions)[0];

    // we encode trace data according to the parse function in Forta SDK
    // https://github.com/forta-protocol/forta-agent-sdk/blob/master/sdk/transaction.event.ts#L107
    const trace = {
      action: {
        to: to,
        input: iface.encodeFunctionData(fragment, data),
        value: null
      }
    };

    return trace as any;
  }

  createTxEvent(
    traces: Array<Trace>,
    from: string = '0x01',
    to: string = '0x02'
  ): TransactionEvent {
    return createTransactionEvent({
      traces: traces,
      transaction: {
        from,
        to
      } as any,
      addresses: { [from]: true, [to]: true },
      receipt: {} as any,
      block: {} as any
    });
  }
}
