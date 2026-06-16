// @ts-check
/**
 * <dice-verifier> — a drop-in custom element that re-derives a game's dice from
 * a reveal, entirely in the browser, with no server in the trust path. It
 * imports the SAME core modules the producer ran (SHA-256 via Web Crypto), so a
 * green check means the visitor's own machine reproduced the dice.
 *
 * Usage:
 *   <script type="module" src="./dice-verifier.mjs"></script>
 *   <dice-verifier src="reveal.json" commitment-hash="abc123..."></dice-verifier>
 * or set `.reveal` / `.commitmentHash` properties directly.
 *
 * Note: drand, starlink and mock verify OFFLINE from the reveal alone. Bitcoin's
 * offline check is consistency-only; the element links out to a block explorer
 * for the independent confirmation.
 */

import { verifyReveal } from '../src/envelope.mjs';
import '../src/sources/mock.mjs';
import '../src/sources/drand.mjs';
import '../src/sources/starlink.mjs';
import '../src/sources/bitcoin.mjs';

class DiceVerifier extends HTMLElement {
  static get observedAttributes() {
    return ['src', 'commitment-hash'];
  }

  connectedCallback() {
    this.render('idle');
    const src = this.getAttribute('src');
    if (src) this.loadAndVerify(src);
    else if (this.reveal) this.verify(this.reveal);
  }

  attributeChangedCallback() {
    if (this.isConnected && this.getAttribute('src')) {
      this.loadAndVerify(/** @type {string} */ (this.getAttribute('src')));
    }
  }

  async loadAndVerify(src) {
    this.render('loading');
    try {
      const res = await fetch(src);
      const reveal = await res.json();
      await this.verify(reveal);
    } catch (err) {
      this.render('error', { message: String(err) });
    }
  }

  async verify(reveal) {
    this.render('loading');
    const expected =
      this.commitmentHash || this.getAttribute('commitment-hash') || undefined;
    try {
      const result = await verifyReveal(reveal, expected);
      this.render(result.ok ? 'ok' : 'fail', { reveal, result });
    } catch (err) {
      this.render('error', { message: String(err) });
    }
  }

  render(status, data = {}) {
    const { reveal, result, message } = data;
    if (status === 'idle' || status === 'loading') {
      this.innerHTML = `<div class="dv-card dv-${status}">${
        status === 'loading' ? 'Verifying dice…' : 'Waiting for a reveal…'
      }</div>`;
      return;
    }
    if (status === 'error') {
      this.innerHTML = `<div class="dv-card dv-error">Could not verify: ${escapeHtml(message)}</div>`;
      return;
    }
    const dice = (reveal.dice || []).map((d) => `<span class="dv-die">${d}</span>`).join('');
    const rows = result.checks
      .map(
        (c) =>
          `<li class="${c.ok ? 'dv-pass' : 'dv-fail'}"><b>${c.ok ? '✓' : '✗'}</b> ${escapeHtml(
            c.name,
          )}</li>`,
      )
      .join('');
    const sources = (reveal.commitment.sources || [])
      .map((s) => {
        const g = s.grade || {};
        const anchor = (g.unpredictable ?? 0) + (g.uninfluenceable ?? 0) >= 5;
        return `<li>${escapeHtml(s.id)} <em>${anchor ? 'anchor' : 'garnish'}</em>
          <small>unpredictable ${g.unpredictable ?? '?'} · uninfluenceable ${g.uninfluenceable ?? '?'} · verifiable ${g.verifiable ?? '?'}</small></li>`;
      })
      .join('');
    this.innerHTML = `
      <div class="dv-card dv-${status}">
        <div class="dv-headline">${status === 'ok' ? '✓ Dice verified on your device' : '✗ Verification FAILED'}</div>
        <div class="dv-dice">${dice}</div>
        <details open><summary>How these dice were seeded</summary>
          <ul class="dv-sources">${sources}</ul>
        </details>
        <details><summary>Checks</summary><ul class="dv-checks">${rows}</ul>
          <code class="dv-seed">seed ${escapeHtml(reveal.seedHex)}</code>
        </details>
      </div>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

customElements.define('dice-verifier', DiceVerifier);
export { DiceVerifier };
