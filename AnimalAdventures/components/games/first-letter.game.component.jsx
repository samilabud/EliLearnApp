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
import { useBackToMenu } from '../../utils/navigation';
import { playClip, stopClip } from '../../utils/sound';
import { EVENTS, track } from '../../utils/analytics';
import {
  tapFeedback,
  successFeedback,
  errorFeedback,
} from '../../utils/haptics';
import { BouncyButton } from '../utility/bouncy-button.component';

const MAX_LEVEL = 6;

// Levels at or below this teach vowels in isolation: both the animal shown
// and the two wrong letters come only from {A, E, I, O, U}. Levels above it
// draw from the whole alphabet, consonants included.
const VOWEL_LEVELS = 2;

const VOWELS = ['A', 'E', 'I', 'O', 'U'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// After this many wrong taps the right letter starts to glow. Children aged
// three to six learn by trying the wrong thing, so the game never ends on a
// mistake - it just gets more helpful. Matches Guess the Animal's threshold.
const HINT_AFTER_TRIES = 3;

const OPTION_GAP = 20;
const MIN_OPTION_SIZE = 96;
const MAX_OPTION_SIZE = 140;

const stripAccents = str => str.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * The letter a child should answer with, in the language currently shown.
 * Accents are stripped first so "Águila" counts as starting with A, the
 * same vowel a child hears regardless of the written accent mark.
 */
const firstLetterOf = (animal, lang) => {
  const name = lang === 'en' ? animal.name : animal.spanish_name;
  return stripAccents(name).trim().charAt(0).toUpperCase();
};

const isVowel = letter => VOWELS.includes(letter);

export default function FirstLetterGame({
  currentLanguage,
  onBackToMenu,
  ambientEnabled,
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const optionSize = Math.min(
    MAX_OPTION_SIZE,
    Math.max(MIN_OPTION_SIZE, Math.floor((windowWidth - OPTION_GAP * 4) / 3))
  );
  const [fontsLoaded] = useFonts({ Bangers_400Regular });
  // Level and the current round are saved progress and live in the context,
  // so they survive a trip to the menu, a rotation, or the app being killed.
  // Only state meaningless outside the current round stays local.
  const { letter, updateLetter, resetLetter, markAnimalMet } =
    useGameProgress();
  const { level, wrongCount, showComplete } = letter;

  const [isCorrect, setIsCorrect] = useState(false);
  const promptPlayer = useAudioPlayer(null);
  const [feedbackAnim] = useState(new Animated.Value(0));
  const [promptPulse] = useState(new Animated.Value(0));
  const [showWrongOverlay, setShowWrongOverlay] = useState(false);
  const wrongPlayer = useAudioPlayer(null);
  const gameWinPlayer = useAudioPlayer(null);
  const gameSuccessPlayer = useAudioPlayer(null);
  const [confettiKey, setConfettiKey] = useState(0);

  const backgroundImage = require('../../assets/backgrounds/pawel-czerwinski-4gWNAWeOvP0-unsplash.jpg');

  const targetAnimRef = useRef(null);
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

  // Animals whose name starts with a vowel in the language currently shown.
  // Recomputed on language toggle, since "Owl" and "Buho" do not agree.
  const vowelAnimals = useMemo(
    () =>
      animalList.filter(animal =>
        isVowel(firstLetterOf(animal, currentLanguage))
      ),
    [currentLanguage]
  );

  // The saved round stores the animal id only. Artwork and audio are
  // re-attached here rather than persisted, because Metro module ids shift
  // between builds and would otherwise restore a round pointing at the wrong
  // animal.
  const targetAnimal = useMemo(
    () => animalsById[letter.targetId] || null,
    [animalsById, letter.targetId]
  );
  const correctLetter = useMemo(
    () => (targetAnimal ? firstLetterOf(targetAnimal, currentLanguage) : null),
    [targetAnimal, currentLanguage]
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
    track(letter.targetId ? EVENTS.GAME_RESUMED : EVENTS.GAME_STARTED, {
      game: 'letter',
      level,
    });
    // Fires once per visit to the game, not once per round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    };
  }, [
    stopAndUnload,
    promptPlayer,
    wrongPlayer,
    gameWinPlayer,
    gameSuccessPlayer,
  ]);

  // Continuous bubble effect on the Play button, matching the other games.
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
    const isVowelLevel = level <= VOWEL_LEVELS;
    const pool =
      isVowelLevel && vowelAnimals.length > 0 ? vowelAnimals : animalList;
    const nextTarget = pool[Math.floor(Math.random() * pool.length)];
    const correct = firstLetterOf(nextTarget, currentLanguage);
    const distractorAlphabet = isVowelLevel ? VOWELS : ALPHABET;
    const distractors = shuffle(
      distractorAlphabet.filter(letterOption => letterOption !== correct)
    ).slice(0, 2);
    updateLetter({
      targetId: nextTarget.id,
      optionLetters: shuffle([correct, ...distractors]),
      wrongCount: 0,
    });
    setIsCorrect(false);
    setShowWrongOverlay(false);
    roundStartedAt.current = Date.now();
  }, [level, vowelAnimals, currentLanguage, shuffle, updateLetter]);

  // A round is dealt only when the saved one is missing, which covers a
  // first run, a level change and a reset. A saved round that already has
  // its three letters is restored untouched, so returning from the menu or
  // rotating the device resumes the same question rather than silently
  // replacing it.
  useEffect(() => {
    if (letter.optionLetters.length !== 3) {
      pickRound();
    }
  }, [letter.optionLetters.length, pickRound]);

  // Toggling the language can change which letter is correct for the
  // animal already on screen (e.g. "Owl" -> "Buho"). When the saved letters
  // no longer include the right answer, deal a fresh round rather than show
  // a question with no correct option.
  useEffect(() => {
    if (!targetAnimal) return;
    if (!letter.optionLetters.includes(correctLetter)) {
      pickRound();
    }
  }, [targetAnimal, correctLetter, letter.optionLetters, pickRound]);

  const playPrompt = useCallback(async () => {
    if (!targetAnimal) return;
    await stopAndUnload();
    const voice =
      currentLanguage === 'en'
        ? targetAnimal.voice
        : targetAnimal.spanish_voice;
    playClip(promptPlayer, voice);
  }, [targetAnimal, currentLanguage, stopAndUnload, promptPlayer]);

  useEffect(() => {
    if (targetAnimal) {
      playPrompt();
    }
  }, [targetAnimal, currentLanguage, playPrompt]);

  const onSelect = useCallback(
    async selectedLetter => {
      if (showComplete || isCorrect || !targetAnimal) return;
      const correct = selectedLetter === correctLetter;
      if (correct) {
        successFeedback();
        setIsCorrect(true);
        updateLetter({ wrongCount: 0 });
        markAnimalMet(targetAnimal.id);
        track(EVENTS.LEVEL_COMPLETED, {
          game: 'letter',
          level,
          duration_ms: Date.now() - roundStartedAt.current,
        });

        later(() => {
          if (level < MAX_LEVEL) {
            playClip(gameSuccessPlayer, gameSuccessSoundFile);
          }
        }, 1000);

        try {
          if (targetAnimRef.current && targetAnimRef.current.play) {
            targetAnimRef.current.play();
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
          updateLetter(prev => {
            if (prev.level < MAX_LEVEL) {
              return {
                level: prev.level + 1,
                targetId: null,
                optionLetters: [],
              };
            }
            track(EVENTS.GAME_COMPLETED, { game: 'letter', level: prev.level });
            return { showComplete: true };
          });
        }, 2500);
      } else {
        // A wrong pick is a normal part of learning, so nothing ends here.
        // The child gets a gentle noise, the name again to compare against,
        // and after a few tries the right letter starts to glow.
        errorFeedback();
        setShowWrongOverlay(true);
        later(() => setShowWrongOverlay(false), 900);
        playClip(wrongPlayer, wrongSoundFile);
        later(() => playPrompt(), 700);
        updateLetter(prev => ({ wrongCount: prev.wrongCount + 1 }));
      }
    },
    [
      targetAnimal,
      correctLetter,
      level,
      feedbackAnim,
      wrongSoundFile,
      showComplete,
      wrongPlayer,
      gameSuccessPlayer,
      gameSuccessSoundFile,
      isCorrect,
      later,
      updateLetter,
      markAnimalMet,
      playPrompt,
    ]
  );

  const onReset = useCallback(() => {
    track(EVENTS.GAME_RESET, { game: 'letter', level });
    setIsCorrect(false);
    setShowWrongOverlay(false);
    // Clearing progress empties the round, which re-deals via the effect above.
    resetLetter();
  }, [resetLetter, level]);

  const handleReset = useCallback(() => {
    tapFeedback();
    onReset();
  }, [onReset]);

  const handleBackToMenu = useCallback(() => {
    tapFeedback();
    if (!showComplete) {
      track(EVENTS.GAME_ABANDONED, { game: 'letter', level, wrongCount });
    }
    onBackToMenu();
  }, [onBackToMenu, showComplete, level, wrongCount]);

  useBackToMenu(handleBackToMenu);

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
      {ambientEnabled && <AmbientBackground />}

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
            <BouncyButton
              onPress={handleReset}
              style={styles.actionButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yResetButton')}
            >
              <Text style={styles.actionText}>
                {t(currentLanguage, 'reset')}
              </Text>
            </BouncyButton>
            <BouncyButton
              onPress={handleBackToMenu}
              style={styles.actionButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yMainMenuButton')}
            >
              <Text style={styles.actionText}>
                {t(currentLanguage, 'mainMenu')}
              </Text>
            </BouncyButton>
          </View>
        </View>

        {/* The animal, shown and named */}
        <View style={styles.animalContainer}>
          <View style={styles.animalCard}>
            {!!targetAnimal && (
              <LottieView
                autoPlay={false}
                loop={false}
                ref={el => (targetAnimRef.current = el)}
                resizeMode="contain"
                source={targetAnimal.animation_path}
                style={styles.animalAnimation}
              />
            )}
          </View>
          <Animated.View style={{ transform: [{ scale: promptScale }] }}>
            <BouncyButton
              onPress={handlePlayPrompt}
              style={styles.promptButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yPlayName')}
            >
              <Text
                style={[
                  styles.promptText,
                  { fontFamily: 'Bangers_400Regular' },
                ]}
              >
                {t(currentLanguage, 'playName')}
              </Text>
            </BouncyButton>
          </Animated.View>
          {!!targetAnimal && (
            <Text style={styles.helperText}>
              {t(currentLanguage, 'whichLetter')}
            </Text>
          )}
        </View>

        {/* Letter options */}
        <View style={styles.optionsContainer}>
          {letter.optionLetters.map(letterOption => {
            const isHinted =
              wrongCount >= HINT_AFTER_TRIES &&
              targetAnimal &&
              letterOption === correctLetter;

            return (
              <BouncyButton
                key={letterOption}
                style={[
                  styles.letterCard,
                  { width: optionSize, height: optionSize },
                ]}
                onPress={() => onSelect(letterOption)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t(currentLanguage, 'a11yLetterOption', {
                  letter: letterOption,
                })}
              >
                {/* A rounded View with a background clips its children on
                    Android regardless of `overflow`, which was cropping the
                    big letter. Keeping the rounded card as an absolutely
                    positioned sibling behind the Text (same trick as the
                    animal option cards in guess-animal) avoids that. */}
                <View
                  style={[
                    styles.letterCardBackground,
                    isHinted && styles.letterCardHinted,
                  ]}
                />
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.letterText,
                    { fontFamily: 'Bangers_400Regular' },
                  ]}
                >
                  {letterOption}
                </Text>
              </BouncyButton>
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
              <BouncyButton
                onPress={handleReset}
                style={styles.bigButton}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t(currentLanguage, 'a11yResetButton')}
              >
                <Text style={styles.bigButtonText}>
                  {t(currentLanguage, 'restart')}
                </Text>
              </BouncyButton>
            </Animated.View>
            <BouncyButton
              onPress={handleBackToMenu}
              style={styles.secondaryButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yMainMenuButton')}
            >
              <Text style={styles.secondaryButtonText}>
                {t(currentLanguage, 'mainMenuFull')}
              </Text>
            </BouncyButton>
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
    // Bangers clips on Android without both of these - see letterText below.
    lineHeight: 30,
    includeFontPadding: false,
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
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  animalContainer: {
    paddingTop: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  animalCard: {
    width: 170,
    height: 170,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  animalAnimation: {
    width: 150,
    height: 150,
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
    lineHeight: 32,
    includeFontPadding: false,
    color: '#0A3D62',
    letterSpacing: 1,
  },
  helperText: {
    marginTop: 14,
    color: 'white',
    fontSize: 20,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  optionsContainer: {
    flexGrow: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: OPTION_GAP,
    paddingTop: 28,
    paddingHorizontal: 16,
  },
  letterCard: {
    // Plain on purpose: the rounded, filled look lives in
    // letterCardBackground instead, so this container never combines
    // borderRadius + backgroundColor with the Text as a child - see the
    // comment at its usage above for why.
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterCardBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  letterText: {
    fontSize: 56,
    // Bangers clips on Android without both of these - see
    // guess-animal.game.component.jsx's promptText for the full
    // explanation. Safe to rely on here now that the Text is no longer a
    // child of the rounded, filled card.
    lineHeight: 72,
    includeFontPadding: false,
    color: '#0A3D62',
    textAlign: 'center',
  },
  // Shown only after several tries, so it reads as help rather than an
  // answer key.
  letterCardHinted: {
    borderWidth: 4,
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.22)',
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
    lineHeight: 58,
    includeFontPadding: false,
    color: '#FFD700',
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 4 },
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
    lineHeight: 60,
    includeFontPadding: false,
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
