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
 * Scatter positions for `count` dice of size `sz` inside `zoneRect`: divide
 * the zone into a grid, jitter within each cell, then shuffle — guaranteed no
 * overlap, still looks scattered.
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
  const cols = Math.max(2, Math.round(Math.sqrt(count * w / h)));
  const rows = Math.ceil(count / cols);
  const cellW = w / cols;
  const cellH = h / rows;
  const jx = Math.max(0, (cellW - sz) / 2 * 0.6);
  const jy = Math.max(0, (cellH - sz) / 2 * 0.6);

  /** @type {DiePosition[]} */
  const positions = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bx = pad + c * cellW + cellW / 2 - sz / 2;
      const by = pad + r * cellH + cellH / 2 - sz / 2;
      positions.push({
        x: Math.max(pad, Math.min(pad + w - sz, bx + (Math.random() - 0.5) * jx * 2)),
        y: Math.max(pad, Math.min(pad + h - sz, by + (Math.random() - 0.5) * jy * 2)),
        rot: (Math.random() - 0.5) * 24,
      });
    }
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
