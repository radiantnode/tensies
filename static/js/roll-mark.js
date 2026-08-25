// @ts-check

/**
 * The ROLL coin's engraved dice mark — geometry verbatim from
 * static/images/logo.svg, drawn as hollow cut outlines: a light copy of each
 * path 3 units below a dark copy (an engraved line on brass), with the front
 * die knocking a gap out of the back one so they read as overlapping solids.
 * The mark cannot be pink here — pink is reserved for literal neon, so the
 * logo becomes pure relief (board.json).
 *
 * Stroke lives in viewBox units, so any size change re-weights it (the
 * 7.3 × 50/mark factor below) or the engraving goes spindly.
 */

const SIX = [[-20, -22], [-20, 0], [-20, 22], [20, -22], [20, 0], [20, 22]];
const FOUR = [[-19, -19], [19, -19], [-19, 19], [19, 19]];
const CD = '#43280a';
const CL = 'rgba(255,250,228,.6)';

/** @param {string} body @param {number} sw */
const cut = (body, sw) =>
  `<g transform="translate(0 3)" fill="none" stroke="${CL}" stroke-width="${sw}">${body}</g>` +
  `<g fill="none" stroke="${CD}" stroke-width="${sw}">${body}</g>`;

/** @param {number[][]} pips @param {number} r */
const cutPips = (pips, r) =>
  `<g transform="translate(0 3)" fill="${CL}">${pips.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>` +
  `<g fill="${CD}">${pips.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;

/**
 * Build the engraved mark's SVG at a given rendered width.
 * @param {number} px rendered width (the board coin uses 46% of the coin)
 * @param {string} [id] unique mask id suffix when several marks coexist
 * @returns {string}
 */
export function rollMarkSVG(px, id = 'coin') {
  const sw = 7.3 * (50 / px);
  const gap = 5.5;
  return `
  <svg class="roll-mark" width="${px}" height="${Math.round(px * 0.94)}" viewBox="26 32 152 144" aria-hidden="true">
    <defs><mask id="rm-${id}">
      <rect x="0" y="0" width="200" height="200" fill="#fff"/>
      <g transform="translate(132 130) rotate(10)">
        <rect x="${-38 - gap}" y="${-38 - gap}" width="${76 + gap * 2}" height="${76 + gap * 2}"
              rx="${14 + gap}" fill="#000"/></g></mask></defs>
    <g mask="url(#rm-${id})"><g transform="translate(74 80) rotate(-14)">
      ${cut('<rect x="-40" y="-40" width="80" height="80" rx="15"/>', sw)}${cutPips(SIX, 6)}
    </g></g>
    <g transform="translate(132 130) rotate(10)">
      ${cut('<rect x="-38" y="-38" width="76" height="76" rx="14"/>', sw)}${cutPips(FOUR, 6)}
    </g></svg>`;
}
