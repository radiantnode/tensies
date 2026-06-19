// @ts-check

/**
 * Client-side WebAuthn passkey ceremony orchestration + JWT session helpers.
 *
 * Binary fields (ArrayBuffer ↔ base64url) follow the WebAuthn JSON
 * serialisation spec so py_webauthn on the server can decode them directly.
 */

import { readSession } from './session.js';

// ─── Base64url helpers ──────────────────────────────────────────────

/** @param {ArrayBuffer} buf */
function bufferToBase64url(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} b64 */
function base64urlToBuffer(b64) {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ─── JWT helpers ────────────────────────────────────────────────────

const AUTH_TOKEN_KEY = 'tensies_auth_token';

/** @returns {string | null} */
export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Decode the JWT payload (no verification — that's the server's job).
 * @returns {{ sub: string, username: string, exp: number } | null}
 */
export function getAuthUser() {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** @returns {boolean} */
export function isSignedIn() {
  return getAuthUser() !== null;
}

export function signOut() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/** @param {string} token */
function saveAuthToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

// ─── Username validation (mirrors server) ───────────────────────────

const USERNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,28}[a-zA-Z0-9]$/;

/**
 * @param {string} username
 * @returns {string | null} Error message, or null if valid.
 */
export function validateUsername(username) {
  const u = username.trim();
  if (u.length < 2) return 'Username must be at least 2 characters';
  if (u.length > 30) return 'Username must be 30 characters or fewer';
  if (!USERNAME_RE.test(u)) {
    return 'Letters, numbers, dots, hyphens, and underscores only. Must start and end with a letter or number.';
  }
  return null;
}

// ─── WebAuthn feature detection ─────────────────────────────────────

/** @returns {boolean} */
export function isWebAuthnAvailable() {
  return typeof window.PublicKeyCredential !== 'undefined';
}

// ─── Registration ───────────────────────────────────────────────────

/**
 * Full passkey registration flow.
 * @param {string} username
 * @returns {Promise<{ token: string, user: { id: string, username: string } }>}
 */
export async function registerPasskey(username) {
  // 1. Get options from server
  const legacyPid = readSession().playerId;
  const optRes = await fetch('/auth/register/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!optRes.ok) {
    const err = await optRes.json();
    throw new Error(err.detail || 'Registration failed');
  }
  const { options, nonce, user_id } = await optRes.json();

  // 2. Create credential via browser API
  const publicKey = {
    rp: options.rp,
    user: {
      id: base64urlToBuffer(options.user.id),
      name: options.user.name,
      displayName: options.user.displayName,
    },
    challenge: base64urlToBuffer(options.challenge),
    pubKeyCredParams: options.pubKeyCredParams,
    timeout: options.timeout,
    authenticatorSelection: options.authenticatorSelection,
    attestation: options.attestation,
    excludeCredentials: (options.excludeCredentials || []).map((/** @type {any} */ c) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  };

  const credential = /** @type {PublicKeyCredential} */ (
    await navigator.credentials.create({ publicKey })
  );
  if (!credential) throw new Error('Passkey creation was cancelled');

  const attestation = /** @type {AuthenticatorAttestationResponse} */ (credential.response);

  // 3. Send credential to server for verification
  const verifyRes = await fetch('/auth/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nonce,
      username,
      credential: {
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToBase64url(attestation.clientDataJSON),
          attestationObject: bufferToBase64url(attestation.attestationObject),
        },
        transports: attestation.getTransports ? attestation.getTransports() : [],
        user_id,
      },
      legacy_pid: legacyPid,
    }),
  });
  if (!verifyRes.ok) {
    const err = await verifyRes.json();
    throw new Error(err.detail || 'Registration verification failed');
  }

  const result = await verifyRes.json();
  saveAuthToken(result.token);
  return result;
}

// ─── Authentication ─────────────────────────────────────────────────

/**
 * Full passkey authentication flow.
 * @param {string} username
 * @returns {Promise<{ token: string, user: { id: string, username: string } }>}
 */
export async function loginPasskey(username) {
  // 1. Get options from server
  const optRes = await fetch('/auth/login/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!optRes.ok) {
    const err = await optRes.json();
    throw new Error(err.detail || 'Login failed');
  }
  const { options, nonce } = await optRes.json();

  // 2. Get credential via browser API
  const publicKey = {
    challenge: base64urlToBuffer(options.challenge),
    rpId: options.rpId,
    timeout: options.timeout,
    userVerification: options.userVerification,
    allowCredentials: (options.allowCredentials || []).map((/** @type {any} */ c) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  };

  const credential = /** @type {PublicKeyCredential} */ (
    await navigator.credentials.get({ publicKey })
  );
  if (!credential) throw new Error('Passkey verification was cancelled');

  const assertion = /** @type {AuthenticatorAssertionResponse} */ (credential.response);

  // 3. Send credential to server for verification
  const verifyRes = await fetch('/auth/login/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nonce,
      username,
      credential: {
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToBase64url(assertion.clientDataJSON),
          authenticatorData: bufferToBase64url(assertion.authenticatorData),
          signature: bufferToBase64url(assertion.signature),
          userHandle: assertion.userHandle ? bufferToBase64url(assertion.userHandle) : null,
        },
      },
    }),
  });
  if (!verifyRes.ok) {
    const err = await verifyRes.json();
    throw new Error(err.detail || 'Login verification failed');
  }

  const result = await verifyRes.json();
  saveAuthToken(result.token);
  return result;
}
