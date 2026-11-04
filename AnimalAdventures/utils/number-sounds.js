/**
 * Spoken numbers ("one", "uno"...), one clip per number per language.
 *
 * Counting says the answer aloud when the child gets it right (and once as
 * help after a few wrong tries). Static table for the same reason as
 * ./letter-sounds: Metro needs a literal path in every `require()`.
 *
 * To add a clip: drop the mp3 in assets/sounds/numbers/<language>/,
 * normalized to about -16 LUFS, then add its line below. Until a
 * line is enabled `getNumberSound` returns null and the game stays quiet
 * for that number instead of failing.
 */

const english_folder = '../assets/sounds/numbers/english/';
const spanish_folder = '../assets/sounds/numbers/spanish/';

export const NUMBER_SOUNDS = {
  en: {
    1: require(`${english_folder}1.mp3`),
    2: require(`${english_folder}2.mp3`),
    3: require(`${english_folder}3.mp3`),
    4: require(`${english_folder}4.mp3`),
    5: require(`${english_folder}5.mp3`),
    6: require(`${english_folder}6.mp3`),
    7: require(`${english_folder}7.mp3`),
    8: require(`${english_folder}8.mp3`),
    9: require(`${english_folder}9.mp3`),
    10: require(`${english_folder}10.mp3`),
  },
  es: {
    1: require(`${spanish_folder}1.mp3`),
    2: require(`${spanish_folder}2.mp3`),
    3: require(`${spanish_folder}3.mp3`),
    4: require(`${spanish_folder}4.mp3`),
    5: require(`${spanish_folder}5.mp3`),
    6: require(`${spanish_folder}6.mp3`),
    7: require(`${spanish_folder}7.mp3`),
    8: require(`${spanish_folder}8.mp3`),
    9: require(`${spanish_folder}9.mp3`),
    10: require(`${spanish_folder}10.mp3`),
  },
};

/**
 * The spoken clip for a number in a language, or null if none exists.
 * @param {number} n - A whole number, 1-10.
 * @param {'en'|'es'} lang
 * @returns {*}
 */
export const getNumberSound = (n, lang) =>
  (NUMBER_SOUNDS[lang] && NUMBER_SOUNDS[lang][n]) || null;
