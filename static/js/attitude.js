// @ts-check
import { readSession } from './session.js';
import { state } from './state.js';

/**
 * Tensies Attitude — the snark engine.
 *
 * The server resolves the voice pack to one attitude level and serves it at
 * /attitude.json (server/attitude.py); this module loads it once at boot and
 * re-voices the UI through quip(). Everything degrades to the built-in copy:
 * if the fetch fails, the level is "off", or a scenario key is missing, the
 * caller's fallback string is returned verbatim.
 *
 * Dynamism comes from three sources, all client-side:
 *  - a gameplay context (bust/win/loss streaks, dice deficit, idle time) that
 *    the pack's `when` conditions match against, so lines escalate with play;
 *  - per-player identity: a nickname hash-picked from the pack by the stable
 *    tensies_pid, plus a small localStorage memory (lifetime wins/losses,
 *    last-played) so the game remembers returning players;
 *  - the local clock (daypart / weekend), for time-of-day lines.
 *
 * HARNESS CONTRACT: with the level off this module consumes no Math.random,
 * writes no localStorage, and changes no DOM — the pixel suite stays exact.
 */

/**
 * @typedef {object} ConditionedVariant
 * @property {Record<string, string | number | boolean>} [when] All conditions
 *   must hold. Numeric conditions are strings like ">=3", "<=2", ">1", "==0".
 * @property {string} text
 * @property {number} [weight] Random-pick weight (default 1).
 */
/** @typedef {string | ConditionedVariant} Variant */
/**
 * @typedef {object} AttitudePack
 * @property {string} level
 * @property {string[]} levels
 * @property {boolean} player_choice
 * @property {string[]} nicknames
 * @property {Record<string, Variant[]>} phrases Scenario dot-keys → variants.
 */

/** @type {AttitudePack | null} */
let pack = null;

/** Last line said per scenario, so back-to-back quips never repeat. */
const recent = new Map();

/** First resolution per key+vars, for labels that must not churn re-render. */
const sticky = new Map();

/** Gameplay context the pack's `when` conditions match against. */
const ctx = {
  bust_streak: 0,
  win_streak: 0,
  loss_streak: 0,
  /** Leader's matched dice minus mine (0 when leading). */
  behind_by: 0,
  /** Lost the last round with 9+ locked. */
  near_miss: false,
  round_num: 1,
  rounds_played: 0,
  idle_secs: 0,
  is_first_time: false,
  lifetime_visits: 0,
  lifetime_wins: 0,
  lifetime_losses: 0,
  days_since_played: 0,
};

// ── Per-player memory (localStorage; only touched when attitude is on) ──

const MEMORY_KEY = 'tensies_attitude';

/** @type {{ visits: number, wins: number, losses: number, busts: number, last_played: number } | null} */
let memory = null;

function loadMemoryRaw() {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveMemory() {
  if (!memory) return;
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // Storage full/blocked — the game just forgets; nothing depends on it.
  }
}

// ── Loading ──

/** Whether a non-off pack is loaded (the global "is the snark on" switch). */
export function attitudeOn() {
  return Boolean(pack && Object.keys(pack.phrases).length);
}

/**
 * Fetch the server-resolved pack. Fire-and-forget at boot — the UI renders
 * its built-in copy until (unless) this lands.
 */
export async function loadAttitude() {
  try {
    const res = await fetch('/attitude.json');
    if (!res.ok) return;
    pack = await res.json();
  } catch {
    return;
  }
  if (!attitudeOn()) return;
  const saved = loadMemoryRaw();
  ctx.is_first_time = !saved;
  const mem = saved ?? { visits: 0, wins: 0, losses: 0, busts: 0, last_played: 0 };
  memory = mem;
  if (mem.last_played) {
    ctx.days_since_played = Math.floor((Date.now() - mem.last_played) / 86_400_000);
  }
  mem.visits += 1;
  mem.last_played = Date.now();
  saveMemory();
  ctx.lifetime_visits = mem.visits;
  ctx.lifetime_wins = mem.wins;
  ctx.lifetime_losses = mem.losses;
  applyGreeting();
}

/**
 * Re-voice the landing tagline once the pack lands (the landing screen builds
 * before the fetch resolves, so the static string is patched here).
 */
function applyGreeting() {
  const tagline = document.querySelector('#landing .tagline');
  if (tagline) tagline.textContent = quip('greeting', tagline.textContent ?? '');
}

// ── Identity: nickname + time of day ──

/** FNV-1a over the stable player id — the seed for everything per-player. */
function pidHash() {
  const pid = state.myId ?? readSession().playerId ?? '';
  let h = 2166136261;
  for (let i = 0; i < pid.length; i++) {
    h ^= pid.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** This player's persistent pet name (hash-picked, so it sticks). */
function nickname() {
  const pool = pack?.nicknames ?? [];
  return pool.length ? pool[pidHash() % pool.length] : 'friend';
}

function daypart() {
  const h = new Date().getHours();
  if (h < 5) return 'late_night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

function timeShort() {
  const d = new Date();
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}${d.getHours() < 12 ? 'am' : 'pm'}`;
}

// ── Phrase selection ──

/**
 * One pack condition against a live value. Strings starting with a comparison
 * operator compare numerically; everything else is strict equality.
 * @param {string | number | boolean} expected
 * @param {unknown} actual
 */
function evalCond(expected, actual) {
  if (typeof expected === 'string') {
    const m = expected.match(/^(>=|<=|==|>|<)(.+)$/);
    if (m) {
      const want = Number(m[2]);
      const have = Number(actual);
      if (Number.isNaN(want) || Number.isNaN(have)) return false;
      switch (m[1]) {
        case '>=': return have >= want;
        case '<=': return have <= want;
        case '>': return have > want;
        case '<': return have < want;
        default: return have === want;
      }
    }
  }
  return actual === expected;
}

/**
 * @param {ConditionedVariant[]} candidates
 */
function weightedPick(candidates) {
  const total = candidates.reduce((sum, v) => sum + (v.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const v of candidates) {
    r -= v.weight ?? 1;
    if (r <= 0) return v;
  }
  return candidates[candidates.length - 1];
}

/**
 * Fill {placeholders} from per-player builtins + the live facts. Unknown
 * placeholders are left intact so a pack typo is visible, not silent.
 * @param {string} text
 * @param {Record<string, unknown>} facts
 */
function interpolate(text, facts) {
  return text.replace(/\{(\w+)\}/g, (whole, key) => {
    if (key === 'nickname') return nickname();
    if (key === 'time') return timeShort();
    const v = facts[key];
    return v === undefined || v === null ? whole : String(v);
  });
}

/**
 * The voice line for a scenario, or `fallback` (returned verbatim) when the
 * attitude is off or the pack has nothing for the key. Variants whose `when`
 * conditions match the live context outrank generic ones — reacting beats
 * reciting — and the last-said line is avoided when there's a choice.
 * @param {string} key Scenario dot-key, e.g. 'winner.flavor_lose'.
 * @param {string} fallback The built-in copy (already formatted).
 * @param {Record<string, string | number | boolean>} [vars] Event facts; also
 *   usable in `when` conditions and as {placeholders}.
 */
export function quip(key, fallback, vars = {}) {
  const pool = pack?.phrases[key];
  if (!pool?.length) return fallback;
  /** @type {Record<string, unknown>} */
  const facts = {
    ...ctx,
    daypart: daypart(),
    is_weekend: [0, 6].includes(new Date().getDay()),
    ...vars,
  };
  const all = pool.map((v) => (typeof v === 'string' ? { text: v } : v));
  const eligible = all.filter(
    (v) => !v.when || Object.entries(v.when).every(([k, want]) => evalCond(want, facts[k])),
  );
  if (!eligible.length) return fallback;
  const conditioned = eligible.filter((v) => v.when);
  let candidates = conditioned.length ? conditioned : eligible;
  const last = recent.get(key);
  if (candidates.length > 1 && last) {
    const fresh = candidates.filter((v) => v.text !== last);
    if (fresh.length) candidates = fresh;
  }
  const picked = weightedPick(candidates);
  recent.set(key, picked.text);
  return interpolate(picked.text, facts);
}

/**
 * quip(), but the first resolution sticks for the session — for labels that
 * re-render on every snapshot and must not churn (lobby copy, button text).
 * Nothing is cached until the pack has loaded, so an early call can't pin the
 * fallback.
 * @param {string} key
 * @param {string} fallback
 * @param {Record<string, string | number | boolean>} [vars]
 */
export function quipSticky(key, fallback, vars = {}) {
  if (!pack) return fallback;
  const memo = key + JSON.stringify(vars);
  let line = sticky.get(memo);
  if (line === undefined) {
    line = quip(key, fallback, vars);
    sticky.set(memo, line);
  }
  return line;
}

// ── Gameplay context tracking ──

/** @type {number | null} */
let lastRound = null;
let lastActivity = Date.now();
let nextNagAtSecs = 30;

/** @typedef {import('./types.js').GameSnapshot} GameSnapshot */

/**
 * Feed every snapshot through (router.showFor): round bookkeeping, the
 * leaderboard gap, and the new-round announcement.
 * @param {GameSnapshot} snap
 */
export function observeSnapshot(snap) {
  if (!attitudeOn()) return;
  const newRound = snap.started && lastRound !== null && snap.round_num !== lastRound;
  if (snap.started) lastRound = snap.round_num;
  ctx.round_num = snap.round_num;
  const me = state.myId ? snap.players[state.myId] : undefined;
  if (snap.started && me) {
    const mine = me.has_rolled ? me.dice.filter((d) => d === snap.target).length : 0;
    let best = 0;
    for (const [pid, p] of Object.entries(snap.players)) {
      if (pid === state.myId || !p.has_rolled) continue;
      best = Math.max(best, p.dice.filter((d) => d === snap.target).length);
    }
    ctx.behind_by = Math.max(0, best - mine);
  }
  if (newRound) {
    ctx.rounds_played += 1;
    markActivity();
    toast(quip('round.start', '', { round: snap.round_num, target: snap.target }));
  }
}

/**
 * Record my completed (non-winning) roll; returns the scenario it warrants.
 * @param {number} gained Newly matched dice this roll.
 * @param {number} matchedNow Total matched after the roll.
 * @returns {string | null}
 */
export function recordRoll(gained, matchedNow) {
  if (!attitudeOn()) return null;
  markActivity();
  if (gained <= 0) {
    ctx.bust_streak += 1;
    if (memory) {
      memory.busts += 1;
      saveMemory();
    }
    return 'roll.bust';
  }
  ctx.bust_streak = 0;
  if (matchedNow === 9) return 'roll.one_left';
  if (gained >= 3) return 'roll.good';
  return null;
}

/**
 * Record a finished round: streaks, the near-miss flag the winner overlay
 * reads, and lifetime memory.
 * @param {boolean} iWon
 * @param {number} myMatched My locked dice when the round ended.
 */
export function recordRoundEnd(iWon, myMatched) {
  if (!attitudeOn()) return;
  ctx.near_miss = !iWon && myMatched >= 9;
  if (iWon) {
    ctx.win_streak += 1;
    ctx.loss_streak = 0;
  } else {
    ctx.loss_streak += 1;
    ctx.win_streak = 0;
  }
  ctx.bust_streak = 0;
  if (memory) {
    if (iWon) memory.wins += 1;
    else memory.losses += 1;
    saveMemory();
    ctx.lifetime_wins = memory.wins;
    ctx.lifetime_losses = memory.losses;
  }
}

/** Whether the last recorded round ended as a 9-locked near miss. */
export function wasNearMiss() {
  return ctx.near_miss;
}

/** Reset the idle clock (any meaningful player/board activity). */
export function markActivity() {
  lastActivity = Date.now();
  ctx.idle_secs = 0;
  nextNagAtSecs = 30;
}

/**
 * Idle-nag check, polled by the game screen. A line when one is due (first at
 * 30s idle, again every 45s of continued idleness), else null.
 * @returns {string | null}
 */
export function idleNag() {
  if (!attitudeOn()) return null;
  ctx.idle_secs = Math.floor((Date.now() - lastActivity) / 1000);
  if (ctx.idle_secs < nextNagAtSecs) return null;
  nextNagAtSecs = ctx.idle_secs + 45;
  return quip('idle_nag', '') || null;
}

// ── The quip toast (the board's voice) ──

/** @type {ReturnType<typeof setTimeout> | undefined} */
let toastTimer;

/**
 * Flash a line on the board's quip toast. The toast is absolutely positioned
 * (game.css) so it never shifts the dice, and a falsy text is a no-op — at
 * level off the element stays empty and hidden.
 * @param {string} text
 */
export function toast(text) {
  if (!text) return;
  const el = document.getElementById('quip-toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4500);
}

/** Drop the toast early — a new outcome with nothing to say supersedes it. */
export function hideToast() {
  clearTimeout(toastTimer);
  document.getElementById('quip-toast')?.classList.remove('show');
}
