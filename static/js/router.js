// @ts-check
import { byId } from './dom.js';
import { saveGameCode, hasSession } from './session.js';
import { state } from './state.js';
import { showScreen, leaveLoading } from './transitions.js';

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

/**
 * Show whatever screen the latest server snapshot calls for.
 * (Scaffold scope: lobby and basic board routing. The paused, peer-disconnected
 * and post-roll branches are added with their views.)
 * @param {GameSnapshot} snap
 */
export function showFor(snap) {
  state.currentState = snap;
  state.pendingOrigin = null;
  if (snap.code) {
    state.gameCode = snap.code;
    saveGameCode(snap.code);
  }
  if (!snap.started) {
    leaveLoading(() => {
      showScreen('lobby');
      /** @type {import('./components/lobby-screen.js').LobbyScreen} */ (byId('lobby')).render(snap);
    });
    return;
  }
  leaveLoading(() => {
    showScreen('game');
    /** @type {import('./components/game-screen.js').GameScreen} */ (byId('game')).render(snap);
  });
}
