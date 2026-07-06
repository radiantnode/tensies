// @ts-check
import './app-header.js';
import { BACK_BUTTON_HTML } from '../back-button.js';
import { byId } from '../dom.js';
import { GeoError, GEO_ERROR_COPY, getPosition } from '../geo.js';
import { joinWithCode } from '../net.js';
import { showLanding } from '../router.js';

/** @typedef {import('../types.js').NearbyGame} NearbyGame */
/** @typedef {import('../types.js').NearbyResponse} NearbyResponse */

/** How often the radar re-polls the endpoint while the screen is active. */
const REFRESH_MS = 8000;

/**
 * <nearby-screen> — the GPS discovery radar (#nearby.screen, light DOM).
 *
 * `enter()` acquires the device fix, polls `GET /api/nearby`, and paints each
 * discoverable game as a blip: its distance sets the radial position, its true
 * bearing sets the angle, so a blip sits in the real-world direction of the
 * game. Tapping a blip surfaces a join card. Privacy is entirely server-side —
 * the client only ever sees bucketed distance + bearing, never coordinates.
 */
export class NearbyScreen extends HTMLElement {
  /** @type {{lat: number, lon: number} | null} last acquired fix */
  #pos = null;

  /** @type {ReturnType<typeof setInterval> | undefined} */
  #pollTimer;

  /** @type {string | null} code of the currently selected blip */
  #selected = null;

  /** @type {NearbyGame[]} last painted list, for card lookups on blip tap */
  #lastGames = [];

  /** @type {number} bumped each acquisition so a stale fetch can't paint. */
  #token = 0;

  /** @type {boolean} compass alignment active (scope rotates with heading). */
  #compassOn = false;

  /** @type {number} latest heading in degrees clockwise from true north. */
  #heading = 0;

  /** @type {boolean} an orientation → rAF paint is already queued. */
  #rafPending = false;

  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'nearby';
    this.className = 'screen nearby-screen';
    this.setAttribute('aria-labelledby', 'nearby-title');
    this.innerHTML = `
      <app-header></app-header>
      <div class="screen-body nearby-body">
        <button id="nearby-back-btn" type="button" class="btn-back">${BACK_BUTTON_HTML}</button>
        <h1 id="nearby-title" class="screen-title">Games Nearby</h1>
        <p class="tagline nearby-status">Finding games around you…</p>
        <div class="radar" id="radar" role="group" aria-label="Nearby games radar">
          <div class="radar-face" aria-hidden="true">
            <span class="radar-ring radar-ring-1"></span>
            <span class="radar-ring radar-ring-2"></span>
            <span class="radar-ring radar-ring-3"></span>
            <span class="radar-sweep"></span>
            <span class="radar-north">N</span>
            <span class="radar-you"></span>
          </div>
          <div class="radar-blips" id="radar-blips"></div>
        </div>
        <button id="compass-btn" type="button" class="btn btn-secondary compass-btn" aria-pressed="false" hidden>
          <svg class="compass-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polygon points="12,7 14.5,14.5 12,13 9.5,14.5" fill="currentColor" stroke="none"/></svg>
          <span class="compass-label">Use compass</span>
        </button>
        <div class="nearby-card" id="nearby-card" hidden></div>
        <p class="error-msg nearby-error" id="nearby-error" role="alert" aria-live="polite"></p>
        <button id="nearby-retry" type="button" class="btn btn-secondary nearby-retry" hidden>Try again</button>
      </div>`;

    byId('nearby-back-btn').addEventListener('click', () => showLanding());
    byId('nearby-retry').addEventListener('click', () => this.enter());
    // Compass alignment is offered only where device orientation could exist;
    // the tap is also the user gesture iOS requires for its permission prompt.
    if ('DeviceOrientationEvent' in window) byId('compass-btn').hidden = false;
    byId('compass-btn').addEventListener('click', () => this.#toggleCompass());
    // Blip taps + card Join, via delegation (blips/card are rebuilt each poll).
    byId('radar-blips').addEventListener('click', (e) => {
      const blip = /** @type {HTMLElement} */ (e.target).closest('[data-code]');
      if (blip) this.#select(blip.getAttribute('data-code'));
    });
    byId('nearby-card').addEventListener('click', (e) => {
      const join = /** @type {HTMLElement} */ (e.target).closest('[data-join]');
      if (join) joinWithCode(/** @type {string} */ (join.getAttribute('data-join')), 'nearby');
    });
  }

  disconnectedCallback() {
    this.#stopPolling();
    this.#stopCompass();
  }

  /**
   * Toggle compass alignment. On first enable this triggers the iOS
   * DeviceOrientationEvent.requestPermission() prompt (allowed because we're in
   * the tap handler); other engines start listening directly. When on, the
   * scope + blips rotate so the direction you're facing is at the top.
   */
  async #toggleCompass() {
    if (this.#compassOn) {
      this.#stopCompass();
      return;
    }
    const DOE = /** @type {any} */ (window.DeviceOrientationEvent);
    if (DOE && typeof DOE.requestPermission === 'function') {
      let res;
      try {
        res = await DOE.requestPermission();
      } catch {
        res = 'denied';
      }
      if (res !== 'granted') {
        this.showError('Compass access denied — check your browser settings.');
        return;
      }
    }
    this.showError('');
    this.#compassOn = true;
    // deviceorientationabsolute (Chromium) is true-north; iOS Safari fires
    // plain deviceorientation carrying webkitCompassHeading instead.
    const evt = 'ondeviceorientationabsolute' in window
      ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(evt, this.#onOrient);
    const btn = byId('compass-btn');
    btn.classList.add('is-on');
    btn.setAttribute('aria-pressed', 'true');
    /** @type {HTMLElement} */ (btn.querySelector('.compass-label')).textContent = 'Compass on';
  }

  #stopCompass() {
    if (!this.#compassOn) return;
    this.#compassOn = false;
    window.removeEventListener('deviceorientationabsolute', this.#onOrient);
    window.removeEventListener('deviceorientation', this.#onOrient);
    byId('radar').style.removeProperty('--rot');
    const btn = byId('compass-btn');
    btn.classList.remove('is-on');
    btn.setAttribute('aria-pressed', 'false');
    /** @type {HTMLElement} */ (btn.querySelector('.compass-label')).textContent = 'Use compass';
  }

  /**
   * Device-orientation handler. Derives a compass heading (clockwise from true
   * north) and rotates the scope by -heading via a CSS var, throttled to a
   * frame. Bound field so add/removeEventListener match.
   * @param {DeviceOrientationEvent & {webkitCompassHeading?: number}} e
   */
  #onOrient = (e) => {
    if (!this.#compassOn || !this.classList.contains('active')) return;
    let heading;
    if (typeof e.webkitCompassHeading === 'number') {
      heading = e.webkitCompassHeading;               // iOS: already 0=N, CW
    } else if (typeof e.alpha === 'number') {
      heading = 360 - e.alpha;                         // alpha is CCW from N
    } else {
      return;
    }
    this.#heading = heading;
    if (this.#rafPending) return;
    this.#rafPending = true;
    requestAnimationFrame(() => {
      this.#rafPending = false;
      byId('radar').style.setProperty('--rot', `${-this.#heading}deg`);
    });
  };

  /**
   * Acquire location and start the poll loop. Called on every entry to the
   * screen (tap, direct URL, Back/Forward) so a returning user re-locates.
   */
  async enter() {
    this.#stopPolling();
    this.#selected = null;
    this.#renderCard(null);
    this.showError('');
    byId('nearby-retry').hidden = true;
    this.#setStatus('Finding games around you…');
    this.#setLocating(true);

    const token = ++this.#token;
    try {
      this.#pos = await getPosition();
    } catch (err) {
      if (token !== this.#token) return; // superseded by a newer entry
      this.#setLocating(false);
      const reason = err instanceof GeoError ? err.reason : 'unavailable';
      this.showError(GEO_ERROR_COPY[reason] ?? GEO_ERROR_COPY.unavailable);
      this.#setStatus('Couldn’t locate you');
      byId('nearby-retry').hidden = false;
      return;
    }
    if (token !== this.#token) return;
    this.#setLocating(false);
    await this.#poll();
    // Only keep polling if this entry is still the active one.
    if (token === this.#token && this.classList.contains('active')) {
      this.#pollTimer = setInterval(() => this.#poll(), REFRESH_MS);
    }
  }

  #stopPolling() {
    clearInterval(this.#pollTimer);
    this.#pollTimer = undefined;
  }

  /** Fetch the current nearby list and repaint the radar. */
  async #poll() {
    if (!this.#pos) return;
    // The screen was left (navigated away) between ticks — stop cleanly.
    if (!this.classList.contains('active')) {
      this.#stopPolling();
      return;
    }
    const token = this.#token;
    let data;
    try {
      const res = await fetch(`/api/nearby?lat=${this.#pos.lat}&lon=${this.#pos.lon}`);
      if (!res.ok) throw new Error(`nearby ${res.status}`);
      data = /** @type {NearbyResponse} */ (await res.json());
    } catch {
      // A single failed poll is transient — keep the last view, don't wipe it.
      return;
    }
    if (token !== this.#token) return;
    this.#render(data);
  }

  /**
   * Paint blips for each game. Radial position = distance / radius; angle =
   * true bearing (north is up, east is right).
   * @param {NearbyResponse} data
   */
  #render(data) {
    const blips = byId('radar-blips');
    const radius = data.radius_m || 1;
    const games = data.games || [];
    this.#lastGames = games;

    this.#setStatus(games.length
      ? `${games.length} game${games.length === 1 ? '' : 's'} nearby`
      : 'No games nearby yet');

    // Keep a still-present selection; otherwise clear the card.
    if (this.#selected && !games.some((g) => g.code === this.#selected)) {
      this.#selected = null;
      this.#renderCard(null);
    }

    blips.replaceChildren();
    for (const g of games) {
      // Clamp to the ring so a rounding overshoot can't escape the scope.
      const frac = Math.min(1, g.distance_m / radius);
      const rad = (g.bearing_deg * Math.PI) / 180;
      const x = 50 + Math.sin(rad) * frac * 50;
      const y = 50 - Math.cos(rad) * frac * 50;
      const blip = document.createElement('button');
      blip.type = 'button';
      blip.className = 'radar-blip';
      if (g.code === this.#selected) blip.classList.add('is-selected');
      blip.dataset.code = g.code;
      blip.style.left = `${x}%`;
      blip.style.top = `${y}%`;
      blip.setAttribute('aria-label',
        `${g.host_name}, ${g.player_count} player${g.player_count === 1 ? '' : 's'}, ${g.distance_m} metres away`);
      blip.innerHTML = `<span class="blip-dot"></span><span class="blip-name">${escapeHtml(g.host_name)}</span>`;
      blips.append(blip);
    }
    if (this.#selected) {
      this.#renderCard(games.find((g) => g.code === this.#selected) ?? null);
    }
  }

  /**
   * Select a blip and surface its join card.
   * @param {string | null} code
   */
  #select(code) {
    this.#selected = code;
    for (const b of this.querySelectorAll('.radar-blip')) {
      b.classList.toggle('is-selected', b.getAttribute('data-code') === code);
    }
    const data = this.#lastGames.find((g) => g.code === code) ?? null;
    this.#renderCard(data);
  }

  /**
   * @param {NearbyGame | null} g
   */
  #renderCard(g) {
    const card = byId('nearby-card');
    if (!g) {
      card.hidden = true;
      card.replaceChildren();
      return;
    }
    const plural = g.player_count === 1 ? 'player' : 'players';
    card.innerHTML = `
      <div class="nearby-card-info">
        <span class="nearby-card-host">${escapeHtml(g.host_name)}</span>
        <span class="nearby-card-meta">${g.player_count} ${plural} · ~${g.distance_m} m away</span>
      </div>
      <button type="button" class="btn btn-primary nearby-card-join" data-join="${g.code}">Join</button>`;
    card.hidden = false;
  }

  /** @param {string} text */
  #setStatus(text) {
    /** @type {HTMLElement} */ (this.querySelector('.nearby-status')).textContent = text;
  }

  /** @param {boolean} on */
  #setLocating(on) {
    byId('radar').classList.toggle('is-locating', on);
  }

  /** @param {string} message */
  showError(message) {
    byId('nearby-error').textContent = message;
  }
}

/** Minimal HTML escaping for the host name (server-sanitised, but belt+braces). */
function escapeHtml(/** @type {string} */ s) {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

customElements.define('nearby-screen', NearbyScreen);
