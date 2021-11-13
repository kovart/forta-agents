import axios from 'axios';
import { ethers, BigNumber } from 'ethers';
import { base58 } from 'ethers/lib/utils';
import { getJsonRpcUrl } from 'forta-agent';
import { AAVE_GOVERNANCE_ABI, AAVE_GOVERNANCE_ADDRESS, IPFS_ENDPOINT } from './constants';

export interface IAaveGovernanceUtils {
  getProposalById: (id: number | BigNumber) => Promise<any>;
  getProposalMetadata: (hash: string) => Promise<any>;
}

export class AaveGovernanceUtils implements IAaveGovernanceUtils {
  private governance: ethers.Contract;

  constructor() {
    const provider = new ethers.providers.StaticJsonRpcProvider(getJsonRpcUrl());
    this.governance = new ethers.Contract(AAVE_GOVERNANCE_ADDRESS, AAVE_GOVERNANCE_ABI, provider);
  }

  public async getProposalById(id: number | BigNumber) {
    return this.governance.getProposalById(id);
  }

  public async getProposalMetadata(hash: string) {
    const ipfsHash = base58.encode(Buffer.from(`1220${hash.slice(2)}`, 'hex'));
    const { data } = await axios(`${IPFS_ENDPOINT}/${ipfsHash}`);

    return data;
  }
}
