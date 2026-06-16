// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combine } from '../src/combiner.mjs';
import { toHex, utf8 } from '../src/bytes.mjs';

const A = { id: 'a', bytes: utf8('alpha') };
const B = { id: 'b', bytes: utf8('beta') };

test('combine is deterministic', async () => {
  assert.equal(toHex(await combine('d', [A, B])), toHex(await combine('d', [A, B])));
});

test('order of sources is significant', async () => {
  assert.notEqual(toHex(await combine('d', [A, B])), toHex(await combine('d', [B, A])));
});

test('domain separation changes the seed', async () => {
  assert.notEqual(toHex(await combine('d1', [A])), toHex(await combine('d2', [A])));
});

test('length-prefix framing prevents field-sliding collisions', async () => {
  // Naive concat would make ("ab","c") collide with ("a","bc"); framing must not.
  const x = await combine('d', [{ id: 's', bytes: utf8('ab') }, { id: 't', bytes: utf8('c') }]);
  const y = await combine('d', [{ id: 's', bytes: utf8('a') }, { id: 't', bytes: utf8('bc') }]);
  assert.notEqual(toHex(x), toHex(y));
});
