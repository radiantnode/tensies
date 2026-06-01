// Template for server-driven / multi-player states (lobby, game board, players
// bar, winner overlay). Copy this per complex view and adapt the driving steps.
//
// Two ideas make these byte-stable from the OUTSIDE only:
//   1. Multiple browser CONTEXTS = isolated localStorage, one real player each
//      (the programmatic equivalent of the host/guest MCP profiles).
//   2. pinWebSocket() rewrites inbound `state` frames so dice + roster are fixed,
//      since dice come from the server and a client RNG stub cannot reach them.
//
// Rename the .example.spec.js -> .spec.js once you have a state worth capturing.
const { test, expect } = require('@playwright/test');
const { seedPage, settle, pinWebSocket } = require('./determinism');

test('lobby-3p', async ({ browser }, testInfo) => {
  // One context per player. Capture the HOST's view here; add guest.page
  // screenshots if a guest-specific view matters.
  const host = await browser.newContext({ viewport: testInfo.project.use.viewport });
  const hostPage = await host.newPage();
  await seedPage(hostPage);

  // Force a known, fixed roster + code regardless of server randomness.
  await pinWebSocket(hostPage, (msg) => {
    if (msg.type === 'state') {
      msg.code = 'AAAA';
      msg.players = {
        p1: { name: 'Alpha', dice: [], wins: 0, has_rolled: false, roll_count: 0 },
        p2: { name: 'Bravo', dice: [], wins: 0, has_rolled: false, roll_count: 0 },
        p3: { name: 'Cosmo', dice: [], wins: 0, has_rolled: false, roll_count: 0 },
      };
      msg.host = 'p1';
    }
    return msg;
  });

  await hostPage.goto('/');
  // ... drive create-game here (click create, type name, wait for #lobby.active).
  // Bring up real guests with more contexts if the lobby needs them present:
  //   const g = await browser.newContext(...); await g.newPage().goto('/?join=AAAA') ...
  await hostPage.waitForSelector('#lobby.active');

  await settle(hostPage);
  await expect(hostPage).toHaveScreenshot('lobby-3p.png');

  await host.close();
});
