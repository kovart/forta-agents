import { ethers, utils } from 'ethers';
import { LogDescription } from 'ethers/lib/utils';
import { Log } from 'forta-agent';
import { createAddress } from 'forta-agent-tools';
import {
  TimelockControllerAbi,
  TimelockControllerRoles,
  TimelockControllerEvents
} from './constants';

const { MinDelayChange, CallScheduled, CallExecuted, RoleGranted, RoleRevoked } =
  TimelockControllerEvents;

export type ParsedLog = LogDescription & {
  logIndex: number;
  address: string;
};

export class LogUtils {
  public parse(logs: Log[], abi: any[]) {
    const parsedLogs: ParsedLog[] = [];
    const timelockController = new utils.Interface(abi);

    for (const log of logs) {
      try {
        const description = timelockController.parseLog(log);
        parsedLogs.push({
          ...description,
          logIndex: log.logIndex,
          address: log.address
        });
      } catch {
        /* ignore parse issues */
      }
    }

    return parsedLogs;
  }
}

export class TimelockUtils {
  static RolesHashMap = {
    '0x0000000000000000000000000000000000000000000000000000000000000000':
      TimelockControllerRoles.DEFAULT_ADMIN,
    [utils.id('TIMELOCK_ADMIN_ROLE')]: TimelockControllerRoles.TIMELOCK_ADMIN,
    [utils.id('PROPOSER_ROLE')]: TimelockControllerRoles.PROPOSER,
    [utils.id('EXECUTOR_ROLE')]: TimelockControllerRoles.EXECUTOR,
    [utils.id('MINTER_ROLE')]: TimelockControllerRoles.MINTER,
    [utils.id('BURNER_ROLE')]: TimelockControllerRoles.BURNER,
    [utils.id('SWAPPER_ROLE')]: TimelockControllerRoles.SWAPPER,
    [utils.id('SETTER_ROLE')]: TimelockControllerRoles.SETTER,
    [utils.id('ADMIN_ROLE')]: TimelockControllerRoles.ADMIN,
    [utils.id('PAUSER_ROLE')]: TimelockControllerRoles.PAUSER,
    [utils.id('UNPAUSER_ROLE')]: TimelockControllerRoles.UNPAUSER,
    [utils.id('RELAY_ROLE')]: TimelockControllerRoles.RELAY,
    [utils.id('ACTION_ROLE')]: TimelockControllerRoles.ACTION,
    [utils.id('SNAPSHOT_ROLE')]: TimelockControllerRoles.SNAPSHOT
  };

  constructor(
    private provider: ethers.providers.JsonRpcProvider,
    private archiveDataMode: boolean = false // should be enabled if provider supports this
  ) {}

  public getRoleNameByHash(roleHash: string): string | undefined {
    return TimelockUtils.RolesHashMap[roleHash];
  }

  public async getRoleNames(
    contractAddress: string,
    account: string,
    blockTag?: number
  ): Promise<string[]> {
    const contract = new ethers.Contract(contractAddress, TimelockControllerAbi, this.provider);

    const roles: string[] = [];

    const options = this.archiveDataMode ? { blockTag } : {};

    await Promise.all(
      Object.entries(TimelockUtils.RolesHashMap).map(async ([roleHash, roleName]) => {
        if (await contract.hasRole(roleHash, account, options)) {
          roles.push(roleName);
        }
      })
    );

    return roles;
  }
}

export class TestUtils {
  private createLog(abi: any, logIndex?: number, address?: string, ...params: any[]) {
    const iface = new utils.Interface([abi]);
    const fragment = Object.values(iface.events)[0];

    const log = {
      ...iface.encodeEventLog(fragment, params),
      address: address || createAddress('0x0'),
      logIndex: logIndex || 0
    } as Log;

    return {
      rawLog: log,
      parsedLog: { ...iface.parseLog(log), logIndex: log.logIndex, address: log.address }
    };
  }

  public createMinDelayChangeLog(logIndex?: number, address?: string) {
    return (oldDelay: number, newDelay: number) =>
      this.createLog(MinDelayChange.abi, logIndex, address, oldDelay, newDelay);
  }

  public createCallExecutedLog(logIndex?: number, address?: string) {
    return (id: string, index: number, target: string, value: number, data: ReadonlyArray<any>) => {
      return this.createLog(CallExecuted.abi, logIndex, address, id, index, target, value, data);
    };
  }

  public createCallScheduledLog(logIndex?: number, address?: string) {
    return (
      id: string,
      index: number,
      target: string,
      value: number,
      data: ReadonlyArray<any>,
      predecessor: number | string,
      delay: number
    ) => {
      predecessor = utils.formatBytes32String(predecessor.toString());
      const params = [id, index, target, value, data, predecessor, delay]; // for formatting purposes
      return this.createLog(CallScheduled.abi, logIndex, address, ...params);
    };
  }

  private createRoleChangeLog(
    abi: any,
    address: string | undefined,
    roleName: string,
    account: string,
    sender: string
  ) {
    const existingRole = Object.entries(TimelockUtils.RolesHashMap).find(
      (entry) => roleName === entry[1]
    );
    const roleHash = existingRole ? existingRole[0] : utils.id(roleName);

    return this.createLog(abi, 0, address, roleHash, account, sender);
  }

  public createRoleGrantedLog(address?: string) {
    return (roleName: string, account: string, sender: string) => {
      return this.createRoleChangeLog(RoleGranted.abi, address, roleName, account, sender);
    };
  }

  public createRoleRevokedLog(address?: string) {
    return (roleName: string, account: string, sender: string) => {
      return this.createRoleChangeLog(RoleRevoked.abi, address, roleName, account, sender);
    };
  }
}
