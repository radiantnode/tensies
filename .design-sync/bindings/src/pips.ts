/* Mirrors static/js/pips.js and static/js/dice.js (FACE_ROTATIONS) — the app's
   single source of truth for die-face pip layouts and cube rotations. Keep in
   sync if the app's tables ever change (they are stable game geometry). */

/** Active pip indices (0–8, row-major in a 3×3 grid) for each die face value. */
export const PIP_POSITIONS: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** Cube rotation (applied to `.die-3d`) that brings each face value to the front. */
export const FACE_ROTATIONS: Record<number, string> = {
  1: 'rotateY(0deg)',
  2: 'rotateY(-90deg)',
  3: 'rotateX(90deg)',
  4: 'rotateX(-90deg)',
  5: 'rotateY(90deg)',
  6: 'rotateY(180deg)',
};
