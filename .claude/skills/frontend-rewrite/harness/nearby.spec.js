// Nearby-games GPS radar (#nearby) — a real-interaction state made deterministic
// by faking the geolocation fix and stubbing GET /api/nearby with a fixed
// payload (so distances/bearings/roster never vary). No frame synthesis needed.
const { test, expect } = require('./fixtures');
const { seedPage, settle } = require('./determinism');

// A fixed discovery response: stable hosts, bucketed distances, and bearings
// spread around the compass (NW / SE / NNE). No photos → the default avatar, so
// the blips paint identically every run.
const NEARBY = {
  radius_m: 500,
  games: [
    { code: 'AAAAA', host_name: 'Ivy', photo: null, player_count: 3, distance_m: 75, bearing_deg: 315, place_id: 'p1', place_name: 'The Tipsy Parrot', place_photo_url: null },
    { code: 'BBBBB', host_name: 'Mateo', photo: null, player_count: 2, distance_m: 150, bearing_deg: 120, place_id: 'p2', place_name: 'Draught House', place_photo_url: null },
    { code: 'CCCCC', host_name: 'Priya', photo: null, player_count: 5, distance_m: 275, bearing_deg: 30, place_id: 'p3', place_name: 'Radio Coffee', place_photo_url: null },
  ],
};

// Fake a fixed GPS fix (no permission prompt / real geolocation) and stub the
// discovery endpoint with `games`. Call before page.goto.
async function stubDiscovery(page, games) {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (ok) =>
      ok({ coords: { latitude: 30.2672, longitude: -97.7431, accuracy: 20 } });
  });
  await page.route('**/api/nearby*', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ radius_m: 500, games }),
  }));
}

test('nearby', async ({ page }) => {
  await seedPage(page);
  await stubDiscovery(page, NEARBY.games);
  await page.goto('/');
  await page.waitForSelector('#landing.active');
  await page.click('#show-nearby-btn');
  await page.waitForSelector('#nearby.active');
  // All three blips + list rows painted from the stubbed payload.
  await page.waitForFunction(() =>
    document.querySelectorAll('#radar-blips .radar-blip').length === 3
    && document.querySelectorAll('#nearby-list .nearby-row').length === 3);
  // Default avatars are <img>s — make sure they've decoded before the capture.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('#nearby img')].every((i) => i.complete));
  await settle(page);
  await expect(page).toHaveScreenshot('nearby.png');
});

test('nearby-empty', async ({ page }) => {
  await seedPage(page);
  await stubDiscovery(page, []);
  await page.goto('/');
  await page.waitForSelector('#landing.active');
  await page.click('#show-nearby-btn');
  await page.waitForSelector('#nearby.active');
  await page.waitForSelector('#nearby-empty:not([hidden])');
  await settle(page);
  await expect(page).toHaveScreenshot('nearby-empty.png');
});
