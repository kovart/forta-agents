// This contract is immutable and the address will never change
// https://docs.aave.com/developers/deployed-contracts/deployed-contracts
export const LENDING_POOL_ADDRESSES_PROVIDER_ADDRESS = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5';

export const LENDING_POOL_ADDRESS = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';

// https://github.com/aave/protocol-v2/blob/master/contracts/interfaces/ILendingPoolAddressesProvider.sol#L18
export const PRICE_ORACLE_UPDATED_EVENT_ABI =
  'event PriceOracleUpdated(address indexed newAddress)';

export const MAINNET_TOKENS_CONFIG_URL = 'https://aave.github.io/aave-addresses/mainnet.json';

export const FLASH_LOAN_FUNCTION_ABI = `function flashLoan(address receiverAddress, address[] calldata assets, uint256[] calldata amounts, uint256[] calldata modes,address onBehalfOf, bytes calldata params, uint16 referralCode) external`;
