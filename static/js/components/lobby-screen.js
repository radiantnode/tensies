// @ts-check
import './app-header.js';
import { getAuthUser } from '../auth.js';
import { playCode } from '../audio-share.js';
import { BACK_BUTTON_HTML } from '../back-button.js';
import { byId } from '../dom.js';
import { EQ_ICON_HTML } from '../eq-icon.js';
import { GeoError, GEO_ERROR_COPY, getPosition } from '../geo.js';
import { broadcastNearby, checkIn, checkOut, leaveGame, startGame, stopBroadcast } from '../net.js';
import { updateScrollFades } from '../scroll-fades.js';
import { clearNearbyConsent, hasNearbyConsent, saveNearbyConsent } from '../session.js';
import { state } from '../state.js';

/** @typedef {import('../types.js').GameSnapshot} GameSnapshot */

/** Copy hint HTML under the code, showing the shareable link (URL bold), e.g.
 *  "Click to copy — <b>tensies.app/ABCDE</b>" (host reflects the current origin).
 *  Safe to inject: host is the browser origin, code is a sanitised 5-letter code.
 *  @param {string} code */
const copyHint = (code) => `Click to copy — <span class="copy-hint-url">${location.host}/${code}</span>`;

/** Fallback avatar for anonymous players (no account photo). */
const DEFAULT_AVATAR = '/static/images/avatar-default.svg';

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

  /** @type {boolean} guard so the background prefetch fires at most once. */
  #prefetchTried = false;

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
        <h1 id="lobby-title" class="lobby-title">Waiting for players…</h1>
        <button id="lobby-code" type="button" class="code-display" aria-label="Copy invite link">——</button>
        <p class="copy-hint" id="copy-hint">Click to copy</p>
        <div class="or-divider" aria-hidden="true"><span>or</span></div>
        <div class="lobby-actions">
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
          <div id="broadcast-item" class="lobby-action-item" hidden>
            <button id="broadcast-btn" type="button" class="lobby-action btn-broadcast" aria-pressed="false" aria-label="Allow nearby players to see and join your game">
              <span class="broadcast-wave" aria-hidden="true"><span></span><span></span><span></span></span>
            </button>
            <span class="lobby-action-label">Nearby</span>
          </div>
        </div>
        <p id="discovery-status" class="discovery-status" role="status" aria-live="polite" hidden></p>
        <button id="checkin-prompt" type="button" class="checkin-prompt" aria-pressed="false" hidden>
          <svg class="checkin-prompt-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.6" fill="currentColor" stroke="none"/></svg>
          <span id="checkin-prompt-text" class="checkin-prompt-text">Check in to a place</span>
          <span id="checkin-prompt-more" class="checkin-prompt-more" hidden></span>
          <svg class="checkin-prompt-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
        </button>
        <dialog id="places-sheet" class="places-sheet" aria-label="Check in to a place">
          <div class="places-sheet-head">
            <h2 class="places-sheet-title">Check in to a place</h2>
            <button id="places-close" type="button" class="places-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          </div>
          <input id="places-search" class="places-search" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="Search for a place" aria-label="Search for a place">
          <p id="places-status" class="places-status">Finding places near you…</p>
          <ul id="places-list" class="places-list" aria-label="Nearby places"></ul>
        </dialog>
        <dialog id="allow-nearby-confirm" class="confirm-dialog" aria-labelledby="allow-nearby-title">
          <h2 id="allow-nearby-title" class="confirm-title">Allow nearby players?</h2>
          <p class="confirm-body">Nearby players will be able to see and join this game using your location.</p>
          <p class="confirm-note">Your exact location is never stored — others only see your rough distance and direction. Your device may ask for additional permissions.</p>
          <div class="confirm-actions">
            <button id="allow-nearby-cancel" type="button" class="btn btn-secondary">Cancel</button>
            <button id="allow-nearby-ok" type="button" class="btn btn-primary">Allow</button>
          </div>
        </dialog>
        <dialog id="checkout-confirm" class="confirm-dialog" aria-labelledby="checkout-title">
          <h2 id="checkout-title" class="confirm-title">Check out?</h2>
          <p class="confirm-body">Your game will no longer show as being at <span id="checkout-place-name"></span>.</p>
          <div class="confirm-actions">
            <button id="checkout-cancel" type="button" class="btn btn-secondary">Cancel</button>
            <button id="checkout-ok" type="button" class="btn btn-primary">Check out</button>
          </div>
        </dialog>
        <dialog id="stop-nearby-confirm" class="confirm-dialog" aria-labelledby="stop-nearby-title">
          <h2 id="stop-nearby-title" class="confirm-title">Turn off Nearby?</h2>
          <p class="confirm-body">Nearby players will no longer see or join this game, and your check-in at <span id="stop-nearby-place-name"></span> will end.</p>
          <div class="confirm-actions">
            <button id="stop-nearby-cancel" type="button" class="btn btn-secondary">Cancel</button>
            <button id="stop-nearby-ok" type="button" class="btn btn-primary">Turn off</button>
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
    byId('lobby-code').addEventListener('click', () => this.#copyJoinLink());
    byId('share-btn').addEventListener('click', () => this.#share());
    byId('play-code-btn').addEventListener('click', () => this.#playCode());
    byId('start-btn').addEventListener('click', () => startGame());
    byId('broadcast-btn').addEventListener('click', () => this.#toggleBroadcast());
    byId('allow-nearby-cancel').addEventListener('click', () => this.#closeAllowConfirm());
    byId('allow-nearby-ok').addEventListener('click', () => {
      this.#closeAllowConfirm();
      this.#startBroadcast(); // now run the browser geolocation permission flow
    });
    byId('checkin-prompt').addEventListener('click', () => this.#openPlaces());
    byId('places-search').addEventListener('input', () => this.#onSearchInput());
    byId('places-close').addEventListener('click', () => this.#closePlaces());
    byId('places-list').addEventListener('click', (e) => {
      const row = /** @type {HTMLElement} */ (e.target).closest('[data-place]');
      if (!row) return;
      // The current place's row checks OUT (after a confirm) — every other
      // row checks in.
      if (row.classList.contains('is-current')) {
        this.#openCheckoutConfirm();
        return;
      }
      checkIn(/** @type {string} */ (row.getAttribute('data-place')));
      this.#closePlaces();
    });
    byId('checkout-cancel').addEventListener('click', () => this.#closeCheckoutConfirm());
    byId('checkout-ok').addEventListener('click', () => {
      this.#closeCheckoutConfirm();
      this.#closePlaces();
      checkOut();
    });
    byId('stop-nearby-cancel').addEventListener('click', () => this.#closeStopNearbyConfirm());
    byId('stop-nearby-ok').addEventListener('click', () => {
      this.#closeStopNearbyConfirm();
      stopBroadcast();
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

  /** Ask before turning Nearby off while checked in — stopping the broadcast
   *  also ends the check-in, so it's worth an explicit yes (mirrors checkout). */
  #openStopNearbyConfirm() {
    byId('stop-nearby-place-name').textContent =
      state.currentState?.place_name || 'this place';
    const dlg = /** @type {HTMLDialogElement} */ (byId('stop-nearby-confirm'));
    dlg.showModal();
    // Focus the dialog, not the first button — see #openCheckoutConfirm.
    dlg.tabIndex = -1;
    dlg.focus();
  }

  #closeStopNearbyConfirm() {
    /** @type {HTMLDialogElement} */ (byId('stop-nearby-confirm')).close();
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.#onResize);
    this.#photoObserver?.disconnect();
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
    byId('lobby-code').textContent = snap.code;
    // Show the shareable link; don't clobber the transient "link copied!".
    const copyHintEl = byId('copy-hint');
    if (!copyHintEl.classList.contains('copied')) copyHintEl.innerHTML = copyHint(snap.code);

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
      const src = player.photo || DEFAULT_AVATAR;
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
      ? 'Waiting for players…'
      : 'Waiting for host to start…';
    const startBtn = byId('start-btn');
    startBtn.hidden = !isHost;
    this.#syncBroadcast(!!snap.broadcasting, isHost);
    // Check-in is a refinement of Share Location — only offered while it's on.
    this.#syncCheckin(snap.place_name ?? null, isHost, !!snap.broadcasting);
    requestAnimationFrame(() => this.#updateFades());
  }

  /**
   * Reflect the free-range broadcast flag on the host's Broadcast button. The
   * button is host-only and its on/off state is driven purely by the snapshot
   * (never optimistically) so a rejected broadcast can't leave it stuck on. The
   * shared "discoverable" status line is owned by #syncDiscoveryStatus, not here
   * — this button reflects only its own toggle (broadcasting), so tapping it
   * always means the same thing.
   * @param {boolean} broadcasting
   * @param {boolean} isHost
   */
  #syncBroadcast(broadcasting, isHost) {
    const btn = /** @type {HTMLButtonElement} */ (byId('broadcast-btn'));
    byId('broadcast-item').hidden = !isHost; // hide the button + its label together
    if (!isHost) return;
    btn.classList.toggle('is-on', broadcasting);
    btn.setAttribute('aria-pressed', broadcasting ? 'true' : 'false');
    btn.setAttribute('aria-label',
      broadcasting ? 'Stop allowing nearby players' : 'Allow nearby players to see and join your game');
    if (broadcasting) {
      // Sharing is on — the lit button is the cue, so clear the transient
      // "Getting your location…" once it succeeds. (An error keeps broadcasting
      // off, so no snapshot arrives to wipe it.)
      const status = byId('discovery-status');
      status.hidden = true;
      status.classList.remove('is-error');
    }
  }

  /**
   * Host-only "Allow Nearby" toggle. Turning off is a bare intent. Turning on
   * first asks for confirmation (letting strangers find the game is worth an
   * explicit yes); only on confirm does the browser geolocation flow run. The
   * visible on/off state follows the next snapshot via #syncBroadcast.
   */
  #toggleBroadcast() {
    const btn = byId('broadcast-btn');
    if (btn.getAttribute('aria-pressed') === 'true') {
      // Turning off. If checked in to a place, confirm first — stopping also
      // ends the check-in. Otherwise it's a bare intent, no dialog.
      if (state.currentState?.place_name) {
        this.#openStopNearbyConfirm();
      } else {
        stopBroadcast();
      }
      return;
    }
    // Already consented once? Skip our explainer and go straight to the
    // geolocation flow — the phone won't re-prompt for a granted permission,
    // so re-toggling is one tap. A revoke resets consent in #startBroadcast.
    if (hasNearbyConsent()) {
      this.#startBroadcast();
      return;
    }
    const dlg = /** @type {HTMLDialogElement} */ (byId('allow-nearby-confirm'));
    dlg.showModal();
    // Focus the dialog, not the first button — see #openCheckoutConfirm.
    dlg.tabIndex = -1;
    dlg.focus();
  }

  /** Close the "Allow nearby players?" confirmation. */
  #closeAllowConfirm() {
    /** @type {HTMLDialogElement} */ (byId('allow-nearby-confirm')).close();
  }

  /**
   * Run the geolocation permission flow and start broadcasting. Called only
   * after the host confirms. The GPS prompt fires inside getPosition().
   */
  async #startBroadcast() {
    this.#setBroadcastStatus('Getting your location…', false);
    try {
      const { lat, lon } = await getPosition();
      saveNearbyConsent(); // confirmed + granted → skip the dialog next time
      broadcastNearby(lat, lon);
    } catch (err) {
      const reason = err instanceof GeoError ? err.reason : 'unavailable';
      // OS permission denied/revoked → forget consent so the explainer (with
      // its privacy context) returns next time they try.
      if (reason === 'permission') clearNearbyConsent();
      this.#setBroadcastStatus(GEO_ERROR_COPY[reason] ?? GEO_ERROR_COPY.unavailable, true);
    }
  }

  /**
   * @param {string} text
   * @param {boolean} isError
   */
  #setBroadcastStatus(text, isError) {
    const status = byId('discovery-status');
    status.hidden = false;
    status.textContent = text;
    status.classList.toggle('is-error', isError);
  }

  /**
   * Reflect the checked-in place on the host's Check-in prompt. Only offered
   * once Share Location is on — checking in is a refinement of sharing, not a
   * separate opt-in — so the prompt is hidden until then (and the server
   * clears any check-in when sharing stops). The pill's copy names the
   * checked-in place, or the nearest options once we've looked them up.
   * @param {string | null} placeName
   * @param {boolean} isHost
   * @param {boolean} broadcasting Share Location on — gates the prompt.
   */
  #syncCheckin(placeName, isHost, broadcasting) {
    const prompt = byId('checkin-prompt');
    prompt.hidden = !(isHost && broadcasting);
    if (!isHost || !broadcasting) return;
    const on = !!placeName;
    prompt.classList.toggle('is-on', on);
    prompt.setAttribute('aria-pressed', on ? 'true' : 'false');
    this.#setCheckinPromptCopy(placeName);
    prompt.setAttribute('aria-label', on
      ? `Checked in at ${placeName} — tap to change or check out`
      : 'Check in to a nearby place');
    // Once, in the background, name the nearby places. Sharing is on, so the
    // host has already granted geolocation — no surprise prompt.
    if (!on && !this.#placesCache && !this.#prefetchTried) this.#prefetchPlaces();
  }

  /**
   * Copy for the check-in prompt pill, split across two spans: the main label
   * (which may fade) and a pinned "and N more" that always stays visible at the
   * end. Checked in → the place; else the nearest option + a count of the rest;
   * before we know what's nearby → a generic invite. The trailing-edge fade is
   * applied only when the main label actually overflows.
   * @param {string | null} placeName
   */
  #setCheckinPromptCopy(placeName) {
    const textEl = byId('checkin-prompt-text');
    const moreEl = byId('checkin-prompt-more');
    if (placeName) {
      textEl.textContent = `Checked in at ${placeName}`;
      moreEl.hidden = true;
    } else {
      const list = this.#placesCache;
      if (list && list.length) {
        textEl.textContent = `Check in to ${list[0].name}`;
        const rest = list.length - 1;
        moreEl.hidden = rest <= 0;
        if (rest > 0) moreEl.textContent = `+${rest} more`;
      } else {
        textEl.textContent = 'Check in to a place';
        moreEl.hidden = true;
      }
    }
    // Fade the label's trailing edge only when it can't fit — a fit label keeps
    // its last characters crisp; a long one dissolves into "+N more".
    requestAnimationFrame(() =>
      textEl.classList.toggle('is-faded', textEl.scrollWidth > textEl.clientWidth + 1));
  }

  /**
   * Best-effort background lookup so the prompt can name nearby places. Gated on
   * an already-granted geolocation permission — the tap handler (#openPlaces) is
   * the sanctioned, user-initiated moment to ask when permission isn't granted.
   */
  async #prefetchPlaces() {
    this.#prefetchTried = true;
    try {
      const perm = navigator.permissions
        && await navigator.permissions.query({ name: /** @type {PermissionName} */ ('geolocation') });
      if (perm && perm.state !== 'granted') return;
      const { lat, lon } = await getPosition();
      this.#lastPos = { lat, lon };
      const res = await fetch(`/api/places/nearby?lat=${lat}&lon=${lon}`);
      if (!res.ok) return;
      const data = await res.json();
      this.#placesCache = data.places || [];
      // Refresh the prompt now that we know what's nearby (still host + not
      // checked in — a snapshot may have arrived meanwhile).
      const prompt = byId('checkin-prompt');
      if (this.#isHost && prompt.getAttribute('aria-pressed') !== 'true') {
        this.#setCheckinPromptCopy(null);
      }
    } catch {
      // Denied/unavailable — the prompt keeps its generic copy and the tap
      // handler fetches (and prompts for location) on demand.
    }
  }

  /** Close the places picker sheet. */
  #closePlaces() {
    /** @type {HTMLDialogElement} */ (byId('places-sheet')).close();
  }

  /**
   * Host-only: open the places picker. Prompts for GPS, fetches nearby places,
   * and lists them; tapping one sends a check-in (server resolves the place).
   * Shows a "Check out" action when already checked in.
   */
  async #openPlaces() {
    const sheet = /** @type {HTMLDialogElement} */ (byId('places-sheet'));
    const list = byId('places-list');
    const status = byId('places-status');
    list.replaceChildren();
    status.classList.remove('is-error');
    // Reset the search each open — the sheet always starts on the nearby list.
    clearTimeout(this.#searchTimer);
    this.#searchSeq++;
    /** @type {HTMLInputElement} */ (byId('places-search')).value = '';
    sheet.showModal();
    // The background prefetch usually has the list already — open straight to it.
    if (this.#placesCache && this.#placesCache.length) {
      this.#renderPlaces(this.#placesCache, true);
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
      this.#renderPlaces(places, true);
    } catch (err) {
      const reason = err instanceof GeoError ? err.reason : 'unavailable';
      status.textContent = err instanceof GeoError
        ? (GEO_ERROR_COPY[reason] ?? GEO_ERROR_COPY.unavailable)
        : 'Couldn’t load nearby places.';
      status.classList.add('is-error');
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
      this.#renderPlaces(this.#placesCache || [], true);
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
   * @param {boolean} [pinAbsent] prepend the checked-in place even when the
   *   fetched list doesn't contain it (nearby renders; search leaves it out)
   */
  #renderPlaces(list, pinAbsent = false) {
    const status = byId('places-status');
    const listEl = byId('places-list');
    // Already checked in: the current place always leads the list, marked with
    // a gold ring, so the host can re-find their pick at a glance.
    const currentId = state.currentState?.place_id;
    if (currentId) {
      const cur = list.find((p) => p.place_id === currentId);
      if (cur) {
        list = [cur, ...list.filter((p) => p !== cur)];
      } else if (pinAbsent && state.currentState?.place_name) {
        list = [{ place_id: currentId, name: state.currentState.place_name,
                  address: '' }, ...list];
      }
    }
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
      const isCurrent = p.place_id === currentId;
      if (isCurrent) {
        btn.classList.add('is-current');
        btn.setAttribute('aria-current', 'true');
      }
      // The current row's trailing affordance is a "Check out" pill (tapping
      // the row checks out, after a confirm); every other row keeps the
      // join-chevron and checks in.
      btn.innerHTML =
        '<span class="places-row-body">' +
          '<span class="places-row-name"></span>' +
          '<span class="places-row-addr"></span>' +
        '</span>' +
        (isCurrent ? '<span class="places-row-checkout">Check out</span>' : PLACES_CHEVRON);
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
      const hint = byId('copy-hint');
      hint.textContent = 'link copied!';
      hint.classList.add('copied');
      clearTimeout(this.#copyResetTimer);
      this.#copyResetTimer = setTimeout(() => {
        hint.innerHTML = copyHint(code);
        hint.classList.remove('copied');
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
