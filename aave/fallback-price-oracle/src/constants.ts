// This contract is immutable and the address will never change
// https://docs.aave.com/developers/deployed-contracts/deployed-contracts
export const LENDING_POOL_ADDRESSES_PROVIDER_ADDRESS = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5';

// https://github.com/aave/protocol-v2/blob/master/contracts/misc/AaveOracle.sol#L124
export const GET_FALLBACK_ORACLE_FUNCTION_ABI =
  'function getFallbackOracle() external view returns (address)';

// https://github.com/aave/protocol-v2/blob/master/contracts/interfaces/IPriceOracleGetter.sol#L15
export const GET_ASSET_PRICE_FUNCTION_ABI =
  'function getAssetPrice(address asset) external view returns (uint256)';

// https://github.com/aave/protocol-v2/blob/master/contracts/interfaces/ILendingPoolAddressesProvider.sol#L18
export const PRICE_ORACLE_UPDATED_EVENT_ABI =
  'event PriceOracleUpdated(address indexed newAddress)';

// https://github.com/aave/protocol-v2/blob/master/contracts/misc/AaveOracle.sol#L23
export const FALLBACK_ORACLE_UPDATED_EVENT_ABI =
  'event FallbackOracleUpdated(address indexed fallbackOracle)';

export const MAINNET_TOKENS_CONFIG_URL = 'https://aave.github.io/aave-addresses/mainnet.json';
