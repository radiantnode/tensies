// @ts-check

/**
 * Active pip indices (0–8, row-major in a 3×3 grid) for each die face value.
 * One source of truth shared by the play dice (the `.die-3d` faces) and the
 * round-target die, so the face layouts can never drift apart.
 * @type {Record<number, number[]>}
 */
export const PIP_POSITIONS = {
  0: [],
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};
