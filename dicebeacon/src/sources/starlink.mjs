// @ts-check
/**
 * Starlink constellation geometry — the FLAGSHIP GARNISH, and a deliberate
 * lesson in honest grading.
 *
 * We hash a snapshot of the public TLE/ephemeris set for the whole Starlink
 * fleet (thousands of satellites, their orbital elements at a given epoch). It
 * makes a gorgeous, cosmic story — "your dice were seeded by the positions of
 * 4,000+ satellites" — and it's verifiable from the archived snapshot.
 *
 * BUT: orbits are deterministic and TLEs are published days in advance, so this
 * value is PREDICTABLE. unpredictable: 0. It must never be the anchor. It rides
 * alongside drand purely for narrative. The grade makes that impossible to
 * forget — the verifier prints it.
 *
 * ref = { snapshotUrl?: string }
 */

import { register } from './types.mjs';
import { utf8, bytesEqual } from '../bytes.mjs';
import { sha256 } from '../hash.mjs';

const CELESTRAK = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle';

/** Normalise line endings / trailing whitespace so the hash is stable. */
function normalizeTle(text) {
  return text
    .replace(/\r/g, '')
    .trim()
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n');
}

export const starlink = register({
  id: 'starlink',
  description:
    'Starlink fleet geometry (narrative garnish — TLEs are public & PREDICTABLE, never an anchor)',
  grade: { unpredictable: 0, uninfluenceable: 1, verifiable: 2, live: 2 },

  async fetch(ref) {
    const url = (ref && ref.snapshotUrl) || CELESTRAK;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`starlink: HTTP ${res.status}`);
    const snapshot = normalizeTle(await res.text());
    const satelliteCount = (snapshot.match(/\n1 /g) || []).length + (snapshot.startsWith('1 ') ? 1 : 0);
    return {
      bytes: await sha256(utf8(snapshot)),
      provenance: { satelliteCount, source: url },
      // The snapshot is stored so the reveal is reproducible from the archive.
      // (Independent verification is only as strong as trusting that archive —
      // graded verifiable: 2, not 3. A signed/timestamped TLE archive would lift it.)
      proof: { snapshot },
    };
  },

  async verify(ref, obs) {
    const snapshot = String(obs.proof && obs.proof.snapshot);
    return bytesEqual(await sha256(utf8(snapshot)), obs.bytes);
  },
});
