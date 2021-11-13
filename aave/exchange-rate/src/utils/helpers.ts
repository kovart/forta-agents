import BigNumber from 'bignumber.js';

export function formatNumber(value: string | number | BigNumber, decimalPlaces: number = 2) {
  return new BigNumber(new BigNumber(value).toFormat(decimalPlaces)).toString();
}
