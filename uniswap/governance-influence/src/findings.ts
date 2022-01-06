import { Finding, FindingSeverity, FindingType } from 'forta-agent';

function zeroVotesBeforeProposal() {
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

function votesIncreaseBeforeProposal() {
  return Finding.fromObject({
    name: 'Possible ERC20 Phishing Attack',
    description: `ERC20 approvals were called ${approvalsCount} times to an EOA ${attackerAddress}`,
    alertId: 'KOVART-ERC-20-EOA-ALLOWANCE-0',
    severity: FindingSeverity.High,
    type: FindingType.Suspicious,
    metadata: {}
  });
}

function zeroVotesAfterVoteCast() {
  return Finding.fromObject({
    name: 'Possible ERC20 Phishing Attack',
    description: `ERC20 approvals were called ${approvalsCount} times to an EOA ${attackerAddress}`,
    alertId: 'KOVART-ERC-20-EOA-ALLOWANCE-0',
    severity: FindingSeverity.High,
    type: FindingType.Suspicious,
    metadata: {}
  });
}

function votesDecreaseAfterVoteCast() {
  return Finding.fromObject({
    name: 'Possible ERC20 Phishing Attack',
    description: `ERC20 approvals were called ${approvalsCount} times to an EOA ${attackerAddress}`,
    alertId: 'KOVART-ERC-20-EOA-ALLOWANCE-0',
    severity: FindingSeverity.High,
    type: FindingType.Suspicious,
    metadata: {}
  });
}

const Findings = {
  zeroVotesBeforeProposal,
  votesIncreaseBeforeProposal,
  zeroVotesAfterVoteCast,
  votesDecreaseAfterVoteCast
};

export default Findings;
