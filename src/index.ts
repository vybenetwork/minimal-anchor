import { Address, BorshCoder, Coder, Idl, translateAddress } from '@project-serum/anchor';
import { decodeIdlAccount, idlAddress } from '@project-serum/anchor/dist/cjs/idl';
import { utf8 } from '@project-serum/anchor/dist/cjs/utils/bytes';
import { Connection, PublicKey } from '@solana/web3.js';
import { inflate } from 'pako';
import AccountFactory, { AccountNamespace } from './account';

/**
 * Fetches an idl from the blockchain.
 * @param address The on-chain address of the program.
 * @static
 */
export async function fetchIdl<IDL extends Idl = Idl>(address: Address, rpcURL: string): Promise<IDL | null> {
  const programId = translateAddress(address);
  const idlAddr = await idlAddress(programId);
  const connection = new Connection(rpcURL, 'processed');
  const accountInfo = await connection.getAccountInfo(idlAddr);
  if (!accountInfo) {
    return null;
  }
  // Chop off account discriminator.
  const idlAccount = decodeIdlAccount(accountInfo.data.slice(8));
  const inflatedIdl = inflate(idlAccount.data);
  return JSON.parse(utf8.decode(inflatedIdl));
}

/**
 * The method is a replacement for getting accounts from the Program class of Anchor.
 * This method returns the accounts directly without requiring an id.json file
 * @param idl The IDL of the program. You can use {@link fetchIdl} to get an IDL for a program
 * @param coder The coder for the program. You can use {@link getCoder} to create a coder for an IDL
 * @param programId The programID for the program
 * @param connection A web3.js connection object
 * @returns All program accounts with data
 */
export function getProgramAccounts<IDL extends Idl>(
  idl: IDL,
  coder: Coder,
  programId: PublicKey,
  connection: Connection
): AccountNamespace<IDL> {
  const accountsNS = AccountFactory.build(idl, coder, programId, connection);
  return accountsNS;
}

/**
 * Get a coder which can be used to parse accounts, instructions or events
 * @param idl The IDL to use in the coder
 * @returns A coder
 */
export function getCoder(idl: Idl): Coder {
  const coder: Coder = new BorshCoder(idl);
  return coder;
}

async function test() {
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'processed');
  const programID = new PublicKey('SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f');
  const idl = await fetchIdl(programID, 'https://api.mainnet-beta.solana.com');
  if (idl) {
    const coder = getCoder(idl);
    const pAccounts = getProgramAccounts(idl, coder, programID, connection);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const sbStateAccount = await pAccounts['sbState'].all();
  }
}

test();
