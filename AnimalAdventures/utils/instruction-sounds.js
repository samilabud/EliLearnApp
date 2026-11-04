/**
 * Spoken "what do I do here?" prompts, one clip per mode per language.
 *
 * Non-reading children can't act on on-screen instructions, so every mode
 * says its instruction aloud when it opens (and again when the child taps
 * the instruction). Metro needs a literal path for every `require()`, so
 * this is a static table like ./letter-sounds.
 *
 * To add a clip: drop the mp3 in assets/sounds/instructions/<language>/,
 * normalized to about -16 LUFS, then add its line below. Until a
 * line is enabled the mode simply stays silent - a missing clip must never
 * block or break a game (see use-instruction-prompt).
 *
 * Keys are the mode keys from constants/games.js.
 */

const english_folder = '../assets/sounds/instructions/english/';
const spanish_folder = '../assets/sounds/instructions/spanish/';

export const INSTRUCTION_SOUNDS = {
  en: {
    learn: require(`${english_folder}learn.mp3`),
    guess: require(`${english_folder}guess.mp3`),
    letter: require(`${english_folder}letter.mp3`),
    lastLetter: require(`${english_folder}lastLetter.mp3`),
    trace: require(`${english_folder}trace.mp3`),
    memory: require(`${english_folder}memory.mp3`),
    findAnimal: require(`${english_folder}findAnimal.mp3`),
    whoseSound: require(`${english_folder}whoseSound.mp3`),
    buildScene: require(`${english_folder}buildScene.mp3`),
    coloring: require(`${english_folder}coloring.mp3`),
    counting: require(`${english_folder}counting.mp3`),
  },
  es: {
    learn: require(`${spanish_folder}learn.mp3`),
    guess: require(`${spanish_folder}guess.mp3`),
    letter: require(`${spanish_folder}letter.mp3`),
    lastLetter: require(`${spanish_folder}lastLetter.mp3`),
    trace: require(`${spanish_folder}trace.mp3`),
    memory: require(`${spanish_folder}memory.mp3`),
    findAnimal: require(`${spanish_folder}findAnimal.mp3`),
    whoseSound: require(`${spanish_folder}whoseSound.mp3`),
    buildScene: require(`${spanish_folder}buildScene.mp3`),
    coloring: require(`${spanish_folder}coloring.mp3`),
    counting: require(`${spanish_folder}counting.mp3`),
  },
};

/**
 * The spoken instruction for a mode in a language, or null if none exists.
 * @param {string} gameKey - A mode key, e.g. 'counting'.
 * @param {'en'|'es'} lang
 * @returns {*}
 */
export const getInstructionSound = (gameKey, lang) =>
  (INSTRUCTION_SOUNDS[lang] && INSTRUCTION_SOUNDS[lang][gameKey]) || null;
