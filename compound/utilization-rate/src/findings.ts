import { Finding, FindingSeverity, FindingType } from 'forta-agent';

export type Direction = 'up' | 'down';

export const createFinding = (
  tokenSymbol: string,
  tokenAddress: string,
  direction: Direction,
  percent: string | number,
  minutes: number,
  lowestRate: string | number,
  highestRate: string | number,
  changeRate: string | number
) =>
  Finding.from({
    alertId: 'AK-COMP-UTILIZATION-RATE',
    name: `Compound ${tokenSymbol} Utilization Rate`,
    description: `Utilization rate of ${tokenSymbol} is ${direction} ${percent}% within ${minutes} minutes`,
    severity: FindingSeverity.Medium,
    type: FindingType.Suspicious,
    addresses: [tokenAddress],
    metadata: {
      tokenSymbol,
      tokenAddress: tokenAddress.toLowerCase(),
      lowestRate: lowestRate.toString(),
      highestRate: highestRate.toString(),
      changeRate: changeRate.toString()
    }
  });
