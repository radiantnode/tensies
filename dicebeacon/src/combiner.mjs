// @ts-check
/**
 * Combiner — folds N source observations into a single 32-byte seed.
 *
 * Two properties matter: (1) the encoding is canonical (length-prefixed, tagged
 * by source id, domain-separated) so a verifier reconstructs the exact same
 * pre-image; (2) one source's bytes can never be slid into another's field, so
 * no source can cancel or impersonate another. Order is significant and is fixed
 * by the commitment.
 */

import { utf8, concatBytes, u32be } from './bytes.mjs';
import { sha256 } from './hash.mjs';

const PREFIX = utf8('DICEBEACON/combine/v1');

/** length-prefixed `label || bytes` frame */
function frame(label, bytes) {
  const l = utf8(label);
  return concatBytes(u32be(l.length), l, u32be(bytes.length), bytes);
}

/**
 * @param {string} domain  caller-chosen domain separator (e.g. "tensies-dice/v1")
 * @param {{ id: string, bytes: Uint8Array }[]} parts  in committed order
 * @returns {Promise<Uint8Array>} 32-byte seed
 */
export async function combine(domain, parts) {
  const chunks = [PREFIX, u32be(parts.length), frame('domain', utf8(domain))];
  for (const p of parts) chunks.push(frame(p.id, p.bytes));
  return sha256(concatBytes(...chunks));
}
