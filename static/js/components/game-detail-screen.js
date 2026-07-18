// @ts-check
import './app-header.js';
import { avatarSrc } from '../avatars.js';
import { getAuthUser } from '../auth.js';
import { esc } from '../dom.js';
import { BACK_BUTTON_HTML } from '../back-button.js';
import { showLanding } from '../router.js';
import { state } from '../state.js';

/**
 * <game-detail-screen> — post-game detail view at /games/<code>.
 * Light DOM: the host element *is* `#game-detail.screen`.
 */
export class GameDetailScreen extends HTMLElement {
  /** Bumped each time verification (re)starts so a superseded run bails at its
   *  next await instead of writing into the newly-rendered detail view. */
  #verifyGen = 0;

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
    if (header) {
      const user = getAuthUser();
      if (user) {
        const tag = document.createElement('a');
        tag.className = 'header-username';
        tag.textContent = `@${user.username}`;
        tag.href = `/@${user.username}`;
        const btn = header.querySelector('.game-menu-btn');
        btn?.parentElement?.insertBefore(tag, btn);
      }
    }
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
   * inside the view transition's update phase — the screen is captured already
   * populated instead of animating to an empty body and popping in later.
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
      else if (totalSecs < 3600) duration = `${Math.floor(totalSecs / 60)}m ${totalSecs % 60}s`;
      else duration = `${(totalSecs / 3600).toFixed(1)}h`;
    }

    // Play time
    let playedAt = '';
    if (data.started_at) {
      const d = new Date(data.started_at);
      playedAt = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    // Players
    const playersHtml = data.players.map((/** @type {any} */ p) => {
      const photo = avatarSrc(p.photo);
      return `
        <div class="gd-player">
          <span class="gd-player-avatar-ring"><img class="gd-player-avatar" src="${esc(photo)}" alt=""></span>
          <span class="gd-player-name">${esc(p.name)}</span>
          <span class="gd-player-wins">${p.wins} win${p.wins !== 1 ? 's' : ''}</span>
        </div>`;
    }).join('');

    const justEnded = state.gameJustEnded;
    state.gameJustEnded = false;

    contentEl.innerHTML = `
      ${justEnded ? '<p class="gd-ended">Game ended</p>' : ''}
      <p class="gd-code">${data.game_code}</p>
      <p class="gd-time">${playedAt}</p>
      <div class="gd-stats">
        <div class="gd-stat"><span class="gd-stat-value">${data.num_rounds}</span><span class="gd-stat-label">Rounds</span></div>
        <div class="gd-stat"><span class="gd-stat-value">${data.num_players}</span><span class="gd-stat-label">Players</span></div>
        <div class="gd-stat"><span class="gd-stat-value">${duration}</span><span class="gd-stat-label">Duration</span></div>
      </div>
      <div class="gd-section">
        <p class="gd-section-label">Players</p>
        <div class="gd-players">${playersHtml}</div>
      </div>
      <div class="gd-section gd-trust" id="gd-trust">
        <p class="gd-section-label">Roll Trust</p>
        <div class="gd-trust-box" id="gd-trust-box">
          <img class="gd-trust-badge" src="/static/images/roll-trust.svg" alt="" aria-hidden="true">
          <div class="gd-trust-scanner" id="gd-trust-scanner">
            <div class="gd-trust-scan-line"></div>
            <p class="gd-trust-status" id="gd-trust-status">Initializing verification&hellip;</p>
          </div>
        </div>
        <a class="gd-trust-learn" href="https://github.com/radiantnode/tensies/blob/main/docs/ROLL_TRUST.md" target="_blank" rel="noopener">Learn more about Roll Trust</a>
      </div>`;

    this.#runVerification(data.game_code, data.players);
  }

  /**
   * Animate the roll trust verification.
   * @param {string} code
   * @param {any[]} players
   */
  async #runVerification(code, players) {
    const statusEl = document.getElementById('gd-trust-status');
    const boxEl = document.getElementById('gd-trust-box');
    if (!statusEl || !boxEl) return;
    // Generation guard: quickly switching between two /games/<code> views starts
    // overlapping verification loops. Capture our generation; a newer run bumps
    // it, so we bail at the next await instead of writing stale results (e.g.
    // toggling the other view's scanner class) into the freshly-rendered view.
    const gen = ++this.#verifyGen;

    // Phase 1: scanning animation
    const phases = [
      'Connecting to drand beacon network&hellip;',
      'Fetching cryptographic proofs&hellip;',
      'Re-deriving dice from beacon entropy&hellip;',
      'Comparing roll signatures&hellip;',
    ];
    for (const msg of phases) {
      statusEl.innerHTML = msg;
      await new Promise((r) => setTimeout(r, 600));
      if (gen !== this.#verifyGen) return;
    }

    // Phase 2: actual verification
    statusEl.innerHTML = 'Verifying rolls&hellip;';
    try {
      const res = await fetch(`/api/game/${encodeURIComponent(code)}/verify`);
      if (gen !== this.#verifyGen) return;
      if (!res.ok) {
        statusEl.innerHTML = 'Verification unavailable';
        boxEl.classList.add('gd-trust-done');
        return;
      }
      const v = await res.json();
      if (gen !== this.#verifyGen) return;

      // Phase 3: reveal per-player results with stagger
      const scannerEl = document.getElementById('gd-trust-scanner');
      if (scannerEl) scannerEl.classList.add('gd-trust-scan-done');

      await new Promise((r) => setTimeout(r, 400));
      if (gen !== this.#verifyGen) return;

      // Build results
      const allPassed = v.failed === 0 && v.total > 0;
      const noData = v.total === 0;
      const playerMap = v.players || {};
      const checkSvg = `<svg class="gd-trust-check" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#166534" stroke="#4ade80" stroke-width="1.2"/><path d="M7 12.5 L10.5 16 L17 9" fill="none" stroke="#4ade80" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      const failSvg = `<svg class="gd-trust-check" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#7f1d1d" stroke="#f87171" stroke-width="1.2"/><path d="M8 8 L16 16 M16 8 L8 16" fill="none" stroke="#f87171" stroke-width="2.2" stroke-linecap="round"/></svg>`;
      let resultsHtml = `<img class="gd-trust-badge" src="/static/images/roll-trust.svg" alt="" aria-hidden="true">`;

      if (noData) {
        resultsHtml += `<div class="gd-trust-result"><span class="gd-trust-verdict">No beacon data for this game</span></div>`;
        resultsHtml += `<p class="gd-trust-source">Verified against <span class="gd-trust-highlight">drand</span> League of Entropy beacons</p>`;
        boxEl.innerHTML = resultsHtml;
        boxEl.classList.add('gd-trust-done');
        return;
      }

      resultsHtml += `<div class="gd-trust-result ${allPassed ? 'gd-trust-pass' : 'gd-trust-fail'}">
        ${allPassed ? checkSvg : failSvg}
        <span class="gd-trust-verdict">${allPassed ? `All ${v.total} rolls verified` : `${v.failed} of ${v.total} rolls failed`}</span>
      </div>`;

      resultsHtml += '<div class="gd-trust-players">';
      for (const p of players) {
        const pr = playerMap[p.user_id];
        if (!pr) continue;
        const ok = pr.failed === 0;
        resultsHtml += `
          <div class="gd-trust-player-row">
            ${ok ? checkSvg : failSvg}
            <span class="gd-trust-player-name">${esc(pr.name)}</span>
            <span class="gd-trust-player-count">${pr.verified}/${pr.total}</span>
          </div>`;
      }
      resultsHtml += '</div>';

      resultsHtml += `<p class="gd-trust-source">Verified against <span class="gd-trust-highlight">drand</span> League of Entropy beacons</p>`;

      boxEl.innerHTML = resultsHtml;
      boxEl.classList.add('gd-trust-done');

    } catch {
      statusEl.innerHTML = 'Verification failed';
      boxEl.classList.add('gd-trust-done');
    }
  }
}

customElements.define('game-detail-screen', GameDetailScreen);
