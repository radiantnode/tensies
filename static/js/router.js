// @ts-check
import { byId } from './dom.js';
import {
  RESUME_CLOSE_DELAY_MS, hidePaused, hideWinner, pausedText, showPaused, waitingText,
} from './overlays.js';
import { saveGameCode, hasSession } from './session.js';
import { state } from './state.js';
import { showScreen, showLoading, leaveLoading } from './transitions.js';
import { playIntro } from './video-intro.js';

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
const ROUTES = { '/': 'landing', '/nearby': 'nearby', '/signin': 'signin', '/welcome': 'onboarding', '/profile': 'profile', '/games': 'game-detail' };

// Monotonic navigation counter. enterFetched() defers its swap behind a fetch +
// the loading-gate, so a later navigation can start before an earlier one
// finishes; each navigation bumps this and stale completions bail (see
// enterFetched). Guards against rapid Back/Forward landing on the wrong screen.
let navToken = 0;

/**
 * Push (or replace) a history entry for `path` and show its screen.
 * @param {string} path
 * @param {{ replace?: boolean, instant?: boolean }} [options]
 */
export function navigate(path, { replace = false, instant = false } = {}) {
  const id = ROUTES[path] ?? 'landing';
  history[replace ? 'replaceState' : 'pushState']({ id }, '', path);
  return showScreen(id, { instant });
}

/** The landing screen component (typed accessor for its join sheet + errors). */
export function landing() {
  return /** @type {import('./components/landing-screen.js').LandingScreen} */ (byId('landing'));
}

/**
 * The nearby radar acquires GPS + fetches on `enter()` (it can't be prefetched
 * behind loading). Kick that off once `transition` has swapped it in — shared by
 * the /nearby navigation and Back/Forward activation onto it.
 * @template T
 * @param {T & {updateCallbackDone: Promise<unknown>}} transition
 * @returns {T}
 */
function enterNearbyAfter(transition) {
  transition.updateCallbackDone.then(() => /** @type {any} */ (byId('nearby'))?.enter?.());
  return transition;
}

/**
 * Show the landing screen and open its Join sheet (used by direct /join and
 * /<CODE> URLs + Back/Forward onto them). `code` pre-fills the game code.
 * @param {{ code?: string }} [opts]
 */
function openJoinOnLanding(opts = {}) {
  const transition = showScreen('landing');
  transition.updateCallbackDone.then(() => landing().openJoinSheet(opts));
  return transition;
}

/** Navigate to the landing screen. */
export function showLanding() {
  const transition = navigate('/');
  transition.updateCallbackDone.then(() => {
    /** @type {any} */ (byId('landing'))?.refreshAuth?.();
  });
  return transition;
}

/** Navigate to the sign-in screen. */
export function showSignin() {
  return navigate('/signin');
}

/**
 * Navigate to the nearby-games radar and (re)start location acquisition. The
 * screen prompts for GPS + fetches on `enter()` — a plain snapshot-less swap,
 * since discovery is permission-gated and can't be prefetched behind loading.
 */
export function showNearby() {
  // Instant swap (no view transition): the radar's spinning sweep would flicker
  // through a VT cross-fade — see showScreen's `instant`.
  return enterNearbyAfter(navigate('/nearby', { instant: true }));
}

/**
 * Navigate to a player's public profile.
 * @param {string} username
 */
export function showProfile(username) {
  const path = `/@${username}`;
  // Already here (a double-tap, or a tap that fires twice) — ignore so we don't
  // stack a duplicate history entry that a single Back can't escape.
  if (location.pathname === path) return;
  history.pushState({ id: 'profile', username }, '', path);
  enterFetched('profile', username);
}

/**
 * Navigate to a game's post-game detail view.
 * @param {string} code
 */
export function showGameDetail(code) {
  const path = `/games/${code}`;
  if (location.pathname === path) return;
  history.pushState({ id: 'game-detail', code }, '', path);
  enterFetched('game-detail', code);
}

/**
 * Fetch a data-backed screen behind the loading screen, then swap with a
 * synchronous render so the view transition captures populated content — the
 * same shape as the game-start flow, where loading holds until the snapshot is
 * in hand. A bare swap would animate to an empty screen and pop the data in
 * once the fetch resolves. The target must expose `load(arg) => result` and
 * `render(arg, result)`.
 * @param {'profile' | 'game-detail'} id
 * @param {string} arg
 */
function enterFetched(id, arg) {
  const token = ++navToken;
  const screen = /** @type {{ load(a: string): Promise<any>, render(a: string, r: any): void }} */ (
    /** @type {unknown} */ (byId(id)));
  showLoading();
  screen.load(arg).then((result) => {
    // A newer navigation (rapid Back/Forward, or a fresh link) started while
    // this fetch/loading-gate was in flight — its swap already happened, so
    // dropping this stale completion keeps us on the current screen instead of
    // clobbering it (the source of the flaky Back button).
    if (token !== navToken) return;
    leaveLoading(() => {
      if (token !== navToken) return;
      showScreen(id, { onSwap: () => screen.render(arg, result) });
    });
  });
}

/**
 * Show a named (non-fetched) screen and run any per-screen activation. The
 * nearby radar re-acquires GPS on `enter()` so a direct URL / Back-Forward
 * lands the same as a tap on "Find Nearby Games".
 * @param {string} id
 */
function activateNamed(id) {
  // Nearby swaps instantly (no VT) so its spinning sweep doesn't flicker.
  const transition = showScreen(id, { instant: id === 'nearby' });
  return id === 'nearby' ? enterNearbyAfter(transition) : transition;
}

/**
 * Navigate to the onboarding screen and display the confirmed username.
 * @param {string} username
 * @param {object | null} [stats]
 */

export function showOnboarding(username, stats) {
  const transition = navigate('/welcome');
  transition.updateCallbackDone.then(() => {
    /** @type {import('./components/onboarding-screen.js').OnboardingScreen} */
    (byId('onboarding')).show(username, stats ?? null);
  });
  return transition;
}

/**
 * Route the first paint. The inline #loading screen is already showing;
 * decide what replaces it without a landing flash: a saved session resumes
 * via `resumeSession`; a `/<CODE>` deep link (or legacy `?join=`) pre-fills
 * the join screen; otherwise land on landing.
 * @param {{ resumeSession: () => void }} deps
 */
export function bootstrap({ resumeSession }) {
  // Keep profile links (the /@username header pill) in-app. As bare anchors the
  // browser does a full document navigation, which tears down and restarts the
  // fixed #bg-video (poster flash → replay from frame 0 = a visible flicker).
  // Routing through showProfile() uses the History API, so the video keeps
  // looping — matching the reload-free create-game → lobby path.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = /** @type {HTMLElement} */ (e.target).closest('a.header-username');
    const match = link?.getAttribute('href')?.match(/^\/@(.+)$/);
    if (!match) return;
    e.preventDefault();
    showProfile(decodeURIComponent(match[1]));
  });
  window.addEventListener('popstate', (e) => {
    // Supersede any in-flight enterFetched — the enterFetched branches below
    // bump again, but the direct showScreen('landing') branch relies on this so
    // a stale fetch can't swap back over it.
    navToken++;
    const gameMatch = location.pathname.match(/^\/games\/(.+)$/);
    if (gameMatch) {
      enterFetched('game-detail', decodeURIComponent(gameMatch[1]));
      return;
    }
    const profileMatch = location.pathname.match(/^\/@(.+)$/);
    if (profileMatch) {
      enterFetched('profile', decodeURIComponent(profileMatch[1]));
      return;
    }
    if (location.pathname === '/join') {
      openJoinOnLanding();
      return;
    }
    const backCode = location.pathname.match(/^\/([A-Z]{5})$/i)?.[1];
    if (backCode) {
      openJoinOnLanding({ code: backCode });
      return;
    }
    const transition = activateNamed(ROUTES[location.pathname] ?? 'landing');
    // Landing on any other screen dismisses a Join sheet left open on the landing.
    transition.updateCallbackDone.then(() => landing().closeJoinSheet());
  });
  // Game detail URLs: /games/<code> → game-detail screen.
  const gameMatch = location.pathname.match(/^\/games\/(.+)$/);
  if (gameMatch) {
    enterFetched('game-detail', decodeURIComponent(gameMatch[1]));
    return;
  }
  // Vanity profile URLs: /@username → profile screen.
  const profileMatch = location.pathname.match(/^\/@(.+)$/);
  if (profileMatch) {
    enterFetched('profile', decodeURIComponent(profileMatch[1]));
    return;
  }
  // Named routes (signin, welcome) get their own screen directly — before
  // the saved-session check, so a direct /signin URL isn't hijacked by a
  // stale reconnect attempt.
  const namedRoute = ROUTES[location.pathname];
  if (namedRoute && namedRoute !== 'landing') {
    leaveLoading(() => activateNamed(namedRoute));
    return;
  }
  // /join → landing with the Join sheet open. Before the saved-session check so
  // a direct /join isn't hijacked by a stale reconnect (matched the old named
  // route's precedence).
  if (location.pathname === '/join') {
    leaveLoading(() => openJoinOnLanding());
    return;
  }
  if (hasSession()) {
    resumeSession();
    return;
  }
  const pathCode = location.pathname.match(/^\/([A-Z]{5})$/i)?.[1];
  const joinCode = pathCode ?? new URLSearchParams(location.search).get('join');
  if (joinCode) {
    // Keep a /<CODE> path in the address bar so a refresh re-opens the sheet;
    // canonicalise the legacy ?join= form to /<CODE>.
    if (!pathCode) history.replaceState({ id: 'landing' }, '', `/${joinCode.toUpperCase()}`);
    leaveLoading(() => openJoinOnLanding({ code: joinCode }));
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

  // A live game drives the screen now, so normalise the URL to '/'. If we
  // arrived via a named route like /join, leaving that in the address bar
  // makes a refresh re-show the join screen — bootstrap() resolves named
  // routes before the saved-session check, so resumeSession() never runs.
  // '/' is not a hijacking route; it falls through to the resume path.
  if (location.pathname !== '/') history.replaceState({ id: 'landing' }, '', '/');

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
          staged: true,
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
        staged: true,
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

  // First start (lobby → game): play the intro video.
  const fromLobby = byId('lobby').classList.contains('active');
  leaveLoading(() => {
    hideWinner();
    const reveal = () => showScreen('game', { staged: true, onSwap: () => gameScreen().render(snap) });
    if (fromLobby) playIntro(reveal);
    else reveal();
    // Just resumed: drop the pause overlay after the toggle's slide-off.
    const pauseDialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('pause-overlay'));
    if (pauseDialog?.open) setTimeout(hidePaused, RESUME_CLOSE_DELAY_MS);
    else hidePaused();
  });
}
