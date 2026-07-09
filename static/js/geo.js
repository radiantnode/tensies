// @ts-check
/**
 * Geolocation — a promise wrapper around the callback-based Geolocation API,
 * with a typed failure whose `reason` maps cleanly to user-facing copy (the
 * same shape as {@link import('./audio-share.js').AudioShareError}).
 *
 * We ask for a coarse-ish fix (30 s cache, 10 s timeout): "nearby" is a
 * ~500 m radius, so a fresh high-accuracy lock is neither needed nor worth the
 * extra battery/latency.
 */

/** @typedef {'permission' | 'unavailable' | 'timeout' | 'unsupported'} GeoReason */

/** Typed failure from {@link getPosition}. */
export class GeoError extends Error {
  /**
   * @param {GeoReason} reason
   * @param {string} message
   */
  constructor(reason, message) {
    super(message);
    this.name = 'GeoError';
    this.reason = reason;
  }
}

/** User-facing copy per failure reason — reused by the nearby screen + lobby. */
export const GEO_ERROR_COPY = {
  permission: 'Location access needed — allow it in your browser settings.',
  unavailable: 'Couldn’t get your location. Try again in a moment.',
  timeout: 'Locating timed out. Give it another go.',
  unsupported: 'Location isn’t available on this device.',
};

/**
 * Resolve the device's current position.
 * @returns {Promise<{lat: number, lon: number}>}
 * @throws {GeoError}
 */
export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new GeoError('unsupported', 'geolocation unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        // GeolocationPositionError: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT
        const reason = err.code === 1 ? 'permission'
          : err.code === 3 ? 'timeout'
          : 'unavailable';
        reject(new GeoError(reason, err.message || 'geolocation failed'));
      },
      // Coarse fix on purpose: "nearby" is ~500 m, so a high-accuracy GPS lock
      // isn't worth the extra battery/latency (see the module docstring).
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 },
    );
  });
}
