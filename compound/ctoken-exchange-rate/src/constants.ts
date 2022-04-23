import { Network } from 'forta-agent';

import GoerliConfig from './config/goerli.json';
import GoerliAbiConfig from './config/goerli-abi.json';
import MainnetConfig from './config/mainnet.json';
import MainnetAbiConfig from './config/mainnet-abi.json';
import RinkebyConfig from './config/rinkeby.json';
import RinkebyAbiConfig from './config/rinkeby-abi.json';
import RopstenConfig from './config/ropsten.json';
import RopstenAbiConfig from './config/ropsten-abi.json';

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
