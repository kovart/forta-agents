import {
  Finding,
  FindingSeverity,
  FindingType,
  HandleTransaction,
  TransactionEvent
} from 'forta-agent';
import { CompoundNetworkNames, CompoundHelper } from './utils';

export const COMPOUND_NETWORK = CompoundNetworkNames.MAINNET;
export const BLACKLISTED_ADDRESSES = [
  '0x539e978ad34def1eadf018524a260ab14a7e4122',
  '0x4585fe77225b41b697c938b018e2ac67ac5a20c0'
];

const compound = new CompoundHelper(COMPOUND_NETWORK);

const handleTransaction: HandleTransaction = async (txEvent: TransactionEvent) => {
  const findings: Finding[] = [];

  const txAddresses = Object.keys(txEvent.addresses);

  const blacklistedAddresses = txAddresses.filter((addr) => BLACKLISTED_ADDRESSES.includes(addr));
  const compoundAddresses = txAddresses
    .map((addr) => compound.getAddressInfo(addr))
    .filter((v) => !!v);

  if (blacklistedAddresses.length > 0 && compoundAddresses.length > 0) {
    findings.push(
      Finding.fromObject({
        name: 'Compound Blacklisted Address',
        description: `Compound transaction involving a blacklisted addresses: [${blacklistedAddresses.join(', ')}]`,
        alertId: 'COMP-BLACKLIST',
        severity: FindingSeverity.High,
        type: FindingType.Suspicious,
        metadata: {
          blacklistedAddresses: `[${blacklistedAddresses.map((a) => a).join(', ')}]`,
          compoundAddresses: `[${compoundAddresses
            .map((a) => `${a.address} (${a.name || a.path})`)
            .join(', ')}]`
        }
      })
    );
  }

  return findings;
};

export default {
  handleTransaction
};
