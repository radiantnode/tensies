// Stateful / server-driven views (lobby, game board, players bar, winner/loser
// overlays). The whole UI renders from inbound WS frames, so a SINGLE real host
// connection is enough: pinWebSocket() rewrites the inbound `state` frame into
// whatever view we want, with a fixed code, roster, dice, and target — byte
// stable regardless of server randomness. seedPage() pins Math.random (dice
// scatter) and Date.now (winner countdown), so no values drift between runs.
const { test, expect } = require('@playwright/test');
const { seedPage, settle, pinWebSocket } = require('./determinism');

// Fixed roster. The host key is the real player_id from the `welcome` frame
// (captured per-test); the other two are stable stand-ins.
function roster(myPid, dice) {
  // has_rolled drives both the players-bar progress and the matched-grid split
  // in my-area, so a started game must report it true to look mid-round.
  const p = (name, d) => ({ name, dice: d, wins: 0, has_rolled: d.length > 0, roll_count: d.length ? 1 : 0, disconnected: false });
  return {
    [myPid]: p('Alpha', dice.alpha),
    guest_bravo: p('Bravo', dice.bravo),
    guest_cosmo: p('Cosmo', dice.cosmo),
  };
}

const mk = (name, dice = [], extra = {}) =>
  ({ name, dice, wins: 0, has_rolled: dice.length > 0, roll_count: dice.length ? 1 : 0, disconnected: false, ...extra });

// Drive a host into the app and rewrite the post-create frame via `build`.
// `after` runs once `readySelector` is visible (e.g. open a menu).
async function host(page, build, readySelector, after) {
  await seedPage(page);
  let myPid = null;
  await pinWebSocket(page, (msg) => {
    if (msg.type === 'welcome') { myPid = msg.player_id; return msg; }
    if (msg.type === 'state' || msg.type === 'round_won') return build(msg, myPid);
    return msg;
  });
  await page.goto('/');
  await page.waitForSelector('#landing.active');
  await page.fill('#name-input', 'Alpha');
  await page.click('#landing-form button[type="submit"]');
  await page.waitForSelector(readySelector);
  if (after) await after(page);
}

test('lobby-3p', async ({ page }) => {
  await host(page, (msg, myPid) => ({
    ...msg, type: 'state', code: 'AYBD', started: false, paused: false, host: myPid,
    round_num: 0, target: 1,
    players: roster(myPid, { alpha: [], bravo: [], cosmo: [] }),
  }), '#lobby.active');
  await settle(page);
  await expect(page).toHaveScreenshot('lobby-3p.png');
});

test('game-board', async ({ page }) => {
  await host(page, (msg, myPid) => ({
    ...msg, type: 'state', code: 'AYBD', started: true, paused: false, host: myPid,
    round_num: 1, target: 1,
    players: roster(myPid, {
      alpha: [1, 1, 1, 1, 2, 3, 4, 1, 5, 6], // five locked
      bravo: [1, 2, 1, 3, 1, 4, 5, 6, 1, 2], // four locked
      cosmo: [1, 1, 1, 1, 1, 1, 1, 1, 2, 3], // eight locked
    }),
  }), '#game.active');
  await settle(page);
  await expect(page).toHaveScreenshot('game-board.png');
});

test('winner-win', async ({ page }) => {
  await host(page, (msg, myPid) => ({
    ...msg, type: 'round_won', code: 'AYBD', started: true, paused: false, host: myPid,
    round_num: 2, target: 1, winner_name: 'Alpha',
    players: roster(myPid, {
      alpha: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // all locked -> I won
      bravo: [1, 1, 1, 2, 3, 4, 1, 5, 1, 6],
      cosmo: [1, 1, 2, 3, 4, 5, 1, 6, 1, 2],
    }),
  }), '#winner-overlay[open]');
  await settle(page);
  await expect(page).toHaveScreenshot('winner-win.png');
});

test('winner-lose', async ({ page }) => {
  await host(page, (msg, myPid) => ({
    ...msg, type: 'round_won', code: 'AYBD', started: true, paused: false, host: myPid,
    round_num: 2, target: 1, winner_name: 'Cosmo',
    players: roster(myPid, {
      alpha: [1, 1, 1, 1, 1, 1, 1, 2, 3, 4], // not all -> I lost
      bravo: [1, 1, 2, 3, 4, 5, 1, 6, 1, 2],
      cosmo: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Cosmo won
    }),
  }), '#winner-overlay[open]');
  await settle(page);
  await expect(page).toHaveScreenshot('winner-lose.png');
});

test('lobby-solo', async ({ page }) => {
  await host(page, (msg, myPid) => ({
    ...msg, type: 'state', code: 'AYBD', started: false, paused: false, host: myPid,
    round_num: 0, target: 1, players: { [myPid]: mk('Alpha') },
  }), '#lobby.active');
  await settle(page);
  await expect(page).toHaveScreenshot('lobby-solo.png');
});

test('lobby-guest', async ({ page }) => {
  // Host is someone else; the viewer (myPid) is a non-host with a "you" badge
  // and the "waiting for the host" message instead of a Start button.
  await host(page, (msg, myPid) => ({
    ...msg, type: 'state', code: 'AYBD', started: false, paused: false, host: 'guest_alpha',
    round_num: 0, target: 1,
    players: { guest_alpha: mk('Alpha'), [myPid]: mk('Bravo'), guest_cosmo: mk('Cosmo') },
  }), '#lobby.active');
  await settle(page);
  await expect(page).toHaveScreenshot('lobby-guest.png');
});

test('lobby-5p', async ({ page }) => {
  await host(page, (msg, myPid) => ({
    ...msg, type: 'state', code: 'AYBD', started: false, paused: false, host: myPid,
    round_num: 0, target: 1,
    players: {
      [myPid]: mk('Alpha'), g2: mk('Bravo'), g3: mk('Cosmo'),
      g4: mk('Delta'), g5: mk('Echo'),
    },
  }), '#lobby.active');
  await settle(page);
  await expect(page).toHaveScreenshot('lobby-5p.png');
});

test('game-menu-open', async ({ page }) => {
  await host(page, (msg, myPid) => ({
    ...msg, type: 'state', code: 'AYBD', started: true, paused: false, host: myPid,
    round_num: 1, target: 1,
    players: roster(myPid, {
      alpha: [1, 1, 1, 1, 2, 3, 4, 1, 5, 6], bravo: [1, 2, 1, 3, 1, 4, 5, 6, 1, 2],
      cosmo: [1, 1, 1, 1, 1, 1, 1, 1, 2, 3],
    }),
  }), '#game.active', async (p) => {
    await p.click('#game-menu-btn');
    await p.waitForSelector('#game-menu.open');
  });
  await settle(page);
  await expect(page).toHaveScreenshot('game-menu-open.png');
});

test('paused-host', async ({ page }) => {
  // Host returning into a paused game lands on the board with the menu popped
  // open: a Resume toggle, a frozen 60:00 countdown, and "Everyone is here".
  await host(page, (msg, myPid) => ({
    ...msg, type: 'state', code: 'AYBD', started: true, paused: true, host: myPid,
    round_num: 1, target: 1, pause_remaining_ms: 3600000,
    players: roster(myPid, {
      alpha: [1, 1, 1, 1, 2, 3, 4, 1, 5, 6], bravo: [1, 2, 1, 3, 1, 4, 5, 6, 1, 2],
      cosmo: [1, 1, 1, 1, 1, 1, 1, 1, 2, 3],
    }),
  }), '#game.active', async (p) => {
    // The pause status lives inside the menu panel, so it's only visible once
    // the menu is open. Open it ourselves rather than rely on the auto-open.
    if (!(await p.isVisible('#game-menu.open'))) await p.click('#game-menu-btn');
    await p.waitForSelector('#menu-pause-status:not([hidden])');
  });
  await settle(page);
  await expect(page).toHaveScreenshot('paused-host.png');
});

test('paused-guest', async ({ page }) => {
  // Non-host during a pause: the board stays under a dialog overlay reading
  // "Waiting for <Host> to resume the game".
  await host(page, (msg, myPid) => ({
    ...msg, type: 'state', code: 'AYBD', started: true, paused: true, host: 'guest_alpha',
    round_num: 1, target: 1,
    players: {
      guest_alpha: mk('Alpha', [1, 1, 1, 2, 3, 4, 5, 6, 1, 2]),
      [myPid]: mk('Bravo', [1, 1, 1, 1, 2, 3, 4, 1, 5, 6]),
      guest_cosmo: mk('Cosmo', [1, 1, 1, 1, 1, 1, 1, 1, 2, 3]),
    },
  }), '#pause-overlay[open]');
  await settle(page);
  await expect(page).toHaveScreenshot('paused-guest.png');
});

test('disconnect-waiting', async ({ page }) => {
  // A peer dropped mid-game: the loading screen shows "Waiting for <name> to
  // reconnect…" until the grace window elapses.
  await host(page, (msg, myPid) => ({
    ...msg, type: 'state', code: 'AYBD', started: true, paused: false, host: myPid,
    round_num: 1, target: 1,
    players: {
      [myPid]: mk('Alpha', [1, 1, 1, 1, 2, 3, 4, 1, 5, 6]),
      guest_bravo: mk('Bravo', [], { disconnected: true }),
      guest_cosmo: mk('Cosmo', [1, 1, 1, 1, 1, 1, 1, 1, 2, 3]),
    },
  }), '#loading.active');
  await page.waitForFunction(() =>
    /reconnect/i.test(document.getElementById('loading-msg')?.textContent || ''));
  await settle(page);
  await expect(page).toHaveScreenshot('disconnect-waiting.png');
});
