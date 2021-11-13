// This contract is immutable and the address will never change
// https://docs.aave.com/developers/deployed-contracts/deployed-contracts
export const LENDING_POOL_ADDRESSES_PROVIDER_ADDRESS = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5';

// https://github.com/aave/protocol-v2/blob/master/contracts/interfaces/ILendingPoolAddressesProvider.sol#L18
export const PRICE_ORACLE_UPDATED_EVENT_ABI =
  'event PriceOracleUpdated(address indexed newAddress)';

export const MAINNET_TOKENS_CONFIG_URL = 'https://aave.github.io/aave-addresses/mainnet.json';
