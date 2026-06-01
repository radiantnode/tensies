// Persist the unmatched-zone die layout so a refresh / reconnect doesn't
// re-shuffle the dice the player is looking at. Keyed by game code and
// round_num — round transitions intentionally start fresh (new dice).
//
// Stored shape: { round: <int>, positions: [{x, y, rot}, ...] }
// Order matches DOM order of .die-wrapper inside .zone-unmatched, which in
// turn matches player.dice.filter(d => d !== target) order — stable across
// renders for a given state snapshot.

const KEY_PREFIX = 'tensies_dice_';

export function saveDicePositions(code, round, positions) {
  if (!code) return;
  try {
    localStorage.setItem(KEY_PREFIX + code, JSON.stringify({ round, positions }));
  } catch (_) {}
}

export function loadDicePositions(code, round) {
  if (!code) return null;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + code);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.round !== round) return null;
    return data.positions;
  } catch (_) {
    return null;
  }
}
