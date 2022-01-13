import { CompoundRegistry } from './utils';
import { createAddress } from 'forta-agent-tools';

describe('compound blacklist agent utils', () => {
  describe('CompoundRegistry', () => {
    it('returns correct address entry', async () => {
      const config = {
        Comptroller: {
          StdComptrollerG1: {
            address: createAddress('0x1')
          }
        },
        Token1: {
          address: createAddress('0x2'),
          name: 'Token 1'
        },
        Governor: {
          Bravo: {
            address1: createAddress('0x3'),
            address2: createAddress('0x4')
          }
        },
        Tokens: {
          TKN: {
            address: createAddress('0x5'),
            description: 'TKN description'
          }
        }
      };

      const registry = new CompoundRegistry(config);

      let entry = registry.getAddressEntry(config.Comptroller.StdComptrollerG1.address);

      expect(entry).toStrictEqual({
        address: config.Comptroller.StdComptrollerG1.address,
        path: 'Comptroller.StdComptrollerG1.address'
      });

      entry = registry.getAddressEntry(config.Token1.address);

      expect(entry).toStrictEqual({
        address: config.Token1.address,
        name: config.Token1.name,
        path: 'Token1.address'
      });

      entry = registry.getAddressEntry(config.Governor.Bravo.address1);

      expect(entry).toStrictEqual({
        address: config.Governor.Bravo.address1,
        path: 'Governor.Bravo.address1'
      });

      entry = registry.getAddressEntry(config.Governor.Bravo.address2);

      expect(entry).toStrictEqual({
        address: config.Governor.Bravo.address2,
        path: 'Governor.Bravo.address2'
      });

      entry = registry.getAddressEntry(config.Tokens.TKN.address);

      expect(entry).toStrictEqual({
        address: config.Tokens.TKN.address,
        path: 'Tokens.TKN.address',
        description: config.Tokens.TKN.description
      });
    });
  });
});
