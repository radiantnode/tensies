// Auth-specific pixel baselines. These states require a fake JWT in localStorage
// before page load (so refreshAuth() sees the signed-in state on first render),
// which means they can't go in the data-driven states.json.
const { test, expect } = require('./fixtures');
const { seedPage, settle, pinWebSocket } = require('./determinism');

// A fake JWT that getAuthUser() accepts. The client only does atob(payload) —
// no signature verification. exp must be after the pinned Date.now (2026-01-01).
const FAKE_JWT = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({
    sub: '00000000-0000-0000-0000-000000000001',
    username: 'TestUser',
    exp: 1799999999,
  })).toString('base64url'),
  'ZmFrZQ', // fake signature — client never checks
].join('.');

/** Inject the JWT into localStorage before any page script runs. */
async function seedAuth(page) {
  await page.addInitScript((token) => {
    localStorage.setItem('tensies_auth_token', token);
  }, FAKE_JWT);
}

test('signin', async ({ page }) => {
  // The sign-in/sign-up screen, reached from the nav menu. No auth needed.
  await seedPage(page);
  await page.goto('/');
  await page.waitForSelector('#landing.active');
  await page.click('#landing-menu-btn');
  await page.waitForSelector('#nav-menu.open');
  await page.click('.menu-auth-btn');
  await page.waitForSelector('#signin.active');
  await settle(page);
  await expect(page).toHaveScreenshot('signin.png');
});

test('landing-signed-in', async ({ page }) => {
  // Landing with a signed-in user: name input hidden, @username pill in header.
  await seedPage(page);
  await seedAuth(page);
  await page.goto('/');
  await page.waitForSelector('#landing.active');
  // Verify the signed-in state took effect before capturing.
  await page.waitForFunction(() => document.getElementById('name-input')?.hidden === true);
  await settle(page);
  await expect(page).toHaveScreenshot('landing-signed-in.png');
});

test('onboarding', async ({ page }) => {
  // Post-signup welcome screen showing @username and vanity URL.
  await seedPage(page);
  await seedAuth(page);
  // Seed the onboarding stash so #restore() populates the screen.
  await page.addInitScript((data) => {
    sessionStorage.setItem('tensies_onboarding', data);
  }, JSON.stringify({ username: 'TestUser', stats: null }));
  await page.goto('/welcome');
  await page.waitForSelector('#onboarding.active');
  await page.waitForFunction(() =>
    document.getElementById('onboarding-username')?.textContent === '@TestUser');
  await settle(page);
  await expect(page).toHaveScreenshot('onboarding.png');
});

test('nav-menu-signed-in', async ({ page }) => {
  // Nav menu when signed in: shows "Sign out" instead of "Sign in or Sign up".
  await seedPage(page);
  await seedAuth(page);
  await page.goto('/');
  await page.waitForSelector('#landing.active');
  await page.click('#landing-menu-btn');
  await page.waitForSelector('#nav-menu.open');
  await settle(page);
  await expect(page).toHaveScreenshot('nav-menu-signed-in.png');
});

// ── Game board: signed-in vs signed-out ─────────────────────────────────────
// These use pinWebSocket to rewrite the post-create WS frame into a mid-game
// state, same technique as stateful.spec.js. The signed-out game-board already
// lives there; here we add the signed-in variant and an explicit signed-out
// companion so both are in one place for auth-aware diffing.

const mk = (name, dice = [], extra = {}) =>
  ({ name, dice, wins: 0, has_rolled: dice.length > 0, roll_count: dice.length ? 1 : 0, disconnected: false, ...extra });

/**
 * Drive a host through create and rewrite the state frame via `build`.
 * When `authed` is true, the outbound `auth` action (which carries the fake
 * JWT the server can't verify) is intercepted and a synthetic `auth_ok` is
 * returned so the client thinks it's authenticated without server validation.
 */
async function hostGame(page, build, readySelector, { authed = false } = {}) {
  let myPid = null;
  await page.routeWebSocket(/\/ws$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'welcome') myPid = msg.player_id;
        const rewritten = (msg.type === 'state' || msg.type === 'round_won')
          ? build(msg, myPid) : msg;
        ws.send(JSON.stringify(rewritten ?? msg));
      } catch { ws.send(raw); }
    });
    ws.onMessage((raw) => {
      try {
        const msg = JSON.parse(raw);
        if (authed && msg.action === 'auth') {
          // Fake auth_ok — don't forward the bogus JWT to the server.
          ws.send(JSON.stringify({
            type: 'auth_ok', username: 'TestUser',
            user_id: '00000000-0000-0000-0000-000000000001',
          }));
          return;
        }
      } catch { /* pass through */ }
      server.send(raw);
    });
  });
  await page.goto('/');
  await page.waitForSelector('#landing.active');
  // When signed in the name input is hidden; the auth user's name is used.
  const nameVisible = await page.isVisible('#name-input');
  if (nameVisible) await page.fill('#name-input', 'Alpha');
  await page.click('#landing-form button[type="submit"]');
  await page.waitForSelector(readySelector);
}

function gameBoardState(myPid, myName = 'Alpha') {
  return {
    type: 'state', code: 'AYBD', started: true, paused: false, host: myPid,
    round_num: 1, target: 1,
    players: {
      [myPid]: mk(myName, [1, 1, 1, 1, 2, 3, 4, 1, 5, 6]),
      guest_bravo: mk('Bravo', [1, 2, 1, 3, 1, 4, 5, 6, 1, 2]),
      guest_cosmo: mk('Cosmo', [1, 1, 1, 1, 1, 1, 1, 1, 2, 3]),
    },
  };
}

test('game-board-signed-in', async ({ page }) => {
  // Game board with JWT: @TestUser pill visible next to the hamburger.
  await seedPage(page);
  await seedAuth(page);
  await hostGame(page, (msg, myPid) => ({ ...msg, ...gameBoardState(myPid, 'TestUser') }), '#game.active', { authed: true });
  await page.waitForFunction(() =>
    document.querySelector('.game-screen .header-username')?.textContent === '@TestUser');
  await settle(page);
  await expect(page).toHaveScreenshot('game-board-signed-in.png');
});

// ── Profile screen ──────────────────────────────────────────────────────────
// The profile page fetches /api/profile/{username} — intercept the fetch to
// return deterministic data so the baseline is byte-stable.

const RECENT_GAMES = [
  { rounds: 30, wins: 14, won_game: true, fastest_win_ms: 6800, avg_roll_speed_ms: 1362, duration_ms: 480000, opponents: [{ name: 'TestOpponent', photo: null }, { name: 'Jazzy Panda', photo: null }] },
  { rounds: 10, wins: 7, won_game: true, fastest_win_ms: 3700, avg_roll_speed_ms: 1300, duration_ms: 180000, opponents: [{ name: 'Jazzy Panda', photo: null }, { name: 'Salty Penguin', photo: null }] },
  { rounds: 12, wins: 7, won_game: true, fastest_win_ms: 5000, avg_roll_speed_ms: 1500, duration_ms: 240000, opponents: [{ name: 'Jazzy Panda', photo: null }, { name: 'Salty Penguin', photo: null }] },
  { rounds: 11, wins: 8, won_game: true, fastest_win_ms: 6100, avg_roll_speed_ms: 1600, duration_ms: 240000, opponents: [{ name: 'Jazzy Panda', photo: null }, { name: 'Salty Penguin', photo: null }] },
  { rounds: 7, wins: 4, won_game: true, fastest_win_ms: 13700, avg_roll_speed_ms: 1200, duration_ms: 180000, opponents: [{ name: 'TestOpponent', photo: null }] },
  { rounds: 3, wins: 0, won_game: false, fastest_win_ms: null, avg_roll_speed_ms: 1200, duration_ms: 120000, opponents: [{ name: 'TestOpponent', photo: null }] },
];

const PROFILE_WITH_STATS = {
  username: 'Mich',
  member_since: '2026-01-15T00:00:00',
  profile_photo_url: null,
  stats: {
    total_games: 42,
    total_wins: 18,
    total_rounds: 156,
    total_rolls: 890,
    fastest_win_ms: 3200,
    fastest_win_rolls: 4,
    total_time_played_ms: 7200000,
  },
  recent: RECENT_GAMES,
};

const PROFILE_WITH_PHOTO = {
  ...PROFILE_WITH_STATS,
  username: 'Mich',
  profile_photo_url: '/static/images/avatar-default.svg',
};

const PROFILE_EMPTY = {
  username: 'Newbie',
  member_since: '2026-06-01T00:00:00',
  profile_photo_url: null,
  stats: null,
};

async function stubProfile(page, data) {
  await page.route('**/api/profile/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
}

test('profile-with-stats', async ({ page }) => {
  await seedPage(page);
  await stubProfile(page, PROFILE_WITH_STATS);
  await page.goto('/@Mich');
  await page.waitForSelector('#profile.active');
  await page.waitForFunction(() =>
    document.getElementById('profile-username')?.textContent === 'Mich');
  // Wait for recent games to render and shimmer to finish
  await page.waitForSelector('.recent-game');
  await page.waitForFunction(() =>
    !document.querySelector('.profile-shimmer'), { timeout: 3000 });
  await settle(page);
  await expect(page).toHaveScreenshot('profile-with-stats.png');
});

test('profile-with-photo', async ({ page }) => {
  await seedPage(page);
  await stubProfile(page, PROFILE_WITH_PHOTO);
  await page.goto('/@Mich');
  await page.waitForSelector('#profile.active');
  await page.waitForFunction(() =>
    document.getElementById('profile-username')?.textContent === 'Mich');
  await page.waitForFunction(() =>
    document.querySelector('.profile-avatar')?.src?.includes('avatar-default.svg'));
  await page.waitForSelector('.recent-game');
  await page.waitForFunction(() =>
    !document.querySelector('.profile-shimmer'), { timeout: 3000 });
  await settle(page);
  await expect(page).toHaveScreenshot('profile-with-photo.png');
});

test('profile-empty', async ({ page }) => {
  await seedPage(page);
  await stubProfile(page, PROFILE_EMPTY);
  await page.goto('/@Newbie');
  await page.waitForSelector('#profile.active');
  await page.waitForFunction(() =>
    document.getElementById('profile-username')?.textContent === 'Newbie');
  await page.waitForFunction(() =>
    document.getElementById('profile-empty')?.hidden === false);
  await settle(page);
  await expect(page).toHaveScreenshot('profile-empty.png');
});

// ── Game detail screen ──────────────────────────────────────────────────────
// The game detail view fetches /api/game/{code} and /api/game/{code}/verify —
// intercept both with deterministic JSON so baselines are stable.

const GAME_DETAIL_DATA = {
  game_code: 'HTVEC',
  started_at: '2026-01-15T14:12:00Z',
  ended_at: '2026-01-15T14:14:20Z',
  duration_ms: 140000,
  num_rounds: 5,
  num_players: 2,
  players: [
    { user_id: 'uid-alpha', name: 'Shifty Octopus', photo: null, wins: 2 },
    { user_id: 'uid-bravo', name: 'notheruser', photo: null, wins: 2 },
  ],
  rounds: [],
};

const GAME_VERIFY_PASS = {
  game_code: 'HTVEC',
  total: 95,
  verified: 95,
  failed: 0,
  no_beacon: 0,
  players: {
    'uid-alpha': { name: 'Shifty Octopus', total: 41, verified: 41, failed: 0 },
    'uid-bravo': { name: 'notheruser', total: 54, verified: 54, failed: 0 },
  },
};

const GAME_VERIFY_NO_DATA = {
  game_code: 'OLDGM',
  total: 0,
  verified: 0,
  failed: 0,
  no_beacon: 0,
  players: {},
};

async function stubGameDetail(page, gameData, verifyData) {
  await page.route('**/api/game/*/verify', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(verifyData),
    });
  });
  await page.route('**/api/game/*', (route) => {
    // Don't intercept the verify route (already handled above)
    if (route.request().url().includes('/verify')) {
      route.fallback();
      return;
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(gameData),
    });
  });
}

test('game-detail-verified', async ({ page }) => {
  // Game detail with all rolls verified via drand beacons.
  await seedPage(page);
  await stubGameDetail(page, GAME_DETAIL_DATA, GAME_VERIFY_PASS);
  await page.goto('/games/HTVEC');
  await page.waitForSelector('#game-detail.active');
  // Wait for the verification animation to complete
  await page.waitForFunction(() =>
    document.querySelector('.gd-trust-done') !== null, { timeout: 15000 });
  await page.waitForFunction(() =>
    document.querySelector('.gd-trust-verdict')?.textContent?.includes('rolls verified'));
  await settle(page);
  await expect(page).toHaveScreenshot('game-detail-verified.png');
});

test('game-detail-no-data', async ({ page }) => {
  // Game detail for a pre-drand game with no beacon data to verify.
  const oldGame = { ...GAME_DETAIL_DATA, game_code: 'OLDGM' };
  await seedPage(page);
  await stubGameDetail(page, oldGame, GAME_VERIFY_NO_DATA);
  await page.goto('/games/OLDGM');
  await page.waitForSelector('#game-detail.active');
  await page.waitForFunction(() =>
    document.querySelector('.gd-trust-done') !== null, { timeout: 15000 });
  await page.waitForFunction(() =>
    document.querySelector('.gd-trust-verdict')?.textContent?.includes('No beacon data'));
  await settle(page);
  await expect(page).toHaveScreenshot('game-detail-no-data.png');
});

test('game-board-signed-out', async ({ page }) => {
  // Game board without JWT: no pill, same dice layout for diffing.
  await seedPage(page);
  await hostGame(page, (msg, myPid) => ({ ...msg, ...gameBoardState(myPid) }), '#game.active');
  await page.waitForFunction(() =>
    !document.querySelector('.game-screen .header-username'));
  await settle(page);
  await expect(page).toHaveScreenshot('game-board-signed-out.png');
});
