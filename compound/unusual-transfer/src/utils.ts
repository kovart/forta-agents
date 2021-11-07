import { FindingSeverity, Log, Network } from 'forta-agent';
import { utils } from 'ethers';
import BigNumber from 'bignumber.js';

import { CompoundNetworkConfig, ERC20_TRANSFER_ABI } from './constants';

type TransactionHistoryItem = {
  from: string;
  to: string;
  amount: BigNumber;
  timestamp: number;
};

type TransactionAnalyzerParams = {
  maxTransferAmount: string;
  organicIncreaseRate: number;
  minOrganicTransactions: number;
  expireTime: number;
};

type AnalyzerResult = {
  isUsual: boolean;
  description: string;
  severity: FindingSeverity;
};

export class CompoundUtils {
  private static readonly instanceMap: Map<Network, CompoundUtils> = new Map();
  private readonly transferInterface: utils.Interface;

  public readonly COMPTROLLER_ADDRESS: string;
  public readonly COMPOUND_TOKEN_ADDRESS: string;

  constructor(network: Network) {
    const networkConfig = CompoundNetworkConfig[network] as any;

    this.COMPTROLLER_ADDRESS = networkConfig.Contracts?.Comptroller;
    this.COMPOUND_TOKEN_ADDRESS = networkConfig.cTokens?.cCOMP?.underlying;

    if (!this.COMPTROLLER_ADDRESS) {
      throw new Error(`No Comptroller address found in "${Network[network]}" network`);
    }

    if (!this.COMPOUND_TOKEN_ADDRESS) {
      throw new Error(`No Compound Token address found in "${Network[network]}" network`);
    }

    this.transferInterface = new utils.Interface(ERC20_TRANSFER_ABI);
  }

  public parseTransferLog(log: Log) {
    return this.transferInterface.parseLog(log);
  }

  static getInstance(network: Network): CompoundUtils {
    if (!this.instanceMap.has(network)) {
      this.instanceMap.set(network, new CompoundUtils(network));
    }

    return this.instanceMap.get(network)!;
  }

  static removeInstance(network: Network) {
    this.instanceMap.delete(network);
  }
}

export class TransactionAnalyzer {
  public readonly expireInterval: number;
  public readonly maxTransferAmount: BigNumber;
  public readonly history: Set<TransactionHistoryItem>;
  public readonly minOrganicTransactions: number;
  public organicIncreaseRate: number;
  public transactionCount: number;
  public maxAmount: BigNumber = new BigNumber(0);

  constructor({
    expireTime,
    maxTransferAmount,
    organicIncreaseRate,
    minOrganicTransactions
  }: TransactionAnalyzerParams) {
    this.expireInterval = expireTime;
    this.organicIncreaseRate = organicIncreaseRate;
    this.minOrganicTransactions = minOrganicTransactions;
    this.maxTransferAmount = new BigNumber(maxTransferAmount);
    this.transactionCount = 0;
    this.history = new Set();
  }

  private catchTransaction(from: string, to: string, amount: BigNumber) {
    const now = Number(new Date());

    this.transactionCount++;

    if (this.maxAmount.isLessThan(amount)) {
      this.maxAmount = amount;
    }

    this.history.forEach((item) => {
      const maxValidTime = item.timestamp + this.expireInterval;
      if (now > maxValidTime) {
        this.history.delete(item);
      }
    });

    this.history.add({ from, to, amount, timestamp: Number(new Date()) });
  }

  public analyze(from: string, to: string, transferAmount: string): AnalyzerResult {
    const amount = new BigNumber(transferAmount);
    // get current max amount before catching this transaction
    const maxAmount = this.maxAmount;
    // in the future, we will be able to dynamically calculate the maximum rate of organic increase
    const currentIncreaseRate = amount.dividedBy(maxAmount);
    const maxOrganicAmount = maxAmount.multipliedBy(this.organicIncreaseRate);

    const formattedAmount = formatEtherAmount(amount.toString());
    const formattedMaxOrganicAmount = formatEtherAmount(maxOrganicAmount.toString());

    this.catchTransaction(from, to, amount);

    if (amount.isGreaterThan(this.maxTransferAmount)) {
      return {
        isUsual: false,
        description: `Too large transfer: ${formattedAmount} COMP.`,
        severity: FindingSeverity.Critical
      };
    }

    if (!maxAmount.isZero() && this.transactionCount > this.minOrganicTransactions) {
      if (currentIncreaseRate.isGreaterThan(this.organicIncreaseRate)) {
        return {
          isUsual: false,
          description:
            `Inorganic amount increase: ${currentIncreaseRate} (${formattedAmount} COMP). ` +
            `Max organic increase: ${this.organicIncreaseRate} (${formattedMaxOrganicAmount} COMP).`,
          severity: FindingSeverity.High
        };
      }
    }

    // we can put some machine learning with history data here

    return {
      isUsual: true,
      severity: FindingSeverity.Info,
      description: 'Usual transaction'
    };
  }
}

export function formatEtherAmount(value: string) {
  return new BigNumber(utils.formatEther(value)).toString();
}
