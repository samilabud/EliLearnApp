/**
 * Age-based difficulty, in one place.
 *
 * The Parent Area's age band (`childAgeBand` in the settings context) picks
 * how much each game asks of a child. Difficulty here only ever changes how
 * much is on screen and how soon help arrives - there are no lives, timers
 * or game-over states, so a wrong answer is never a loss for any age.
 *
 * `MAX_LEVEL` stays per-game and identical across bands, so stars and saved
 * progress mean the same thing whichever band is selected.
 *
 * The '4to6' band reproduces the numbers the games used before bands
 * existed, so existing players notice no change.
 */

export const AGE_BANDS = ['under4', '4to6', '7plus'];
export const DEFAULT_AGE_BAND = '4to6';

/** After this many wrong tries the right answer starts to glow. */
const HINT_AFTER = { under4: 2, '4to6': 3, '7plus': 4 };

const clampBand = band => (AGE_BANDS.includes(band) ? band : DEFAULT_AGE_BAND);

/**
 * Hint threshold shared by every quiz game.
 * @param {string} band
 * @returns {number}
 */
export const getHintAfterTries = band => HINT_AFTER[clampBand(band)];

/**
 * How many animal choices Guess / Find / Whose Sound show at a level.
 * @param {string} band
 * @param {number} level
 * @returns {number}
 */
export const getAnimalOptionCount = (band, level) => {
  switch (clampBand(band)) {
    case 'under4':
      return Math.min(3, level + 1);
    case '7plus':
      return Math.min(6, level + 2);
    default:
      return Math.min(6, level + 1);
  }
};

/**
 * First/Last Letter: how many letter cards, and how many levels use vowels
 * only as the wrong answers.
 * @param {string} band
 * @returns {{ optionCount: number, vowelLevels: number }}
 */
export const getLetterDifficulty = band => {
  switch (clampBand(band)) {
    case 'under4':
      return { optionCount: 2, vowelLevels: Infinity };
    case '7plus':
      return { optionCount: 4, vowelLevels: 1 };
    default:
      return { optionCount: 3, vowelLevels: 2 };
  }
};

/**
 * Count the Animals: the most animals shown at a level, and how many number
 * cards are offered.
 * @param {string} band
 * @param {number} level
 * @returns {{ maxCount: number, optionCount: number }}
 */
export const getCountingDifficulty = (band, level) => {
  switch (clampBand(band)) {
    case 'under4':
      return { maxCount: Math.min(1 + level, 5), optionCount: 3 };
    case '7plus':
      return { maxCount: Math.min(4 + level, 10), optionCount: 4 };
    default:
      return { maxCount: Math.min(2 + level, 8), optionCount: 3 };
  }
};

/**
 * Memory: number of cards at a level (always an even number).
 * @param {string} band
 * @param {number} level
 * @returns {number}
 */
export const getMemoryCardCount = (band, level) => {
  switch (clampBand(band)) {
    case 'under4':
      return Math.min(2 + level * 2, 8);
    case '7plus':
      return Math.min(4 + level * 2, 16);
    default:
      return Math.min(2 + level * 2, 16);
  }
};

/**
 * Trace the Letter: how closely the finger must follow the letter.
 * Values replace the PROXIMITY_RATIO / MIN_COVERAGE_RATIO defaults in
 * utils/trace-grading.js.
 * @param {string} band
 * @returns {{ proximityRatio: number, minCoverageRatio: number }}
 */
export const getTraceTolerance = band => {
  switch (clampBand(band)) {
    case 'under4':
      return { proximityRatio: 0.06, minCoverageRatio: 0.55 };
    case '7plus':
      return { proximityRatio: 0.04, minCoverageRatio: 0.7 };
    default:
      return { proximityRatio: 0.045, minCoverageRatio: 0.65 };
  }
};
