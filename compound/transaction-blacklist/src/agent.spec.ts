import { TestTransactionEvent, createAddress } from 'forta-agent-tools';
import { BlackListEntry, CompoundAddressEntry } from './types';
import Agent from './agent';

const { provideHandleTransaction, createFinding } = Agent;

describe('compound blacklist agent', () => {
  describe('handleTransaction', () => {
    let txEvent: TestTransactionEvent;
    let mockCompoundHelper = {
      getAddressEntry: jest.fn()
    };

    beforeEach(() => {
      txEvent = new TestTransactionEvent();
      mockCompoundHelper.getAddressEntry.mockReset();
    });

    it('returns empty findings if no Compound addresses provided', async () => {
      const blacklistedAddress = createAddress('0x1');

      const handleTransaction = provideHandleTransaction(mockCompoundHelper as any, [
        { address: blacklistedAddress }
      ]);

      txEvent.addInvolvedAddresses(blacklistedAddress);

      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if no blacklisted addresses provided', async () => {
      mockCompoundHelper.getAddressEntry.mockReturnValueOnce(true);

      const handleTransaction = provideHandleTransaction(mockCompoundHelper as any, []);

      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if Compound address interacts with a blacklisted address', async () => {
      const blacklistedAddress = createAddress('0x1');
      const compoundAddress = createAddress('0x2');

      const blacklistedAddressEntries: BlackListEntry[] = [{ address: blacklistedAddress }];
      const compoundAddressEntries: CompoundAddressEntry[] = [
        { address: compoundAddress, path: 'test' }
      ];

      const handleTransaction = provideHandleTransaction(
        mockCompoundHelper as any,
        blacklistedAddressEntries
      );

      txEvent.addInvolvedAddresses(blacklistedAddress, compoundAddress);

      mockCompoundHelper.getAddressEntry.mockReturnValueOnce(compoundAddressEntries[0]);

      const findings = await handleTransaction(txEvent);

      const finding = createFinding(blacklistedAddressEntries, compoundAddressEntries);

      expect(mockCompoundHelper.getAddressEntry).toHaveBeenNthCalledWith(1, compoundAddress);
      expect(findings).toStrictEqual([finding]);
    });

    it('returns a finding if transaction multiple Compound addresses interact with multiple blacklisted addresses', async () => {
      const blacklistedAddress1 = createAddress('0x1');
      const blacklistedAddress2 = createAddress('0x2');
      const compoundAddress1 = createAddress('0x3');
      const compoundAddress2 = createAddress('0x4');

      const blacklistedAddressEntries: BlackListEntry[] = [
        blacklistedAddress1,
        blacklistedAddress2
      ].map((address) => ({ address }));
      const compoundAddressEntries: CompoundAddressEntry[] = [
        compoundAddress1,
        compoundAddress2
      ].map((address, i) => ({ address, path: 'path #' + i }));

      const handleTransaction = provideHandleTransaction(
        mockCompoundHelper as any,
        blacklistedAddressEntries
      );

      txEvent.addInvolvedAddresses(
        blacklistedAddress1,
        compoundAddress1,
        blacklistedAddress2,
        compoundAddress2
      );

      mockCompoundHelper.getAddressEntry.mockImplementation((address: string) => {
        if (address === compoundAddress1) return compoundAddressEntries[0];
        if (address === compoundAddress2) return compoundAddressEntries[1];
      });

      const findings = await handleTransaction(txEvent);

      const finding = createFinding(blacklistedAddressEntries, compoundAddressEntries);

      expect(findings).toStrictEqual([finding]);
      expect(mockCompoundHelper.getAddressEntry).toHaveBeenCalledTimes(2);
    });
  });
});
