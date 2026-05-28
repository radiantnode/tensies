import { state } from './state.js';

const DOTS = {
  0: [],
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Cube rotation (applied to .die-3d) to bring each face value to the front
export const FACE_ROTATIONS = {
  1: 'rotateY(0deg)',
  2: 'rotateY(-90deg)',
  3: 'rotateX(90deg)',
  4: 'rotateX(-90deg)',
  5: 'rotateY(90deg)',
  6: 'rotateY(180deg)',
};

export function makeDie(value, target) {
  const scene = document.createElement('div');
  scene.className = 'die-scene';

  const cube = document.createElement('div');
  cube.className = 'die-3d' + (value === target && value !== 0 ? ' match' : '');
  cube.style.transform = FACE_ROTATIONS[value] || 'rotateY(0deg)';

  for (let fv = 1; fv <= 6; fv++) {
    const face = document.createElement('div');
    face.className = 'face face-' + fv;
    for (let i = 0; i < 9; i++) {
      const dot = document.createElement('span');
      dot.className = 'dot' + (DOTS[fv].includes(i) ? ' active' : '');
      face.appendChild(dot);
    }
    cube.appendChild(face);
  }

  scene.appendChild(cube);
  return scene;
}

export function makeTargetDie(target, className) {
  const el = document.createElement('div');
  el.className = className;
  for (let i = 0; i < 9; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot' + (DOTS[target].includes(i) ? ' active' : '');
    el.appendChild(dot);
  }
  return el;
}

// Divide the zone into a grid sized for `count` dice, add jitter within each
// cell, then shuffle — guaranteed no overlap, still looks scattered.
export function placeGrid(zoneRect, count, sz) {
  if (count === 0) return [];
  const pad = 8;
  const w = zoneRect.width  - pad * 2;
  const h = zoneRect.height - pad * 2;
  const cols = Math.max(2, Math.round(Math.sqrt(count * w / h)));
  const rows = Math.ceil(count / cols);
  const cellW = w / cols;
  const cellH = h / rows;
  const jx = Math.max(0, (cellW - sz) / 2 * 0.6);
  const jy = Math.max(0, (cellH - sz) / 2 * 0.6);

  const positions = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bx = pad + c * cellW + cellW / 2 - sz / 2;
      const by = pad + r * cellH + cellH / 2 - sz / 2;
      positions.push({
        x:   Math.max(pad, Math.min(pad + w - sz, bx + (Math.random() - 0.5) * jx * 2)),
        y:   Math.max(pad, Math.min(pad + h - sz, by + (Math.random() - 0.5) * jy * 2)),
        rot: (Math.random() - 0.5) * 24,
      });
    }
  }
  // Fisher-Yates shuffle so dice get random grid slots
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, count);
}

// roll_count distinguishes a re-roll that landed on the same values as before
export function myDiceKey(snap) {
  const p = snap.players[state.myId];
  if (!p) return null;
  return JSON.stringify({
    dice: p.dice,
    has_rolled: p.has_rolled,
    target: snap.target,
    round_num: snap.round_num,
    roll_count: p.roll_count || 0,
  });
}
