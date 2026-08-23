// @ts-check
import { PIP_POSITIONS } from './pips.js';
import { state } from './state.js';

/** @typedef {import('./types.js').GameSnapshot} GameSnapshot */

/**
 * Cube rotation (applied to `.die-3d`) that brings each face value to the front.
 * @type {Record<number, string>}
 */
export const FACE_ROTATIONS = {
  1: 'rotateY(0deg)',
  2: 'rotateY(-90deg)',
  3: 'rotateX(90deg)',
  4: 'rotateX(-90deg)',
  5: 'rotateY(90deg)',
  6: 'rotateY(180deg)',
};

/**
 * Build a 3-D die showing `value`, marked as matched when it equals `target`.
 * @param {number} value
 * @param {number} target
 * @returns {HTMLDivElement} the `.die-scene` wrapper
 */
export function makeDie(value, target) {
  const scene = document.createElement('div');
  scene.className = 'die-scene';

  const cube = document.createElement('div');
  cube.className = value === target && value !== 0 ? 'die-3d match' : 'die-3d';
  cube.style.transform = FACE_ROTATIONS[value] ?? 'rotateY(0deg)';

  for (let faceValue = 1; faceValue <= 6; faceValue++) {
    const face = document.createElement('div');
    face.className = `face face-${faceValue}`;
    for (let i = 0; i < 9; i++) {
      const dot = document.createElement('span');
      dot.className = PIP_POSITIONS[faceValue].includes(i) ? 'dot active' : 'dot';
      face.appendChild(dot);
    }
    cube.appendChild(face);
  }

  scene.appendChild(cube);
  return scene;
}

/**
 * @typedef {{ x: number, y: number, rot: number }} DiePosition
 */

/**
 * The board still (`poster-game.webp`, painted `center / cover` on the fixed
 * .game-bg layer) has a pint glass and its coaster in the top-left corner.
 * Dice should never be set down on it, so the scatter keeps clear of this
 * rectangle. It is in the IMAGE's own pixel space — a constant per picture,
 * not per device — and `glassRect()` maps it through the cover transform
 * for whatever viewport is showing it.
 */
const BG_IMAGE = { w: 640, h: 1248 };
const GLASS_IN_IMAGE = { x: 0, y: 150, w: 143, h: 235 };
/* Padding around the glass, in viewport px. Covers the few px by which iOS
   shifts the picture (the layer is sized to 100lvh plus a chrome gap, not
   the small viewport) and the 4K poster's slightly different framing. */
const GLASS_PAD = 16;
/* A die's front face projects ~6px past its layout box on each side
   (translateZ under the scene's perspective); count that as part of it. */
const DIE_OVERHANG = 6;

/**
 * Where the glass sits in viewport px for a `center / cover` fit of the
 * board still into `vw`×`vh`.
 * @param {number} vw
 * @param {number} vh
 * @returns {{ left: number, top: number, right: number, bottom: number }}
 */
export function glassRect(vw, vh) {
  const scale = Math.max(vw / BG_IMAGE.w, vh / BG_IMAGE.h);
  const offX = (BG_IMAGE.w * scale - vw) / 2;
  const offY = (BG_IMAGE.h * scale - vh) / 2;
  const g = GLASS_IN_IMAGE;
  return {
    left: g.x * scale - offX - GLASS_PAD,
    top: g.y * scale - offY - GLASS_PAD,
    right: (g.x + g.w) * scale - offX + GLASS_PAD,
    bottom: (g.y + g.h) * scale - offY + GLASS_PAD,
  };
}

/**
 * Scatter positions for `count` dice of size `sz` inside `zoneRect`: divide
 * the zone into a grid, drop the cells that would put a die on the glass,
 * the mat or the ROLL coin, jitter within each remaining cell, then shuffle — guaranteed no overlap,
 * still looks scattered. If the exclusion leaves too few cells the grid is
 * given more rows until there are enough.
 * @param {DOMRect} zoneRect
 * @param {number} count
 * @param {number} sz die size in px
 * @returns {DiePosition[]}
 */
export function placeGrid(zoneRect, count, sz) {
  if (count === 0) return [];
  const pad = 8;
  const w = zoneRect.width - pad * 2;
  const h = zoneRect.height - pad * 2;
  /* Viewport-space boxes a die must not be set down on: the glass in the
     background still, the mat, and the ROLL coin (the latter two read off
     the DOM — both are rendered before the scatter is placed). */
  const keepClear = [glassRect(window.innerWidth, window.innerHeight)];
  /** @type {Array<[string, number]>} */
  const fixtures = [['.zone-matched', 6], ['#roll-btn', 10]];
  for (const [sel, pad] of fixtures) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    keepClear.push({ left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad });
  }
  /** @param {number} x zone-relative @param {number} y zone-relative */
  const blocked = (x, y) => {
    const l = zoneRect.left + x - DIE_OVERHANG;
    const t = zoneRect.top + y - DIE_OVERHANG;
    const r = l + sz + DIE_OVERHANG * 2;
    const b = t + sz + DIE_OVERHANG * 2;
    return keepClear.some((k) => l < k.right && r > k.left && t < k.bottom && b > k.top);
  };

  // At least 3 columns: the zone spans the board, and the right-hand column
  // is mostly under the mat, so two would stack the dice up the left edge.
  const cols = Math.max(3, Math.round(Math.sqrt(count * w / h)));
  let rows = Math.ceil(count / cols);
  /** @type {DiePosition[]} */
  let positions = [];
  // Each extra row makes the cells shorter; stop once there are enough clear
  // cells, or once cells are too short to hold a die (then take what there is).
  for (;;) {
    const cellW = w / cols;
    const cellH = h / rows;
    const jx = Math.max(0, (cellW - sz) / 2 * 0.6);
    const jy = Math.max(0, (cellH - sz) / 2 * 0.6);
    positions = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = pad + c * cellW + cellW / 2 - sz / 2;
        const by = pad + r * cellH + cellH / 2 - sz / 2;
        const x = Math.max(pad, Math.min(pad + w - sz, bx + (Math.random() - 0.5) * jx * 2));
        const y = Math.max(pad, Math.min(pad + h - sz, by + (Math.random() - 0.5) * jy * 2));
        if (blocked(x, y)) continue;
        positions.push({ x, y, rot: (Math.random() - 0.5) * 24 });
      }
    }
    if (positions.length >= count || h / (rows + 1) < sz) break;
    rows++;
  }
  // Fisher–Yates shuffle so dice get random grid slots.
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, count);
}

/**
 * Fingerprint of my dice as rendered. Includes `roll_count` so a re-roll that
 * lands on identical values still reads as a new roll (without it the client
 * could never detect that roll arrived — the old roll-ack hang).
 * @param {GameSnapshot} snap
 * @returns {string | null}
 */
export function myDiceKey(snap) {
  const me = state.myId ? snap.players[state.myId] : undefined;
  if (!me) return null;
  return JSON.stringify({
    dice: me.dice,
    has_rolled: me.has_rolled,
    target: snap.target,
    round_num: snap.round_num,
    roll_count: me.roll_count || 0,
  });
}
