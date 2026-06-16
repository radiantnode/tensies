// @ts-check
/**
 * The EntropySource plugin contract + a tiny registry.
 *
 * Every source declares an honest `grade` on four axes (0 = none .. 3 = strong).
 * The grade ships inside the commitment and the verifier output, so the
 * framework never lets a pretty-but-predictable source (Starlink) masquerade as
 * a security anchor (drand). Flavor is labelled as flavor.
 */

/**
 * @typedef {Object} Grade
 * @property {number} unpredictable    is the value unknown to everyone at commit time?
 * @property {number} uninfluenceable  can the operator nudge/grind/withhold it?
 * @property {number} verifiable       can a third party independently re-derive it?
 * @property {number} live             is it reliably available on demand?
 */

/**
 * @typedef {Object} Observation
 * @property {Uint8Array} bytes                     contribution mixed into the seed
 * @property {Record<string, unknown>} provenance   human-facing "what was seen"
 * @property {Record<string, unknown>} [proof]      data a verifier needs to re-check
 */

/**
 * @typedef {Object} EntropySource
 * @property {string} id
 * @property {string} description
 * @property {Grade} grade
 * @property {(ref: any) => Promise<Observation>} fetch   resolve a pinned ref into an observation
 * @property {(ref: any, obs: Observation) => Promise<boolean>} verify  independent re-check
 */

/** @type {Record<string, EntropySource>} */
export const SOURCES = {};

/**
 * @template {EntropySource} T
 * @param {T} source
 * @returns {T}
 */
export function register(source) {
  SOURCES[source.id] = source;
  return source;
}

/** Weighted-ish single-number "anchor strength" — the security-bearing axes. */
export function anchorScore(grade) {
  return grade.unpredictable + grade.uninfluenceable;
}
