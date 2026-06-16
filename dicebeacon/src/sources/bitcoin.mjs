// @ts-check
/**
 * Bitcoin future block hash — a strong, independent SECOND anchor that
 * diversifies away from trusting the drand federation. The hash of a block that
 * hasn't been mined yet is unpredictable and globally public.
 *
 * The one caveat (hence uninfluenceable: 2, not 3): a miner who finds a block
 * *could* withhold it and grind an alternative to nudge the hash — costing them
 * a block reward per attempt. Real but expensive; fine as a co-anchor, and the
 * grade says so.
 *
 * ref = { height: number, api?: string }
 */

import { register } from './types.mjs';
import { fromHex, bytesEqual } from '../bytes.mjs';

const DEFAULT_API = 'https://mempool.space/api';

export const bitcoin = register({
  id: 'bitcoin',
  description: 'Bitcoin block hash at a future height (independent co-anchor; miner-grind caveat)',
  grade: { unpredictable: 3, uninfluenceable: 2, verifiable: 3, live: 3 },

  async fetch(ref) {
    const api = ref.api || DEFAULT_API;
    const res = await fetch(`${api}/block-height/${ref.height}`);
    if (!res.ok) throw new Error(`bitcoin height ${ref.height}: HTTP ${res.status}`);
    const hash = (await res.text()).trim();
    return {
      bytes: fromHex(hash),
      provenance: { height: ref.height, hash, api },
      proof: { hash },
    };
  },

  /**
   * Offline check: the mixed-in bytes match the claimed hash. The genuinely
   * INDEPENDENT confirmation for Bitcoin is external — look up `provenance.height`
   * in any block explorer and confirm `provenance.hash`. We keep verify()
   * network-free so the browser widget stays zero-trust/offline; the explorer
   * cross-check is the human step the UI links out to.
   */
  async verify(ref, obs) {
    const hash = String(obs.proof && obs.proof.hash);
    return bytesEqual(fromHex(hash), obs.bytes);
  },
});
