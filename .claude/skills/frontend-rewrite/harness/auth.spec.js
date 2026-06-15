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

function gameBoardState(myPid) {
  return {
    type: 'state', code: 'AYBD', started: true, paused: false, host: myPid,
    round_num: 1, target: 1,
    players: {
      [myPid]: mk('Alpha', [1, 1, 1, 1, 2, 3, 4, 1, 5, 6]),
      guest_bravo: mk('Bravo', [1, 2, 1, 3, 1, 4, 5, 6, 1, 2]),
      guest_cosmo: mk('Cosmo', [1, 1, 1, 1, 1, 1, 1, 1, 2, 3]),
    },
  };
}

test('game-board-signed-in', async ({ page }) => {
  // Game board with JWT: @TestUser pill visible next to the hamburger.
  await seedPage(page);
  await seedAuth(page);
  await hostGame(page, (msg, myPid) => ({ ...msg, ...gameBoardState(myPid) }), '#game.active', { authed: true });
  await page.waitForFunction(() =>
    document.querySelector('.game-screen .header-username')?.textContent === '@TestUser');
  await settle(page);
  await expect(page).toHaveScreenshot('game-board-signed-in.png');
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
