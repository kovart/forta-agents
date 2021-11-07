import { EventType, Network, createBlockEvent } from 'forta-agent';

export class Web3Mock {
  constructor(public cash: string, public borrows: string, public reserves: string) {}

  public eth = {
    Contract: () => ({
      methods: {
        getCash: () => ({ call: () => this.cash }),
        totalBorrowsCurrent: () => ({ call: () => this.borrows }),
        totalReserves: () => ({ call: () => this.reserves })
      }
    })
  };
}

type CreateBlockEventParams = { timestamp: number; network: Network };

export function createBlockEventMock(params?: CreateBlockEventParams) {
  const { timestamp = Math.floor(Number(new Date()) / 1000), network = Network.MAINNET } = params || {};

  return createBlockEvent({
    network: network,
    type: EventType.BLOCK,
    block: {
      timestamp
    } as any
  });
}
