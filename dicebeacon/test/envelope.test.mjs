// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCommitment, reveal, verifyReveal } from '../src/envelope.mjs';
import '../src/sources/mock.mjs'; // register the mock source

const spec = {
  gameId: 'game-123',
  diceCount: 10,
  sources: [
    { id: 'mock', ref: { value: 'drand-stand-in' } },
    { id: 'mock', ref: { value: 'starlink-stand-in' } },
  ],
  createdAt: '2026-06-16T00:00:00.000Z',
};

test('commit -> reveal -> verify round-trips green', async () => {
  const { commitment, commitmentHash } = await buildCommitment(spec);
  const rev = await reveal(commitment);
  const result = await verifyReveal(rev, commitmentHash);
  assert.ok(result.ok, 'verify failed: ' + JSON.stringify(result.checks, null, 2));
});

test('commitment hash is stable across key order (canonical JSON)', async () => {
  const a = await buildCommitment(spec);
  const b = await buildCommitment({ ...spec });
  assert.equal(a.commitmentHash, b.commitmentHash);
});

test('a swapped recipe fails the commitment-hash check', async () => {
  const { commitment, commitmentHash } = await buildCommitment(spec);
  const rev = await reveal(commitment);
  rev.commitment.diceCount = 9; // tamper with the recipe post-commit
  const result = await verifyReveal(rev, commitmentHash);
  assert.equal(result.ok, false);
  assert.equal(result.checks.find((c) => c.name === 'commitment-hash')?.ok, false);
});

test('a tampered die fails the dice check', async () => {
  const { commitment, commitmentHash } = await buildCommitment(spec);
  const rev = await reveal(commitment);
  rev.dice[0] = (rev.dice[0] % 6) + 1; // flip one die
  const result = await verifyReveal(rev, commitmentHash);
  assert.equal(result.ok, false);
  assert.equal(result.checks.find((c) => c.name === 'dice')?.ok, false);
});

test('a forged observation fails its source verify', async () => {
  const { commitment, commitmentHash } = await buildCommitment(spec);
  const rev = await reveal(commitment);
  rev.observations[0].bytesHex = '00'.repeat(32); // lie about what was observed
  const result = await verifyReveal(rev, commitmentHash);
  assert.equal(result.ok, false);
  assert.equal(result.checks.find((c) => c.name === 'source:mock')?.ok, false);
});
