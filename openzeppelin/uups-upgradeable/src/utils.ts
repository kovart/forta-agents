import { utils } from 'ethers';
import { Log } from 'forta-agent';

export function createLog(abi: string, address: string, data: ReadonlyArray<any>): Log {
  const iface = new utils.Interface([abi]);
  const fragment = Object.values(iface.events)[0];

  return {
    ...iface.encodeEventLog(fragment, data),
    address: address
  } as Log;
}
