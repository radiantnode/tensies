// @ts-check
/**
 * Commit -> Reveal -> Verify. This is the protocol that turns "we hashed some
 * random stuff" into "the operator demonstrably had no free parameter".
 *
 *  1. buildCommitment(): publish the recipe — which sources, which *future*
 *     refs (drand round R, Bitcoin height H), dice shape — and its hash, BEFORE
 *     the anchor values exist. Timestamp/sign it out of band.
 *  2. reveal(): once the anchor has published, fetch every source, combine into
 *     a seed, expand into dice. The seed is now forced; the operator never chose
 *     anything.
 *  3. verifyReveal(): anyone re-runs the whole thing from the reveal alone and
 *     confirms the commitment hash, every source, the seed, and the dice.
 */

import { canonicalJson, utf8, toHex, fromHex } from './bytes.mjs';
import { sha256 } from './hash.mjs';
import { combine } from './combiner.mjs';
import { rollDice } from './mapper.mjs';
import { SOURCES } from './sources/types.mjs';

export const COMBINER_VERSION = '1';
export const MAPPER_VERSION = '1';

/**
 * @typedef {Object} SourcePin
 * @property {string} id
 * @property {any} ref
 */

/**
 * @typedef {Object} Commitment
 * @property {string} gameId
 * @property {string} domain
 * @property {string} combinerVersion
 * @property {string} mapperVersion
 * @property {number} diceCount
 * @property {number} diceSides
 * @property {{ id: string, ref: any, grade: any }[]} sources
 * @property {string} createdAt
 */

/**
 * Build a commitment + its hash. Publish/timestamp the hash before the anchor
 * round exists — that's what makes the outcome unforgeable.
 * @param {{ gameId: string, sources: SourcePin[], domain?: string, diceCount?: number, diceSides?: number, createdAt?: string }} spec
 * @returns {Promise<{ commitment: Commitment, commitmentHash: string }>}
 */
export async function buildCommitment(spec) {
  /** @type {Commitment} */
  const commitment = {
    gameId: spec.gameId,
    domain: spec.domain ?? 'tensies-dice/v1',
    combinerVersion: COMBINER_VERSION,
    mapperVersion: MAPPER_VERSION,
    diceCount: spec.diceCount ?? 10,
    diceSides: spec.diceSides ?? 6,
    sources: spec.sources.map((s) => ({
      id: s.id,
      ref: s.ref,
      grade: SOURCES[s.id] ? SOURCES[s.id].grade : null,
    })),
    createdAt: spec.createdAt ?? new Date().toISOString(),
  };
  const commitmentHash = toHex(await sha256(utf8(canonicalJson(commitment))));
  return { commitment, commitmentHash };
}

/**
 * @typedef {Object} RevealObservation
 * @property {string} id
 * @property {string} bytesHex
 * @property {Record<string, unknown>} provenance
 * @property {Record<string, unknown>} [proof]
 */

/**
 * @typedef {Object} Reveal
 * @property {Commitment} commitment
 * @property {RevealObservation[]} observations
 * @property {string} seedHex
 * @property {number[]} dice
 */

/**
 * Fetch every pinned source, combine -> seed -> dice. Run this AFTER the anchor
 * value has been published by its beacon.
 * @param {Commitment} commitment
 * @returns {Promise<Reveal>}
 */
export async function reveal(commitment) {
  /** @type {RevealObservation[]} */
  const observations = [];
  /** @type {{ id: string, bytes: Uint8Array }[]} */
  const parts = [];
  for (const s of commitment.sources) {
    const src = SOURCES[s.id];
    if (!src) throw new Error(`reveal: unknown source "${s.id}"`);
    const obs = await src.fetch(s.ref);
    observations.push({
      id: s.id,
      bytesHex: toHex(obs.bytes),
      provenance: obs.provenance,
      proof: obs.proof,
    });
    parts.push({ id: s.id, bytes: obs.bytes });
  }
  const seed = await combine(commitment.domain, parts);
  const dice = await rollDice(seed, commitment.diceCount, commitment.diceSides);
  return { commitment, observations, seedHex: toHex(seed), dice };
}

/**
 * @typedef {Object} Check
 * @property {string} name
 * @property {boolean} ok
 * @property {unknown} detail
 */

/**
 * Independently verify a reveal end-to-end. Pass the originally-published
 * commitment hash to also prove the recipe wasn't swapped after the fact.
 * @param {Reveal} rev
 * @param {string} [expectedCommitmentHash]
 * @returns {Promise<{ ok: boolean, checks: Check[] }>}
 */
export async function verifyReveal(rev, expectedCommitmentHash) {
  /** @type {Check[]} */
  const checks = [];
  const c = rev.commitment;

  // 1. The recipe is the one that was committed to.
  const recomputedHash = toHex(await sha256(utf8(canonicalJson(c))));
  checks.push({
    name: 'commitment-hash',
    ok: expectedCommitmentHash ? recomputedHash === expectedCommitmentHash : true,
    detail: recomputedHash,
  });

  // 2. Every source independently verifies; rebuild parts in committed order.
  //    Observations are POSITIONAL (parallel to commitment.sources), so pair by
  //    index — ids aren't unique (a recipe may list the same source twice).
  /** @type {{ id: string, bytes: Uint8Array }[]} */
  const parts = [];
  for (let i = 0; i < c.sources.length; i++) {
    const s = c.sources[i];
    const src = SOURCES[s.id];
    const obs = rev.observations[i];
    if (!src || !obs || obs.id !== s.id) {
      checks.push({ name: `source:${s.id}`, ok: false, detail: 'missing/mismatched observation' });
      continue;
    }
    const bytes = fromHex(obs.bytesHex);
    const ok = await src.verify(s.ref, { bytes, provenance: obs.provenance, proof: obs.proof });
    checks.push({ name: `source:${s.id}`, ok, detail: obs.provenance });
    parts.push({ id: s.id, bytes });
  }

  // 3. Recombine + remap; the seed and dice must reproduce exactly.
  const seed = await combine(c.domain, parts);
  checks.push({ name: 'seed', ok: toHex(seed) === rev.seedHex, detail: rev.seedHex });
  const dice = await rollDice(seed, c.diceCount, c.diceSides);
  checks.push({
    name: 'dice',
    ok: JSON.stringify(dice) === JSON.stringify(rev.dice),
    detail: dice,
  });

  return { ok: checks.every((ck) => ck.ok), checks };
}
