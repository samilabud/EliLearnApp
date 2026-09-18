/**
 * Durable game progress.
 *
 * Both games used to keep level, board and score in component `useState`.
 * That state died whenever the component unmounted, which happened on every
 * trip back to the main menu and again on rotation - a child who had reached
 * level 6 was silently dropped back to level 1.
 *
 * Progress therefore lives here, above the screen swap in App, and is mirrored
 * to storage so it also survives the process being killed. Anything a child
 * would be upset to lose belongs in this file; anything transient (which card
 * is mid-flip, whether a sound is playing) belongs in the component.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { animalList } from '../components/animals/animal.list';
import { loadJSON, saveJSON } from '../utils/storage';

const PROGRESS_KEY = 'game.progress';

/** Bump when the persisted shape changes; older payloads are discarded. */
const SCHEMA_VERSION = 1;

/** Card flips arrive in bursts, so writes are coalesced rather than per-tap. */
const PERSIST_DEBOUNCE_MS = 400;

const DEFAULT_MEMORY = {
  level: 1,
  cards: [],
  matchedPairs: [],
  moves: 0,
  gameComplete: false,
};

const DEFAULT_GUESS = {
  level: 1,
  targetId: null,
  optionIds: [],
  wrongCount: 0,
  showComplete: false,
};

/**
 * Animals the child has met, by id.
 *
 * Kept as its own slice rather than derived from game state, because meeting
 * an animal is permanent: it survives a reset, a finished game and a new
 * playthrough. Nothing here is ever removed.
 */
const DEFAULT_MET = [];

const GameProgressContext = createContext(null);

const validIds = new Set(animalList.map(a => a.id));

/**
 * Reject progress that references animals this build no longer ships.
 *
 * Saved boards store animal ids, never `require()` results - Metro module ids
 * are not stable across builds, so persisting them would resurrect a board
 * pointing at the wrong artwork after an update. The trade-off is that
 * removing or renaming an animal invalidates saved boards, handled here.
 */
const memoryIsUsable = memory => {
  if (!memory || !Array.isArray(memory.cards)) return false;
  return (
    memory.cards.every(c => validIds.has(c.id)) &&
    (memory.matchedPairs || []).every(id => validIds.has(id))
  );
};

const guessIsUsable = guess => {
  if (!guess) return false;
  if (guess.targetId && !validIds.has(guess.targetId)) return false;
  return (guess.optionIds || []).every(id => validIds.has(id));
};

/**
 * Cards left face up by a comparison that never resolved.
 *
 * A card's revealed state is saved, so it is the only source of truth for
 * which cards are face up. Anything tracking the current turn must derive it
 * from here rather than keep its own copy, or the two drift apart the moment
 * the game unmounts.
 *
 * @param {object[]} cards - Saved cards.
 * @returns {object[]} Face-up cards that are not yet matched.
 */
export const unresolvedFlips = cards =>
  (cards || []).filter(card => card.isFlipped && !card.isMatched);

/**
 * Turn every unmatched card face down, leaving matches revealed.
 * @param {object[]} cards - Saved cards.
 * @returns {object[]} Cards at a clean turn boundary.
 */
export const faceDownUnmatched = cards =>
  cards.map(card => (card.isMatched ? card : { ...card, isFlipped: false }));

/**
 * Clear end-of-game states that should not greet a child on a fresh launch.
 *
 * Finishing every level is worth celebrating in the moment, but reopening the
 * app straight into a victory screen is not, so a finished game starts over.
 * Losing is not a state either game can be in any more - Guess the Animal no
 * longer ends on a mistake - so completion is the only thing to clear.
 *
 * This runs only at hydration, so within a session leaving to the menu and
 * returning still shows the overlay the child left behind.
 */
const clearTerminalStates = (memory, guess) => ({
  memory: memory.gameComplete ? DEFAULT_MEMORY : memory,
  guess: guess.showComplete ? DEFAULT_GUESS : guess,
});

/**
 * Restore a board to a clean turn boundary.
 *
 * Matched cards stay face up. A single card left flipped mid-turn also stays
 * up, because that is what the child sees. Two flipped cards mean the app died
 * during the compare-and-flip-back window, so both are turned down - the state
 * the game would have reached a second later anyway. Without this a restored
 * board can present a turn that can never be completed.
 */
const sanitizeMemory = memory => {
  const cards = memory.cards || [];
  if (unresolvedFlips(cards).length < 2) return memory;
  return { ...memory, cards: faceDownUnmatched(cards) };
};

export function GameProgressProvider({ children }) {
  const [hydrated, setHydrated] = useState(false);
  const [memory, setMemoryState] = useState(DEFAULT_MEMORY);
  const [guess, setGuessState] = useState(DEFAULT_GUESS);
  const [met, setMet] = useState(DEFAULT_MET);
  const persistTimer = useRef(null);
  const latest = useRef({ memory, guess });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadJSON(PROGRESS_KEY, null);
      if (cancelled) return;

      if (stored && stored.version === SCHEMA_VERSION) {
        const restored = clearTerminalStates(
          memoryIsUsable(stored.memory)
            ? sanitizeMemory({ ...DEFAULT_MEMORY, ...stored.memory })
            : DEFAULT_MEMORY,
          guessIsUsable(stored.guess)
            ? { ...DEFAULT_GUESS, ...stored.guess }
            : DEFAULT_GUESS
        );
        setMemoryState(restored.memory);
        setGuessState(restored.guess);
        if (Array.isArray(stored.met)) {
          setMet(stored.met.filter(id => validIds.has(id)));
        }
      }
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    latest.current = { memory, guess, met, hydrated };
    // Nothing is written until the stored value has been read, otherwise the
    // initial empty state would overwrite real progress during startup.
    if (!hydrated) return;

    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      saveJSON(PROGRESS_KEY, { version: SCHEMA_VERSION, memory, guess, met });
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [memory, guess, met, hydrated]);

  // Flush on teardown so a fast exit cannot outrun the debounce. Guarded on
  // `hydrated`: a teardown that happens while storage is still being read must
  // not write starting values over real saved progress.
  useEffect(() => {
    return () => {
      const {
        memory: m,
        guess: g,
        met: k,
        hydrated: isHydrated,
      } = latest.current;
      if (!isHydrated) return;
      saveJSON(PROGRESS_KEY, {
        version: SCHEMA_VERSION,
        memory: m,
        guess: g,
        met: k,
      });
    };
  }, []);

  const updateMemory = useCallback(patch => {
    setMemoryState(prev => ({
      ...prev,
      ...(typeof patch === 'function' ? patch(prev) : patch),
    }));
  }, []);

  const updateGuess = useCallback(patch => {
    setGuessState(prev => ({
      ...prev,
      ...(typeof patch === 'function' ? patch(prev) : patch),
    }));
  }, []);

  /**
   * Record that a child has met an animal. Idempotent, and never undone -
   * resetting a game must not take an animal back out of the album.
   * @param {string} id - Animal id from `animalList`.
   */
  const markAnimalMet = useCallback(id => {
    if (!id || !validIds.has(id)) return;
    setMet(prev => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const resetMemory = useCallback(() => setMemoryState(DEFAULT_MEMORY), []);
  const resetGuess = useCallback(() => setGuessState(DEFAULT_GUESS), []);

  const value = useMemo(
    () => ({
      hydrated,
      memory,
      guess,
      met,
      markAnimalMet,
      updateMemory,
      updateGuess,
      resetMemory,
      resetGuess,
    }),
    [
      hydrated,
      memory,
      guess,
      met,
      markAnimalMet,
      updateMemory,
      updateGuess,
      resetMemory,
      resetGuess,
    ]
  );

  return (
    <GameProgressContext.Provider value={value}>
      {children}
    </GameProgressContext.Provider>
  );
}

/**
 * Access saved progress for both games.
 * @returns {{hydrated: boolean, memory: object, guess: object,
 *   updateMemory: Function, updateGuess: Function,
 *   resetMemory: Function, resetGuess: Function}}
 */
export function useGameProgress() {
  const ctx = useContext(GameProgressContext);
  if (!ctx) {
    throw new Error('useGameProgress must be used inside GameProgressProvider');
  }
  return ctx;
}

export { DEFAULT_MEMORY, DEFAULT_GUESS };
