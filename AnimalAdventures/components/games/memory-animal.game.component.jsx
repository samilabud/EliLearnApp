import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import { AmbientBackground } from '../utility/ambient-background.component';
import { animalList } from '../animals/animal.list';
import ConfettiCannon from 'react-native-confetti-cannon';
import { t, MIN_TOUCH_TARGET } from '../../constants';
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
import { playClip, releasePlayer } from '../../utils/sound';

const MAX_LEVEL = 7; // Level 1: 4 cards, Level 2: 6 cards, ..., Level 7: 16 cards
const CARD_FLIP_DELAY = 1000; // 1 second delay before flipping back unmatched cards
const GRID_PADDING_H = 16;
const CARD_GAP = 8;
const PORTRAIT_COLUMNS = 4;
const LANDSCAPE_COLUMNS = 8;

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

/** Cards per level: 4, 6, 8, ... capped at 16. */
const getCardsPerLevel = levelNum => Math.min(2 + levelNum * 2, 16);

export default function MemoryAnimalGame({ currentLanguage, onBackToMenu }) {
  const insets = useSafeAreaInsets();
  // Android 16 ignores the portrait lock on large screens, so the grid has to
  // lay out sensibly at any aspect ratio. Sizing cards from the window keeps
  // them square instead of stretching them into wide slabs in landscape.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const columns =
    windowWidth > windowHeight ? LANDSCAPE_COLUMNS : PORTRAIT_COLUMNS;
  const cardSize = Math.floor(
    (windowWidth - GRID_PADDING_H * 2 - CARD_GAP * columns) / columns
  );
  const [fontsLoaded] = useFonts({ Bangers_400Regular });

  // Level, board and score are saved progress and live in the context so they
  // survive a trip to the menu, a rotation, or the app being killed. Only
  // state that is meaningless outside the current turn stays local.
  const { memory, updateMemory, resetMemory, markAnimalMet } =
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

  const backgroundImage = require('../../assets/backgrounds/pawel-czerwinski-4gWNAWeOvP0-unsplash.jpg');

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

  const dealBoard = useCallback(
    levelNum => {
      const pairsNeeded = getCardsPerLevel(levelNum) / 2;
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
    [updateMemory]
  );

  // A board is dealt only when the saved one does not fit the current level,
  // which covers a first run, a level change and a reset. A saved board that
  // does fit is left exactly as the child left it.
  const expectedCardCount = getCardsPerLevel(level);
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
  ]);

  const playCardFlipSound = useCallback(
    async animal => {
      playClip(cardFlipPlayer, animal.sound);
    },
    [cardFlipPlayer]
  );

  const playAnimalNameSound = useCallback(
    async animal => {
      playClip(
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
          markAnimalMet(firstCard.id);
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
          } catch (e) {}

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

  const handleReset = useCallback(() => {
    tapFeedback();
    track(EVENTS.GAME_RESET, { game: 'memory', level });
    setIsProcessing(false);
    setShowLevelComplete(false);
    setConfettiKey(prev => prev + 1);
    resetMemory();
  }, [resetMemory, level]);

  const handleBackToMenu = useCallback(() => {
    tapFeedback();
    if (!gameComplete) {
      track(EVENTS.GAME_ABANDONED, {
        game: 'memory',
        level,
        moves,
        matched: matchedPairs.length,
      });
    }
    onBackToMenu();
  }, [onBackToMenu, gameComplete, level, moves, matchedPairs.length]);

  if (!fontsLoaded) return null;

  return (
    <ImageBackground
      source={backgroundImage}
      resizeMode="cover"
      style={styles.backgroundImage}
    >
      <AmbientBackground />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(60, insets.bottom + 24) },
        ]}
      >
        {/* Top controls */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <View style={styles.gameInfo}>
            <Text
              style={[styles.infoText, { fontFamily: 'Bangers_400Regular' }]}
            >
              {t(currentLanguage, 'memoryGame')}
            </Text>
            <Text style={styles.levelText}>
              {t(currentLanguage, 'level')} {level}/{MAX_LEVEL}
            </Text>
            <Text style={styles.movesText}>
              {t(currentLanguage, 'moves')}: {moves}
            </Text>
          </View>
          <View style={styles.topActions}>
            <TouchableOpacity
              onPress={handleReset}
              style={styles.actionButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yResetButton')}
            >
              <Text style={styles.actionText}>
                {t(currentLanguage, 'reset')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBackToMenu}
              style={styles.actionButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yMainMenuButton')}
            >
              <Text style={styles.actionText}>
                {t(currentLanguage, 'mainMenu')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Game instructions */}
        <View style={styles.instructionsContainer}>
          <Text
            style={[
              styles.instructionsText,
              { fontFamily: 'Bangers_400Regular' },
            ]}
          >
            {t(currentLanguage, 'findPairs', { count: expectedCardCount })}
          </Text>
        </View>

        {/* Cards grid */}
        <View style={styles.gridContainer}>
          {cards.map(card => (
            <TouchableOpacity
              key={card.position}
              style={[
                styles.cardContainer,
                { width: cardSize, height: cardSize },
              ]}
              onPress={() => handleCardPress(card)}
              disabled={isProcessing}
              accessible={true}
              accessibilityRole="button"
              accessibilityState={{ disabled: isProcessing }}
              accessibilityLabel={
                card.isFlipped || card.isMatched
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
              <View style={styles.card}>
                {card.isFlipped || card.isMatched ? (
                  <View style={styles.cardInner}>
                    <View style={styles.animationBackground} />
                    <LottieView
                      autoPlay={false}
                      loop={false}
                      ref={el => (cardAnimRefs.current[card.position] = el)}
                      resizeMode="contain"
                      source={card.animation_path}
                      style={styles.animation}
                    />
                  </View>
                ) : (
                  <View style={styles.cardBack}>
                    <Text style={styles.cardBackText}>?</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Level completion overlay */}
      {showLevelComplete && (
        <View style={styles.levelCompleteOverlay}>
          <Text
            style={[
              styles.levelCompleteTitle,
              { fontFamily: 'Bangers_400Regular' },
            ]}
          >
            {t(currentLanguage, 'levelComplete')}
          </Text>
          <Text style={styles.levelCompleteSubtitle}>
            {t(currentLanguage, 'movingToLevel', { level: level + 1 })}
          </Text>
          <ConfettiCannon
            key={`level-${level}-complete`}
            fadeOut={true}
            {...CELEBRATIONS[level % CELEBRATIONS.length]}
          />
        </View>
      )}

      {/* Game completion overlay */}
      {gameComplete && (
        <View style={styles.completionOverlay}>
          <Text
            style={[
              styles.completionTitle,
              { fontFamily: 'Bangers_400Regular' },
            ]}
          >
            {t(currentLanguage, 'amazing')}
          </Text>
          <Text style={styles.completionSubtitle}>
            {t(currentLanguage, 'completedAllMemoryLevels')}
          </Text>
          <ConfettiCannon
            key={`memory-${confettiKey}-complete`}
            count={200}
            fadeOut={true}
            explosionSpeed={300}
            fallSpeed={3500}
            origin={{ x: 0, y: 0 }}
          />
          <View style={styles.completionActions}>
            <TouchableOpacity
              onPress={handleReset}
              style={styles.bigButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yResetButton')}
            >
              <Text style={styles.bigButtonText}>
                {t(currentLanguage, 'playAgain')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBackToMenu}
              style={styles.secondaryButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yMainMenuButton')}
            >
              <Text style={styles.secondaryButtonText}>
                {t(currentLanguage, 'mainMenuFull')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#BD0000',
  },
  topBar: {
    width: '100%',
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameInfo: {
    flex: 1,
  },
  infoText: {
    color: 'white',
    fontSize: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 3 },
    paddingBottom: 4,
  },
  levelText: {
    color: 'white',
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 2 },
    paddingBottom: 4,
  },
  movesText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  actionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  instructionsContainer: {
    paddingTop: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  instructionsText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 2 },
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  gridContainer: {
    flexGrow: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    alignContent: 'space-around',
    paddingTop: 20,
    paddingHorizontal: GRID_PADDING_H,
  },
  cardContainer: {
    marginBottom: CARD_GAP,
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  animationBackground: {
    backgroundColor: '#ffffff',
    height: '100%',
    width: '100%',
    borderRadius: 12,
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  animation: {
    width: '100%',
    height: '100%',
    zIndex: 2,
  },
  cardBack: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 12,
  },
  cardBackText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0A3D62',
  },
  levelCompleteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  levelCompleteTitle: {
    fontSize: 42,
    color: '#FFD700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 4 },
    textAlign: 'center',
    marginBottom: 16,
  },
  levelCompleteSubtitle: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    lineHeight: 24,
  },
  completionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  completionTitle: {
    fontSize: 48,
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 4 },
    textAlign: 'center',
  },
  completionSubtitle: {
    marginTop: 8,
    fontSize: 18,
    color: '#FFD700',
    textAlign: 'center',
    lineHeight: 24,
  },
  completionActions: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 12,
  },
  bigButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  bigButtonText: {
    color: '#0A3D62',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  secondaryButtonText: {
    color: '#0A3D62',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
