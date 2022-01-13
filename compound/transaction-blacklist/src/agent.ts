import {
  Finding,
  FindingSeverity,
  FindingType,
  Network,
  TransactionEvent,
  HandleTransaction
} from 'forta-agent';
import { CompoundNetworkConfigs, CompoundRegistry } from './utils';
import { BlackListEntry, CompoundAddressEntry } from './types';

import blacklist from './data/blacklist.json';
const compound = new CompoundRegistry(CompoundNetworkConfigs[Network.MAINNET]);

function provideHandleTransaction(
  compound: CompoundRegistry,
  blacklist: BlackListEntry[]
): HandleTransaction {
  const blacklistedEntriesMap: { [addr: string]: BlackListEntry } = {};

  blacklist.forEach((entry) => {
    const address = entry.address.toLowerCase();
    blacklistedEntriesMap[address] = { address, comment: entry.comment };
  });

  return async function handleTransaction(txEvent: TransactionEvent) {
    const findings: Finding[] = [];

    if (!txEvent.status) return findings;

    const txAddresses = Object.keys(txEvent.addresses);
    const blacklistedAddressEntries = txAddresses
      .map((addr) => blacklistedEntriesMap[addr.toLowerCase()])
      .filter((v) => !!v);

    if (!blacklistedAddressEntries.length) return findings;

    const compoundAddressEntries = txAddresses
      .map((address) => {
        address = address.toLowerCase();
        return !blacklistedEntriesMap[address] && compound.getAddressEntry(address);
      })
      .filter((v) => !!v) as unknown as CompoundAddressEntry[];

    if (compoundAddressEntries.length > 0) {
      findings.push(createFinding(blacklistedAddressEntries, compoundAddressEntries));
    }

    return findings;
  };
}

function createFinding(
  blacklistedAddressEntries: BlackListEntry[],
  compoundAddressEntries: CompoundAddressEntry[]
) {
  const formattedBlacklistedAddresses = blacklistedAddressEntries.map((e) => e.address).join(', ');
  const formattedAddressWord = blacklistedAddressEntries.length > 1 ? 'addresses' : 'address';

  return Finding.fromObject({
    name: 'Compound Interaction with a Blacklisted Address',
    description:
      `Compound Protocol was involved in a transaction ` +
      `with blacklisted ${formattedAddressWord}: ${formattedBlacklistedAddresses}`,
    alertId: 'KOVART-COMPOUND-BLACKLIST',
    everestId: '0x9c6983d688f1f65ad6224c8151f3c89dd39e6472',
    protocol: 'Compound',
    severity: FindingSeverity.High,
    type: FindingType.Suspicious,
    metadata: {
      blacklistedAddresses: JSON.stringify(blacklistedAddressEntries),
      compoundAddresses: JSON.stringify(compoundAddressEntries)
    }
  });
}

export default {
  createFinding,
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(compound, blacklist)
};
