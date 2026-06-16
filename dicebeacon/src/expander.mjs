// @ts-check
/**
 * Expander — turns the 32-byte seed into an unbounded deterministic byte stream
 * using SHA-256 in counter mode:  block_i = SHA-256(seed || u32be(i)).
 *
 * Deterministic and identical in Node + browser, so the verifier produces the
 * same stream the producer did. Pulled lazily because the dice mapper consumes a
 * variable number of bytes (rejection sampling).
 */

import { concatBytes, u32be } from './bytes.mjs';
import { sha256 } from './hash.mjs';

export class ByteReader {
  /** @param {Uint8Array} seed */
  constructor(seed) {
    this.seed = seed;
    this.counter = 0;
    this.buf = new Uint8Array(0);
    this.pos = 0;
  }

  /** @returns {Promise<number>} next byte, 0..255 */
  async next() {
    if (this.pos >= this.buf.length) {
      this.buf = await sha256(concatBytes(this.seed, u32be(this.counter++)));
      this.pos = 0;
    }
    return this.buf[this.pos++];
  }
}
