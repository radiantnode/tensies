// @ts-check

/**
 * Probe tokens (iOS Safari Gotchas §3). A /p/<tokens>/<route> URL serves the
 * app with html[data-probe="<tokens>"] set by the server (routes.py, gated on
 * PROBE_PATHS) so iOS Safari's per-URL-path decisions can be measured per
 * variant. On every normal URL the attribute is absent and all of this is
 * inert. The CSS half lives in critical.css; the flow tokens (create, start,
 * autojoin, y<px>, hold) are here so a simulator with no touch input can
 * reach every screen and a scroll offset on its own.
 */

/** The probe tokens on this document, or [] on a normal URL. */
export function probeTokens() {
  return (document.documentElement.dataset.probe ?? '').split(' ').filter(Boolean);
}

/**
 * @param {string} token
 */
export function hasProbe(token) {
  return probeTokens().includes(token);
}

/** The y<px> token's offset, e.g. y1500 → 1500; 0 when absent. */
export function probeScrollY() {
  const t = probeTokens().find((x) => /^y\d+$/.test(x));
  return t ? Number(t.slice(1)) : 0;
}
