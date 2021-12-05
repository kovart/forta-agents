import { providers } from 'ethers';
import {
  Finding,
  FindingType,
  FindingSeverity,
  TransactionEvent,
  getEthersProvider
} from 'forta-agent';
import { PROTOCOL, ALERT_ID, ERC1967_UPGRADED_EVENT_ABI } from './constants';

const provider = getEthersProvider();

function provideHandleTransaction(provider: providers.JsonRpcProvider) {
  return async function handleTransaction(txEvent: TransactionEvent) {
    const findings: Finding[] = [];

    const upgradedLogs = txEvent.filterLog(ERC1967_UPGRADED_EVENT_ABI);

    for (const upgradedLog of upgradedLogs) {
      const oldImplementationAddress = upgradedLog.address;
      const newImplementationAddress = upgradedLog.args['implementation'];

      // it is important to get the contract code in the block of 'Upgraded' event,
      // since the contact may be destructed later for other reasons
      const contractCode = await provider.getCode(oldImplementationAddress, txEvent.blockNumber);

      // check if the code is empty
      if (contractCode === '0x') {
        findings.push(
          createSelfDestructFinding(oldImplementationAddress, newImplementationAddress)
        );
      }
    }

    return findings;
  };
}

function createSelfDestructFinding(oldImplementation: string, newImplementation: string) {
  return Finding.fromObject({
    name: 'UUPSUpgradeable Self-Destruct Exploit',
    description:
      `Contract implementation ${oldImplementation} was permanently broken. ` +
      `Assets are locked without the possibility of recovery.\n` +
      `Read more: https://forum.openzeppelin.com/t/uupsupgradeable-vulnerability-post-mortem/15680`,
    alertId: ALERT_ID,
    protocol: PROTOCOL,
    severity: FindingSeverity.Critical,
    type: FindingType.Exploit,
    metadata: {
      oldImplementation: oldImplementation,
      newImplementation: newImplementation
    }
  });
}

export default {
  createSelfDestructFinding,
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(provider)
};
