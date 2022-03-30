import { Connection, ConfirmOptions } from '@solana/web3.js';
import { isBrowser } from './utils/common.js';

/**
 * The network and wallet context used to send transactions paid for and signed
 * by the provider.
 */
export default class Provider {
  /**
   * @param connection The cluster connection where the program is deployed.
   * @param opts       Transaction confirmation options to use by default.
   */
  constructor(readonly connection: Connection, readonly opts: ConfirmOptions) {}

  static defaultOptions(): ConfirmOptions {
    return {
      preflightCommitment: 'processed',
      commitment: 'processed'
    };
  }

  /**
   * Returns a `Provider` with a wallet read from the local filesystem.
   *
   * @param url  The network cluster url.
   * @param opts The default transaction confirmation options.
   *
   * (This api is for Node only.)
   */
  static local(url?: string, opts?: ConfirmOptions): Provider {
    if (isBrowser) {
      throw new Error(`Provider local is not available on browser.`);
    }
    opts = opts ?? Provider.defaultOptions();
    const connection = new Connection(url ?? 'http://localhost:8899', opts.preflightCommitment);
    return new Provider(connection, opts);
  }

  /**
   * Returns a `Provider` read from the `ANCHOR_PROVIDER_URL` environment
   * variable
   *
   * (This api is for Node only.)
   */
  static env(): Provider {
    if (isBrowser) {
      throw new Error(`Provider env is not available on browser.`);
    }

    //const process = require("process");
    const url = process.env.ANCHOR_PROVIDER_URL;
    if (url === undefined) {
      throw new Error('ANCHOR_PROVIDER_URL is not defined');
    }
    const options = Provider.defaultOptions();
    const connection = new Connection(url, options.commitment);

    return new Provider(connection, options);
  }
}

/**
 * Sets the default provider on the client.
 */
export function setProvider(provider: Provider) {
  _provider = provider;
}

/**
 * Returns the default provider being used by the client.
 */
export function getProvider(): Provider {
  if (_provider === null) {
    return Provider.local();
  }
  return _provider;
}

// Global provider used as the default when a provider is not given.
let _provider: Provider | null = null;
