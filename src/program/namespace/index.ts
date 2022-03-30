import { PublicKey } from '@solana/web3.js';
import Coder from '../../coder/index.js';
import Provider from '../../provider.js';
import { Idl } from '../../idl.js';
import AccountFactory, { AccountNamespace } from './account.js';

export { AccountNamespace, AccountClient, ProgramAccount } from './account.js';
export { IdlAccounts, IdlTypes } from './types.js';

export default class NamespaceFactory {
  /**
   * Generates all namespaces for a given program.
   */
  public static build<IDL extends Idl>(
    idl: IDL,
    coder: Coder,
    programId: PublicKey,
    provider: Provider
  ): [AccountNamespace<IDL>] {
    const account: AccountNamespace<IDL> = idl.accounts
      ? AccountFactory.build(idl, coder, programId, provider)
      : ({} as AccountNamespace<IDL>);

    return [account];
  }
}
