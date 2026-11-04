import { useCallback, useEffect, useRef } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { getInstructionSound } from './instruction-sounds';
import { isSoundEnabled, playClip, releasePlayer, stopClip } from './sound';

// If the "finished" event never arrives (a clip that fails to load, say),
// the round must still start - a child should never be left waiting on a
// silent screen.
const FALLBACK_MS = 4000;

/**
 * Speak a mode's instruction once when the mode opens, and again on demand.
 *
 * `onFinished` fires when the clip ends - or immediately when there is
 * nothing to play (no clip yet, sound muted) - so a game can hold back its
 * own round audio until the instruction is done and the two never overlap.
 * It fires once per play; `replay()` does not call it again.
 *
 * @param {string} gameKey - Mode key, e.g. 'counting'.
 * @param {'en'|'es'} lang
 * @param {{ onFinished?: () => void }} [options]
 * @returns {{ replay: () => void, stop: () => void }}
 */
export function useInstructionPrompt(gameKey, lang, { onFinished } = {}) {
  const player = useAudioPlayer(null);
  const finishedRef = useRef(false);
  const timerRef = useRef(null);
  const onFinishedRef = useRef(onFinished);
  const langRef = useRef(lang);

  // Keep the latest callback and language readable from timers and
  // listeners without re-running the play effect when they change.
  useEffect(() => {
    onFinishedRef.current = onFinished;
    langRef.current = lang;
  });

  const finish = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (onFinishedRef.current) onFinishedRef.current();
  }, []);

  // Language can change after mount (the toggle is on every screen); the
  // initial play deliberately uses whichever language was active at open.
  useEffect(() => {
    const source = getInstructionSound(gameKey, langRef.current);
    if (!source || !isSoundEnabled()) {
      finish();
      return undefined;
    }
    let subscription;
    try {
      subscription = player.addListener('playbackStatusUpdate', status => {
        if (status && status.didJustFinish) finish();
      });
    } catch {
      // No listener support - the fallback timer below covers it.
    }
    playClip(player, source);
    timerRef.current = setTimeout(finish, FALLBACK_MS);
    return () => {
      if (subscription && subscription.remove) subscription.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
      stopClip(player);
      releasePlayer(player);
    };
  }, [gameKey, player, finish]);

  const replay = useCallback(() => {
    const source = getInstructionSound(gameKey, langRef.current);
    if (source) playClip(player, source);
  }, [gameKey, player]);

  const stop = useCallback(() => stopClip(player), [player]);

  return { replay, stop };
}
