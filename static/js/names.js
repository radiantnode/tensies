// @ts-check

/**
 * Random "Spicy Squid"-style player-name generator.
 * 50 adjectives × 50 nouns = 2,500 combinations.
 */

const ADJECTIVES = [
  'Spicy', 'Funky', 'Sneaky', 'Grumpy', 'Lazy', 'Zippy', 'Wobbly',
  'Fluffy', 'Cranky', 'Salty', 'Jumpy', 'Wiggly', 'Cheeky', 'Dizzy',
  'Goofy', 'Sassy', 'Bouncy', 'Zesty', 'Grizzly', 'Plucky', 'Shifty',
  'Jolly', 'Gloomy', 'Wacky', 'Peppy', 'Stormy', 'Frosty', 'Rusty',
  'Dusty', 'Shaky', 'Lucky', 'Spooky', 'Fancy', 'Rowdy', 'Nervy',
  'Snazzy', 'Zany', 'Quirky', 'Mighty', 'Bubbly', 'Twitchy', 'Snappy',
  'Breezy', 'Chunky', 'Sparkly', 'Witty', 'Speedy', 'Tipsy', 'Cosmic', 'Wonky',
];

const NOUNS = [
  'Unicorn', 'Badger', 'Penguin', 'Goblin', 'Narwhal', 'Pickle',
  'Waffle', 'Noodle', 'Potato', 'Biscuit', 'Platypus', 'Muffin',
  'Cactus', 'Blobfish', 'Mongoose', 'Turnip', 'Hamster', 'Salamander',
  'Toadstool', 'Pretzel', 'Walrus', 'Capybara', 'Burrito', 'Otter',
  'Raccoon', 'Marmot', 'Porcupine', 'Kumquat', 'Squid', 'Yak',
  'Mackerel', 'Armadillo', 'Chinchilla', 'Dumpling', 'Puffin',
  'Aardvark', 'Quokka', 'Wombat', 'Tapir', 'Lobster', 'Buffalo',
  'Pelican', 'Octopus', 'Lemur', 'Toucan', 'Manatee', 'Sloth',
  'Iguana', 'Wallaby', 'Bison',
];

/**
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Generate a random two-word player name. */
export function makeName() {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}
