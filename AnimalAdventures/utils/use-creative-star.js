import { useEffect, useRef, useState } from 'react';
import { useGameProgress } from '../contexts/game-progress.context';
import { successFeedback } from './haptics';

const TOAST_MS = 2600;

/**
 * A first star for the open-ended modes (Band, Build a Scene, Coloring),
 * which have no levels and no right answers. It is earned once, the first
 * time `achieved` becomes true - a small thank-you for making something,
 * never a score. It joins the same stars the quiz games give, so the menu
 * badge and Album keep covering these modes.
 *
 * @param {string} gameKey - Mode key: 'band', 'buildScene' or 'coloring'.
 * @param {boolean} achieved - True once the child has made something.
 * @returns {boolean} Whether the "you earned a star" toast is showing.
 */
export function useCreativeStar(gameKey, achieved) {
  const { stars, markLevelStarred } = useGameProgress();
  const [toast, setToast] = useState(false);
  const timer = useRef(null);
  const alreadyEarned = (stars[gameKey] || []).length > 0;

  useEffect(() => {
    if (!achieved || alreadyEarned) return;
    markLevelStarred(gameKey, 1);
    successFeedback();
    setToast(true);
    timer.current = setTimeout(() => setToast(false), TOAST_MS);
  }, [achieved, alreadyEarned, gameKey, markLevelStarred]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return toast;
}

export default useCreativeStar;
