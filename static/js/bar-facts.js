// @ts-check

/**
 * Bar facts shown over the game-start intro video so there's something to read
 * while the clip plays. randomFact() avoids repeating the fact it returned last
 * (per session), so back-to-back games don't show the same line twice.
 */

// TODO: replace these placeholders with researched facts before launch.
export const BAR_FACTS = [
  'The oldest known dice, carved from bone, are over 5,000 years old.',
  'Rolling five of a kind with fair dice happens about once in every 1,296 tries.',
  'The pips on opposite faces of a standard die always add up to seven.',
  'Casinos use transparent "precision" dice so no hidden weight can bias a roll.',
  'The word "dice" is plural — a single cube is technically a "die".',
];

/** Index of the fact returned last, so we can skip it next time. */
let lastIndex = -1;

/**
 * A random fact, never the same one twice in a row within this session.
 * @returns {string}
 */
export function randomFact() {
  if (BAR_FACTS.length <= 1) return BAR_FACTS[0] ?? '';
  let i = lastIndex;
  while (i === lastIndex) i = Math.floor(Math.random() * BAR_FACTS.length);
  lastIndex = i;
  return BAR_FACTS[i];
}
