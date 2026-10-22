/**
 * Durable game progress.
 *
 * The games used to keep level, board and score in component `useState`.
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
import { sceneryList } from '../components/scenery/scenery.list';
import { loadJSON, saveJSON } from '../utils/storage';

const PROGRESS_KEY = 'game.progress';

/** Bump when the persisted shape changes; older payloads are discarded. */
const SCHEMA_VERSION = 1;

/** Card flips arrive in bursts, so writes are coalesced rather than per-tap. */
const PERSIST_DEBOUNCE_MS = 400;

/**
 * Local calendar day, which is the boundary a child's "today" thinks in.
 * Mirrors the identical helper in settings.context.jsx - each context owns
 * its own copy rather than sharing a util, since each already owns its
 * storage/hydration independently.
 */
const today = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

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
  // Animal ids already asked as the target this match, so the same animal
  // is not asked about twice before every animal has had a turn.
  usedTargetIds: [],
};

const DEFAULT_LETTER = {
  level: 1,
  targetId: null,
  optionLetters: [],
  wrongCount: 0,
  showComplete: false,
  // Animal ids already asked as the target this match, so the same animal
  // is not asked about twice before every eligible animal has had a turn.
  usedTargetIds: [],
};

const DEFAULT_TRACE = {
  level: 1,
  targetId: null,
  wrongCount: 0,
  showComplete: false,
  // Animal ids already asked as the target this match, so the same animal
  // is not asked about twice before every animal has had a turn.
  usedTargetIds: [],
};

const DEFAULT_FINDANIMAL = {
  level: 1,
  targetId: null,
  optionIds: [],
  wrongCount: 0,
  showComplete: false,
  // Animal ids already asked as the target this match, so the same animal
  // is not asked about twice before every animal has had a turn.
  usedTargetIds: [],
};

const DEFAULT_WHOSESOUND = {
  level: 1,
  targetId: null,
  optionIds: [],
  wrongCount: 0,
  showComplete: false,
  // Animal ids already asked as the target this match, so the same animal
  // is not asked about twice before every animal has had a turn.
  usedTargetIds: [],
};

/**
 * Animals the child has met, by id.
 *
 * Kept as its own slice rather than derived from game state, because meeting
 * an animal is permanent: it survives a reset, a finished game and a new
 * playthrough. Nothing here is ever removed.
 */
const DEFAULT_MET = [];

/**
 * Which game first met each animal, by id - e.g. `{ 'dog-tail-wag': 'guess' }`.
 *
 * A separate slice from `met` rather than changing `met`'s own shape, so
 * every existing `met`-as-array consumer is untouched. An animal met before
 * this slice existed simply has no entry here - the Album treats that as
 * "known, source unrecorded" rather than an error.
 */
const DEFAULT_MET_VIA = {};

/**
 * Distinct levels ever completed, per leveled game.
 *
 * Permanent in the same spirit as `met` - a star earned by finishing a level
 * is never taken away by a reset or a finished-game screen, so a child who
 * replays a game they already mastered still sees what they already earned.
 * 'learn' has no level concept and is deliberately absent here.
 */
const DEFAULT_STARS = {
  guess: [],
  letter: [],
  trace: [],
  memory: [],
  findAnimal: [],
  whoseSound: [],
};

/**
 * Items (animals or scenery - trees, rocks, and the like) a child has
 * freely placed into their own scene, by instance - not by level or by
 * right/wrong answer, since this mode has neither. Permanent like every
 * other saved board, so a scene a child spent time arranging survives a
 * restart.
 */
const DEFAULT_SCENE = { placed: [] };

/**
 * Free-form coloring pages, one per animal a child has drawn on. Permanent
 * like `scene` - a page a child spent time coloring survives a restart.
 * `strokes` holds finished strokes only (color + the points drawn in it);
 * the in-progress stroke lives in the coloring screen's own component state
 * until released, same split `scene`'s drag ghost uses between "committed"
 * and "in flight".
 */
const DEFAULT_COLORING = { pages: {} };

/** Oldest strokes drop once a single page passes this many - see
 * `addColorStroke`'s comment for why a cap exists at all. */
const MAX_STROKES_PER_PAGE = 300;

/** Skip a new point this close to the stroke's last one - cuts the point
 * count of a slow, careful stroke substantially with no visible difference,
 * since raw per-move-event points are far denser than the line actually
 * needs. */
const MIN_POINT_DISTANCE = 3;

const GameProgressContext = createContext(null);

const validIds = new Set(animalList.map(a => a.id));
const validSceneryIds = new Set(sceneryList.map(s => s.id));

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

const letterIsUsable = letter => {
  if (!letter) return false;
  if (letter.targetId && !validIds.has(letter.targetId)) return false;
  return Array.isArray(letter.optionLetters);
};

const traceIsUsable = trace => {
  if (!trace) return false;
  if (trace.targetId && !validIds.has(trace.targetId)) return false;
  return true;
};

const findAnimalIsUsable = findAnimal => {
  if (!findAnimal) return false;
  if (findAnimal.targetId && !validIds.has(findAnimal.targetId)) return false;
  return (findAnimal.optionIds || []).every(id => validIds.has(id));
};

const whoseSoundIsUsable = whoseSound => {
  if (!whoseSound) return false;
  if (whoseSound.targetId && !validIds.has(whoseSound.targetId)) return false;
  return (whoseSound.optionIds || []).every(id => validIds.has(id));
};

const starsIsUsable = stars =>
  !!stars &&
  typeof stars === 'object' &&
  Object.keys(DEFAULT_STARS).every(
    key =>
      Array.isArray(stars[key]) && stars[key].every(n => typeof n === 'number')
  );

/**
 * A placed instance is usable only if it still points at a real item (an
 * animal or a scenery object this build still ships) and has sane
 * coordinates - a corrupt or out-of-range entry is dropped rather than
 * rejecting the whole scene, so one bad instance can't erase everything
 * else a child built.
 */
const scenePlacedIsUsable = p =>
  !!p &&
  typeof p.instanceId === 'string' &&
  typeof p.itemId === 'string' &&
  (p.kind === 'scenery'
    ? validSceneryIds.has(p.itemId)
    : validIds.has(p.itemId)) &&
  typeof p.x === 'number' &&
  typeof p.y === 'number' &&
  p.x >= 0 &&
  p.x <= 1 &&
  p.y >= 0 &&
  p.y <= 1;

const colorStrokeIsUsable = s =>
  !!s &&
  typeof s.color === 'string' &&
  Array.isArray(s.points) &&
  s.points.every(p => typeof p.x === 'number' && typeof p.y === 'number');

/**
 * Drops pages for animals this build no longer ships (see `memoryIsUsable`'s
 * comment for why - the same "ids are stable, require() results aren't"
 * reasoning applies here) and any individual stroke that doesn't look right,
 * without throwing away the rest of a page over one bad stroke. Same "keep
 * what's still good" approach as `metVia`'s hydrate sanitizing below.
 */
const sanitizeColoringPages = pages => {
  const sanitized = {};
  if (!pages || typeof pages !== 'object' || Array.isArray(pages)) {
    return sanitized;
  }
  Object.entries(pages).forEach(([id, page]) => {
    if (!validIds.has(id) || !page || !Array.isArray(page.strokes)) return;
    sanitized[id] = { strokes: page.strokes.filter(colorStrokeIsUsable) };
  });
  return sanitized;
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
 * Losing is not a state any game can be in any more - none of them end on a
 * mistake - so completion is the only thing to clear.
 *
 * Each game's own Menu/Next Game handlers already clear their completed
 * state the moment a child navigates away from it (a finished game should
 * only resume on a level, never on its own victory screen - see
 * handleBackToMenu in e.g. trace-letter.game.component.jsx), so by the time
 * this runs a lingering completed state only means the app was killed (or
 * crashed) while still sitting on that screen, never a normal exit.
 */
const clearTerminalStates = (
  memory,
  guess,
  letter,
  trace,
  findAnimal,
  whoseSound
) => ({
  memory: memory.gameComplete ? DEFAULT_MEMORY : memory,
  guess: guess.showComplete ? DEFAULT_GUESS : guess,
  letter: letter.showComplete ? DEFAULT_LETTER : letter,
  trace: trace.showComplete ? DEFAULT_TRACE : trace,
  findAnimal: findAnimal.showComplete ? DEFAULT_FINDANIMAL : findAnimal,
  whoseSound: whoseSound.showComplete ? DEFAULT_WHOSESOUND : whoseSound,
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
  const [letter, setLetterState] = useState(DEFAULT_LETTER);
  const [trace, setTraceState] = useState(DEFAULT_TRACE);
  const [findAnimal, setFindAnimalState] = useState(DEFAULT_FINDANIMAL);
  const [whoseSound, setWhoseSoundState] = useState(DEFAULT_WHOSESOUND);
  const [met, setMet] = useState(DEFAULT_MET);
  const [metVia, setMetVia] = useState(DEFAULT_MET_VIA);
  const [stars, setStars] = useState(DEFAULT_STARS);
  const [scene, setScene] = useState(DEFAULT_SCENE);
  const [coloring, setColoring] = useState(DEFAULT_COLORING);
  const [lastCelebratedDailyAnimal, setLastCelebratedDailyAnimal] =
    useState(null);
  const persistTimer = useRef(null);
  const latest = useRef({
    memory,
    guess,
    letter,
    trace,
    findAnimal,
    whoseSound,
  });

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
            : DEFAULT_GUESS,
          letterIsUsable(stored.letter)
            ? { ...DEFAULT_LETTER, ...stored.letter }
            : DEFAULT_LETTER,
          traceIsUsable(stored.trace)
            ? { ...DEFAULT_TRACE, ...stored.trace }
            : DEFAULT_TRACE,
          findAnimalIsUsable(stored.findAnimal)
            ? { ...DEFAULT_FINDANIMAL, ...stored.findAnimal }
            : DEFAULT_FINDANIMAL,
          whoseSoundIsUsable(stored.whoseSound)
            ? { ...DEFAULT_WHOSESOUND, ...stored.whoseSound }
            : DEFAULT_WHOSESOUND
        );
        setMemoryState(restored.memory);
        setGuessState(restored.guess);
        setLetterState(restored.letter);
        setTraceState(restored.trace);
        setFindAnimalState(restored.findAnimal);
        setWhoseSoundState(restored.whoseSound);
        if (Array.isArray(stored.met)) {
          setMet(stored.met.filter(id => validIds.has(id)));
        }
        if (stored.metVia && typeof stored.metVia === 'object') {
          const sanitized = {};
          Object.entries(stored.metVia).forEach(([id, gameKey]) => {
            if (validIds.has(id) && typeof gameKey === 'string') {
              sanitized[id] = gameKey;
            }
          });
          setMetVia(sanitized);
        }
        if (starsIsUsable(stored.stars)) {
          setStars({ ...DEFAULT_STARS, ...stored.stars });
        }
        if (stored.scene && Array.isArray(stored.scene.placed)) {
          setScene({ placed: stored.scene.placed.filter(scenePlacedIsUsable) });
        }
        if (stored.coloring) {
          setColoring({ pages: sanitizeColoringPages(stored.coloring.pages) });
        }
        if (typeof stored.lastCelebratedDailyAnimal === 'string') {
          setLastCelebratedDailyAnimal(stored.lastCelebratedDailyAnimal);
        }
      }
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    latest.current = {
      memory,
      guess,
      letter,
      trace,
      findAnimal,
      whoseSound,
      met,
      metVia,
      stars,
      scene,
      coloring,
      lastCelebratedDailyAnimal,
      hydrated,
    };
    // Nothing is written until the stored value has been read, otherwise the
    // initial empty state would overwrite real progress during startup.
    if (!hydrated) return;

    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      saveJSON(PROGRESS_KEY, {
        version: SCHEMA_VERSION,
        memory,
        guess,
        letter,
        trace,
        findAnimal,
        whoseSound,
        met,
        metVia,
        stars,
        scene,
        coloring,
        lastCelebratedDailyAnimal,
      });
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [
    memory,
    guess,
    letter,
    trace,
    findAnimal,
    whoseSound,
    met,
    metVia,
    stars,
    scene,
    coloring,
    lastCelebratedDailyAnimal,
    hydrated,
  ]);

  // Flush on teardown so a fast exit cannot outrun the debounce. Guarded on
  // `hydrated`: a teardown that happens while storage is still being read must
  // not write starting values over real saved progress.
  useEffect(() => {
    return () => {
      const {
        memory: m,
        guess: g,
        letter: l,
        trace: tr,
        findAnimal: fa,
        whoseSound: ws,
        met: k,
        metVia: mv,
        stars: st,
        scene: sc,
        coloring: co,
        lastCelebratedDailyAnimal: lc,
        hydrated: isHydrated,
      } = latest.current;
      if (!isHydrated) return;
      saveJSON(PROGRESS_KEY, {
        version: SCHEMA_VERSION,
        memory: m,
        guess: g,
        letter: l,
        trace: tr,
        findAnimal: fa,
        whoseSound: ws,
        met: k,
        metVia: mv,
        stars: st,
        scene: sc,
        coloring: co,
        lastCelebratedDailyAnimal: lc,
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

  const updateLetter = useCallback(patch => {
    setLetterState(prev => ({
      ...prev,
      ...(typeof patch === 'function' ? patch(prev) : patch),
    }));
  }, []);

  const updateTrace = useCallback(patch => {
    setTraceState(prev => ({
      ...prev,
      ...(typeof patch === 'function' ? patch(prev) : patch),
    }));
  }, []);

  const updateFindAnimal = useCallback(patch => {
    setFindAnimalState(prev => ({
      ...prev,
      ...(typeof patch === 'function' ? patch(prev) : patch),
    }));
  }, []);

  const updateWhoseSound = useCallback(patch => {
    setWhoseSoundState(prev => ({
      ...prev,
      ...(typeof patch === 'function' ? patch(prev) : patch),
    }));
  }, []);

  /**
   * Record that a child has met an animal. Idempotent, and never undone -
   * resetting a game must not take an animal back out of the album.
   * @param {string} id - Animal id from `animalList`.
   * @param {string} [gameKey] - The game this animal was met through, so the
   *   Album can show where it was first found. Only the first game to meet
   *   a given animal gets credit - later encounters in other games don't
   *   overwrite it.
   */
  const markAnimalMet = useCallback((id, gameKey) => {
    if (!id || !validIds.has(id)) return;
    setMet(prev => (prev.includes(id) ? prev : [...prev, id]));
    if (gameKey) {
      setMetVia(prev => (prev[id] ? prev : { ...prev, [id]: gameKey }));
    }
  }, []);

  /**
   * Record that a level has been completed, for the main-menu/album star
   * display. Idempotent and never undone - same permanence as `markAnimalMet`,
   * so replaying a level already starred just doesn't add a duplicate.
   * @param {string} gameKey - One of the keys in DEFAULT_STARS.
   * @param {number} level - The level just completed.
   */
  const markLevelStarred = useCallback((gameKey, level) => {
    if (!gameKey || typeof level !== 'number') return;
    setStars(prev => {
      const earned = prev[gameKey] || [];
      if (earned.includes(level)) return prev;
      return { ...prev, [gameKey]: [...earned, level] };
    });
  }, []);

  /** Gate the once-per-day "today's animal" fanfare on the main menu. */
  const markDailyAnimalCelebrated = useCallback(() => {
    setLastCelebratedDailyAnimal(today());
  }, []);

  /**
   * Add one item - an animal or a scenery object - to the child's scene at
   * a normalized position.
   * @param {string} itemId - An animal id, or a scenery id from sceneryList.
   * @param {'animal'|'scenery'} kind
   * @param {number} x - 0-1, relative to the scene area's own width.
   * @param {number} y - 0-1, relative to the scene area's own height.
   */
  const addPlacedItem = useCallback((itemId, kind, x, y) => {
    const isValid =
      kind === 'scenery' ? validSceneryIds.has(itemId) : validIds.has(itemId);
    if (!isValid) return;
    const instanceId = `${itemId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    setScene(prev => ({
      placed: [...prev.placed, { instanceId, itemId, kind, x, y }],
    }));
  }, []);

  /** Move one already-placed instance to a new normalized position. */
  const movePlacedItem = useCallback((instanceId, x, y) => {
    setScene(prev => ({
      placed: prev.placed.map(p =>
        p.instanceId === instanceId ? { ...p, x, y } : p
      ),
    }));
  }, []);

  /** Drop one placed instance - used when it's dragged off the scene. */
  const removePlacedItem = useCallback(instanceId => {
    setScene(prev => ({
      placed: prev.placed.filter(p => p.instanceId !== instanceId),
    }));
  }, []);

  /**
   * Commit one finished stroke to an animal's coloring page, creating the
   * page on first use. `points` is thinned to MIN_POINT_DISTANCE apart (the
   * screen draws every raw move event; storing all of them is far denser
   * than the line needs) and the page is capped at MAX_STROKES_PER_PAGE,
   * dropping the oldest stroke first - a safety net against unbounded
   * storage growth, not a limit a child would ever run into by drawing
   * normally.
   * @param {string} animalId
   * @param {string} color - Hex color of this stroke.
   * @param {{x: number, y: number}[]} points - Canvas-local coordinates.
   * @param {number} width - Brush width this stroke was drawn with.
   */
  const addColorStroke = useCallback((animalId, color, points, width) => {
    if (!validIds.has(animalId) || points.length === 0) return;
    const thinned = points.reduce((acc, p) => {
      const last = acc[acc.length - 1];
      if (
        last &&
        Math.hypot(p.x - last.x, p.y - last.y) < MIN_POINT_DISTANCE
      ) {
        return acc;
      }
      acc.push(p);
      return acc;
    }, []);
    setColoring(prev => {
      const page = prev.pages[animalId] || { strokes: [] };
      const nextStrokes = [
        ...page.strokes,
        { color, points: thinned, width },
      ].slice(-MAX_STROKES_PER_PAGE);
      return {
        pages: { ...prev.pages, [animalId]: { strokes: nextStrokes } },
      };
    });
  }, []);

  /** Remove the single most recently drawn stroke from an animal's page -
   * a simple one-step undo. Erased strokes (see `eraseStrokesNear`) are not
   * part of this history; erasing is already its own correction tool. */
  const undoLastStroke = useCallback(animalId => {
    setColoring(prev => {
      const page = prev.pages[animalId];
      if (!page || page.strokes.length === 0) return prev;
      return {
        pages: {
          ...prev.pages,
          [animalId]: { strokes: page.strokes.slice(0, -1) },
        },
      };
    });
  }, []);

  /**
   * Delete every whole stroke on an animal's page that passes near any
   * point of an eraser gesture - a full stroke disappears rather than being
   * partially trimmed, which is simpler to reason about (for a child) and
   * to implement than true path-segment erasing.
   * @param {string} animalId
   * @param {{x: number, y: number}[]} points - The eraser gesture's path.
   * @param {number} threshold - How close (px) counts as "touched".
   */
  const eraseStrokesNear = useCallback((animalId, points, threshold) => {
    setColoring(prev => {
      const page = prev.pages[animalId];
      if (!page || page.strokes.length === 0) return prev;
      const touched = s =>
        s.points.some(sp =>
          points.some(ep => Math.hypot(sp.x - ep.x, sp.y - ep.y) < threshold)
        );
      const nextStrokes = page.strokes.filter(s => !touched(s));
      if (nextStrokes.length === page.strokes.length) return prev;
      return {
        pages: { ...prev.pages, [animalId]: { strokes: nextStrokes } },
      };
    });
  }, []);

  /** Clear one animal's coloring page - the rest stay untouched. */
  const clearColorPage = useCallback(animalId => {
    setColoring(prev => {
      if (!prev.pages[animalId]) return prev;
      const pages = { ...prev.pages };
      delete pages[animalId];
      return { pages };
    });
  }, []);

  // Derived here (rather than exposing `today()` itself) so the main menu
  // doesn't need its own copy of the calendar-day format just to compare.
  const hasSeenTodaysAnimal = lastCelebratedDailyAnimal === today();

  const resetMemory = useCallback(() => setMemoryState(DEFAULT_MEMORY), []);
  const resetGuess = useCallback(() => setGuessState(DEFAULT_GUESS), []);
  const resetLetter = useCallback(() => setLetterState(DEFAULT_LETTER), []);
  const resetTrace = useCallback(() => setTraceState(DEFAULT_TRACE), []);
  const resetFindAnimal = useCallback(
    () => setFindAnimalState(DEFAULT_FINDANIMAL),
    []
  );
  const resetWhoseSound = useCallback(
    () => setWhoseSoundState(DEFAULT_WHOSESOUND),
    []
  );
  const resetScene = useCallback(() => setScene(DEFAULT_SCENE), []);

  const value = useMemo(
    () => ({
      hydrated,
      memory,
      guess,
      letter,
      trace,
      findAnimal,
      whoseSound,
      met,
      metVia,
      stars,
      scene,
      coloring,
      lastCelebratedDailyAnimal,
      hasSeenTodaysAnimal,
      markAnimalMet,
      markLevelStarred,
      markDailyAnimalCelebrated,
      addPlacedItem,
      movePlacedItem,
      removePlacedItem,
      addColorStroke,
      undoLastStroke,
      eraseStrokesNear,
      clearColorPage,
      updateMemory,
      updateGuess,
      updateLetter,
      updateTrace,
      updateFindAnimal,
      updateWhoseSound,
      resetMemory,
      resetGuess,
      resetLetter,
      resetTrace,
      resetFindAnimal,
      resetWhoseSound,
      resetScene,
    }),
    [
      hydrated,
      memory,
      guess,
      letter,
      trace,
      findAnimal,
      whoseSound,
      met,
      metVia,
      stars,
      scene,
      coloring,
      lastCelebratedDailyAnimal,
      hasSeenTodaysAnimal,
      markAnimalMet,
      markLevelStarred,
      markDailyAnimalCelebrated,
      addPlacedItem,
      movePlacedItem,
      removePlacedItem,
      addColorStroke,
      undoLastStroke,
      eraseStrokesNear,
      clearColorPage,
      updateMemory,
      updateGuess,
      updateLetter,
      updateTrace,
      updateFindAnimal,
      updateWhoseSound,
      resetMemory,
      resetGuess,
      resetLetter,
      resetTrace,
      resetFindAnimal,
      resetWhoseSound,
      resetScene,
    ]
  );

  return (
    <GameProgressContext.Provider value={value}>
      {children}
    </GameProgressContext.Provider>
  );
}

/**
 * Access saved progress for all games.
 * @returns {{hydrated: boolean, memory: object, guess: object, letter: object,
 *   trace: object, findAnimal: object, whoseSound: object, stars: object,
 *   scene: {placed: object[]}, coloring: {pages: Object<string,object>},
 *   met: string[], metVia: Object<string,string>,
 *   lastCelebratedDailyAnimal: ?string, hasSeenTodaysAnimal: boolean,
 *   markLevelStarred: Function,
 *   markDailyAnimalCelebrated: Function, addPlacedItem: Function,
 *   movePlacedItem: Function, removePlacedItem: Function,
 *   addColorStroke: Function, undoLastStroke: Function,
 *   eraseStrokesNear: Function, clearColorPage: Function,
 *   updateMemory: Function,
 *   updateGuess: Function, updateLetter: Function, updateTrace: Function,
 *   updateFindAnimal: Function, updateWhoseSound: Function,
 *   resetMemory: Function, resetGuess: Function, resetLetter: Function,
 *   resetTrace: Function, resetFindAnimal: Function,
 *   resetWhoseSound: Function, resetScene: Function}}
 */
export function useGameProgress() {
  const ctx = useContext(GameProgressContext);
  if (!ctx) {
    throw new Error('useGameProgress must be used inside GameProgressProvider');
  }
  return ctx;
}

export {
  DEFAULT_MEMORY,
  DEFAULT_GUESS,
  DEFAULT_LETTER,
  DEFAULT_TRACE,
  DEFAULT_FINDANIMAL,
  DEFAULT_WHOSESOUND,
  DEFAULT_STARS,
};
