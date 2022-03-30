import { isBrowser } from '../common';
import util from 'util';

export function decode(array: Uint8Array): string {
  const decoder = isBrowser
    ? new TextDecoder('utf-8') // Browser https://caniuse.com/textencoder.
    : new util.TextDecoder('utf-8'); // Node.

  return decoder.decode(array);
}

export function encode(input: string): Uint8Array {
  const encoder = isBrowser
    ? new TextEncoder() // Browser.
    : new util.TextEncoder(); // Node.
  return encoder.encode(input);
}
