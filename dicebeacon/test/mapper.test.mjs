// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollDice } from '../src/mapper.mjs';
import { sha256 } from '../src/hash.mjs';
import { utf8 } from '../src/bytes.mjs';

test('dice are deterministic for a given seed', async () => {
  const seed = await sha256(utf8('seed-A'));
  const a = await rollDice(seed, 10);
  const b = await rollDice(seed, 10);
  assert.deepEqual(a, b);
});

test('different seeds give different dice', async () => {
  const a = await rollDice(await sha256(utf8('seed-A')), 10);
  const b = await rollDice(await sha256(utf8('seed-B')), 10);
  assert.notDeepEqual(a, b);
});

test('all dice are in range 1..6', async () => {
  const dice = await rollDice(await sha256(utf8('range')), 200);
  for (const d of dice) {
    assert.ok(d >= 1 && d <= 6, `die ${d} out of range`);
  }
});

test('distribution is roughly uniform (rejection sampling, no modulo bias)', async () => {
  // 12000 dice over distinct seeds; each face expected ~2000. Chi-square gate.
  const counts = [0, 0, 0, 0, 0, 0];
  const N = 12000;
  for (let i = 0; i < N; i++) {
    const seed = await sha256(utf8('u' + i));
    const [d] = await rollDice(seed, 1);
    counts[d - 1]++;
  }
  const expected = N / 6;
  let chi = 0;
  for (const c of counts) chi += ((c - expected) ** 2) / expected;
  // 5 dof, 0.1% critical value ~= 20.5. Comfortable margin; this is a sanity gate.
  assert.ok(chi < 20.5, `chi-square ${chi.toFixed(2)} too high — distribution skewed: ${counts}`);
});

test('supports arbitrary sided dice', async () => {
  const dice = await rollDice(await sha256(utf8('d20')), 100, 20);
  for (const d of dice) assert.ok(d >= 1 && d <= 20);
});
