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
import { state } from '../state.js';

/** @typedef {import('../types.js').GameSnapshot} GameSnapshot */

/** Copy hint HTML under the code, showing the shareable link (URL bold), e.g.
 *  "Click to copy — <b>tensies.app/ABCDE</b>" (host reflects the current origin).
 *  Safe to inject: host is the browser origin, code is a sanitised 5-letter code.
 *  @param {string} code */
const copyHint = (code) => `Click to copy — <span class="copy-hint-url">${location.host}/${code}</span>`;

/** Fallback avatar for anonymous players (no account photo). */
const DEFAULT_AVATAR = '/static/images/avatar-default.svg';

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
            <button id="broadcast-btn" type="button" class="lobby-action btn-broadcast" aria-pressed="false" aria-label="Broadcast to nearby players">
              <span class="broadcast-wave" aria-hidden="true"><span></span><span></span><span></span></span>
            </button>
            <span class="lobby-action-label">Broadcast</span>
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
            <button id="places-close" type="button" class="places-close" aria-label="Close">✕</button>
          </div>
          <p id="places-status" class="places-status">Finding places near you…</p>
          <ul id="places-list" class="places-list" aria-label="Nearby places"></ul>
          <button id="places-checkout" type="button" class="btn btn-secondary places-checkout" hidden>Check out</button>
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
    byId('checkin-prompt').addEventListener('click', () => this.#openPlaces());
    byId('places-close').addEventListener('click', () => this.#closePlaces());
    byId('places-checkout').addEventListener('click', () => { checkOut(); this.#closePlaces(); });
    byId('places-list').addEventListener('click', (e) => {
      const row = /** @type {HTMLElement} */ (e.target).closest('[data-place]');
      if (row) { checkIn(/** @type {string} */ (row.getAttribute('data-place'))); this.#closePlaces(); }
    });
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.#onResize);
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
        row = document.createElement('li');
        row.className = 'player-list-item';
        // Built once; name/avatar/badge are patched in place below so a
        // roster change doesn't reload avatars or reset the row.
        row.innerHTML =
          '<span class="lobby-avatar-ring"><img class="lobby-avatar" alt=""></span>' +
          '<span class="lobby-player-name"></span>';
        // Fade+slide the row in as the player joins. One-shot: added only on
        // creation (keyed rows are built once) and cleared when it finishes, so
        // re-renders never replay it.
        row.classList.add('player-enter');
        row.addEventListener('animationend', () => row.classList.remove('player-enter'), { once: true });
        this.#rows.set(pid, row);
      }
      list.appendChild(row);
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
    this.#syncCheckin(snap.place_name ?? null, isHost);
    // The shared "you're discoverable" line reflects *either* path onto the
    // radar, so being on the radar always reads as on.
    this.#syncDiscoveryStatus(!!snap.broadcasting, snap.place_name ?? null, isHost);
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
      broadcasting ? 'Stop broadcasting to nearby players' : 'Broadcast to nearby players');
  }

  /**
   * The single "you're on the radar" cue. Shown whenever the game is discoverable
   * by *either* mechanism — a free-range broadcast or a checked-in place — so an
   * off Broadcast button next to an active check-in doesn't read as "not
   * discoverable". Host-only. The live variant carries a pulsing accent dot.
   * @param {boolean} broadcasting
   * @param {string | null} placeName
   * @param {boolean} isHost
   */
  #syncDiscoveryStatus(broadcasting, placeName, isHost) {
    const status = byId('discovery-status');
    if (!isHost) { status.hidden = true; return; }
    const live = broadcasting || !!placeName;
    // A fresh snapshot supersedes any transient "getting location" / error text.
    status.classList.toggle('is-live', live);
    status.classList.remove('is-error');
    status.hidden = !live;
    if (!live) return;
    status.textContent = placeName
      ? `Nearby players can find this game at ${placeName}.`
      : 'Nearby players can find this game.';
  }

  /**
   * Host-only Broadcast toggle. Turning on needs a GPS fix (prompted here);
   * turning off is a bare intent. Either way the visible on/off state follows
   * the next snapshot via #syncBroadcast, not this handler.
   */
  async #toggleBroadcast() {
    const btn = byId('broadcast-btn');
    if (btn.getAttribute('aria-pressed') === 'true') {
      stopBroadcast();
      return;
    }
    this.#setBroadcastStatus('Getting your location…', false);
    try {
      const { lat, lon } = await getPosition();
      broadcastNearby(lat, lon);
    } catch (err) {
      const reason = err instanceof GeoError ? err.reason : 'unavailable';
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
    status.classList.remove('is-live'); // transient broadcast feedback, not the live cue
    status.textContent = text;
    status.classList.toggle('is-error', isError);
  }

  /**
   * Reflect the checked-in place on the host's Check-in prompt. Host-only; the
   * prompt is a single tappable pill (no separate icon button) whose copy names
   * the checked-in place, or the nearest options once we've looked them up.
   * @param {string | null} placeName
   * @param {boolean} isHost
   */
  #syncCheckin(placeName, isHost) {
    const prompt = byId('checkin-prompt');
    prompt.hidden = !isHost;
    if (!isHost) return;
    const on = !!placeName;
    prompt.classList.toggle('is-on', on);
    prompt.setAttribute('aria-pressed', on ? 'true' : 'false');
    this.#setCheckinPromptCopy(placeName);
    prompt.setAttribute('aria-label', on
      ? `Checked in at ${placeName} — tap to change or check out`
      : 'Check in to a nearby place');
    // Once, in the background, name the nearby places — but only if location is
    // already granted, so opening the lobby never fires a surprise GPS prompt.
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
        if (rest > 0) moreEl.textContent = `and ${rest} more`;
      } else {
        textEl.textContent = 'Check in to a place';
        moreEl.hidden = true;
      }
    }
    // Fade the label's trailing edge only when it can't fit — a fit label keeps
    // its last characters crisp; a long one dissolves into "and N more".
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
    const checkedIn = byId('checkin-prompt').getAttribute('aria-pressed') === 'true';
    byId('places-checkout').hidden = !checkedIn;
    list.replaceChildren();
    status.classList.remove('is-error');
    sheet.showModal();
    // The background prefetch usually has the list already — open straight to it.
    if (this.#placesCache && this.#placesCache.length) {
      this.#renderPlaces(this.#placesCache);
      return;
    }
    status.hidden = false;
    status.textContent = 'Finding places near you…';
    try {
      const { lat, lon } = await getPosition();
      const res = await fetch(`/api/places/nearby?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error(`places ${res.status}`);
      const data = await res.json();
      const places = data.places || [];
      this.#placesCache = places;
      this.#renderPlaces(places);
    } catch (err) {
      const reason = err instanceof GeoError ? err.reason : 'unavailable';
      status.textContent = err instanceof GeoError
        ? (GEO_ERROR_COPY[reason] ?? GEO_ERROR_COPY.unavailable)
        : 'Couldn’t load nearby places.';
      status.classList.add('is-error');
    }
  }

  /**
   * @param {Array<{place_id: string, name: string, address: string}>} list
   */
  #renderPlaces(list) {
    const status = byId('places-status');
    const listEl = byId('places-list');
    if (!list.length) {
      status.hidden = false;
      status.textContent = 'No places found nearby.';
      return;
    }
    status.hidden = true;
    listEl.replaceChildren();
    for (const p of list) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'places-row';
      btn.dataset.place = p.place_id;
      btn.innerHTML =
        `<span class="places-row-name"></span><span class="places-row-addr"></span>`;
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
