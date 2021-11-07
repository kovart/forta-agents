import { Network } from 'forta-agent';

import GoerliConfig from 'compound-config/networks/goerli.json';
import GoerliAbiConfig from 'compound-config/networks/goerli-abi.json';
import MainnetConfig from 'compound-config/networks/mainnet.json';
import MainnetAbiConfig from 'compound-config/networks/mainnet-abi.json';
import RinkebyConfig from 'compound-config/networks/rinkeby.json';
import RinkebyAbiConfig from 'compound-config/networks/rinkeby-abi.json';
import RopstenConfig from 'compound-config/networks/ropsten.json';
import RopstenAbiConfig from 'compound-config/networks/ropsten-abi.json';

export const CompoundNetworkConfig = {
  [Network.GOERLI]: GoerliConfig,
  [Network.MAINNET]: MainnetConfig,
  [Network.RINKEBY]: RinkebyConfig,
  [Network.ROPSTEN]: RopstenConfig
};

export const CompoundNetworkABI = {
  [Network.GOERLI]: GoerliAbiConfig,
  [Network.MAINNET]: MainnetAbiConfig,
  [Network.RINKEBY]: RinkebyAbiConfig,
  [Network.ROPSTEN]: RopstenAbiConfig
};

export const ERC20_TRANSFER_SIGNATURE = 'Transfer(address,address,uint256)';
export const ERC20_TRANSFER_ABI =
  ['event Transfer(address indexed from, address indexed to, uint256 value)'];
