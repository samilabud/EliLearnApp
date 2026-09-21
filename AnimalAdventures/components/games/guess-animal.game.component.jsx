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
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import { AmbientBackground } from '../utility/ambient-background.component';
import { animalList } from '../animals/animal.list';
import ConfettiCannon from 'react-native-confetti-cannon';
import { t, MIN_TOUCH_TARGET, LARGE_TOUCH_TARGET } from '../../constants';
import { useGameProgress } from '../../contexts/game-progress.context';
import { playClip, stopClip } from '../../utils/sound';
import { EVENTS, track } from '../../utils/analytics';
import {
  tapFeedback,
  successFeedback,
  errorFeedback,
} from '../../utils/haptics';

const GRID_PADDING_H = 16;
const OPTION_GAP = 12;
const PORTRAIT_COLUMNS = 3;
const LANDSCAPE_COLUMNS = 6;
// The answer artwork is a fixed 100dp square, so cards must never shrink past it.
const MIN_OPTION_SIZE = 104;

const MAX_LEVEL = 8;

// After this many wrong tries the right answer starts to glow. Children aged
// three to six learn by trying the wrong thing, so the game never ends on a
// mistake - it just gets more helpful.
const HINT_AFTER_TRIES = 3;

export default function GuessAnimalGame({ currentLanguage, onBackToMenu }) {
  const insets = useSafeAreaInsets();
  // Android 16 ignores the portrait lock on large screens, so the answer grid
  // has to lay out sensibly at any aspect ratio. A wide screen gets one row of
  // six instead of two rows of stretched cards.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const optionColumns =
    windowWidth > windowHeight ? LANDSCAPE_COLUMNS : PORTRAIT_COLUMNS;
  const optionSize = Math.max(
    MIN_OPTION_SIZE,
    Math.floor(
      (windowWidth - GRID_PADDING_H * 2 - OPTION_GAP * optionColumns) /
        optionColumns
    )
  );
  const [fontsLoaded] = useFonts({ Bangers_400Regular });
  // Level, the current round and lives are saved progress and live in the
  // context, so they survive a trip to the menu, a rotation, or the app being
  // killed. Only state meaningless outside the current round stays local.
  const { guess, updateGuess, resetGuess, markAnimalMet } = useGameProgress();
  const { level, wrongCount, showComplete } = guess;

  const [isCorrect, setIsCorrect] = useState(false);
  const promptPlayer = useAudioPlayer(null);
  const [feedbackAnim] = useState(new Animated.Value(0));
  const [promptPulse] = useState(new Animated.Value(0));
  const [showWrongOverlay, setShowWrongOverlay] = useState(false);
  const wrongPlayer = useAudioPlayer(null);
  const gameWinPlayer = useAudioPlayer(null);
  const gameSuccessPlayer = useAudioPlayer(null);
  const animalNamePlayer = useAudioPlayer(null);
  const [confettiKey, setConfettiKey] = useState(0);

  const backgroundImage = require('../../assets/backgrounds/pawel-czerwinski-4gWNAWeOvP0-unsplash.jpg');

  const optionAnimRefs = useRef({});
  const wrongSoundFile = require('../../assets/sounds/background/animals/mixkit-creaking-cartoon-bird-calling-11 (online-audio-converter.com).mp3');
  const gameWinSoundFile = require('../../assets/sounds/game/game_win.mp3');
  const gameSuccessSoundFile = require('../../assets/sounds/game/game_success.mp3');

  const animalsById = useMemo(() => {
    const lookup = {};
    animalList.forEach(animal => {
      lookup[animal.id] = animal;
    });
    return lookup;
  }, []);

  // The saved round stores animal ids only. Artwork and audio are re-attached
  // here rather than persisted, because Metro module ids shift between builds
  // and would otherwise restore a round pointing at the wrong animal.
  const targetAnimal = useMemo(
    () => animalsById[guess.targetId] || null,
    [animalsById, guess.targetId]
  );
  const options = useMemo(
    () => guess.optionIds.map(id => animalsById[id]).filter(Boolean),
    [animalsById, guess.optionIds]
  );

  // Every delayed action is registered here so unmounting cancels it. Without
  // this, leaving mid-round leaves timers that later advance the level or
  // clear an overlay in a game the child has already left.
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

  const roundStartedAt = useRef(0);

  useEffect(() => {
    roundStartedAt.current = Date.now();
    track(guess.targetId ? EVENTS.GAME_RESUMED : EVENTS.GAME_STARTED, {
      game: 'guess',
      level,
    });
    // Fires once per visit to the game, not once per round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const optionsCount = useMemo(() => {
    // Level 1 -> 2 options, Level 2 -> 3, ... Level 5 -> 6
    return Math.min(6, level + 1);
  }, [level]);

  const stopAndUnload = useCallback(async () => {
    stopClip(promptPlayer);
  }, [promptPlayer]);

  useEffect(() => {
    return () => {
      stopAndUnload();
      try {
        promptPlayer.remove();
      } catch {}
      try {
        wrongPlayer.remove();
      } catch {}
      try {
        gameWinPlayer.remove();
      } catch {}
      try {
        gameSuccessPlayer.remove();
      } catch {}
      try {
        animalNamePlayer.remove();
      } catch {}
    };
  }, [
    stopAndUnload,
    promptPlayer,
    wrongPlayer,
    gameWinPlayer,
    gameSuccessPlayer,
    animalNamePlayer,
  ]);

  // Continuous bubble effect on Play Sound button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(promptPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(promptPulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [promptPulse]);

  // Play win sound when the user completes all levels
  useEffect(() => {
    if (showComplete) {
      playClip(gameWinPlayer, gameWinSoundFile);
    }
  }, [showComplete, gameWinPlayer, gameWinSoundFile]);

  const shuffle = useCallback(arr => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, []);

  const pickRound = useCallback(() => {
    const all = shuffle(animalList);
    const nextTarget = all[0];
    const distractors = shuffle(all.slice(1)).slice(0, optionsCount - 1);
    const nextOptions = shuffle([nextTarget, ...distractors]);
    updateGuess({
      targetId: nextTarget.id,
      optionIds: nextOptions.map(a => a.id),
    });
    setIsCorrect(false);
    setShowWrongOverlay(false);
    roundStartedAt.current = Date.now();
  }, [optionsCount, shuffle, updateGuess]);

  // A round is dealt only when the saved one does not fit the current level,
  // which covers a first run, a level change and a reset. A saved round that
  // does fit is restored untouched, so returning from the menu or rotating the
  // device resumes the same question rather than silently replacing it.
  useEffect(() => {
    if (guess.optionIds.length !== optionsCount) {
      pickRound();
    }
  }, [guess.optionIds.length, optionsCount, pickRound]);

  const playPrompt = useCallback(async () => {
    if (!targetAnimal) return;
    await stopAndUnload();
    playClip(promptPlayer, targetAnimal.sound);
  }, [targetAnimal, stopAndUnload, promptPlayer]);

  const playAnimalName = useCallback(
    async animal => {
      playClip(
        animalNamePlayer,
        currentLanguage === 'en' ? animal.voice : animal.spanish_voice
      );
    },
    [animalNamePlayer, currentLanguage]
  );

  useEffect(() => {
    if (targetAnimal) {
      playPrompt();
    }
  }, [targetAnimal, playPrompt]);

  const onSelect = useCallback(
    async selected => {
      if (showComplete || isCorrect) return;
      const correct = selected.id === targetAnimal.id;
      if (correct) {
        successFeedback();
        setIsCorrect(true);
        updateGuess({ wrongCount: 0 });
        markAnimalMet(selected.id);
        track(EVENTS.LEVEL_COMPLETED, {
          game: 'guess',
          level,
          duration_ms: Date.now() - roundStartedAt.current,
        });

        // Play animal name sound first
        playAnimalName(selected);

        // Play success sound after 1 second (non-final levels)
        later(() => {
          if (level < MAX_LEVEL) {
            playClip(gameSuccessPlayer, gameSuccessSoundFile);
          }
        }, 1000);

        try {
          if (
            optionAnimRefs.current[selected.id] &&
            optionAnimRefs.current[selected.id].play
          ) {
            optionAnimRefs.current[selected.id].play();
          }
        } catch {}

        Animated.sequence([
          Animated.timing(feedbackAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(feedbackAnim, {
            toValue: 0,
            duration: 1900,
            useNativeDriver: true,
          }),
        ]).start();

        setConfettiKey(prev => prev + 1);

        // Clearing the round is what triggers the next one to be dealt.
        later(() => {
          updateGuess(prev => {
            if (prev.level < MAX_LEVEL) {
              return { level: prev.level + 1, targetId: null, optionIds: [] };
            }
            track(EVENTS.GAME_COMPLETED, { game: 'guess', level: prev.level });
            return { showComplete: true };
          });
        }, 2500);
      } else {
        // A wrong pick is a normal part of learning, so nothing ends here.
        // The child gets a gentle noise, the sound again to compare against,
        // and after a few tries the right answer starts to glow.
        errorFeedback();
        setShowWrongOverlay(true);
        later(() => setShowWrongOverlay(false), 900);
        try {
          const wrongAnim = optionAnimRefs.current[selected.id];
          if (wrongAnim && wrongAnim.reset) wrongAnim.reset();
        } catch {}
        playClip(wrongPlayer, wrongSoundFile);
        later(() => playPrompt(), 700);
        updateGuess(prev => ({ wrongCount: prev.wrongCount + 1 }));
      }
    },
    [
      targetAnimal,
      level,
      feedbackAnim,
      wrongSoundFile,
      showComplete,
      wrongPlayer,
      gameSuccessPlayer,
      gameSuccessSoundFile,
      playAnimalName,
      isCorrect,
      later,
      updateGuess,
      markAnimalMet,
      playPrompt,
    ]
  );

  const onReset = useCallback(() => {
    track(EVENTS.GAME_RESET, { game: 'guess', level });
    setIsCorrect(false);
    setShowWrongOverlay(false);
    // Clearing progress empties the round, which re-deals via the effect above.
    resetGuess();
  }, [resetGuess, level]);

  const handleReset = useCallback(() => {
    tapFeedback();
    onReset();
  }, [onReset]);

  const handleBackToMenu = useCallback(() => {
    tapFeedback();
    if (!showComplete) {
      track(EVENTS.GAME_ABANDONED, { game: 'guess', level, wrongCount });
    }
    onBackToMenu();
  }, [onBackToMenu, showComplete, level, wrongCount]);

  const handlePlayPrompt = useCallback(() => {
    tapFeedback();
    playPrompt();
  }, [playPrompt]);

  if (!fontsLoaded) return null;
  const promptScale = promptPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

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
          <Text
            style={[styles.levelText, { fontFamily: 'Bangers_400Regular' }]}
            accessibilityRole="header"
            accessibilityLabel={t(currentLanguage, 'a11yLevelStatus', {
              level,
              max: MAX_LEVEL,
            })}
          >
            {t(currentLanguage, 'level')} {level}/{MAX_LEVEL}
          </Text>
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

        {/* Prompt */}
        <View style={styles.promptContainer}>
          <Animated.View style={{ transform: [{ scale: promptScale }] }}>
            <TouchableOpacity
              onPress={handlePlayPrompt}
              style={styles.promptButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yPlaySound')}
            >
              <Text
                style={[
                  styles.promptText,
                  { fontFamily: 'Bangers_400Regular' },
                ]}
              >
                {t(currentLanguage, 'playSound')}
              </Text>
            </TouchableOpacity>
          </Animated.View>
          {!!targetAnimal && (
            <Text style={styles.helperText}>
              {t(currentLanguage, 'whichAnimal')}
            </Text>
          )}
        </View>

        {/* Options grid */}
        <View style={styles.optionsContainer}>
          {options.map(opt => {
            const isHinted =
              wrongCount >= HINT_AFTER_TRIES &&
              targetAnimal &&
              opt.id === targetAnimal.id;

            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.optionCard,
                  { width: optionSize },
                  isHinted && styles.optionCardHinted,
                ]}
                onPress={() => onSelect(opt)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t(currentLanguage, 'a11yAnswerOption', {
                  animal:
                    currentLanguage === 'en' ? opt.name : opt.spanish_name,
                })}
              >
                <View style={styles.optionInner}>
                  <View style={styles.animationBackground} />
                  <LottieView
                    autoPlay={false}
                    loop={false}
                    ref={el => (optionAnimRefs.current[opt.id] = el)}
                    resizeMode="contain"
                    source={opt.animation_path}
                    style={styles.animation}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Correct feedback + confetti */}
      {isCorrect && (
        <Animated.View
          pointerEvents="none"
          style={[styles.feedbackOverlay, { opacity: feedbackAnim }]}
        >
          <Text
            style={[styles.feedbackText, { fontFamily: 'Bangers_400Regular' }]}
          >
            ✅
          </Text>
          <ConfettiCannon
            key={`confetti-${confettiKey}`}
            count={80}
            fadeOut={true}
            explosionSpeed={350}
            fallSpeed={3000}
            origin={{ x: 0, y: 0 }}
          />
        </Animated.View>
      )}

      {/* Encouragement, not a failure mark */}
      {showWrongOverlay && (
        <View pointerEvents="none" style={styles.feedbackOverlay}>
          <Text
            style={[styles.tryAgainText, { fontFamily: 'Bangers_400Regular' }]}
          >
            {t(currentLanguage, 'tryOnceMore')}
          </Text>
        </View>
      )}

      {/* Completion overlay */}
      {showComplete && (
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
            {t(currentLanguage, 'finishedAllLevels')}
          </Text>
          <ConfettiCannon
            key={`final-${confettiKey}-final`}
            count={200}
            fadeOut={true}
            explosionSpeed={300}
            fallSpeed={3500}
            origin={{ x: 0, y: 0 }}
          />
          <View style={styles.completionActions}>
            <Animated.View style={{ transform: [{ scale: promptScale }] }}>
              <TouchableOpacity
                onPress={handleReset}
                style={styles.bigButton}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t(currentLanguage, 'a11yResetButton')}
              >
                <Text style={styles.bigButtonText}>
                  {t(currentLanguage, 'restart')}
                </Text>
              </TouchableOpacity>
            </Animated.View>
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
  levelText: {
    color: 'white',
    fontSize: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 3 },
    paddingBottom: 34,
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 34,
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
  promptContainer: {
    paddingTop: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  promptButton: {
    backgroundColor: '#FFD700',
    borderRadius: 30,
    minHeight: LARGE_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  promptText: {
    fontSize: 24,
    color: '#0A3D62',
    letterSpacing: 1,
  },
  helperText: {
    marginTop: 6,
    color: 'white',
    fontSize: 20,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  optionsContainer: {
    flexGrow: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    alignContent: 'space-around',
    paddingTop: 6,
    paddingHorizontal: GRID_PADDING_H,
  },
  optionCard: {
    height: 130,
    marginTop: 20,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  optionInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  animationBackground: {
    backgroundColor: '#ffffff',
    height: 100,
    width: '100%',
    borderRadius: 18,
    zIndex: 1,
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  animation: {
    zIndex: 2,
    width: 100,
    height: 100,
  },
  feedbackOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackText: {
    fontSize: 80,
    color: 'white',
    paddingBottom: 34,
  },
  tryAgainText: {
    fontSize: 46,
    color: '#FFD700',
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 4 },
  },
  // Shown only after several tries, so it reads as help rather than a answer key.
  optionCardHinted: {
    borderWidth: 4,
    borderColor: '#FFD700',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.22)',
  },
  wrongText: {
    fontSize: 120,
    color: '#FF5252',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 4 },
    paddingBottom: 34,
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
  },
  completionSubtitle: {
    marginTop: 8,
    fontSize: 20,
    color: '#FFD700',
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
