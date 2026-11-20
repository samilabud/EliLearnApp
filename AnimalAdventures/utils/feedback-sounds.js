import { useCallback, useEffect, useRef } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { playVoice, releasePlayer } from './sound';

/**
 * Spoken praise and encouragement - "Great job!", "Oops, try again!",
 * "You did it!" - so a child who cannot read still hears how it went.
 *
 * Each kind has a few variants (children tune out a line that never
 * changes). Metro needs a literal path for every `require()`, so this is a
 * static table like ./instruction-sounds. It starts EMPTY on purpose: until
 * a clip is recorded and listed here, every kind is silent and the game
 * behaves exactly as before. A missing clip must never block a game.
 *
 * To add clips: record them (see docs/plans/feedback-voice-script.md for
 * the exact lines), put the mp3s in assets/sounds/feedback/<english|spanish>/,
 * normalise each to about -16 LUFS, then list them, e.g.
 *
 *   correct: [require(`${english_folder}correct1.mp3`), ...],
 *
 * Playback goes through `playVoice`, so the parent's Voice setting and
 * speed apply to these clips too.
 */

// eslint-disable-next-line no-unused-vars
const english_folder = '../assets/sounds/feedback/english/';
// eslint-disable-next-line no-unused-vars
const spanish_folder = '../assets/sounds/feedback/spanish/';

export const FEEDBACK_SOUNDS = {
  en: { correct: [], tryAgain: [], allDone: [] },
  es: { correct: [], tryAgain: [], allDone: [] },
};

/** How long to wait so the line follows the animal's own sound, not over it. */
export const FEEDBACK_DELAY_MS = {
  correct: 1400,
  tryAgain: 350,
  allDone: 1500,
};

/**
 * A random clip of the given kind, or null if none is recorded yet.
 * @param {'correct'|'tryAgain'|'allDone'} kind
 * @param {'en'|'es'} lang
 */
export const pickFeedbackSound = (kind, lang) => {
  const clips = FEEDBACK_SOUNDS[lang]?.[kind];
  if (!clips || clips.length === 0) return null;
  return clips[Math.floor(Math.random() * clips.length)];
};

/**
 * Speak a feedback line while `active` is true: once each time it turns on,
 * after a short delay so it never talks over an animal's sound.
 * Does nothing at all when no clip exists for the kind.
 * @param {boolean} active
 * @param {'correct'|'tryAgain'|'allDone'} kind
 * @param {'en'|'es'} lang
 * @param {*} [trigger] Changing value that replays it for a repeat event.
 */
export function useFeedbackVoice(active, kind, lang, trigger) {
  const player = useAudioPlayer(null);
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  });
  useEffect(() => () => releasePlayer(player), [player]);

  const say = useCallback(() => {
    const source = pickFeedbackSound(kind, langRef.current);
    if (source) playVoice(player, source);
  }, [kind, player]);

  useEffect(() => {
    if (!active) return undefined;
    if (!pickFeedbackSound(kind, langRef.current)) return undefined;
    const timer = setTimeout(say, FEEDBACK_DELAY_MS[kind] ?? 0);
    return () => clearTimeout(timer);
  }, [active, kind, trigger, say]);
}

export default useFeedbackVoice;
