// @ts-check
/**
 * Mock source — deterministic, offline, NO security. Exists so the whole
 * pipeline (commit -> reveal -> verify) is testable and demoable without a
 * network. ref = { value: string }.
 */

import { register } from './types.mjs';
import { utf8, bytesEqual } from '../bytes.mjs';
import { sha256 } from '../hash.mjs';

function bytesFor(value) {
  return sha256(utf8('dicebeacon/mock/' + value));
}

export const mock = register({
  id: 'mock',
  description: 'Deterministic test source (no security — for demos and tests only)',
  grade: { unpredictable: 0, uninfluenceable: 0, verifiable: 3, live: 3 },
  async fetch(ref) {
    return { bytes: await bytesFor(ref.value), provenance: { value: ref.value } };
  },
  async verify(ref, obs) {
    return bytesEqual(await bytesFor(ref.value), obs.bytes);
  },
});
