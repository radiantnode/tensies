// @ts-check
import './app-header.js';
import { attachAvatarFallback, avatarSrc } from '../avatars.js';
import { getAuthUser } from '../auth.js';
import { playCode } from '../audio-share.js';
import { BACK_BUTTON_HTML } from '../back-button.js';
import { byId } from '../dom.js';
import { EQ_ICON_HTML } from '../eq-icon.js';
import { GeoError, GEO_ERROR_COPY, getPosition } from '../geo.js';
import { checkIn, leaveGame, startGame, stopBroadcast } from '../net.js';
import { updateScrollFades } from '../scroll-fades.js';
import { SheetController } from '../sheet.js';
import { state } from '../state.js';

/** @typedef {import('../types.js').GameSnapshot} GameSnapshot */

/** Right-pointing chevron for a places-sheet row. */
const PLACES_CHEVRON = '<svg class="places-row-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
/** Map-pin used as the thumbnail placeholder when a place has no photo. */
const PLACES_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.6" fill="currentColor" stroke="none"/></svg>';

/** How many place rows fetch their Google photo eagerly. Beyond this the photo
 *  loads only as the row scrolls into view (IntersectionObserver below). Native
 *  `loading="lazy"` is too weak here — the whole ~20-row list sits inside the
 *  browser's preload distance, so it would fetch every photo on open. This caps
 *  a sheet/search open to ~N billed Place Photo calls instead of up to 20. */
const PLACES_PHOTO_EAGER_N = 6;

/** Nearby-places cache is refetched on sheet-open once it's older than this… */
const PLACES_STALE_MS = 90_000;
/** …or once the host has moved more than this many metres since it was cached. */
const PLACES_STALE_METERS = 75;

/** Great-circle distance in metres between two {lat, lon} points (haversine). */
function metersBetween(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const joinLink = () => `${location.origin}/${state.gameCode}`;

/**
 * <lobby-screen> — the waiting room. Light DOM: the host element *is*
 * `#lobby.screen`. State-driven: `render(snap)` is called by router.showFor
 * on each pre-start `state` frame. Player rows are keyed by pid so
 * joins/leaves patch in place without resetting scroll position.
 */
export class LobbyScreen extends HTMLElement {
  /** @type {Map<string, HTMLLIElement>} pid → row */
  #rows = new Map();

  /** @type {HTMLElement | null} */
  #list = null;

  /** @type {boolean} whether the local player hosts (drives the solo-hint). */
  #isHost = false;

  /** @type {boolean} last-applied emptiness, so the section only fades on change. */
  #sectionEmpty = true;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #sectionHideTimer;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #copyResetTimer;

  /** @type {Array<{place_id: string, name: string, address: string}> | null}
   *  Nearby places, fetched once so the check-in prompt can name them and the
   *  sheet opens instantly. Null until the first successful lookup. */
  #placesCache = null;

  /** @type {number} ms timestamp the cache was last filled, for staleness. */
  #placesCacheAt = 0;

  /** @type {boolean} guard so movement bursts don't fire overlapping refetches. */
  #reloadInFlight = false;

  /** @type {{lat: number, lon: number} | null} last GPS fix — reused to bias the
   *  places search without re-prompting. */
  #lastPos = null;

  /** @type {ReturnType<typeof setTimeout> | undefined} search debounce timer. */
  #searchTimer;

  /** Monotonic id so a slow response for an old query can't overwrite a newer
   *  render (out-of-order search results). */
  #searchSeq = 0;

  /** @type {IntersectionObserver | null} Loads place photos past the eager cap
   *  as their rows scroll into view. Rebuilt each render, torn down on unmount. */
  #photoObserver = null;

  #onResize = () => this.#updateFades();

  /** Shared bottom-sheet controller for the places picker (keyboard-aware). */
  /** @type {import('../sheet.js').SheetController | null} */
  #sheet = null;

  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'lobby';
    this.className = 'screen lobby-screen';
    this.setAttribute('aria-labelledby', 'lobby-title');
    this.innerHTML = `
      <app-header></app-header>
      <div class="screen-body lobby-body">
        <button id="lobby-back-btn" type="button" class="btn-back">${BACK_BUTTON_HTML}</button>
        <h1 id="lobby-title" class="screen-title has-back lobby-title">Waiting for Players</h1>
        <lobby-stamp></lobby-stamp>
        <div class="or-divider" aria-hidden="true"><span>or</span></div>
        <div class="lobby-actions">
          <div class="lobby-action-item">
            <button id="copy-link-btn" type="button" class="lobby-action" aria-label="Copy invite link">
              <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 15l6-6"/>
                <path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1"/>
                <path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1"/>
              </svg>
            </button>
            <span id="copy-link-label" class="lobby-action-label">Copy Link</span>
          </div>
          <div class="lobby-action-item">
            <button id="share-btn" type="button" class="lobby-action" aria-label="Share invite link">
              <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
              </svg>
            </button>
            <span class="lobby-action-label">Share</span>
          </div>
          <div class="lobby-action-item">
            <button id="play-code-btn" type="button" class="lobby-action btn-play-code btn-audio" aria-label="Play the code as a sound">
              ${EQ_ICON_HTML}
            </button>
            <span class="lobby-action-label">Play</span>
          </div>
          <div id="checkin-item" class="lobby-action-item" hidden>
            <button id="checkin-btn" type="button" class="lobby-action btn-checkin" aria-label="Check in to a nearby place">
              <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.6" fill="currentColor" stroke="none"/></svg>
            </button>
            <span id="checkin-label" class="lobby-action-label">Check In</span>
          </div>
        </div>
        <dialog id="places-sheet" class="sheet" aria-label="Check in to a place">
          <div class="sheet-head">
            <h2 class="sheet-title">Check in to a place</h2>
            <button id="places-close" type="button" class="sheet-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          </div>
          <input id="places-search" class="places-search" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="Search for a place" aria-label="Search for a place">
          <p id="places-status" class="places-status">Finding places near you…</p>
          <ul id="places-list" class="places-list" aria-label="Nearby places"></ul>
        </dialog>
        <dialog id="checkout-confirm" class="confirm-dialog" aria-labelledby="checkout-title">
          <h2 id="checkout-title" class="confirm-title">Checked in at <span id="checkout-place-name"></span></h2>
          <p class="confirm-body">Check out to remove your game from Nearby, or pick a different place.</p>
          <div class="confirm-actions confirm-actions-stack">
            <button id="checkout-change" type="button" class="btn btn-secondary">Pick a different place</button>
            <button id="checkout-ok" type="button" class="btn btn-primary">Check out</button>
            <button id="checkout-cancel" type="button" class="btn btn-secondary">Cancel</button>
          </div>
        </dialog>
        <section class="lobby-players-section" aria-labelledby="players-label">
          <h2 id="players-label" class="section-label">Fellow Bar Rats</h2>
          <ul class="player-list" id="lobby-players" aria-label="Players"></ul>
        </section>
        <p id="lobby-solo-hint" class="lobby-solo-hint" hidden>Invite friends or play solo!</p>
        <button id="start-btn" type="button" class="btn btn-primary btn-block" hidden>Start Game</button>
      </div>`;

    this.#list = byId('lobby-players');
    this.#list.addEventListener('scroll', () => this.#updateFades(), { passive: true });
    window.addEventListener('resize', this.#onResize);

    byId('lobby-back-btn').addEventListener('click', () => leaveGame());
    byId('copy-link-btn').addEventListener('click', () => this.#copyJoinLink());
    byId('share-btn').addEventListener('click', () => this.#share());
    byId('play-code-btn').addEventListener('click', () => this.#playCode());
    byId('start-btn').addEventListener('click', () => startGame());
    byId('checkin-btn').addEventListener('click', () => this.#onCheckinButton());
    byId('places-search').addEventListener('input', () => this.#onSearchInput());
    byId('places-list').addEventListener('scroll',
      () => updateScrollFades(byId('places-list')), { passive: true });
    byId('places-close').addEventListener('click', () => this.#closePlaces());
    // Shared bottom-sheet behaviour (open/close/Escape/backdrop + keyboard
    // docking, with a pinned height so the results list fills the space).
    this.#sheet = new SheetController(/** @type {HTMLDialogElement} */ (byId('places-sheet')), {
      pinHeight: true,
    });
    byId('places-list').addEventListener('click', (e) => {
      const row = /** @type {HTMLElement} */ (e.target).closest('[data-place]');
      if (!row) return;
      // Any row checks in to that place (re-selecting the current one is a
      // harmless no-op; the server overwrites the place).
      checkIn(/** @type {string} */ (row.getAttribute('data-place')));
      this.#closePlaces();
    });
    byId('checkout-cancel').addEventListener('click', () => this.#closeCheckoutConfirm());
    byId('checkout-change').addEventListener('click', () => {
      this.#closeCheckoutConfirm();
      this.#openPlaces(); // switch venues — a new check-in overwrites the place
    });
    byId('checkout-ok').addEventListener('click', () => {
      this.#closeCheckoutConfirm();
      stopBroadcast(); // check out = leave the radar entirely (clears the place)
    });
  }

  /** Ask before checking out — a stray tap on the pinned row shouldn't
   *  silently drop the game's place. */
  #openCheckoutConfirm() {
    byId('checkout-place-name').textContent =
      state.currentState?.place_name || 'this place';
    const dlg = /** @type {HTMLDialogElement} */ (byId('checkout-confirm'));
    dlg.showModal();
    // Focus the dialog itself (not the first button) so no action control shows
    // an auto-focus ring on open — WebKit paints :focus-visible on showModal's
    // auto-focus. Keyboard users still Tab into the buttons and get a ring there.
    dlg.tabIndex = -1;
    dlg.focus();
  }

  #closeCheckoutConfirm() {
    /** @type {HTMLDialogElement} */ (byId('checkout-confirm')).close();
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.#onResize);
    this.#sheet?.destroy();
    this.#photoObserver?.disconnect();
  }

  /**
   * The single Check In / Check Out button. Not checked in → open the places
   * list (which prompts for location permission if needed, then loads). Checked
   * in → the check-out confirm (check out or pick a different place).
   */
  #onCheckinButton() {
    if (state.currentState?.place_name) this.#openCheckoutConfirm();
    else this.#openPlaces();
  }

  /**
   * Render the roster + host controls from a pre-start snapshot.
   * @param {GameSnapshot} snap
   */
  render(snap) {
    // Sync the username pill in the header.
    const header = this.querySelector('app-header');
    if (header) {
      const existing = header.querySelector('.header-username');
      const user = getAuthUser();
      if (user && !existing) {
        const tag = document.createElement('a');
        tag.className = 'header-username';
        tag.textContent = `@${user.username}`;
        tag.href = `/@${user.username}`;
        const btn = header.querySelector('.game-menu-btn');
        btn?.parentElement?.insertBefore(tag, btn);
      } else if (!user && existing) {
        existing.remove();
      }
    }

    state.gameCode = snap.code;
    // Fill the stamp's serial, QR, and date from the join code.
    /** @type {any} */ (this.querySelector('lobby-stamp'))?.update(snap.code);

    const list = this.#list;
    if (!list) return;
    // "Fellow Bar Rats" is everyone *but* you — listing yourself is redundant.
    const others = Object.entries(snap.players).filter(([pid]) => pid !== state.myId);
    for (const [pid, player] of others) {
      let row = this.#rows.get(pid);
      if (!row) {
        // A const the closure below can capture without losing its non-null
        // narrowing (the outer `let row` widens back to | undefined in a closure).
        const el = document.createElement('li');
        el.className = 'player-list-item';
        // Built once; name/avatar/badge are patched in place below so a
        // roster change doesn't reload avatars or reset the row.
        el.innerHTML =
          '<span class="lobby-avatar-ring"><img class="lobby-avatar" alt=""></span>' +
          '<span class="lobby-player-name"></span>';
        // Wire the broken-photo fallback once (the img is patched, not rebuilt).
        attachAvatarFallback(/** @type {HTMLImageElement} */ (el.querySelector('.lobby-avatar')));
        // Fade+slide the row in as the player joins. One-shot: added only on
        // creation (keyed rows are built once) and cleared when it finishes, so
        // re-renders never replay it.
        el.classList.add('player-enter');
        el.addEventListener('animationend', () => el.classList.remove('player-enter'), { once: true });
        this.#rows.set(pid, el);
        row = el;
      }
      // Only (re)insert when the row isn't already in its slot. Re-appending a
      // node restarts its player-enter animation, so a second snapshot arriving
      // mid-entrance (every join triggers a render) would kill the fade-in.
      const slot = others.findIndex(([p]) => p === pid);
      if (list.children[slot] !== row) list.insertBefore(row, list.children[slot] ?? null);
      const img = /** @type {HTMLImageElement} */ (row.querySelector('.lobby-avatar'));
      const src = avatarSrc(player.photo);
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      /** @type {HTMLElement} */ (row.querySelector('.lobby-player-name')).textContent = player.name;
      const badge = row.querySelector('.host-badge');
      if (pid === snap.host && !badge) row.appendChild(this.#badge('host-badge', 'HOST'));
      else if (pid !== snap.host && badge) badge.remove();
    }
    const shown = new Set(others.map(([pid]) => pid));
    for (const [pid, row] of this.#rows) {
      if (!shown.has(pid)) {
        // Drop from the registry now so a rejoin builds a fresh (re-animating)
        // row, but collapse+fade the DOM node out before removing it. Re-sync the
        // empty state once it's gone so the last leaver's row can finish
        // animating before the section is hidden.
        this.#rows.delete(pid);
        this.#collapseAndRemove(row, () => this.#syncEmptyState());
      }
    }
    const isHost = snap.host === state.myId;
    this.#isHost = isHost;
    // Hide the section / show the solo hint based on the live DOM, so a row still
    // collapsing out keeps the section visible until its exit animation ends.
    this.#syncEmptyState();

    byId('lobby-title').textContent = isHost
      ? 'Waiting for Players'
      : 'Waiting for host to start';
    const startBtn = byId('start-btn');
    startBtn.hidden = !isHost;
    this.#syncCheckinButton(snap.place_name ?? null, isHost);
    requestAnimationFrame(() => this.#updateFades());
  }

  /**
   * Reflect the checked-in state on the host's single Check In / Check Out
   * button. Host-only; driven purely by the snapshot (never optimistically).
   * Checking in to a place IS being discoverable, so there's no separate toggle
   * or prompt — the button opens the places list, and once checked in it flips
   * to "Check Out" (lit).
   * @param {string | null} placeName
   * @param {boolean} isHost
   */
  #syncCheckinButton(placeName, isHost) {
    byId('checkin-item').hidden = !isHost;
    if (!isHost) return;
    const on = !!placeName;
    const btn = byId('checkin-btn');
    btn.classList.toggle('is-on', on);
    byId('checkin-label').textContent = on ? 'Check Out' : 'Check In';
    btn.setAttribute('aria-label', on
      ? `Checked in at ${placeName} — tap to check out or change place`
      : 'Check in to a nearby place');
  }

  /** Force the results list back to the top after a render. Set now and again
   *  next frame — an iOS momentum-scrolled list can otherwise keep the prior
   *  offset until layout settles, so a single synchronous reset doesn't stick. */
  #resetPlacesScroll() {
    const el = byId('places-list');
    el.scrollTop = 0;
    requestAnimationFrame(() => { el.scrollTop = 0; updateScrollFades(el); });
  }

  /** Close the places picker sheet, sliding it back down before it goes. */
  #closePlaces() {
    this.#sheet?.close();
  }

  /**
   * Host-only: open the places picker. Prompts for GPS, fetches nearby places,
   * and lists them; tapping one sends a check-in (server resolves the place).
   * Shows a "Check out" action when already checked in.
   */
  async #openPlaces() {
    const list = byId('places-list');
    const status = byId('places-status');
    list.replaceChildren();
    status.classList.remove('is-error');
    // Reset the search each open — the sheet always starts on the nearby list.
    clearTimeout(this.#searchTimer);
    this.#searchSeq++;
    /** @type {HTMLInputElement} */ (byId('places-search')).value = '';
    this.#sheet?.open();
    // The background prefetch usually has the list already — open straight to it,
    // then quietly refresh if the fix has gone stale or the host has moved.
    if (this.#placesCache && this.#placesCache.length) {
      this.#renderPlaces(this.#placesCache);
      this.#resetPlacesScroll();
      this.#refreshPlacesIfStale();
      return;
    }
    status.hidden = false;
    status.textContent = 'Finding places near you…';
    try {
      const { lat, lon } = await getPosition();
      this.#lastPos = { lat, lon };
      const res = await fetch(`/api/places/nearby?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error(`places ${res.status}`);
      const data = await res.json();
      const places = data.places || [];
      this.#placesCache = places;
      this.#placesCacheAt = Date.now();
      this.#renderPlaces(places);
      this.#resetPlacesScroll();
    } catch (err) {
      const reason = err instanceof GeoError ? err.reason : 'unavailable';
      status.textContent = err instanceof GeoError
        ? (GEO_ERROR_COPY[reason] ?? GEO_ERROR_COPY.unavailable)
        : 'Couldn’t load nearby places.';
      status.classList.add('is-error');
    }
  }

  /**
   * Quietly refresh the nearby list when the cached fix is stale or the host has
   * moved (a cache-open still renders instantly first). Never prompts for
   * permission in the background, and only swaps the list in if the sheet is
   * still open on the nearby list — so it can't clobber a closed sheet or a
   * search the user has started typing.
   */
  async #refreshPlacesIfStale() {
    try {
      const perm = navigator.permissions
        && await navigator.permissions.query({ name: /** @type {PermissionName} */ ('geolocation') });
      if (perm && perm.state !== 'granted') return;
      const { lat, lon } = await getPosition();
      const moved = this.#lastPos ? metersBetween(this.#lastPos, { lat, lon }) : Infinity;
      const age = Date.now() - this.#placesCacheAt;
      if (moved < PLACES_STALE_METERS && age < PLACES_STALE_MS) return; // still fresh
      await this.#reloadPlacesFrom(lat, lon);
    } catch {
      // Best-effort — keep showing the cached list on any failure.
    }
  }

  /**
   * Refetch nearby places for a position and fan the result out: update the
   * cache + last fix, re-render the sheet if it's open on the nearby list, and
   * re-name the check-in prompt (same host + not-checked-in guard as the
   * prefetch) so the sheet and the label never drift apart. An in-flight guard
   * keeps a burst of watch callbacks from stacking refetches.
   * @param {number} lat @param {number} lon
   */
  async #reloadPlacesFrom(lat, lon) {
    if (this.#reloadInFlight) return;
    this.#reloadInFlight = true;
    try {
      const res = await fetch(`/api/places/nearby?lat=${lat}&lon=${lon}`);
      if (!res.ok) return;
      const data = await res.json();
      this.#placesCache = data.places || [];
      this.#lastPos = { lat, lon };
      this.#placesCacheAt = Date.now();
      const sheet = /** @type {HTMLDialogElement} */ (byId('places-sheet'));
      const search = /** @type {HTMLInputElement} */ (byId('places-search'));
      if (sheet.open && !search.value.trim()) this.#renderPlaces(this.#placesCache);
    } finally {
      this.#reloadInFlight = false;
    }
  }

  /**
   * Debounced search-box handler. Empty (or a single char) restores the nearby
   * list; otherwise a text search fires ~300 ms after the last keystroke.
   */
  #onSearchInput() {
    clearTimeout(this.#searchTimer);
    const q = /** @type {HTMLInputElement} */ (byId('places-search')).value.trim();
    if (q.length < 2) {
      this.#searchSeq++; // cancel any in-flight search
      this.#renderPlaces(this.#placesCache || []);
      return;
    }
    this.#searchTimer = setTimeout(() => this.#searchPlaces(q), 300);
  }

  /**
   * Free-text place search, biased to the last known fix. A per-call sequence id
   * drops stale (out-of-order) responses so the list always matches the newest
   * query.
   * @param {string} q
   */
  async #searchPlaces(q) {
    const seq = ++this.#searchSeq;
    const status = byId('places-status');
    if (!this.#lastPos) {
      status.hidden = false;
      status.textContent = 'Turn on location to search.';
      status.classList.add('is-error');
      return;
    }
    byId('places-list').replaceChildren();
    status.hidden = false;
    status.classList.remove('is-error');
    status.textContent = 'Searching…';
    try {
      const { lat, lon } = this.#lastPos;
      const params = new URLSearchParams({ q, lat: String(lat), lon: String(lon) });
      const res = await fetch(`/api/places/search?${params}`);
      if (!res.ok) throw new Error(`search ${res.status}`);
      const data = await res.json();
      if (seq !== this.#searchSeq) return; // superseded by a newer query
      this.#renderPlaces(data.places || []);
    } catch {
      if (seq !== this.#searchSeq) return;
      status.hidden = false;
      status.textContent = 'Couldn’t search places.';
      status.classList.add('is-error');
    }
  }

  /**
   * @param {Array<{place_id: string, name: string, address: string, photo_url?: string | null}>} list
   */
  #renderPlaces(list) {
    const status = byId('places-status');
    const listEl = byId('places-list');
    // A plain nearest-first list — no checked-in state here; picking a row (re)
    // checks in to it, so the current place isn't singled out.
    // Rebuild the deferred-photo observer from scratch each render (search
    // re-renders replace the whole list), and never leak one on the empty path.
    this.#photoObserver?.disconnect();
    this.#photoObserver = null;
    if (!list.length) {
      status.hidden = false;
      status.classList.remove('is-error');
      status.textContent = 'No places found.';
      return;
    }
    status.hidden = true;
    listEl.replaceChildren();
    // Photos past the eager cap load only when their row nears the viewport, so
    // opening the sheet costs ~PLACES_PHOTO_EAGER_N billed Place Photo calls
    // rather than one per result. rootMargin pre-loads a touch before visible.
    const observer = new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const img = /** @type {HTMLImageElement} */ (e.target);
        if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
        obs.unobserve(img);
      }
    }, { root: listEl, rootMargin: '200px 0px' });
    this.#photoObserver = observer;
    for (const [i, p] of list.entries()) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'places-row';
      btn.dataset.place = p.place_id;
      // Every row checks in to its place; the join-chevron is the affordance.
      btn.innerHTML =
        '<span class="places-row-body">' +
          '<span class="places-row-name"></span>' +
          '<span class="places-row-addr"></span>' +
        '</span>' + PLACES_CHEVRON;
      // Photo thumbnail (Google Places image proxied through our server), or a
      // pin placeholder. src is set as a property, never interpolated into HTML.
      const thumb = document.createElement(p.photo_url ? 'img' : 'span');
      thumb.className = p.photo_url ? 'places-row-photo' : 'places-row-photo is-empty';
      if (p.photo_url) {
        const img = /** @type {HTMLImageElement} */ (thumb);
        img.alt = '';
        if (i < PLACES_PHOTO_EAGER_N) {
          img.src = p.photo_url;          // eager: the first N always load
        } else {
          img.loading = 'lazy';
          img.dataset.src = p.photo_url;  // deferred: loads when scrolled near view
          observer.observe(img);
        }
      } else {
        thumb.innerHTML = PLACES_PIN;
      }
      btn.prepend(thumb);
      /** @type {HTMLElement} */ (btn.querySelector('.places-row-name')).textContent = p.name;
      /** @type {HTMLElement} */ (btn.querySelector('.places-row-addr')).textContent = p.address || '';
      li.append(btn);
      listEl.append(li);
    }
    // Seed the edge fades for the freshly-built list (bottom fade on if it
    // overflows); the scroll listener keeps them in sync thereafter.
    updateScrollFades(listEl);
  }

  /**
   * Collapse a leaving player's row to zero height while fading it out, then
   * drop it from the DOM. Height can't transition from `auto`, so pin the
   * measured height first, then animate to 0. The negative bottom margin eats
   * the flex `gap` the collapsing row would otherwise keep reserving.
   * @param {HTMLElement} row
   * @param {() => void} [onDone] run after the row leaves the DOM
   */
  #collapseAndRemove(row, onDone) {
    const start = row.offsetHeight;
    row.style.blockSize = `${start}px`;
    void row.offsetHeight; // force reflow so the transition has a from-value
    row.classList.add('player-leave');
    row.style.blockSize = '0';
    row.style.opacity = '0';
    row.style.paddingBlock = '0';
    row.style.marginBlockEnd = '-0.5rem';
    let done = false;
    const finish = () => { if (done) return; done = true; row.remove(); onDone?.(); };
    row.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'block-size') finish();
    }, { once: true });
    // Fallback if transitionend never fires (e.g. reduced-motion collapses the
    // duration so the event may be skipped).
    setTimeout(finish, 400);
  }

  /**
   * Hide the players section (and reveal the solo-host hint) only once no row
   * remains in the DOM. Keying off the live child count — not the roster length
   * — keeps the section visible while the last leaver's row collapses out, so
   * its exit animation isn't cut short by an instant display:none.
   */
  #syncEmptyState() {
    const empty = !this.#list || this.#list.childElementCount === 0;
    const section = /** @type {HTMLElement | null} */ (this.querySelector('.lobby-players-section'));
    const hint = byId('lobby-solo-hint');
    if (!section) return;
    if (empty !== this.#sectionEmpty) {
      this.#sectionEmpty = empty;
      clearTimeout(this.#sectionHideTimer);
      if (empty) {
        // Fade the whole section out (label + last collapsing row), then remove
        // it from layout — rather than snapping it away with display:none. The
        // solo hint waits until the fade finishes so the two don't overlap.
        hint.hidden = true;
        section.classList.add('is-hiding');
        const reveal = () => {
          if (!this.#sectionEmpty) return; // someone rejoined mid-fade
          section.hidden = true;
          hint.hidden = !this.#isHost;
        };
        const onEnd = (/** @type {TransitionEvent} */ e) => {
          if (e.propertyName !== 'opacity') return;
          section.removeEventListener('transitionend', onEnd);
          reveal();
        };
        section.addEventListener('transitionend', onEnd);
        this.#sectionHideTimer = setTimeout(reveal, 400);
      } else {
        // First player: reveal and fade in, mirroring the row's entrance.
        hint.hidden = true;
        section.hidden = false;
        section.classList.add('is-hiding'); // start transparent…
        void section.offsetHeight;          // …reflow, then transition to opaque
        section.classList.remove('is-hiding');
      }
    } else if (empty) {
      // Steady empty state (e.g. initial solo host): no fade, just settled.
      section.hidden = true;
      hint.hidden = !this.#isHost;
    } else {
      hint.hidden = true; // steady non-empty
    }
  }

  /**
   * @param {string} className
   * @param {string} label
   */
  #badge(className, label) {
    const badge = document.createElement('span');
    badge.className = className;
    badge.textContent = label;
    return badge;
  }

  #updateFades() {
    if (this.#list) updateScrollFades(this.#list);
  }

  #copyJoinLink() {
    const code = state.gameCode;
    if (!code) return;
    navigator.clipboard.writeText(joinLink()).then(() => {
      const label = byId('copy-link-label');
      label.textContent = 'Copied!';
      label.classList.add('copied');
      clearTimeout(this.#copyResetTimer);
      this.#copyResetTimer = setTimeout(() => {
        label.textContent = 'Copy Link';
        label.classList.remove('copied');
      }, 2000);
    });
  }

  /**
   * Open the OS share sheet (AirDrop, Messages, WhatsApp, Copy, …) via the
   * Web Share API. The sheet already contains Messages, so it supersedes the
   * old SMS button; `#composeSms` stays as the fallback for browsers without
   * `navigator.share` (mostly desktop). A user-dismissed sheet rejects with
   * `AbortError` — that's a normal cancel, so it's swallowed silently.
   *
   * Only `title` + `url` are shared, deliberately no `text`: on iOS, passing
   * `text` alongside `url` makes the share sheet show plain text and drop the
   * rich link card (with the Tensies icon from the page's og:image). The dice
   * emoji moves into the SMS fallback body instead.
   */
  async #share() {
    if (!state.gameCode) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Tensies',
          url: joinLink(),
        });
      } catch {
        // Cancelled or share target failed — nothing to recover.
      }
      return;
    }
    this.#composeSms();
  }

  /**
   * Chirp the game code through the speaker so a nearby phone on the join
   * screen can pick it up with its mic ("Listen"). Experimental.
   */
  async #playCode() {
    if (!state.gameCode) return;
    const btn = /** @type {HTMLButtonElement} */ (byId('play-code-btn'));
    if (btn.classList.contains('playing')) return; // already chirping
    btn.classList.add('playing');
    try {
      await playCode(state.gameCode);
    } catch {
      // Unsupported or interrupted — nothing to recover, just restore the button.
    } finally {
      btn.classList.remove('playing');
    }
  }

  #composeSms() {
    if (!state.gameCode) return;
    const body = encodeURIComponent(`🎲 Come play Tensies! ${joinLink()}`);
    location.href = `sms:?&body=${body}`;
  }
}

customElements.define('lobby-screen', LobbyScreen);
