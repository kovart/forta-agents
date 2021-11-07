import { Finding, FindingSeverity, FindingType, HandleTransaction, Network } from 'forta-agent';
import { utils as ethersUtils } from 'ethers';
import BigNumber from 'bignumber.js';

import agent from '../agent';
import { TestUtils } from './utils';
import { CompoundUtils, TransactionAnalyzer, formatEtherAmount } from '../utils';
import { ERC20_TRANSFER_SIGNATURE } from '../constants';

const { EVENT_ALERT_ID, provideHandlerTransaction } = agent;
const { parseEther, formatEther } = ethersUtils;

const MAX_AMOUNT_THRESHOLD = parseEther('10'); // alert if more than 10 COMP Tokens
const MIN_ORGANIC_TRANSACTIONS = 100; // start analyzing organic increase after 1000 transactions
const ORGANIC_INCREASE_RATE = 0.6; // alert if increased by more than 60% from the max previous amount
const EXPIRE_INTERVAL = 5 * 24 * 60 * 60 * 1000; // 5 days
const RANDOM_ETH_ADDRESS = '0x29D7d1dd5B6f9C864d9db560D72a247c178aE86B';
const NETWORK = Network.MAINNET;

const compound = new CompoundUtils(NETWORK);
const utils = new TestUtils(NETWORK);

describe('compound unusual transfer agent', () => {
  describe('handleTransaction', () => {
    let handleTransaction: HandleTransaction;
    let analyzer: TransactionAnalyzer;

    beforeEach(() => {
      analyzer = new TransactionAnalyzer({
        expireTime: EXPIRE_INTERVAL,
        maxTransferAmount: MAX_AMOUNT_THRESHOLD.toString(),
        organicIncreaseRate: ORGANIC_INCREASE_RATE,
        minOrganicTransactions: MIN_ORGANIC_TRANSACTIONS
      });
      handleTransaction = provideHandlerTransaction(analyzer);
    });

    it('returns empty findings if no comptroller address is involved', async () => {
      const txEvent = utils.createTxEvent({});

      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if no transfer signature found', async () => {
      const txEvent = utils.createTxEvent({
        logs: [
          {
            address: compound.COMPOUND_TOKEN_ADDRESS,
            topics: [
              utils.generateHash('NotATransfer(address,address,uint256)'),
              utils.encode(['address'], [compound.COMPTROLLER_ADDRESS]),
              utils.encode(['address'], [RANDOM_ETH_ADDRESS])
            ],
            data: utils.encode(['uint256'], [MAX_AMOUNT_THRESHOLD.add(parseEther('1'))])
          }
        ]
      });

      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if large transfer out of Comptroller address', async () => {
      const amount = MAX_AMOUNT_THRESHOLD.add(parseEther('1'));
      const txEvent = utils.createTxEvent({
        logs: [
          {
            address: compound.COMPOUND_TOKEN_ADDRESS,
            topics: [
              utils.generateHash(ERC20_TRANSFER_SIGNATURE),
              utils.encode(['address'], [compound.COMPTROLLER_ADDRESS]),
              utils.encode(['address'], [RANDOM_ETH_ADDRESS])
            ],
            data: utils.encode(['uint256'], [amount])
          }
        ]
      });

      const findings = await handleTransaction(txEvent);

      const finding = Finding.fromObject({
        alertId: EVENT_ALERT_ID,
        name: `Compound Comptroller Unusual Transfer`,
        description: `Too large transfer: ${formatEtherAmount(amount.toString())} COMP.`,
        metadata: {
          amount: amount.toString(),
          from: compound.COMPTROLLER_ADDRESS,
          to: RANDOM_ETH_ADDRESS
        },
        protocol: 'Compound',
        severity: FindingSeverity.Critical,
        type: FindingType.Suspicious
      });

      expect(findings).toStrictEqual([finding]);
    });

    it('returns empty findings if transfer less than max threshold amount', async () => {
      const txEvent = utils.createTxEvent({
        logs: [
          {
            address: compound.COMPOUND_TOKEN_ADDRESS,
            topics: [
              utils.generateHash(ERC20_TRANSFER_SIGNATURE),
              utils.encode(['address'], [compound.COMPTROLLER_ADDRESS]),
              utils.encode(['address'], [RANDOM_ETH_ADDRESS])
            ],
            data: utils.encode(['uint256'], [MAX_AMOUNT_THRESHOLD.sub(parseEther('0.6'))])
          }
        ]
      });

      const findings = await handleTransaction(txEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if no transfer signature found', async () => {
      const amount = parseEther('1.5');

      // Emulate organic transactions

      for (let i = 0; i < MIN_ORGANIC_TRANSACTIONS; i++) {
        const txEvent = utils.createTxEvent({
          logs: [
            {
              address: compound.COMPOUND_TOKEN_ADDRESS,
              topics: [
                utils.generateHash(ERC20_TRANSFER_SIGNATURE),
                utils.encode(['address'], [compound.COMPTROLLER_ADDRESS]),
                utils.encode(['address'], [RANDOM_ETH_ADDRESS])
              ],
              data: utils.encode(['uint256'], [amount])
            }
          ]
        });

        const findings = await handleTransaction(txEvent);

        expect(findings).toStrictEqual([]);
      }

      // Now, we enabled 'organic' mode.
      // Let's try to pass a transaction with a big increase rate

      const inorganicIncreaseRate = 2;
      const organicAmount = new BigNumber(amount.toString()).multipliedBy(ORGANIC_INCREASE_RATE);
      const inorganicAmount = new BigNumber(amount.toString()).multipliedBy(inorganicIncreaseRate);

      const txEvent = utils.createTxEvent({
        logs: [
          {
            address: compound.COMPOUND_TOKEN_ADDRESS,
            topics: [
              utils.generateHash(ERC20_TRANSFER_SIGNATURE),
              utils.encode(['address'], [compound.COMPTROLLER_ADDRESS]),
              utils.encode(['address'], [RANDOM_ETH_ADDRESS])
            ],
            data: utils.encode(['uint256'], [inorganicAmount.toString()])
          }
        ]
      });

      const findings = await handleTransaction(txEvent);

      const finding = Finding.fromObject({
        alertId: EVENT_ALERT_ID,
        name: `Compound Comptroller Unusual Transfer`,
        description:
          `Inorganic amount increase: ${inorganicIncreaseRate} (${formatEtherAmount(
            inorganicAmount.toString()
          )} COMP). ` +
          `Max organic increase: ${ORGANIC_INCREASE_RATE} (${formatEtherAmount(
            organicAmount.toString()
          )} COMP).`,
        metadata: {
          amount: inorganicAmount.toString(),
          from: compound.COMPTROLLER_ADDRESS,
          to: RANDOM_ETH_ADDRESS
        },
        protocol: 'Compound',
        severity: FindingSeverity.High,
        type: FindingType.Suspicious
      });

      expect(findings).toStrictEqual([finding]);
    });
  });
});
