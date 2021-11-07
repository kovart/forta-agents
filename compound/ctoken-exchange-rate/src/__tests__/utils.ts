import agent from '../agent';
import { TokenStorage } from '../utils';

export class Web3Mock {
  public exchangeRate: string;

  constructor(currentExchangeRate: string) {
    this.exchangeRate = currentExchangeRate;
  }

  public eth = {
    Contract: () => ({
      methods: {
        exchangeRateCurrent: () => ({ call: () => this.exchangeRate })
      }
    })
  };
}

export function provideHandleBlockMock({
  previousExchangeRate,
  currentExchangeRate,
  alertDropRate,
  tokenSymbol
}: {
  previousExchangeRate: string;
  currentExchangeRate: string;
  alertDropRate: number;
  tokenSymbol: string;
}) {
  const web3Mock = new Web3Mock(currentExchangeRate);
  const storage = new TokenStorage();

  storage.save(tokenSymbol, previousExchangeRate);

  return agent.provideHandleBlock(web3Mock as any, storage, alertDropRate);
}
