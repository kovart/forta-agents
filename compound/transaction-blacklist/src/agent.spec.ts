import { Finding, FindingSeverity, FindingType, createTransactionEvent } from 'forta-agent';
import agent, { BLACKLISTED_ADDRESSES, COMPOUND_NETWORK } from './agent';
import { CompoundNetworkConfigs } from './utils';

const { handleTransaction } = agent;

const COMPOUND_CONFIG = CompoundNetworkConfigs[COMPOUND_NETWORK];

describe('compound blacklisted address agent', () => {
  const createTxEventWithAddresses = (addresses: { [addr: string]: boolean }) =>
    createTransactionEvent({
      transaction: {} as any,
      receipt: {} as any,
      block: {} as any,
      addresses
    });

  describe('handleTransaction', () => {
    it('returns empty findings if no addresses provided', async () => {
      let txEvent = createTxEventWithAddresses({});
      let findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if it is a regular transaction', async () => {
      // random transaction (0xd49370538f96c4aecbdd47b120449ca7190294d1af84f0d521369a6ef3cb8767)
      const txEvent = createTxEventWithAddresses({
        '0x569dc9a8c3b20e5ca217814bcbf686465a475c4c': true,
        '0xebfcdf8ddabecf0da68c0221ba5506773ac850bf': true
      });
      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if blacklisted address interacts with a non-Compound address', async () => {
      const txEvent = createTxEventWithAddresses({
        [BLACKLISTED_ADDRESSES[0]]: true,
        '0xebfcdf8ddabecf0da68c0221ba5506773ac850bf': true
      });
      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if Compound address interacts with a non-blacklisted address', async () => {
      const txEvent = createTxEventWithAddresses({
        [COMPOUND_CONFIG.cTokens.cDAI.underlying]: true,
        '0xebfcdf8ddabecf0da68c0221ba5506773ac850bf': true
      });
      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if Compound address interacts with a blacklisted address', async () => {
      const blacklistedAddress = BLACKLISTED_ADDRESSES[0];
      const compoundAddress = COMPOUND_CONFIG.cTokens.cDAI.underlying;
      const txEvent = createTxEventWithAddresses({
        [compoundAddress]: true,
        [blacklistedAddress]: true
      });

      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: 'Compound Blacklisted Address',
          description: `Compound transaction involving a blacklisted addresses: [${blacklistedAddress}]`,
          alertId: 'COMP-BLACKLIST',
          type: FindingType.Suspicious,
          severity: FindingSeverity.High,
          metadata: {
            blacklistedAddresses: `[${blacklistedAddress}]`,
            compoundAddresses: `[${COMPOUND_CONFIG.cTokens.cDAI.underlying} (${COMPOUND_CONFIG.cTokens.cDAI.name})]`
          }
        })
      ]);
    });

    it('returns a finding if Compound addresses interacts with multiple blacklisted addresses', async () => {
      const blacklistedAddress1 = BLACKLISTED_ADDRESSES[0];
      const blacklistedAddress2 = BLACKLISTED_ADDRESSES[1];
      const compoundAddress = COMPOUND_CONFIG.cTokens.cDAI.underlying;
      const compoundAddressName = COMPOUND_CONFIG.cTokens.cDAI.name;

      const txEvent = createTxEventWithAddresses({
        [compoundAddress]: true,
        [blacklistedAddress1]: true,
        [blacklistedAddress2]: true
      });

      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: 'Compound Blacklisted Address',
          description: `Compound transaction involving a blacklisted addresses: [${blacklistedAddress1}, ${blacklistedAddress2}]`,
          alertId: 'COMP-BLACKLIST',
          type: FindingType.Suspicious,
          severity: FindingSeverity.High,
          metadata: {
            blacklistedAddresses: `[${blacklistedAddress1}, ${blacklistedAddress2}]`,
            compoundAddresses: `[${compoundAddress} (${compoundAddressName})]`
          }
        })
      ]);
    });

    it('returns a finding if multiple Compound addresses interact with a blacklisted address', async () => {
      const blacklistedAddress = BLACKLISTED_ADDRESSES[0];
      const compoundAddress1 = COMPOUND_CONFIG.Maximillion.address;
      const compoundAddress1Name = 'Maximillion.address'; // path
      const compoundAddress2 = COMPOUND_CONFIG.cTokens.cDAI.underlying;
      const compoundAddress2Name = COMPOUND_CONFIG.cTokens.cDAI.name;

      const txEvent = createTxEventWithAddresses({
        [blacklistedAddress]: true,
        [compoundAddress1]: true,
        [compoundAddress2]: true
      });

      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: 'Compound Blacklisted Address',
          description: `Compound transaction involving a blacklisted addresses: [${blacklistedAddress}]`,
          alertId: 'COMP-BLACKLIST',
          type: FindingType.Suspicious,
          severity: FindingSeverity.High,
          metadata: {
            blacklistedAddresses: `[${blacklistedAddress}]`,
            compoundAddresses: `[${compoundAddress1} (${compoundAddress1Name}), ${compoundAddress2} (${compoundAddress2Name})]`
          }
        })
      ]);
    });
  });
});
