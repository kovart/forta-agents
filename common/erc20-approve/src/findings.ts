import { Finding, FindingSeverity, FindingType } from 'forta-agent';
import { AffectedToken } from './types';

export function createPhishingFinding(
  approvalsCount: number,
  attackerAddress: string,
  affectedAddresses: string[],
  tokens: AffectedToken[]
) {
  return Finding.fromObject({
    name: 'Possible ERC20 Phishing Attack',
    description: `ERC20 approvals were called ${approvalsCount} times to an EOA ${attackerAddress}`,
    alertId: 'KOVART-ERC-20-EOA-ALLOWANCE-0',
    severity: FindingSeverity.High,
    type: FindingType.Suspicious,
    metadata: {
      attacker: attackerAddress,
      tokens: JSON.stringify(tokens),
      approvalsCount: approvalsCount.toString(),
      affectedAddresses: JSON.stringify(affectedAddresses)
    }
  });
}
