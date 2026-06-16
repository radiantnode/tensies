#!/usr/bin/env node
// @ts-check
/**
 * dicebeacon CLI.
 *
 *   beacon demo                              run the full pipeline offline (mock sources)
 *   beacon commit  --game G --drand-round R [--bitcoin-height H] [--starlink] [--dice N]
 *   beacon reveal  <commitment.json>         fetch sources, emit a reveal
 *   beacon verify  <reveal.json> [hash]      independently re-derive and check
 *
 * `commit` writes a commitment you publish BEFORE round R exists; after the
 * beacon publishes, `reveal` produces the dice and `verify` proves them.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { buildCommitment, reveal, verifyReveal } from '../src/index.mjs';

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
function has(flag) {
  return process.argv.includes(flag);
}
function out(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

const cmd = process.argv[2];

if (cmd === 'demo') {
  const { commitment, commitmentHash } = await buildCommitment({
    gameId: 'demo-' + Date.now(),
    diceCount: Number(arg('--dice', '10')),
    sources: [
      { id: 'mock', ref: { value: 'pretend-drand-round' } },
      { id: 'mock', ref: { value: 'pretend-starlink-snapshot' } },
    ],
  });
  const rev = await reveal(commitment);
  const result = await verifyReveal(rev, commitmentHash);
  console.log('commitment hash :', commitmentHash);
  console.log('seed            :', rev.seedHex);
  console.log('dice            :', rev.dice.join(' '));
  console.log('verified        :', result.ok ? 'YES ✓' : 'NO ✗');
} else if (cmd === 'commit') {
  /** @type {{id:string, ref:any}[]} */
  const sources = [];
  const drandRound = arg('--drand-round');
  if (drandRound) sources.push({ id: 'drand', ref: { round: Number(drandRound) } });
  const btcHeight = arg('--bitcoin-height');
  if (btcHeight) sources.push({ id: 'bitcoin', ref: { height: Number(btcHeight) } });
  if (has('--starlink')) sources.push({ id: 'starlink', ref: {} });
  if (sources.length === 0) {
    console.error('commit: need at least one of --drand-round / --bitcoin-height / --starlink');
    process.exit(2);
  }
  const built = await buildCommitment({
    gameId: arg('--game', 'game-' + Date.now()),
    diceCount: Number(arg('--dice', '10')),
    sources,
  });
  const file = arg('--out', 'commitment.json');
  writeFileSync(file, JSON.stringify(built, null, 2));
  console.error(`wrote ${file}  (publish this hash now: ${built.commitmentHash})`);
  out(built);
} else if (cmd === 'reveal') {
  const path = process.argv[3];
  if (!path) throw new Error('reveal: pass a commitment.json path');
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  const commitment = parsed.commitment ?? parsed; // accept the commit output or a bare commitment
  out(await reveal(commitment));
} else if (cmd === 'verify') {
  const path = process.argv[3];
  if (!path) throw new Error('verify: pass a reveal.json path');
  const rev = JSON.parse(readFileSync(path, 'utf8'));
  const result = await verifyReveal(rev, process.argv[4]);
  out(result);
  process.exit(result.ok ? 0 : 1);
} else {
  console.error('usage: beacon <demo|commit|reveal|verify> [...]');
  process.exit(2);
}
