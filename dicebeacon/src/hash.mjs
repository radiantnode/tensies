// @ts-check
/**
 * The one hash primitive the whole framework stands on: SHA-256 via Web Crypto.
 *
 * Why only SHA-256, and why SubtleCrypto specifically: the exact same call works
 * in Node (>=18 exposes `globalThis.crypto.subtle`) and in every browser, so the
 * verifier that re-derives the dice runs client-side with ZERO dependencies and
 * ZERO server trust. drand randomness is SHA-256(signature) and Bitcoin is
 * SHA-256d, so SHA-256 is also the native language of our strongest sources.
 */

const subtle = globalThis.crypto && globalThis.crypto.subtle;
if (!subtle) {
  throw new Error(
    'WebCrypto SubtleCrypto is unavailable — need Node >= 18 or a browser context.',
  );
}

/**
 * @param {Uint8Array} data
 * @returns {Promise<Uint8Array>}
 */
export async function sha256(data) {
  const digest = await subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}
