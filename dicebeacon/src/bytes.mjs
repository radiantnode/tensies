// @ts-check
/**
 * Dependency-free byte + encoding helpers. Everything here runs identically in
 * Node (>=18) and the browser — no Buffer, no Node built-ins.
 */

const _enc = new TextEncoder();
const _dec = new TextDecoder();

/** @param {string} str @returns {Uint8Array} */
export function utf8(str) {
  return _enc.encode(str);
}

/** @param {Uint8Array} bytes @returns {string} */
export function fromUtf8(bytes) {
  return _dec.decode(bytes);
}

/** @param {Uint8Array} bytes @returns {string} lowercase hex */
export function toHex(bytes) {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

/** @param {string} hex @returns {Uint8Array} */
export function fromHex(hex) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('fromHex: odd-length string');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** @param {...Uint8Array} arrays @returns {Uint8Array} */
export function concatBytes(...arrays) {
  let len = 0;
  for (const a of arrays) len += a.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

/** Big-endian uint32. @param {number} n @returns {Uint8Array} */
export function u32be(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, false);
  return b;
}

/** Constant-ish-time-ish byte equality (length + content). */
export function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Canonical JSON: object keys sorted recursively, no insignificant whitespace.
 * The commitment hash is taken over this, so producer and verifier must agree
 * byte-for-byte regardless of key insertion order.
 * @param {unknown} value @returns {string}
 */
export function canonicalJson(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(/** @type {any} */ (v)[k]);
    return out;
  }
  return v;
}
