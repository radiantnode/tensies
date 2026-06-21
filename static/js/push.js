// @ts-check

/**
 * Web Push opt-in: register the service worker, ask permission, subscribe with
 * the server's VAPID key, and POST the subscription to the account.
 *
 * Only signed-in users can receive pushes (a push targets a users.id), so the
 * whole flow no-ops unless there's an auth token. Everything is best-effort —
 * an unsupported browser, a denied permission, or push being disabled
 * server-side just leaves the user un-subscribed.
 */

import { getAuthToken, isSignedIn } from './auth.js';

/** @param {string} base64 base64url VAPID public key */
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** @returns {boolean} */
function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Register the service worker (idempotent — the browser dedupes by URL).
 * @returns {Promise<ServiceWorkerRegistration | null>}
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('[push] service worker registration failed', err);
    return null;
  }
}

/**
 * Full opt-in: permission → subscribe → save. Safe to call on every load; if a
 * subscription already exists it's just re-saved (the server upserts by
 * endpoint). No-ops when push is unsupported, the user is signed out, push is
 * disabled server-side, or permission isn't granted.
 * @returns {Promise<boolean>} whether a subscription was saved
 */
export async function subscribeToPush() {
  if (!pushSupported() || !isSignedIn()) return false;

  // The VAPID key doubles as a feature flag: a 503 means push is off server-side.
  let publicKey;
  try {
    const res = await fetch('/push/vapid-public-key');
    if (!res.ok) return false;
    publicKey = (await res.json()).public_key;
  } catch {
    return false;
  }
  if (!publicKey) return false;

  const reg = await registerServiceWorker();
  if (!reg) return false;
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const res = await fetch('/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  return res.ok;
}
