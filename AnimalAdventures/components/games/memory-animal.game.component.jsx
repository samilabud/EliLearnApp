import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import { animalList, iconScaleStyle } from '../animals/animal.list';
import ConfettiCannon from 'react-native-confetti-cannon';
import { t } from '../../constants';
import {
  CATEGORY_COLORS,
  FONTS,
  PALETTE,
  RADIUS,
  titleText,
} from '../../constants/theme';
import {
  tapFeedback,
  successFeedback,
  celebrationFeedback,
} from '../../utils/haptics';
import {
  faceDownUnmatched,
  unresolvedFlips,
  useGameProgress,
} from '../../contexts/game-progress.context';
import { EVENTS, track } from '../../utils/analytics';
import { useBackToMenu } from '../../utils/navigation';
import { playClip, releasePlayer, playVoice } from '../../utils/sound';
import { useResponsive } from '../../utils/use-responsive';
import { GameScreen } from '../utility/game-screen.component';
import { FitGrid } from '../utility/fit-grid.component';
import { AnswerCard } from '../utility/answer-card.component';
import { CompletionOverlay } from '../utility/feedback-overlays.component';
import { useInstructionPrompt } from '../../utils/use-instruction-prompt';
import { useSettings } from '../../contexts/settings.context';
import { getMemoryCardCount } from '../../constants/difficulty';

const MAX_LEVEL = 7; // Level 1: 4 cards, Level 2: 6 cards, ..., Level 7: 16 cards
const CARD_FLIP_DELAY = 1000; // 1 second delay before flipping back unmatched cards
// Phone-size ceiling, grown by the device scale on tablets.
const CARD_MAX = 170;

// Children habituate to a repeated reward quickly, so the celebration is
// varied by level rather than firing the identical burst every time.
const CELEBRATIONS = [
  { count: 90, explosionSpeed: 300, fallSpeed: 3000, origin: { x: 0, y: 0 } },
  {
    count: 140,
    explosionSpeed: 450,
    fallSpeed: 2400,
    origin: { x: 200, y: -10 },
  },
  {
    count: 70,
    explosionSpeed: 220,
    fallSpeed: 3600,
    origin: { x: -20, y: 40 },
  },
];

export default function MemoryAnimalGame({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
  onNextGame,
}) {
  const { scale } = useResponsive();
  // Spoken once when the mode opens; tapping the instruction replays it.
  const { replay: replayInstruction } = useInstructionPrompt(
    'memory',
    currentLanguage
  );

  // Level, board and score are saved progress and live in the context so they
  // survive a trip to the menu, a rotation, or the app being killed. Only
  // state that is meaningless outside the current turn stays local.
  const { memory, updateMemory, resetMemory, markAnimalMet, markLevelStarred } =
    useGameProgress();
  const { level, matchedPairs, moves, gameComplete } = memory;

  const [isProcessing, setIsProcessing] = useState(false);
  const [showLevelComplete, setShowLevelComplete] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);

  // Audio players
  const cardFlipPlayer = useAudioPlayer(null);
  const matchPlayer = useAudioPlayer(null);
  const gameWinPlayer = useAudioPlayer(null);
  const gameSuccessPlayer = useAudioPlayer(null);

  const cardAnimRefs = useRef({});
  // Set on mount and on each deal rather than at render, so the value is a
  // real level start time and render stays pure.
  const levelStartedAt = useRef(0);

  // Every delayed action is registered here so unmounting cancels it. Without
  // this, leaving mid-turn leaves timers that later write to saved progress -
  // flipping cards back down in a game the child has already left.
  const timers = useRef([]);
  const later = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  // Sound files
  const gameWinSoundFile = require('../../assets/sounds/game/game_win.mp3');
  const gameSuccessSoundFile = require('../../assets/sounds/game/game_success.mp3');

  const animalsById = useMemo(() => {
    const lookup = {};
    animalList.forEach(animal => {
      lookup[animal.id] = animal;
    });
    return lookup;
  }, []);

  // Saved cards hold only an animal id plus flags. Artwork and audio are
  // re-attached here at render time rather than persisted, because Metro
  // module ids shift between builds and would otherwise restore a board
  // pointing at the wrong animal after an update.
  const cards = useMemo(
    () =>
      memory.cards
        .filter(card => animalsById[card.id])
        .map(card => ({ ...animalsById[card.id], ...card })),
    [memory.cards, animalsById]
  );

  // The turn is derived from the board rather than tracked alongside it.
  // Keeping a separate list meant a trip to the menu dropped the local copy
  // while the saved cards stayed face up, so the returning player got a free
  // third card and the first pick was silently ignored.
  const flippedCards = useMemo(() => unresolvedFlips(cards), [cards]);

  // The age band sets how many cards a level deals (see getMemoryCardCount in
  // constants/difficulty.js): fewer for under-4, more for 7+.
  const { childAgeBand } = useSettings();

  const dealBoard = useCallback(
    levelNum => {
      const pairsNeeded = getMemoryCardCount(childAgeBand, levelNum) / 2;
      const shuffledAnimals = [...animalList].sort(() => Math.random() - 0.5);
      const selectedAnimals = shuffledAnimals.slice(0, pairsNeeded);
      const pairs = [...selectedAnimals, ...selectedAnimals];

      const dealt = pairs
        .sort(() => Math.random() - 0.5)
        .map((animal, index) => ({
          id: animal.id,
          position: index,
          isFlipped: false,
          isMatched: false,
        }));

      updateMemory({
        cards: dealt,
        matchedPairs: [],
        moves: 0,
        gameComplete: false,
      });
      setIsProcessing(false);
      setConfettiKey(prev => prev + 1);
      levelStartedAt.current = Date.now();
    },
    [updateMemory, childAgeBand]
  );

  // A board is dealt only when the saved one does not fit the current level,
  // which covers a first run, a level change, a reset and a change of age band. A saved board that
  // does fit is left exactly as the child left it.
  const expectedCardCount = getMemoryCardCount(childAgeBand, level);
  useEffect(() => {
    if (memory.cards.length !== expectedCardCount) {
      dealBoard(level);
    }
  }, [memory.cards.length, expectedCardCount, level, dealBoard]);

  // Leaving during the compare-and-flip-back window cancels that timer, so a
  // returning player would find two unmatched cards face up and no way to
  // resolve them. Restoring a clean turn boundary on mount mirrors what
  // hydration does for a relaunch.
  useEffect(() => {
    if (unresolvedFlips(memory.cards).length < 2) return;
    updateMemory(prev => ({ cards: faceDownUnmatched(prev.cards) }));
    // Mount only: mid-turn flips during play are resolved by their own timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    levelStartedAt.current = Date.now();
    const resumed = memory.cards.some(c => c.isMatched || c.isFlipped);
    track(resumed ? EVENTS.GAME_RESUMED : EVENTS.GAME_STARTED, {
      game: 'memory',
      level,
    });
    // Intentionally fires once per visit to the game, not once per level.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup audio players
  useEffect(() => {
    return () => {
      releasePlayer(cardFlipPlayer);
      releasePlayer(matchPlayer);
      releasePlayer(gameWinPlayer);
      releasePlayer(gameSuccessPlayer);
    };
  }, [cardFlipPlayer, matchPlayer, gameWinPlayer, gameSuccessPlayer]);

  // Check for level completion
  useEffect(() => {
    const pairsNeeded = expectedCardCount / 2;

    if (
      matchedPairs.length === pairsNeeded &&
      !gameComplete &&
      !showLevelComplete
    ) {
      celebrationFeedback();
      setShowLevelComplete(true);
      markLevelStarred('memory', level);
      track(EVENTS.LEVEL_COMPLETED, {
        game: 'memory',
        level,
        moves,
        duration_ms: Date.now() - levelStartedAt.current,
      });

      if (level < MAX_LEVEL) {
        // Clearing the board is what triggers the next deal.
        later(() => {
          updateMemory(prev => ({
            level: prev.level + 1,
            cards: [],
            matchedPairs: [],
            moves: 0,
          }));
          setShowLevelComplete(false);
          setConfettiKey(prev => prev + 1);
        }, 2000);
      } else {
        later(() => {
          updateMemory({ gameComplete: true });
          setShowLevelComplete(false);
          track(EVENTS.GAME_COMPLETED, { game: 'memory', level });
          playClip(gameWinPlayer, gameWinSoundFile);
        }, 2000);
      }
    }
  }, [
    matchedPairs.length,
    gameComplete,
    showLevelComplete,
    level,
    moves,
    expectedCardCount,
    gameWinPlayer,
    gameWinSoundFile,
    later,
    updateMemory,
    markLevelStarred,
  ]);

  const playCardFlipSound = useCallback(
    async animal => {
      playClip(cardFlipPlayer, animal.sound);
    },
    [cardFlipPlayer]
  );

  const playAnimalNameSound = useCallback(
    async animal => {
      playVoice(
        matchPlayer,
        currentLanguage === 'en' ? animal.voice : animal.spanish_voice
      );
    },
    [matchPlayer, currentLanguage]
  );

  const handleCardPress = useCallback(
    async card => {
      if (
        isProcessing ||
        card.isFlipped ||
        card.isMatched ||
        flippedCards.length >= 2
      ) {
        return;
      }

      tapFeedback();
      await playCardFlipSound(card);

      updateMemory(prev => ({
        cards: prev.cards.map(c =>
          c.position === card.position ? { ...c, isFlipped: true } : c
        ),
      }));

      const newFlippedCards = [...flippedCards, card];

      if (newFlippedCards.length === 2) {
        setIsProcessing(true);
        updateMemory(prev => ({ moves: prev.moves + 1 }));

        const [firstCard, secondCard] = newFlippedCards;
        const isMatch = firstCard.id === secondCard.id;

        if (isMatch) {
          successFeedback();
          markAnimalMet(firstCard.id, 'memory');
          updateMemory(prev => ({
            matchedPairs: [...prev.matchedPairs, firstCard.id],
            cards: prev.cards.map(c =>
              c.id === firstCard.id ? { ...c, isMatched: true } : c
            ),
          }));

          await playAnimalNameSound(firstCard);

          playClip(gameSuccessPlayer, gameSuccessSoundFile);

          try {
            [firstCard.position, secondCard.position].forEach(pos => {
              const ref = cardAnimRefs.current[pos];
              if (ref && ref.play) ref.play();
            });
          } catch {}

          // Matching clears the pair from the derived turn on its own; this
          // only holds the board briefly so the celebration can play.
          later(() => setIsProcessing(false), 500);
        } else {
          later(() => {
            updateMemory(prev => ({
              cards: prev.cards.map(c =>
                newFlippedCards.some(fc => fc.position === c.position)
                  ? { ...c, isFlipped: false }
                  : c
              ),
            }));
            setIsProcessing(false);
          }, CARD_FLIP_DELAY);
        }
      }
    },
    [
      isProcessing,
      flippedCards,
      playCardFlipSound,
      playAnimalNameSound,
      gameSuccessPlayer,
      gameSuccessSoundFile,
      later,
      updateMemory,
      markAnimalMet,
    ]
  );

  const onReset = useCallback(() => {
    track(EVENTS.GAME_RESET, { game: 'memory', level });
    setIsProcessing(false);
    setShowLevelComplete(false);
    setConfettiKey(prev => prev + 1);
    resetMemory();
  }, [resetMemory, level]);

  const handleReset = useCallback(() => {
    tapFeedback();
    onReset();
  }, [onReset]);

  const handleBackToMenu = useCallback(() => {
    tapFeedback();
    if (gameComplete) {
      // Finishing every level is worth celebrating in the moment, but it
      // should not be what a child finds waiting for them next time they
      // open this game - only an in-progress level is worth resuming.
      resetMemory();
    } else {
      track(EVENTS.GAME_ABANDONED, {
        game: 'memory',
        level,
        moves,
        matched: matchedPairs.length,
      });
    }
    onBackToMenu();
  }, [
    onBackToMenu,
    gameComplete,
    level,
    moves,
    matchedPairs.length,
    resetMemory,
  ]);

  useBackToMenu(handleBackToMenu);

  const handleNextGame = useCallback(() => {
    tapFeedback();
    if (gameComplete) {
      resetMemory();
    } else {
      track(EVENTS.GAME_ABANDONED, {
        game: 'memory',
        level,
        moves,
        matched: matchedPairs.length,
      });
    }
    onNextGame();
  }, [
    onNextGame,
    gameComplete,
    level,
    moves,
    matchedPairs.length,
    resetMemory,
  ]);

  return (
    <GameScreen
      currentLanguage={currentLanguage}
      setCurrentLanguage={setCurrentLanguage}
      onHome={handleBackToMenu}
      onNextGame={handleNextGame}
      onReset={onReset}
      level={level}
      maxLevel={MAX_LEVEL}
      instruction={t(currentLanguage, 'findPairs', {
        count: expectedCardCount,
      })}
      onReplayInstruction={replayInstruction}
      overlay={
        <>
          {showLevelComplete && (
            <View style={styles.levelCompleteOverlay}>
              <View style={styles.levelCompleteCard}>
                <Text style={styles.levelCompleteTitle}>
                  {t(currentLanguage, 'levelComplete')}
                </Text>
                <Text style={styles.levelCompleteSubtitle}>
                  {t(currentLanguage, 'movingToLevel', { level: level + 1 })}
                </Text>
              </View>
              <ConfettiCannon
                key={`level-${level}-complete`}
                fadeOut={true}
                {...CELEBRATIONS[level % CELEBRATIONS.length]}
              />
            </View>
          )}
          <CompletionOverlay
            visible={gameComplete}
            currentLanguage={currentLanguage}
            confettiKey={confettiKey}
            subtitle={t(currentLanguage, 'completedAllMemoryLevels')}
            onRestart={handleReset}
            onNextGame={handleNextGame}
            onHome={handleBackToMenu}
          />
        </>
      }
    >
      {/* Square cards sized from the space they actually get, so 16 cards
          fit a landscape phone and 4 cards fill an iPad. */}
      <FitGrid
        items={cards}
        keyExtractor={card => `card-${card.position}`}
        gap={12}
        minSize={64}
        maxSize={CARD_MAX * scale}
        renderItem={(card, size) => {
          const faceUp = card.isFlipped || card.isMatched;
          return (
            <AnswerCard
              category="memory"
              fill={faceUp ? undefined : CATEGORY_COLORS.memory.ring}
              onPress={() => handleCardPress(card)}
              disabled={isProcessing}
              accessibilityState={{ disabled: isProcessing }}
              accessibilityLabel={
                faceUp
                  ? t(currentLanguage, 'a11yMemoryCardRevealed', {
                      animal:
                        currentLanguage === 'en'
                          ? card.name
                          : card.spanish_name,
                    })
                  : t(currentLanguage, 'a11yMemoryCard', {
                      number: card.position + 1,
                    })
              }
            >
              {faceUp ? (
                <LottieView
                  autoPlay={false}
                  loop={false}
                  ref={el => (cardAnimRefs.current[card.position] = el)}
                  resizeMode="contain"
                  source={card.animation_path}
                  style={[
                    { width: size * 0.86, height: size * 0.86 },
                    iconScaleStyle(card),
                  ]}
                />
              ) : (
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.cardBackText,
                    { fontSize: size * 0.45, lineHeight: size * 0.58 },
                  ]}
                >
                  ?
                </Text>
              )}
            </AnswerCard>
          );
        }}
      />
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  cardBackText: {
    fontWeight: '900',
    color: PALETTE.white,
    includeFontPadding: false,
    textAlign: 'center',
  },
  levelCompleteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 61, 98, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  levelCompleteCard: {
    alignItems: 'center',
    backgroundColor: PALETTE.cream,
    borderRadius: RADIUS.lg,
    borderWidth: 4,
    borderColor: PALETTE.gold,
    paddingHorizontal: 28,
    paddingVertical: 20,
  },
  levelCompleteTitle: {
    ...titleText(42, PALETTE.red),
    textAlign: 'center',
  },
  levelCompleteSubtitle: {
    marginTop: 6,
    fontFamily: FONTS.body,
    fontSize: 20,
    color: PALETTE.ink,
    textAlign: 'center',
  },
});
