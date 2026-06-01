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
  const mk = (name, d) => ({ name, dice: d, wins: 0, has_rolled: false, roll_count: 0, disconnected: false });
  return {
    [myPid]: mk('Alpha', dice.alpha),
    guest_bravo: mk('Bravo', dice.bravo),
    guest_cosmo: mk('Cosmo', dice.cosmo),
  };
}

// Drive a host into the app and rewrite the post-create frame via `build`.
async function host(page, build, readySelector) {
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
