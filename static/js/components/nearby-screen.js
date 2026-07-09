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
const REFRESH_MS = 1500;

/** Fallback avatar for anonymous hosts / a photo that fails to load. */
const DEFAULT_AVATAR = '/static/images/avatar-default.svg';

/** Right-chevron disclosure affordance on each list row (tap the row to join). */
const CHEVRON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

/**
 * Radial spread. Physical gatherings put every game within a small slice of the
 * 500 m radius, so a linear map clusters them all near the centre. A sqrt curve
 * pushes near games outward and a minimum inset keeps them clear of "you", so a
 * roomful of games reads as distinct blips. Bearing stays exact; only the radial
 * *scale* is perceptual (distance is already bucketed, and shown as text).
 */
const MIN_FRAC = 0.18;

/**
 * Build an avatar <img> for a host: their account photo when signed in, else
 * the default silhouette. The error handler (a photo URL that won't load) can't
 * be an inline attribute — CSP blocks inline handlers — so it's attached here.
 * @param {string | null | undefined} photo
 * @param {string} className
 */
function avatarImg(photo, className) {
  const img = document.createElement('img');
  img.className = className;
  img.alt = '';
  img.src = photo || DEFAULT_AVATAR;
  img.addEventListener('error', () => {
    if (img.src !== location.origin + DEFAULT_AVATAR) img.src = DEFAULT_AVATAR;
  }, { once: true });
  return img;
}

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

  /** @type {Map<string, HTMLButtonElement>} code → list row, patched in place
   *  so avatars don't reload on every poll. */
  #rows = new Map();

  /** @type {Map<string, HTMLButtonElement>} code → radar blip, patched in place
   *  for the same reason — a full rebuild every poll flickers. */
  #blips = new Map();

  /** @type {number} bumped each acquisition so a stale fetch can't paint. */
  #token = 0;

  /** @type {boolean} compass alignment active (scope rotates with heading). */
  #compassOn = false;

  /** @type {number} latest heading in degrees clockwise from true north. */
  #heading = 0;

  /** @type {boolean} an orientation → rAF paint is already queued. */
  #rafPending = false;

  /** @type {number} setTimeout id for the compass-off settle-to-north cleanup. */
  #settleTimer = 0;

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
        <h1 id="nearby-title" class="screen-title has-back">Finding Nearby Games</h1>
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
          <button id="compass-btn" type="button" class="compass-btn" aria-pressed="false" aria-label="Align radar to compass" title="Align to compass" hidden>
            <svg class="compass-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.5 L15.5 12 L8.5 12 Z" fill="currentColor"/><path d="M12 21.5 L15.5 12 L8.5 12 Z" fill="currentColor" opacity="0.32"/></svg>
          </button>
        </div>
        <div class="nearby-list" id="nearby-list" role="list" aria-label="Nearby games"></div>
        <p class="nearby-empty" id="nearby-empty" hidden>No games nearby yet — ask a host to check in.</p>
        <p class="error-msg nearby-error" id="nearby-error" role="alert" aria-live="polite"></p>
        <button id="nearby-retry" type="button" class="btn btn-secondary nearby-retry" hidden>Try again</button>
      </div>`;

    byId('nearby-back-btn').addEventListener('click', () => showLanding());
    byId('nearby-retry').addEventListener('click', () => this.enter());
    // Compass alignment is offered only where device orientation could exist;
    // the tap is also the user gesture iOS requires for its permission prompt.
    if ('DeviceOrientationEvent' in window) byId('compass-btn').hidden = false;
    byId('compass-btn').addEventListener('click', () => this.#toggleCompass());
    // Blip taps highlight the matching list row; a row tap highlights its blip;
    // the row's Join button joins. Delegated (rows/blips rebuild across polls).
    byId('radar-blips').addEventListener('click', (e) => {
      const blip = /** @type {HTMLElement} */ (e.target).closest('[data-code]');
      if (blip) this.#select(blip.getAttribute('data-code'), true);
    });
    byId('nearby-list').addEventListener('click', (e) => {
      const row = /** @type {HTMLElement} */ (e.target).closest('[data-code]');
      if (row) joinWithCode(/** @type {string} */ (row.getAttribute('data-code')), 'nearby');
    });
  }

  disconnectedCallback() {
    this.#stopPolling();
    this.#stopCompass();
    this.#cancelSettle(); // in case a settle was mid-flight when we left
  }

  /**
   * Toggle compass alignment. On first enable this triggers the iOS
   * DeviceOrientationEvent.requestPermission() prompt (allowed because we're in
   * the tap handler); other engines start listening directly. When on, the
   * scope + blips rotate so the direction you're facing is at the top.
   */
  async #toggleCompass() {
    if (this.#compassOn) {
      this.#stopCompass(true); // animate the scope back to north
      return;
    }
    this.#cancelSettle(); // a quick re-enable interrupts any in-flight settle
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
    btn.setAttribute('aria-label', 'Turn off compass alignment');
  }

  /**
   * @param {boolean} [animate] Ease the scope back to north (user toggle) vs.
   *   snap instantly (screen teardown — no point animating a leaving view).
   */
  #stopCompass(animate = false) {
    if (!this.#compassOn) return;
    this.#compassOn = false;
    window.removeEventListener('deviceorientationabsolute', this.#onOrient);
    window.removeEventListener('deviceorientation', this.#onOrient);
    const btn = byId('compass-btn');
    btn.classList.remove('is-on');
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Align radar to compass');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animate && !reduced) {
      this.#settleToNorth();
    } else {
      this.#cancelSettle();
      byId('radar').style.removeProperty('--rot');
    }
  }

  /**
   * Ease the scope back to north (--rot → 0) instead of snapping. Normalizes the
   * live angle to the shortest path first so it never spins the long way round,
   * then transitions via the .is-settling class (see nearby.css).
   */
  #settleToNorth() {
    const radar = byId('radar');
    let start = ((-this.#heading % 360) + 360) % 360; // 0..360, visually == -heading
    if (start > 180) start -= 360;                    // -180..180 ⇒ shortest path
    radar.style.setProperty('--rot', `${start}deg`);
    void radar.offsetWidth;                           // commit the start angle first
    radar.classList.add('is-settling');               // enables the transform transition
    radar.style.setProperty('--rot', '0deg');         // …which now animates to north
    // Clear the transition class + var once done (keep in sync with the 0.45s
    // transition in nearby.css). Guarded so a queued cleanup can't touch a
    // torn-down screen.
    this.#settleTimer = window.setTimeout(() => {
      this.#settleTimer = 0;
      if (!this.isConnected) return;
      const r = byId('radar');
      r.classList.remove('is-settling');
      r.style.removeProperty('--rot');
    }, 520);
  }

  /** Abort an in-flight settle (re-enable mid-animation, or teardown). */
  #cancelSettle() {
    if (this.#settleTimer) {
      clearTimeout(this.#settleTimer);
      this.#settleTimer = 0;
    }
    if (this.isConnected) byId('radar').classList.remove('is-settling');
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
      // A frame can still be queued when the compass is switched off; without
      // this guard it re-applies the last heading right after #stopCompass
      // cleared --rot, snapping the scope back off north instead of resetting.
      if (!this.#compassOn) return;
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
    for (const row of this.#rows.values()) row.remove();
    this.#rows.clear();
    for (const blip of this.#blips.values()) blip.remove();
    this.#blips.clear();
    this.showError('');
    byId('nearby-retry').hidden = true;
    this.#setLocating(true);

    const token = ++this.#token;
    try {
      this.#pos = await getPosition();
    } catch (err) {
      if (token !== this.#token) return; // superseded by a newer entry
      this.#setLocating(false);
      const reason = err instanceof GeoError ? err.reason : 'unavailable';
      this.showError(GEO_ERROR_COPY[reason] ?? GEO_ERROR_COPY.unavailable);
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

    // Drop a selection whose game is gone.
    if (this.#selected && !games.some((g) => g.code === this.#selected)) {
      this.#selected = null;
    }

    const present = new Set(games.map((g) => g.code));
    for (const [code, blip] of this.#blips) {
      if (!present.has(code)) { blip.remove(); this.#blips.delete(code); }
    }

    for (const g of games) {
      // Perceptual radial spread: sqrt curve + a minimum inset so nearby games
      // fan out instead of piling on the centre (see MIN_FRAC). Clamped so a
      // rounding overshoot can't escape the scope.
      const raw = Math.min(1, g.distance_m / radius);
      const frac = MIN_FRAC + (1 - MIN_FRAC) * Math.sqrt(raw);
      const rad = (g.bearing_deg * Math.PI) / 180;
      const x = 50 + Math.sin(rad) * frac * 50;
      const y = 50 - Math.cos(rad) * frac * 50;

      let blip = this.#blips.get(g.code);
      if (!blip) {
        blip = document.createElement('button');
        blip.type = 'button';
        blip.className = 'radar-blip';
        blip.dataset.code = g.code;
        // Avatar + labels live in one inner box that counter-rotates as a unit,
        // so the stack stays upright *and* keeps its alignment as the scope turns.
        const inner = document.createElement('span');
        inner.className = 'blip-inner';
        const ring = document.createElement('span');
        ring.className = 'blip-avatar-ring';
        ring.append(avatarImg(g.photo, 'blip-avatar'));
        const name = document.createElement('span');
        name.className = 'blip-name';
        inner.append(ring, name);
        blip.append(inner);
        blips.append(blip);
        this.#blips.set(g.code, blip);
      }
      blip.style.left = `${x}%`;
      blip.style.top = `${y}%`;
      blip.classList.toggle('is-selected', g.code === this.#selected);
      blip.setAttribute('aria-label',
        `${g.host_name}${g.place_name ? ` at ${g.place_name}` : ''}, ${g.player_count} player${g.player_count === 1 ? '' : 's'}, ${g.distance_m} metres away`);
      /** @type {HTMLElement} */ (blip.querySelector('.blip-name')).textContent = g.host_name;
      // Checked-in games also show the place, on a second line under the name.
      const inner = /** @type {HTMLElement} */ (blip.querySelector('.blip-inner'));
      let place = blip.querySelector('.blip-place');
      if (g.place_name) {
        if (!place) {
          place = document.createElement('span');
          place.className = 'blip-place';
          inner.append(place);
        }
        if (place.textContent !== g.place_name) place.textContent = g.place_name;
      } else {
        place?.remove();
      }
    }

    this.#renderList(games);
  }

  /**
   * Build/patch the games list below the radar — one row per game, keyed by
   * code so avatars aren't reloaded every poll. Each row is a join button
   * carrying the host's profile photo, name, player count and distance.
   * @param {NearbyGame[]} games
   */
  #renderList(games) {
    const list = byId('nearby-list');
    byId('nearby-empty').hidden = games.length > 0;

    const present = new Set(games.map((g) => g.code));
    for (const [code, row] of this.#rows) {
      if (!present.has(code)) { row.remove(); this.#rows.delete(code); }
    }

    // Re-appending an unchanged row still moves it (killing hover/active state
    // and forcing a repaint), so only reorder when the order actually changed.
    const currentOrder = Array.from(list.children, (c) => /** @type {HTMLElement} */ (c).dataset.code);
    const orderChanged = games.length !== currentOrder.length
      || games.some((g, i) => g.code !== currentOrder[i]);

    for (const g of games) {
      let row = this.#rows.get(g.code);
      if (!row) {
        // The whole row is the join control (a button), with a chevron
        // affordance — tapping anywhere on it joins the game.
        row = document.createElement('button');
        row.type = 'button';
        row.className = 'nearby-row';
        row.dataset.code = g.code;
        const bg = document.createElement('span');
        bg.className = 'nearby-row-bg';
        row.append(bg);
        const ring = document.createElement('span');
        ring.className = 'nearby-row-avatar-ring';
        ring.append(avatarImg(g.photo, 'nearby-row-avatar'));
        const info = document.createElement('div');
        info.className = 'nearby-row-info';
        info.innerHTML =
          '<span class="nearby-row-host"></span><span class="nearby-row-meta"></span>';
        const chevron = document.createElement('span');
        chevron.className = 'nearby-row-chevron';
        chevron.innerHTML = CHEVRON_SVG;
        row.append(ring, info, chevron);
        this.#rows.set(g.code, row);
      }
      const plural = g.player_count === 1 ? 'player' : 'players';
      const place = g.place_name ? `${g.place_name} · ` : '';
      /** @type {HTMLElement} */ (row.querySelector('.nearby-row-host')).textContent = g.host_name;
      /** @type {HTMLElement} */ (row.querySelector('.nearby-row-meta')).textContent =
        `${place}${g.player_count} ${plural} · ~${g.distance_m} m away`;
      row.setAttribute('aria-label',
        `Join ${g.host_name}'s game${g.place_name ? ` at ${g.place_name}` : ''} — ${g.player_count} ${plural}, ${g.distance_m} metres away`);
      row.classList.toggle('is-selected', g.code === this.#selected);
      // Checked-in rows carry the place's photo as a faded card background.
      // Keyed on the URL so the poll loop never restarts the fade-in.
      const bg = /** @type {HTMLElement} */ (row.querySelector('.nearby-row-bg'));
      const photoUrl = g.place_photo_url || '';
      if (row.dataset.bgUrl !== photoUrl) {
        row.dataset.bgUrl = photoUrl;
        bg.replaceChildren();
        if (photoUrl) {
          const img = document.createElement('img');
          img.className = 'nearby-row-bg-img';
          img.alt = '';
          img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
          bg.append(img);
          img.src = photoUrl;
        }
      }
      if (orderChanged) list.append(row); // re-append in API (nearest-first) order
    }
  }

  /**
   * Cross-highlight a game across the radar + list. When triggered from the
   * radar, scroll its row into view so the two stay connected.
   * @param {string | null} code
   * @param {boolean} fromRadar
   */
  #select(code, fromRadar) {
    this.#selected = code;
    for (const b of this.querySelectorAll('.radar-blip')) {
      b.classList.toggle('is-selected', b.getAttribute('data-code') === code);
    }
    for (const [c, row] of this.#rows) {
      row.classList.toggle('is-selected', c === code);
    }
    if (fromRadar && code) {
      this.#rows.get(code)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
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

customElements.define('nearby-screen', NearbyScreen);
