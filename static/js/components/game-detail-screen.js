// @ts-check
import './app-header.js';
import { avatarSeat } from '../avatars.js';
import { getAuthUser } from '../auth.js';
import { syncUsernamePill } from '../account-sync.js';
import { esc } from '../dom.js';
import { BACK_BUTTON_HTML } from '../back-button.js';
import { state } from '../state.js';

/* The assay disc's marks — strokes at one weight and cap, so they read as
   struck lines in metal rather than filled icons (alarm.json). */
const SHIELD = `<svg viewBox="0 0 24 24" fill="none" stroke="#3d2a09" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.4 4.4 5.6v5.2c0 4.7 3.2 9.1 7.6 10.2 4.4-1.1 7.6-5.5 7.6-10.2V5.6z"/></svg>`;
const SHIELD_TICK = `<svg viewBox="0 0 24 24" fill="none" stroke="#3d2a09" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.4 4.4 5.6v5.2c0 4.7 3.2 9.1 7.6 10.2 4.4-1.1 7.6-5.5 7.6-10.2V5.6z"/><path d="m8.7 12.1 2.3 2.3 4.3-4.6"/></svg>`;
const TICK = `<svg class="gd-trust-tick" viewBox="0 0 24 24" fill="none" stroke="#e2b96e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>`;
const CROSS = `<svg class="gd-trust-tick" viewBox="0 0 24 24" fill="none" stroke="#e0503a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

/**
 * The assay seal — one object in three states: struck (passed), unstruck
 * (verifying / nothing to report), voided (failed). Never a second object.
 * @param {'struck' | 'unstruck' | 'voided'} mode
 */
function seal(mode) {
  if (mode === 'voided') {
    return `<span class="gd-seal is-void"><span class="gd-seal-glyph">${SHIELD}</span><span class="gd-seal-bar"></span></span>`;
  }
  return `<span class="gd-seal${mode === 'unstruck' ? ' is-unstruck' : ''}">${mode === 'struck' ? SHIELD_TICK : SHIELD}</span>`;
}

/**
 * <game-detail-screen> — post-game detail view at /games/<code>.
 * Light DOM: the host element *is* `#game-detail.screen`.
 */
export class GameDetailScreen extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'game-detail';
    this.className = 'screen game-detail-screen';
    this.setAttribute('aria-label', 'Game detail');
    this.innerHTML = `
      <app-header></app-header>
      <div class="screen-body">
        <button id="gd-back-btn" type="button" class="btn-back">${BACK_BUTTON_HTML}</button>
        <p class="error-msg" id="game-detail-error" role="alert" aria-live="polite"></p>
        <div id="game-detail-content"></div>
      </div>`;

    this.querySelector('#gd-back-btn')?.addEventListener('click', () => history.back());

    const header = this.querySelector('app-header');
    if (header) syncUsernamePill(header, getAuthUser());
  }

  /**
   * Fetch a game's post-game detail. Returns a result that the synchronous
   * {@link render} paints — the fetch is kept off the view-transition path so
   * the swap captures a populated screen (same shape as the profile screen).
   * @param {string} code
   * @returns {Promise<{ data?: any, error?: string }>}
   */
  async load(code) {
    try {
      const res = await fetch(`/api/game/${encodeURIComponent(code.toUpperCase())}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { error: body.detail || 'Game not found' };
      }
      return { data: await res.json() };
    } catch {
      return { error: 'Could not load game' };
    }
  }

  /**
   * Paint the game detail from a {@link load} result. Synchronous so it runs
   * inside the view transition's update phase.
   * @param {string} _code Unused; kept for the shared load/render contract.
   * @param {{ data?: any, error?: string }} result
   */
  render(_code, result) {
    const errorEl = document.getElementById('game-detail-error');
    const contentEl = document.getElementById('game-detail-content');
    if (!errorEl || !contentEl) return;

    errorEl.textContent = '';
    contentEl.innerHTML = '';

    if (result.error) {
      errorEl.textContent = result.error;
      return;
    }
    const data = result.data;

    // Duration
    let duration = '';
    if (data.duration_ms) {
      const totalSecs = Math.round(data.duration_ms / 1000);
      if (totalSecs < 60) duration = `${totalSecs}s`;
      else if (totalSecs < 3600) duration = `${Math.floor(totalSecs / 60)}m`;
      else duration = `${(totalSecs / 3600).toFixed(1)}h`;
    }

    // Play time
    let playedAt = '';
    if (data.started_at) {
      const d = new Date(data.started_at);
      playedAt = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (data.place_name) playedAt += `${playedAt ? ' · ' : ''}${data.place_name}`;

    // Players — standings, most wins first; the seat is a photo or monogram.
    const playersHtml = data.players.map((/** @type {any} */ p, /** @type {number} */ i) => `
        <div class="gd-player">
          ${avatarSeat(p.photo || null, p.name, 'gd-player-seat avatar-seat').outerHTML}
          <span class="gd-player-name${i === 0 ? ' is-leader' : ''}">${esc(p.name)}</span>
          <span class="gd-player-wins${i === 0 ? ' is-leader' : ''}">${p.wins} win${p.wins !== 1 ? 's' : ''}</span>
        </div>`).join('');

    const justEnded = state.gameJustEnded;
    state.gameJustEnded = false;

    contentEl.innerHTML = `
      ${justEnded ? '<p class="gd-ended">Game ended</p>' : ''}
      <p class="gd-code">${esc(data.game_code)}</p>
      <p class="gd-time">${esc(playedAt)}</p>
      <div class="gd-stats">
        <div class="gd-stat"><span class="gd-stat-value">${data.num_rounds}</span><span class="gd-stat-label">Rounds</span></div>
        <div class="gd-stat"><span class="gd-stat-value">${data.num_players}</span><span class="gd-stat-label">Players</span></div>
        <div class="gd-stat"><span class="gd-stat-value">${duration}</span><span class="gd-stat-label">Duration</span></div>
      </div>
      <div class="gd-section">
        <p class="gd-section-label section-label">Players</p>
        <div class="gd-players">${playersHtml}</div>
      </div>
      <!-- The Roll Trust apparatus: a plain dark bay with the assay seal
           ABOVE, breaking its top edge — the object announces the area, so
           it carries no label. The seal is unstruck while verifying. -->
      <div class="gd-trust" id="gd-trust-box">
        ${seal('unstruck')}
        <div class="gd-trust-scanbay" aria-hidden="true"><i></i></div>
        <p class="gd-trust-status" id="gd-trust-status">Connecting to drand beacon network&hellip;</p>
      </div>`;

    this.#runVerification(data.game_code, data.players);
  }

  /**
   * Run the roll trust verification: real phase lines on the unstruck seal,
   * then the verdict — the seal struck when every roll matches, VOIDED when
   * any fails (the app's one alarm), unstruck when there is nothing to
   * report.
   * @param {string} code
   * @param {any[]} players
   */
  async #runVerification(code, players) {
    const statusEl = document.getElementById('gd-trust-status');
    const boxEl = document.getElementById('gd-trust-box');
    if (!statusEl || !boxEl) return;

    // Phase 1: the instrument's own status lines.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const phases = [
      'Fetching cryptographic proofs&hellip;',
      'Re-deriving dice from beacon entropy&hellip;',
      'Comparing roll signatures&hellip;',
    ];
    for (const msg of phases) {
      statusEl.innerHTML = msg;
      if (!reduced) await new Promise((r) => setTimeout(r, 600));
    }

    statusEl.innerHTML = 'Verifying rolls&hellip;';
    try {
      const res = await fetch(`/api/game/${encodeURIComponent(code)}/verify`);
      if (!res.ok) {
        statusEl.innerHTML = 'Verification unavailable';
        return;
      }
      const v = await res.json();

      const allPassed = v.failed === 0 && v.total > 0;
      const noData = v.total === 0;
      const playerMap = v.players || {};
      const source = `<div class="gd-trust-hr"></div>
        <p class="gd-trust-source">Verified against <b>drand</b> League of Entropy beacons.</p>
        <p><a class="gd-trust-learn" href="https://github.com/radiantnode/tensies/blob/main/docs/ROLL_TRUST.md" target="_blank" rel="noopener">Learn more about Roll Trust</a></p>`;

      // Unknown: the apparatus is present but UNSTRUCK — the instrument has
      // nothing to report. No verdict colour of any kind.
      if (noData) {
        boxEl.innerHTML = `${seal('unstruck')}
          <p class="gd-trust-unknown">No beacon data for this game</p>
          ${source}`;
        return;
      }

      let rows = '';
      for (const p of players) {
        const pr = playerMap[p.user_id];
        if (!pr) continue;
        const ok = pr.failed === 0;
        rows += `
          <div class="gd-trust-row">
            ${ok ? TICK : CROSS}
            <span class="gd-trust-row-name">${esc(pr.name)}</span>
            <span class="gd-trust-row-count">${pr.verified}/${pr.total}</span>
          </div>`;
      }

      boxEl.innerHTML = `${seal(allPassed ? 'struck' : 'voided')}
        <p class="gd-trust-verdict${allPassed ? '' : ' is-fail'}">${allPassed
          ? `All ${v.total} rolls verified` : `${v.failed} of ${v.total} rolls failed`}</p>
        <p class="gd-trust-status">${allPassed
          ? 'Every roll replayed and matched'
          : `Replayed against the beacon &mdash; ${v.failed === 1 ? 'one did' : `${v.failed} did`} not match`}</p>
        <div class="gd-trust-hr"></div>
        <div class="gd-trust-rows">${rows}</div>
        ${source}`;
    } catch {
      statusEl.innerHTML = 'Verification unavailable';
    }
  }
}

customElements.define('game-detail-screen', GameDetailScreen);
