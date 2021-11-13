import BigNumber from 'bignumber.js';
import { createAddress } from 'forta-agent-tools';
import { TokenConfig } from '../utils/aave-utils';

export const createTokenConfig = (() => {
  const prefix = '7777';
  let nextAddress = 0;

  return (symbol: string) => ({
    symbol: symbol,
    address: createAddress(`0x${prefix}${nextAddress++}`)
  });
})();

export function createAaveUtilsMock(tokens: TokenConfig[]) {
  const tokenConfigsMap: { [symbol: string]: TokenConfig } = {};
  const oracleAddress = createAddress('0x11223344');

  for (const token of tokens) {
    tokenConfigsMap[token.symbol] = token;
  }

  return {
    tokenConfigsMap,
    handleTransaction: jest.fn(),
    getTokenPricesMap: jest.fn(),
    getOracleAddress: jest.fn().mockReturnValue(oracleAddress),

    // helper function
    mockTokenPricesOnce(priceMap: { [tokenSymbol: string]: number }) {
      const map: { [symbol: string]: BigNumber } = {};
      Object.entries(priceMap).forEach(([symbol, price]) => (map[symbol] = new BigNumber(price)));

      this.getTokenPricesMap.mockResolvedValueOnce(map);

      return this;
    }
  };
}

export const big = (num: number) => new BigNumber(num);
