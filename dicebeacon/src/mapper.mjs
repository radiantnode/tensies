// @ts-check
/**
 * Mapper — seed stream -> fair dice.
 *
 * The subtle part everyone gets wrong: `byte % 6` is biased (256 isn't a
 * multiple of 6, so faces 1-4 are very slightly likelier). We reject the top
 * few values so every face is exactly equiprobable. This is the difference
 * between "looks random" and "provably fair".
 */

import { ByteReader } from './expander.mjs';

/**
 * Roll `count` fair dice, each in 1..sides, from a seed.
 * @param {Uint8Array} seed
 * @param {number} count
 * @param {number} [sides=6]
 * @returns {Promise<number[]>}
 */
export async function rollDice(seed, count, sides = 6) {
  if (sides < 2 || sides > 256) throw new Error('sides must be 2..256');
  const limit = Math.floor(256 / sides) * sides; // largest unbiased multiple
  const reader = new ByteReader(seed);
  /** @type {number[]} */
  const out = [];
  while (out.length < count) {
    const b = await reader.next();
    if (b < limit) out.push((b % sides) + 1); // reject b >= limit to kill modulo bias
  }
  return out;
}
