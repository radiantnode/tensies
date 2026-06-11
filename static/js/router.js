// @ts-check
import { byId } from './dom.js';
import {
  RESUME_CLOSE_DELAY_MS, hidePaused, hideWinner, pausedText, showPaused, waitingText,
} from './overlays.js';
import { saveGameCode, hasSession } from './session.js';
import { state } from './state.js';
import { showScreen, showLoading, leaveLoading } from './transitions.js';

/** @typedef {import('./types.js').GameSnapshot} GameSnapshot */

/**
 * Screen routing, with its two inputs:
 *  - the URL (History API — every pre-game screen has a real, shareable path);
 *  - the latest server snapshot (`showFor` — which screen a live game needs).
 *
 * This module deliberately does not import net.js (net.js imports showFor from
 * here); the one net dependency — resuming a saved session at boot — is
 * injected into bootstrap() by the entry point instead.
 */

/** @type {Record<string, string>} */
const ROUTES = { '/': 'landing', '/join': 'join' };

/**
 * Push (or replace) a history entry for `path` and show its screen.
 * @param {string} path
 * @param {{ replace?: boolean }} [options]
 */
export function navigate(path, { replace = false } = {}) {
  const id = ROUTES[path] ?? 'landing';
  history[replace ? 'replaceState' : 'pushState']({ id }, '', path);
  return showScreen(id);
}

/**
 * Carry the name typed on the landing screen over to the join screen, then
 * focus the field the user still needs (code if a name is set, else the name).
 * Focus runs after the DOM swap (updateCallbackDone) — focus() during the
 * view transition gets dropped.
 * @param {{ updateCallbackDone: Promise<void> }} transition The join-swap transition handle.
 */
function carryNameAndFocus(transition) {
  const name = /** @type {HTMLInputElement} */ (byId('name-input')).value.trim();
  /** @type {HTMLInputElement} */ (byId('join-name-input')).value = name;
  const focusId = name ? 'code-input' : 'join-name-input';
  transition.updateCallbackDone.then(() => byId(focusId).focus());
}

/** Navigate to the join screen, carrying the typed name across. */
export function showJoin() {
  carryNameAndFocus(navigate('/join'));
}

/** Navigate to the landing screen. */
export function showLanding() {
  return navigate('/');
}

/**
 * Route the first paint. The inline #loading screen is already showing;
 * decide what replaces it without a landing flash: a saved session resumes
 * via `resumeSession`; a `/<CODE>` deep link (or legacy `?join=`) pre-fills
 * the join screen; otherwise land on landing.
 * @param {{ resumeSession: () => void }} deps
 */
export function bootstrap({ resumeSession }) {
  window.addEventListener('popstate', () => {
    showScreen(ROUTES[location.pathname] ?? 'landing');
  });
  if (hasSession()) {
    resumeSession();
    return;
  }
  const pathCode = location.pathname.match(/^\/([A-Z]{5})$/i)?.[1];
  const joinCode = pathCode ?? new URLSearchParams(location.search).get('join');
  if (joinCode) {
    history.replaceState({ id: 'join' }, '', '/');
    /** @type {HTMLInputElement} */ (byId('code-input')).value = joinCode.toUpperCase();
    leaveLoading(() => carryNameAndFocus(showScreen('join')));
  } else {
    leaveLoading(() => showScreen('landing'));
  }
}

/** The game screen component (typed accessor). */
function gameScreen() {
  return /** @type {import('./components/game-screen.js').GameScreen} */ (byId('game'));
}

/**
 * Show whatever screen the latest server snapshot calls for. Branch order is
 * load-bearing: the paused branch must precede the peer-disconnected branch,
 * so a paused host isn't bounced to the "waiting to reconnect" screen.
 * @param {GameSnapshot} snap
 */
export function showFor(snap) {
  state.currentState = snap;
  state.pendingOrigin = null;
  if (snap.code) {
    state.gameCode = snap.code;
    saveGameCode(snap.code);
  }

  // Screen-specific DOM work rides showScreen's onSwap so it runs with the
  // target screen displayed — the dice scatter needs the zone's pixel rect,
  // which reads 0×0 while the screen is still `display: none` (the bug that
  // made scattered dice miss the board's first paint after a reconnect).
  if (!snap.started) {
    leaveLoading(() => {
      hidePaused();
      showScreen('lobby', {
        onSwap: () => /** @type {import('./components/lobby-screen.js').LobbyScreen} */ (byId('lobby')).render(snap),
      });
    });
    return;
  }

  // Paused. Non-host: keep the board under a wait dialog so dice stay in
  // place. Host: stay on the board with the menu open (countdown + resume).
  if (snap.paused) {
    if (snap.host !== state.myId) {
      hideWinner();
      leaveLoading(() => {
        showScreen('game', {
          onSwap: () => {
            gameScreen().render(snap);
            showPaused(pausedText(snap));
          },
        });
      });
      return;
    }
    // A host returning from reconnect lands on the loading screen — pop the
    // menu open on the swap so the resume toggle is right there. (Read the
    // flag before showScreen: the swap changes what's active.)
    const fromLoading = byId('loading').classList.contains('active');
    leaveLoading(() => {
      hideWinner();
      hidePaused();
      showScreen('game', {
        onSwap: () => {
          gameScreen().render(snap);
          if (fromLoading) gameScreen().openMenu();
        },
      });
    });
    return;
  }

  // A peer dropped (and we're not paused): everyone else watches the loading
  // screen until they reconnect or the grace window elapses.
  const downNames = Object.values(snap.players)
    .filter((p) => p.disconnected)
    .map((p) => p.name);
  if (downNames.length > 0) {
    hideWinner();
    hidePaused();
    showLoading(waitingText(downNames));
    return;
  }

  leaveLoading(() => {
    hideWinner();
    showScreen('game', { onSwap: () => gameScreen().render(snap) });
    // Just resumed: drop the pause overlay after the toggle's slide-off.
    const pauseDialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('pause-overlay'));
    if (pauseDialog?.open) setTimeout(hidePaused, RESUME_CLOSE_DELAY_MS);
    else hidePaused();
  });
}
