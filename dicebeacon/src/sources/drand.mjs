// @ts-check
/**
 * drand / League of Entropy — THE anchor. A federation of independent orgs runs
 * a threshold-BLS beacon that publishes a fresh, signed random value every few
 * seconds. No single member (and certainly no game operator) can predict or
 * bias a future round. This is the source that earns the "the house literally
 * cannot rig it" claim; everything else in the catalog is garnish.
 *
 * ref = { round: number, api?: string, chainHash?: string }
 *
 * The unriggability comes from PINNING a FUTURE round in the commitment: at
 * commit time round R does not yet exist, so no one knows its value.
 */

import { register } from './types.mjs';
import { fromHex, bytesEqual } from '../bytes.mjs';
import { sha256 } from '../hash.mjs';

const DEFAULT_API = 'https://api.drand.sh';
// "quicknet" — 3s rounds, unchained, fast to verify. Public, well-known chain hash.
const DEFAULT_CHAIN = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';

export const drand = register({
  id: 'drand',
  description: 'League of Entropy drand beacon (threshold BLS) — the unriggable anchor',
  grade: { unpredictable: 3, uninfluenceable: 3, verifiable: 3, live: 3 },

  async fetch(ref) {
    const api = ref.api || DEFAULT_API;
    const chain = ref.chainHash || DEFAULT_CHAIN;
    const res = await fetch(`${api}/${chain}/public/${ref.round}`);
    if (!res.ok) throw new Error(`drand round ${ref.round}: HTTP ${res.status}`);
    const j = await res.json(); // { round, randomness, signature }
    return {
      bytes: fromHex(j.randomness),
      provenance: { round: j.round, chainHash: chain },
      proof: { signature: j.signature, randomness: j.randomness },
    };
  },

  /**
   * Chain check: randomness == SHA-256(signature). This is offline-verifiable
   * from the reveal alone (no network), which is what lets the browser widget
   * confirm dice with zero server trust.
   *
   * Hardening (see README "Hardening drand verify"): the STRONGEST check is full
   * BLS signature verification of `signature` against the chain's group public
   * key — that proves the League actually produced this value, not just that the
   * randomness field is a hash of *some* signature. That needs a BLS library and
   * is wired as an optional enhancement, not a runtime dependency.
   */
  async verify(ref, obs) {
    const sig = fromHex(String(obs.proof && obs.proof.signature));
    const derived = await sha256(sig);
    const claimed = fromHex(String(obs.proof && obs.proof.randomness));
    return bytesEqual(derived, obs.bytes) && bytesEqual(claimed, obs.bytes);
  },
});
