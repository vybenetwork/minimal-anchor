import { Buffer } from 'buffer';
import camelCase from 'camelcase';
import EventEmitter from 'eventemitter3';
import bs58 from 'bs58';
import { PublicKey, Commitment, GetProgramAccountsFilter, AccountInfo, Connection } from '@solana/web3.js';
import {
  ACCOUNT_DISCRIMINATOR_SIZE,
  Address,
  Coder,
  Idl,
  Subscription,
  translateAddress,
  BorshAccountsCoder
} from '@project-serum/anchor';

import { IdlTypeDef } from '@project-serum/anchor/dist/cjs/idl';
import { AllAccountsMap, IdlTypes, TypeDef } from '@project-serum/anchor/dist/cjs/program/namespace/types';
import { accountSize } from '@project-serum/anchor/dist/cjs/coder/common';
import { getCoder } from '.';
import * as rpcUtil from '@project-serum/anchor/dist/cjs/utils/rpc';
import * as pubkeyUtil from '@project-serum/anchor/dist/cjs/utils/pubkey';

export default class AccountFactory {
  public static build<IDL extends Idl>(
    idl: IDL,
    coder: Coder,
    programId: PublicKey,
    connection: Connection
  ): AccountNamespace<IDL> {
    const accountFns: AccountNamespace = {};

    idl.accounts?.forEach((idlAccount) => {
      const name = camelCase(idlAccount.name);
      accountFns[name] = new AccountClient<IDL>(idl, idlAccount, programId, connection, coder);
    });

    return accountFns as AccountNamespace<IDL>;
  }
}

type NullableIdlAccount<IDL extends Idl> = IDL['accounts'] extends undefined
  ? IdlTypeDef
  : NonNullable<IDL['accounts']>[number];

export type AccountNamespace<IDL extends Idl = Idl> = {
  [M in keyof AllAccountsMap<IDL>]: AccountClient<IDL>;
};

export class AccountClient<
  IDL extends Idl = Idl,
  A extends NullableIdlAccount<IDL> = IDL['accounts'] extends undefined
    ? IdlTypeDef
    : NonNullable<IDL['accounts']>[number],
  T = TypeDef<A, IdlTypes<IDL>>
> {
  /**
   * Returns the number of bytes in this account.
   */
  get size(): number {
    return this._size;
  }
  private _size: number;

  /**
   * Returns the program ID owning all accounts.
   */
  get programId(): PublicKey {
    return this._programId;
  }
  private _programId: PublicKey;

  /**
   * Returns the coder.
   */
  get coder(): Coder {
    return this._coder;
  }
  private _coder: Coder;

  private _connection: Connection;

  private _idlAccount: A;

  constructor(idl: IDL, idlAccount: A, programId: PublicKey, connection: Connection, coder?: Coder) {
    this._idlAccount = idlAccount;
    this._programId = programId;
    this._coder = coder ?? getCoder(idl);
    this._connection = connection;
    this._size = ACCOUNT_DISCRIMINATOR_SIZE + (accountSize(idl, idlAccount) ?? 0);
  }

  /**
   * Returns a deserialized account, returning null if it doesn't exist.
   *
   * @param address The address of the account to fetch.
   */
  async fetchNullable(address: Address, commitment?: Commitment): Promise<T | null> {
    const accountInfo = await this.getAccountInfo(address, commitment);
    if (accountInfo === null) {
      return null;
    }

    // Assert the account discriminator is correct.
    const discriminator = BorshAccountsCoder.accountDiscriminator(this._idlAccount.name);
    if (discriminator.compare(accountInfo.data.slice(0, 8))) {
      throw new Error('Invalid account discriminator');
    }

    return this._coder.accounts.decode<T>(this._idlAccount.name, accountInfo.data);
  }

  /**
   * Returns a deserialized account.
   *
   * @param address The address of the account to fetch.
   */
  async fetch(address: Address, commitment?: Commitment): Promise<T> {
    const data = await this.fetchNullable(address, commitment);
    if (data === null) {
      throw new Error(`Account does not exist ${address.toString()}`);
    }
    return data;
  }

  /**
   * Returns multiple deserialized accounts.
   * Accounts not found or with wrong discriminator are returned as null.
   *
   * @param addresses The addresses of the accounts to fetch.
   */
  // eslint-disable-next-line @typescript-eslint/ban-types
  async fetchMultiple(addresses: Address[], commitment?: Commitment): Promise<(Object | null)[]> {
    const accounts = await rpcUtil.getMultipleAccounts(
      this._connection,
      addresses.map((address) => translateAddress(address)),
      commitment
    );

    const discriminator = BorshAccountsCoder.accountDiscriminator(this._idlAccount.name);
    // Decode accounts where discriminator is correct, null otherwise
    return accounts.map((account) => {
      if (account == null) {
        return null;
      }
      if (discriminator.compare(account?.account.data.slice(0, 8))) {
        return null;
      }
      return this._coder.accounts.decode(this._idlAccount.name, account?.account.data);
    });
  }

  /**
   * Returns all instances of this account type for the program.
   *
   * @param filters User-provided filters to narrow the results from `connection.getProgramAccounts`.
   *
   *                When filters are not defined this method returns all
   *                the account instances.
   *
   *                When filters are of type `Buffer`, the filters are appended
   *                after the discriminator.
   *
   *                When filters are of type `GetProgramAccountsFilter[]`,
   *                filters are appended after the discriminator filter.
   */
  async all(
    filters?: Buffer | GetProgramAccountsFilter[],
    applyDataSliceForPrefetching?: boolean
  ): Promise<ProgramAccount<T>[]> {
    const discriminator = BorshAccountsCoder.accountDiscriminator(this._idlAccount.name);

    const resp = await this._connection.getProgramAccounts(this._programId, {
      commitment: this._connection.commitment,
      dataSlice: applyDataSliceForPrefetching
        ? {
            offset: 0,
            length: 0
          }
        : undefined,
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(filters instanceof Buffer ? Buffer.concat([discriminator, filters]) : discriminator)
          }
        },
        ...(Array.isArray(filters) ? filters : [])
      ]
    });
    return resp.map(({ pubkey, account }) => {
      return {
        publicKey: pubkey,
        account: this._coder.accounts.decode(this._idlAccount.name, account.data)
      };
    });
  }

  /**
   * Returns an `EventEmitter` emitting a "change" event whenever the account
   * changes.
   */
  subscribe(address: Address, commitment?: Commitment): EventEmitter {
    const sub = subscriptions.get(address.toString());
    if (sub) {
      return sub.ee;
    }

    const ee = new EventEmitter();
    address = translateAddress(address);
    const listener = this._connection.onAccountChange(
      address,
      (acc) => {
        const account = this._coder.accounts.decode(this._idlAccount.name, acc.data);
        ee.emit('change', account);
      },
      commitment
    );

    subscriptions.set(address.toString(), {
      ee,
      listener
    });

    return ee;
  }

  /**
   * Unsubscribes from the account at the given address.
   */
  async unsubscribe(address: Address) {
    const sub = subscriptions.get(address.toString());
    if (!sub) {
      console.warn('Address is not subscribed');
      return;
    }
    if (subscriptions) {
      await this._connection
        .removeAccountChangeListener(sub.listener)
        .then(() => {
          subscriptions.delete(address.toString());
        })
        .catch(console.error);
    }
  }

  /**
   * @deprecated since version 14.0.
   *
   * Function returning the associated account. Args are keys to associate.
   * Order matters.
   */
  async associated(...args: Array<PublicKey | Buffer>): Promise<T> {
    const addr = await this.associatedAddress(...args);
    return await this.fetch(addr);
  }

  /**
   * @deprecated since version 14.0.
   *
   * Function returning the associated address. Args are keys to associate.
   * Order matters.
   */
  async associatedAddress(...args: Array<PublicKey | Buffer>): Promise<PublicKey> {
    return await pubkeyUtil.associated(this._programId, ...args);
  }

  async getAccountInfo(address: Address, commitment?: Commitment): Promise<AccountInfo<Buffer> | null> {
    return await this._connection.getAccountInfo(translateAddress(address), commitment);
  }
}

/**
 * @hidden
 *
 * Deserialized account owned by a program.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProgramAccount<T = any> = {
  publicKey: PublicKey;
  account: T;
};

// Tracks all subscriptions.
const subscriptions: Map<string, Subscription> = new Map();
