/**
 * Spoken letter names ("bee", "ce"...), one clip per letter per language.
 *
 * Metro needs a literal path for every `require()`, so this is a static
 * table rather than a computed path - each entry covers exactly one letter
 * a child can actually be asked about, derived from `animalList` (see
 * `firstLetterOf` in ./helpers). Adding an animal whose name starts with a
 * letter not listed here needs a new clip and a new line, not just data.
 */
const english_folder = '../assets/sounds/letters/english/';
const spanish_folder = '../assets/sounds/letters/spanish/';

export const LETTER_SOUNDS = {
  en: {
    B: require(`${english_folder}b.mp3`),
    C: require(`${english_folder}c.mp3`),
    D: require(`${english_folder}d.mp3`),
    E: require(`${english_folder}e.mp3`),
    F: require(`${english_folder}f.mp3`),
    H: require(`${english_folder}h.mp3`),
    I: require(`${english_folder}i.mp3`),
    K: require(`${english_folder}k.mp3`),
    M: require(`${english_folder}m.mp3`),
    O: require(`${english_folder}o.mp3`),
    P: require(`${english_folder}p.mp3`),
    S: require(`${english_folder}s.mp3`),
    T: require(`${english_folder}t.mp3`),
    W: require(`${english_folder}w.mp3`),
  },
  es: {
    A: require(`${spanish_folder}a.mp3`),
    B: require(`${spanish_folder}b.mp3`),
    C: require(`${spanish_folder}c.mp3`),
    D: require(`${spanish_folder}d.mp3`),
    E: require(`${spanish_folder}e.mp3`),
    G: require(`${spanish_folder}g.mp3`),
    I: require(`${spanish_folder}i.mp3`),
    L: require(`${spanish_folder}l.mp3`),
    M: require(`${spanish_folder}m.mp3`),
    O: require(`${spanish_folder}o.mp3`),
    P: require(`${spanish_folder}p.mp3`),
    R: require(`${spanish_folder}r.mp3`),
    S: require(`${spanish_folder}s.mp3`),
    V: require(`${spanish_folder}v.mp3`),
  },
};

/**
 * The clip for a letter in a language, or null if none exists (shouldn't
 * happen for a letter that came from `firstLetterOf`, but callers should
 * not assume it - a missing clip must never throw mid-game).
 * @param {string} letter - A single uppercase letter.
 * @param {'en'|'es'} lang
 * @returns {*}
 */
export const getLetterSound = (letter, lang) =>
  (LETTER_SOUNDS[lang] && LETTER_SOUNDS[lang][letter]) || null;
