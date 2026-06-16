// @ts-check
/**
 * dicebeacon — public API.
 *
 * A standalone, verifiable dice seeder. Derive dice from publicly-published,
 * independently-verifiable randomness the operator cannot control, blended with
 * optional "narrative" sources for flavor. Knows nothing about any game.
 */

export { combine } from './combiner.mjs';
export { ByteReader } from './expander.mjs';
export { rollDice } from './mapper.mjs';
export {
  buildCommitment,
  reveal,
  verifyReveal,
  COMBINER_VERSION,
  MAPPER_VERSION,
} from './envelope.mjs';

export { SOURCES, register, anchorScore } from './sources/types.mjs';

// Registering a source module is a side effect of importing it.
export { mock } from './sources/mock.mjs';
export { drand } from './sources/drand.mjs';
export { starlink } from './sources/starlink.mjs';
export { bitcoin } from './sources/bitcoin.mjs';

export * as bytes from './bytes.mjs';
