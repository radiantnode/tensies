// @ts-check
import { getAuthUser } from '../auth.js';
import { syncAccountMark } from '../account-sync.js';
import { byId } from '../dom.js';
import { renderGame } from '../game-render.js';
import { makeMenuToggle } from '../menu-toggle.js';
import { RESUME_CLOSE_DELAY_MS } from '../overlays.js';
import { roll } from '../roll.js';
import { state } from '../state.js';
import { TITLE_ROW_HTML } from '../title-row.js';

/** @typedef {import('../types.js').GameSnapshot} GameSnapshot */

/**
 * <game-screen> — the board + the in-game (pause) menu. Light DOM: the host
 * element *is* `#game.screen`. State-driven: `render(snap)` is called by
 * router.showFor on each started `state` frame and patches in place. Owns the
 * game-menu open/close and the Pause/Resume toggle (the server flips the
 * flag; renderMenu reflects it).
 */
export class GameScreen extends HTMLElement {
  /** @type {HTMLButtonElement | null} */
  #menuBtn = null;

  /** @type {HTMLElement | null} */
  #menu = null;

  /** @param {KeyboardEvent} event */
  #onKeydown = (event) => {
    if (event.key === 'Escape' && this.menuOpen()) {
      this.closeMenu();
      return;
    }
    if (event.code === 'Space' && state.currentState?.started && !state.rolling) {
      const btn = /** @type {HTMLButtonElement | null} */ (document.getElementById('roll-btn'));
      if (btn && !btn.disabled) {
        event.preventDefault();
        roll();
      }
    }
  };

  /**
   * The board's own bounce (owner-directed, 2026-09-23, docs/IOS_SAFARI.md):
   * <html> stays overflow: hidden the whole time the board is active — the
   * precondition for #game-bg's in-flow art to paint behind Safari's
   * collapsed toolbar, which a root that bounces can't do (a FIXED layer
   * never gets that treatment regardless of its own box size; a plain
   * overflow-clip-margin ::after copy was tried too and ruled out first —
   * unsupported on iOS 27 for either syntax). *This* element becomes the
   * thing that bounces instead: a real vertical scroll container with
   * exactly 1px of scrollable overflow (critical.css .game-screen.active,
   * ::after), which iOS does rubber-band even though the root won't.
   *
   * That 1px is corrected back to 0 once things are genuinely at rest, so
   * it can't leave a drift that would shift dice.js's
   * getBoundingClientRect() reads of the board. Two guards, both required,
   * checked together in #correctScrollDrift — skip either and this fights
   * the very bounce it exists to leave alone (found on-device: an early
   * version reset unconditionally and cancelled a rubber-band a frame
   * after it started):
   *   1. No touch is currently down on this element. A settle signal
   *      (scrollend, or the scroll+timeout fallback below) can land while
   *      the finger is still on the glass, and correcting then is itself
   *      a way to fight the gesture, even at an otherwise legal value.
   *   2. The value is a genuine resting drift: 0 < scrollTop <=
   *      scrollTopMax. Never negative or beyond max — that's iOS's own
   *      bounce still in flight, and it returns itself to a legal value on
   *      its own clock, not this one.
   * scrollend is the primary settle signal; the scroll+timeout fallback
   * exists because not every engine fires it reliably — the same
   * asymmetric-release shape this codebase already uses for exactly this
   * reason (scroll-fades.js, RELEASE_MS), just resetting to a fixed value
   * instead of a class.
   */
  #touchDown = false;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #scrollSettleFallback;

  #onTouchStart = () => {
    this.#touchDown = true;
  };

  #onTouchLift = () => {
    this.#touchDown = false;
    // The scroll may already have settled while the finger was still
    // down (scrollend/the fallback both no-op while #touchDown) — check
    // now that it's safe to.
    this.#correctScrollDrift();
  };

  #onScroll = () => {
    clearTimeout(this.#scrollSettleFallback);
    this.#scrollSettleFallback = setTimeout(() => this.#correctScrollDrift(), 150);
  };

  #onScrollEnd = () => {
    clearTimeout(this.#scrollSettleFallback);
    this.#correctScrollDrift();
  };

  /** Snap the 1px scroller back to rest. Never while a touch is down, and
   *  never for a value outside (0, scrollTopMax] — see the class comment
   *  above for why both guards have to hold. */
  #correctScrollDrift() {
    if (this.#touchDown) return;
    // Read/write through an explicitly-typed local: checkJs otherwise infers
    // an implicit `scrollTop` class field from the assignment below (rather
    // than resolving the real, inherited HTMLElement one) and then flags the
    // reads in the condition above it as used-before-assigned.
    const el = /** @type {HTMLElement} */ (this);
    const max = el.scrollHeight - el.clientHeight;
    if (el.scrollTop > 0 && el.scrollTop <= max) el.scrollTop = 0;
  }

  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'game';
    this.className = 'screen game-screen';
    this.setAttribute('aria-labelledby', 'game-title');
    this.innerHTML = `
      <header class="game-topbar">
        ${TITLE_ROW_HTML}
        <div class="players-bar" id="players-bar" role="list" aria-label="Players"></div>
      </header>
      <div id="game-menu" class="game-menu" aria-hidden="true">
        <div class="menu-topbar">
          <div class="topbar-title-row">
            <div class="game-title">
              <img src="/static/images/logo.svg" class="game-title-mark" alt="">
              <span>Tensies</span>
            </div>
            <button id="game-menu-close" type="button" class="menu-close-btn" aria-label="Close menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>
        </div>
        <nav class="gm-list" aria-label="Game menu">
          <div class="gm-row" id="menu-pause-row" hidden>
            <span class="gm-text">
              <b>Pause Game</b>
              <span id="menu-pause-sub">Freeze rolling for everyone</span>
            </span>
            <button id="menu-pause-btn" type="button" class="pause-lever" role="switch" aria-checked="false" aria-label="Pause game">
              <span class="lever-knob" aria-hidden="true"></span>
            </button>
          </div>
          <div class="gm-row gm-row-end" id="menu-end-row" hidden>
            <span class="gm-text">
              <b>End Game</b>
              <span>Closes the table for everybody</span>
            </span>
            <div class="bolt" id="end-bolt">
              <span class="bolt-run" aria-hidden="true"></span>
              <span class="bolt-say" aria-hidden="true"><span id="bolt-say-text">Slide to end the game</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>
              </span>
              <button id="menu-end-btn" type="button" class="bolt-slug" aria-label="Slide to end the game">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 12h11"/><path d="m12.5 6.5 6 5.5-6 5.5"/></svg>
              </button>
            </div>
          </div>
        </nav>
        <div class="gm-foot">
          <div class="gm-cap" id="menu-pause-status" aria-live="polite" hidden>
            <div class="thread" aria-hidden="true"><i id="pause-cap-fill"></i></div>
            <p class="gm-cap-text">Table closes on its own in <span id="pause-remaining">—</span></p>
          </div>
          <p class="gm-legend" id="menu-foot-legend"></p>
        </div>
      </div>
      <div class="my-area" id="my-area"></div>`;

    this.#menuBtn = /** @type {HTMLButtonElement} */ (this.querySelector('.game-menu-btn'));
    this.#menu = byId('game-menu');
    // The shared title row gives the hamburger a class; the game's needs the
    // id the rest of the app (and the test suites) reference.
    this.#menuBtn.id = 'game-menu-btn';
    this.#menuBtn.setAttribute('aria-controls', 'game-menu');

    // Hamburger opens the GAME menu; the menu's own X closes it (the menu owns
    // its title row, so nothing has to escape above it — LAYERING.md).
    this.#menuBtn.addEventListener('click', makeMenuToggle({
      isOpen: () => this.menuOpen(),
      open: () => this.openMenu(),
      close: () => this.closeMenu(),
    }));
    byId('game-menu-close').addEventListener('click', () => this.closeMenu());

    // End Game — a barrel bolt: slide-to-confirm, the one deliberate gesture
    // for the one irreversible thing a host can do.
    this.#wireBolt();

    // Pause/Resume — send intent; the broadcast flips the flag and renderMenu
    // reflects it. Resuming closes the menu after a beat (lever slide-off).
    byId('menu-pause-btn').addEventListener('click', () => {
      if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
      const resuming = Boolean(state.currentState?.paused);
      state.ws.send(JSON.stringify({ action: 'pause' }));
      if (resuming) setTimeout(() => this.closeMenu(), RESUME_CLOSE_DELAY_MS);
    });

    // The roll button is rebuilt by every renderMyArea — delegate its clicks.
    byId('my-area').addEventListener('click', (event) => {
      const target = /** @type {HTMLButtonElement} */ (event.target);
      if (target.id === 'roll-btn' && !target.disabled) roll();
    });

    document.addEventListener('keydown', this.#onKeydown);

    // The board's own bounce (see the class comment above): this element
    // IS the scroll container (critical.css .game-screen.active), so the
    // listeners go directly on it — no delegation needed.
    this.addEventListener('scroll', this.#onScroll, { passive: true });
    this.addEventListener('scrollend', this.#onScrollEnd);
    this.addEventListener('touchstart', this.#onTouchStart, { passive: true });
    this.addEventListener('touchend', this.#onTouchLift, { passive: true });
    this.addEventListener('touchcancel', this.#onTouchLift, { passive: true });
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.#onKeydown);
    this.removeEventListener('scroll', this.#onScroll);
    this.removeEventListener('scrollend', this.#onScrollEnd);
    this.removeEventListener('touchstart', this.#onTouchStart);
    this.removeEventListener('touchend', this.#onTouchLift);
    this.removeEventListener('touchcancel', this.#onTouchLift);
  }

  /** Whether the in-game menu is open. */
  menuOpen() {
    return Boolean(this.#menu?.classList.contains('open'));
  }

  /** Open the in-game menu (also auto-opened for a host returning to a pause). */
  openMenu() {
    this.#menu?.classList.add('open');
    this.#menu?.setAttribute('aria-hidden', 'false');
    this.#menuBtn?.classList.add('open');
    this.#menuBtn?.setAttribute('aria-expanded', 'true');
    this.#menuBtn?.setAttribute('aria-label', 'Close menu');
  }

  /** Close the in-game menu. */
  closeMenu() {
    this.#menu?.classList.remove('open');
    this.#menu?.setAttribute('aria-hidden', 'true');
    this.#menuBtn?.classList.remove('open');
    this.#menuBtn?.setAttribute('aria-expanded', 'false');
    this.#menuBtn?.setAttribute('aria-label', 'Open menu');
    // Return the bolt to rest so re-opening starts fresh.
    this.#resetBolt();
  }

  /** @type {number} bolt travel 0–1 */
  #boltTravel = 0;

  /** @type {boolean} the bolt has been shot (End Game sent) */
  #boltDone = false;

  /**
   * The barrel bolt: drag the brass slug across the track. The instruction
   * fades with travel; vermilion appears only on the track floor at the
   * instant the bolt is home. Releasing early springs it back.
   */
  #wireBolt() {
    const bolt = byId('end-bolt');
    const slug = /** @type {HTMLButtonElement} */ (byId('menu-end-btn'));
    let startX = 0;
    let dragging = false;

    const range = () => bolt.clientWidth - slug.offsetWidth - 8;

    const apply = (/** @type {number} */ travel, /** @type {boolean} */ animate) => {
      this.#boltTravel = travel;
      slug.classList.toggle('is-springing', animate);
      slug.style.transform = `translateX(${travel * range()}px)`;
      const run = /** @type {HTMLElement} */ (bolt.querySelector('.bolt-run'));
      const say = /** @type {HTMLElement} */ (bolt.querySelector('.bolt-say'));
      run.style.clipPath = `inset(0 ${Math.round((1 - travel) * 100)}% 0 0)`;
      say.style.opacity = String(Math.max(0, 1 - travel / 0.7));
    };

    slug.addEventListener('pointerdown', (e) => {
      if (this.#boltDone) return;
      dragging = true;
      startX = e.clientX - this.#boltTravel * range();
      slug.setPointerCapture(e.pointerId);
    });
    slug.addEventListener('pointermove', (e) => {
      if (!dragging || this.#boltDone) return;
      const travel = Math.min(1, Math.max(0, (e.clientX - startX) / range()));
      apply(travel, false);
    });
    const release = () => {
      if (!dragging || this.#boltDone) return;
      dragging = false;
      if (this.#boltTravel >= 0.92) this.#shootBolt();
      else apply(0, true);
    };
    slug.addEventListener('pointerup', release);
    slug.addEventListener('pointercancel', release);

    // Keyboard path for the same irreversible action: Enter/Space arms it,
    // a second press within 3s commits — the deliberate two-step, keyboardly.
    let armed = 0;
    slug.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (this.#boltDone) return;
      const now = Date.now();
      if (now - armed < 3000) {
        this.#shootBolt();
      } else {
        armed = now;
        apply(0.5, true);
        setTimeout(() => { if (!this.#boltDone && Date.now() - armed >= 2900) apply(0, true); }, 3000);
      }
    });
  }

  /** The bolt is home: commit End Game. */
  #shootBolt() {
    if (this.#boltDone) return;
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    this.#boltDone = true;
    const bolt = byId('end-bolt');
    const slug = /** @type {HTMLElement} */ (byId('menu-end-btn'));
    bolt.classList.add('done');
    slug.classList.add('is-springing');
    slug.style.transform = `translateX(${bolt.clientWidth - slug.offsetWidth - 8}px)`;
    /** @type {HTMLElement} */ (bolt.querySelector('.bolt-run')).style.clipPath = 'inset(0 0 0 0)';
    const say = /** @type {HTMLElement} */ (bolt.querySelector('.bolt-say'));
    const sayText = byId('bolt-say-text');
    sayText.textContent = 'Table closed';
    say.style.opacity = '1';
    state.ws.send(JSON.stringify({ action: 'end_game' }));
  }

  /** Return the bolt to rest (menu closed / new game). */
  #resetBolt() {
    this.#boltDone = false;
    this.#boltTravel = 0;
    const bolt = document.getElementById('end-bolt');
    const slug = document.getElementById('menu-end-btn');
    if (!bolt || !slug) return;
    bolt.classList.remove('done');
    slug.classList.remove('is-springing');
    slug.style.transform = '';
    const run = /** @type {HTMLElement | null} */ (bolt.querySelector('.bolt-run'));
    if (run) run.style.clipPath = 'inset(0 100% 0 0)';
    const say = /** @type {HTMLElement | null} */ (bolt.querySelector('.bolt-say'));
    if (say) say.style.opacity = '1';
    const sayText = document.getElementById('bolt-say-text');
    if (sayText) sayText.textContent = 'Slide to end the game';
  }

  /**
   * Render the board from a server snapshot.
   * @param {GameSnapshot} snap
   */
  render(snap) {
    // Sync the account mark (auth may have changed since connectedCallback).
    // The board carries the MARK ALONE — no handle, not pressable: the
    // players bar already names you (board-signedin.json).
    const titleRow = this.querySelector('.game-topbar .topbar-title-row');
    if (titleRow) syncAccountMark(titleRow, getAuthUser());
    renderGame(snap);
  }
}

customElements.define('game-screen', GameScreen);
