// Stateful / server-driven views (lobby, game board, players bar, winner/loser
// overlays). The whole UI renders from inbound WS frames, so a SINGLE real host
// connection is enough: pinWebSocket() rewrites the inbound `state` frame into
// whatever view we want, with a fixed code, roster, dice, and target — byte
// stable regardless of server randomness. seedPage() pins Math.random (dice
// scatter) and Date.now (winner countdown), so no values drift between runs.
const { test, expect } = require('./fixtures');
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

test('game-ended', async ({ page }) => {
  // The host ends the game mid-round: the server sends a `game_ended` frame
  // with final stats. The overlay shows player scores, avatars, and a
  // "Bummer!" dismiss button. Like fatal-error, the game_ended frame is a
  // separate message type — inject it after the started state settles.
  await seedPage(page);
  let myPid = null;
  await page.routeWebSocket(/\/ws$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((raw) => {
      let m; try { m = JSON.parse(raw); } catch { return ws.send(raw); }
      if (m.type === 'welcome') { myPid = m.player_id; ws.send(raw); return; }
      if (m.type === 'state') {
        // Rewrite into a started 3-player game at round 4.
        ws.send(JSON.stringify({
          ...m, type: 'state', code: 'AYBD', started: true, paused: false, host: myPid,
          round_num: 4, target: 4,
          players: {
            [myPid]: mk('Alpha', [4, 4, 4, 1, 2, 3, 5, 6, 4, 2], { wins: 1 }),
            guest_bravo: mk('Bravo', [4, 4, 1, 2, 3, 5, 6, 4, 4, 3], { wins: 2 }),
            guest_cosmo: mk('Cosmo', [4, 4, 4, 4, 1, 2, 3, 5, 6, 1], { wins: 0 }),
          },
        }));
        // After the game screen settles, inject the game_ended message.
        setTimeout(() => ws.send(JSON.stringify({
          type: 'game_ended',
          ended_by: 'Alpha',
          round_num: 4,
          players: {
            [myPid]: { name: 'Alpha', wins: 1 },
            guest_bravo: { name: 'Bravo', wins: 2 },
            guest_cosmo: { name: 'Cosmo', wins: 0 },
          },
        })), 600);
        return;
      }
      ws.send(raw);
    });
    ws.onMessage((raw) => server.send(raw));
  });
  await page.goto('/');
  await page.waitForSelector('#landing.active');
  await page.fill('#name-input', 'Alpha');
  await page.click('#landing-form button[type="submit"]');
  await page.waitForSelector('#game-ended-overlay[open]');
  await settle(page);
  await expect(page).toHaveScreenshot('game-ended.png');
});

test('fatal-error', async ({ page }) => {
  // A terminal `error` frame (the pause cap is the only producer) drops the
  // session and bounces back to landing with the reason shown inline.
  //
  // The error must arrive AFTER the create->loading View Transition settles.
  // showScreen() early-returns when its target is already the active screen, so
  // an instant error (while landing is still active mid-transition) no-ops and
  // we get stranded on loading. In production the pause cap fires long after the
  // user has settled, so it never races; the delay reproduces that timing.
  await seedPage(page);
  await page.routeWebSocket(/\/ws$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((raw) => {
      let m; try { m = JSON.parse(raw); } catch { return ws.send(raw); }
      if (m.type === 'state') {
        setTimeout(() => ws.send(JSON.stringify({
          type: 'error', fatal: true, msg: 'Game ended — it was paused too long.',
        })), 900);
        return;
      }
      ws.send(raw);
    });
    ws.onMessage((raw) => server.send(raw));
  });
  await page.goto('/');
  await page.waitForSelector('#landing.active');
  await page.fill('#name-input', 'Alpha');
  await page.click('#landing-form button[type="submit"]');
  await page.waitForFunction(() => {
    const landing = document.getElementById('landing');
    const loading = document.getElementById('loading');
    const err = document.getElementById('landing-error');
    return landing?.classList.contains('active') &&
      !loading?.classList.contains('active') &&
      (err?.textContent || '').trim().length > 0;
  });
  await settle(page);
  await expect(page).toHaveScreenshot('fatal-error.png');
});

// ── Sub-states: player-card variants, paused roll button, every target die ──

// A closed menu (#game-menu without .open) is display:none, so a default
// (visible) waitForSelector on it never resolves — wait on the class instead.
const menuClosed = (p) =>
  p.waitForFunction(() => !document.getElementById('game-menu')?.classList.contains('open'));

test('players-bar-variants', async ({ page }) => {
  // One bar that exercises all distinct player-card renders at once:
  //   leading (most wins) · hot (>=7 matched, not me) · disconnected · is-me.
  // It must be PAUSED: in a non-paused game a disconnected peer routes the
  // viewer to the loading screen, so the board (and bar) wouldn't be visible.
  await host(page, (msg, myPid) => ({
    ...msg, type: 'state', code: 'AYBD', started: true, paused: true, host: myPid,
    round_num: 4, target: 1, pause_remaining_ms: 3600000,
    players: {
      [myPid]: mk('Alpha', [1, 1, 1, 2, 3, 4, 5, 6, 1, 2], { wins: 1 }),     // is-me
      g_lead: mk('Bravo', [1, 1, 2, 3, 4, 5, 6, 1, 2, 3], { wins: 3 }),       // leading (top wins)
      g_hot: mk('Cosmo', [1, 1, 1, 1, 1, 1, 1, 1, 2, 3], { wins: 0 }),        // hot (8 matched)
      g_disc: mk('Delta', [], { wins: 0, disconnected: true }),               // disconnected
    },
  }), '#game.active', async (p) => {
    if (await p.isVisible('#game-menu.open')) await p.click('#game-menu-btn');
    await menuClosed(p);
  });
  await settle(page);
  // Clip to the bar so dice scatter below doesn't enter the frame.
  await expect(page.locator('#players-bar')).toHaveScreenshot('players-bar-variants.png');
});

test('paused-board', async ({ page }) => {
  // Host paused, menu CLOSED: the board itself with the roll button reading
  // "Paused" (every player's roll button reflects the pause).
  await host(page, (msg, myPid) => ({
    ...msg, type: 'state', code: 'AYBD', started: true, paused: true, host: myPid,
    round_num: 1, target: 1, pause_remaining_ms: 3600000,
    players: roster(myPid, {
      alpha: [1, 1, 1, 1, 2, 3, 4, 1, 5, 6], bravo: [1, 2, 1, 3, 1, 4, 5, 6, 1, 2],
      cosmo: [1, 1, 1, 1, 1, 1, 1, 1, 2, 3],
    }),
  }), '#game.active', async (p) => {
    if (await p.isVisible('#game-menu.open')) await p.click('#game-menu-btn'); // close auto-opened menu
    await menuClosed(p);
    await p.waitForFunction(() => document.getElementById('roll-btn')?.textContent?.trim() === 'Paused');
  });
  await settle(page);
  await expect(page).toHaveScreenshot('paused-board.png');
});

for (const target of [1, 2, 3, 4, 5, 6]) {
  test(`target-die-${target}`, async ({ page }) => {
    // The round-target die for each value. Clipped to the element, so it's a
    // tiny, focused baseline independent of board scatter.
    await host(page, (msg, myPid) => ({
      ...msg, type: 'state', code: 'AYBD', started: true, paused: false, host: myPid,
      round_num: target, target,
      players: roster(myPid, {
        alpha: [target, target, 1, 2, 3, 4, 5, 6, target, 2],
        bravo: [1, 2, 3, 4, 5, 6, 1, 2, 3, 4], cosmo: [target, target, target, 1, 2, 3, 4, 5, 6, 1],
      }),
    }), '#game.active');
    const die = page.locator('round-target');
    await die.waitFor();
    await settle(page);
    await expect(die).toHaveScreenshot(`target-die-${target}.png`);
  });
}

for (const value of [1, 2, 3, 4, 5, 6]) {
  test(`play-die-${value}`, async ({ page }) => {
    // The regular ivory play die for each face value, clipped to the first
    // unmatched die on the board. All ten of my dice carry the value and the
    // target differs, so the clip is a plain (non-matched) cube — face,
    // bone material, drilled pips — at its seeded scatter pose.
    await host(page, (msg, myPid) => ({
      ...msg, type: 'state', code: 'AYBD', started: true, paused: false, host: myPid,
      round_num: 1, target: value % 6 + 1,
      players: roster(myPid, {
        alpha: Array(10).fill(value),
        bravo: [1, 2, 3, 4, 5, 6, 1, 2, 3, 4], cosmo: [2, 3, 4, 5, 6, 1, 2, 3, 4, 5],
      }),
    }), '#game.active');
    const die = page.locator('.zone-unmatched .die-wrapper').first().locator('.die-scene');
    await die.waitFor();
    await settle(page);
    await expect(die).toHaveScreenshot(`play-die-${value}.png`);
  });
}
