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
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import { AmbientBackground } from '../utility/ambient-background.component';
import { animalList, iconScaleStyle } from '../animals/animal.list';
import ConfettiCannon from 'react-native-confetti-cannon';
import { t, LARGE_TOUCH_TARGET } from '../../constants';
import { useGameProgress } from '../../contexts/game-progress.context';
import { useSettings } from '../../contexts/settings.context';
import {
  getHintAfterTries,
  getLetterDifficulty,
} from '../../constants/difficulty';
import { useBackToMenu } from '../../utils/navigation';
import { playClip, stopClip } from '../../utils/sound';
import { firstLetterOf, lastLetterOf } from '../../utils/helpers';
import { getLetterSound } from '../../utils/letter-sounds';
import { EVENTS, track } from '../../utils/analytics';
import {
  tapFeedback,
  successFeedback,
  errorFeedback,
} from '../../utils/haptics';
import { BouncyButton } from '../utility/bouncy-button.component';
import { LanguageToggleButton } from '../utility/language-toggle-button.component';
import { NextGameButton } from '../utility/next-game-button.component';
import {
  BackToMenuButton,
  BACK_TO_MENU_CLEARANCE,
} from '../utility/back-to-menu-button.component';
import { ConfirmResetButton } from '../utility/confirm-reset-button.component';
import { InstructionText } from '../utility/instruction-text.component';
import { useInstructionPrompt } from '../../utils/use-instruction-prompt';

const MAX_LEVEL = 6;

// Levels teach vowels in isolation first: both the animal shown and the
// wrong letters come only from {A, E, I, O, U}. How many levels do that, and
// how many letter cards appear, depends on the child's age band - see
// getLetterDifficulty in constants/difficulty.js.
const VOWELS = ['A', 'E', 'I', 'O', 'U'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// This screen serves two games: "Guess the First Letter" and "Guess the Last
// Letter". They are the same game asked about opposite ends of the animal's
// name, so everything that differs lives in this table - which letter counts,
// which saved slice and reward key to use, and which text to show.
const POSITIONS = {
  first: {
    gameKey: 'letter',
    instructionKey: 'whichLetter',
    optionLabelKey: 'a11yLetterOption',
    letterOf: firstLetterOf,
  },
  last: {
    gameKey: 'lastLetter',
    instructionKey: 'whichLastLetter',
    optionLabelKey: 'a11yLastLetterOption',
    letterOf: lastLetterOf,
  },
};

// Wrong answers for the last-letter game. Names mostly end in a vowel (nearly
// all Spanish ones in A or O), so drawing wrong answers from the whole
// alphabet would make the right one obvious, and offering only A and O would
// make it a coin flip. Early levels draw from letters names commonly end in;
// from level 3 the whole alphabet is in play. In Spanish the "other" one of
// A/O is always offered, so the child has to listen for which it is.
const LAST_LETTER_EASY_POOL = {
  en: [...VOWELS, 'Y', 'N', 'S', 'T'],
  es: [...VOWELS, 'N', 'S'],
};
const LAST_LETTER_FULL_POOL_LEVEL = 3;

const lastLetterDistractors = (correct, lang, level, count, shuffle) => {
  const pool =
    level >= LAST_LETTER_FULL_POOL_LEVEL
      ? ALPHABET
      : LAST_LETTER_EASY_POOL[lang] || LAST_LETTER_EASY_POOL.en;
  const required =
    lang === 'es' && correct === 'A'
      ? ['O']
      : lang === 'es' && correct === 'O'
        ? ['A']
        : [];
  const rest = shuffle(
    pool.filter(l => l !== correct && !required.includes(l))
  );
  return [...required, ...rest].slice(0, count);
};

// How soon the right letter glows after wrong taps is age-based - see
// getHintAfterTries in constants/difficulty.js. The game never ends on a
// mistake; it just gets more helpful.

const OPTION_GAP = 20;
const MIN_OPTION_SIZE = 96;
const MAX_OPTION_SIZE = 140;

const isVowel = letter => VOWELS.includes(letter);

export default function FirstLetterGame({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
  onNextGame,
  ambientEnabled,
  position = 'first',
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isLast = position === 'last';
  const { gameKey, instructionKey, optionLabelKey, letterOf } =
    POSITIONS[isLast ? 'last' : 'first'];
  const [fontsLoaded] = useFonts({ Bangers_400Regular });
  // Level and the current round are saved progress and live in the context,
  // so they survive a trip to the menu, a rotation, or the app being killed.
  // Only state meaningless outside the current round stays local.
  const progress = useGameProgress();
  const { markAnimalMet, markLevelStarred } = progress;
  const letter = isLast ? progress.lastLetter : progress.letter;
  const updateLetter = isLast
    ? progress.updateLastLetter
    : progress.updateLetter;
  const resetLetter = isLast ? progress.resetLastLetter : progress.resetLetter;
  const { level, wrongCount, showComplete } = letter;
  const { childAgeBand } = useSettings();
  const hintAfterTries = getHintAfterTries(childAgeBand);
  const { optionCount, vowelLevels } = getLetterDifficulty(childAgeBand);
  // Cards share the row width; four cards sit in a 2x2 grid so they stay
  // large enough to tap on a small phone.
  const columns = optionCount >= 4 ? 2 : optionCount;
  const optionSize = Math.min(
    MAX_OPTION_SIZE,
    Math.max(
      MIN_OPTION_SIZE,
      Math.floor((windowWidth - OPTION_GAP * (columns + 1)) / columns)
    )
  );

  const [isCorrect, setIsCorrect] = useState(false);
  // The first round's audio waits for the spoken instruction to finish so
  // the two never overlap. Later rounds find this already true.
  const [instructionDone, setInstructionDone] = useState(false);
  const { replay: replayInstruction, stop: stopInstruction } =
    useInstructionPrompt(gameKey, currentLanguage, {
      onFinished: () => setInstructionDone(true),
    });
  const promptPlayer = useAudioPlayer(null);
  const [feedbackAnim] = useState(new Animated.Value(0));
  const [promptPulse] = useState(new Animated.Value(0));
  const [showWrongOverlay, setShowWrongOverlay] = useState(false);
  const wrongPlayer = useAudioPlayer(null);
  const gameWinPlayer = useAudioPlayer(null);
  const gameSuccessPlayer = useAudioPlayer(null);
  const letterNamePlayer = useAudioPlayer(null);
  const [confettiKey, setConfettiKey] = useState(0);

  const backgroundImage = require('../../assets/backgrounds/pawel-czerwinski-4gWNAWeOvP0-unsplash.jpg');

  const targetAnimRef = useRef(null);
  const wrongSoundFile = require('../../assets/sounds/background/animals/wrong-answer-bird-call.mp3');
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
    () => (targetAnimal ? letterOf(targetAnimal, currentLanguage) : null),
    [targetAnimal, currentLanguage, letterOf]
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
      game: gameKey,
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
      try {
        letterNamePlayer.remove();
      } catch {}
    };
  }, [
    stopAndUnload,
    promptPlayer,
    wrongPlayer,
    gameWinPlayer,
    gameSuccessPlayer,
    letterNamePlayer,
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
    // Under-4 keeps every level vowels-only (vowelLevels is Infinity), rather
    // than switching to consonants after the first few levels.
    // The last-letter game has no vowel-only phase: names mostly end in
    // vowels already, so it uses its own wrong-answer pool instead.
    const isVowelLevel = !isLast && level <= vowelLevels;
    const basePool =
      isVowelLevel && vowelAnimals.length > 0 ? vowelAnimals : animalList;
    // Every eligible animal gets a turn as the target before any repeats,
    // so a child never gets asked about the same one twice in one match.
    // Falls back to the full base pool once everything in it has had a
    // turn, rather than running out of animals mid-match.
    const unused = basePool.filter(a => !letter.usedTargetIds.includes(a.id));
    const pool = unused.length > 0 ? unused : basePool;
    const nextTarget = pool[Math.floor(Math.random() * pool.length)];
    const correct = letterOf(nextTarget, currentLanguage);
    const distractorAlphabet = isVowelLevel ? VOWELS : ALPHABET;
    const distractors = isLast
      ? lastLetterDistractors(
          correct,
          currentLanguage,
          level,
          optionCount - 1,
          shuffle
        )
      : shuffle(
          distractorAlphabet.filter(letterOption => letterOption !== correct)
        ).slice(0, optionCount - 1);
    updateLetter(prev => ({
      targetId: nextTarget.id,
      optionLetters: shuffle([correct, ...distractors]),
      wrongCount: 0,
      usedTargetIds: [...prev.usedTargetIds, nextTarget.id],
    }));
    setIsCorrect(false);
    setShowWrongOverlay(false);
    roundStartedAt.current = Date.now();
  }, [
    isLast,
    letterOf,
    level,
    optionCount,
    vowelLevels,
    vowelAnimals,
    currentLanguage,
    shuffle,
    updateLetter,
    letter.usedTargetIds,
  ]);

  // A round is dealt only when the saved one is missing, which covers a
  // first run, a level change, a reset or a change of age band. A saved round
  // that already has the right number of letters is restored untouched, so returning from the menu or
  // rotating the device resumes the same question rather than silently
  // replacing it.
  useEffect(() => {
    if (letter.optionLetters.length !== optionCount) {
      pickRound();
    }
  }, [letter.optionLetters.length, optionCount, pickRound]);

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
    if (targetAnimal && instructionDone) {
      playPrompt();
    }
  }, [targetAnimal, currentLanguage, instructionDone, playPrompt]);

  const onSelect = useCallback(
    async selectedLetter => {
      if (showComplete || isCorrect || !targetAnimal) return;
      stopInstruction();
      const correct = selectedLetter === correctLetter;
      if (correct) {
        successFeedback();
        setIsCorrect(true);
        updateLetter({ wrongCount: 0 });
        markAnimalMet(targetAnimal.id, gameKey);
        markLevelStarred(gameKey, level);
        track(EVENTS.LEVEL_COMPLETED, {
          game: gameKey,
          level,
          duration_ms: Date.now() - roundStartedAt.current,
        });

        // Names the letter just picked (e.g. "P" -> "pee"), so the win
        // confirms what was learned, not just that the tap was right.
        // These clips are very short, so firing it alongside the checkmark
        // still leaves clear room before the success jingle below.
        const letterSound = getLetterSound(correctLetter, currentLanguage);
        if (letterSound) {
          playClip(letterNamePlayer, letterSound);
        }

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
            track(EVENTS.GAME_COMPLETED, { game: gameKey, level: prev.level });
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
      gameKey,
      targetAnimal,
      correctLetter,
      currentLanguage,
      level,
      feedbackAnim,
      wrongSoundFile,
      showComplete,
      wrongPlayer,
      gameSuccessPlayer,
      gameSuccessSoundFile,
      letterNamePlayer,
      isCorrect,
      later,
      updateLetter,
      markAnimalMet,
      markLevelStarred,
      playPrompt,
      stopInstruction,
    ]
  );

  const onReset = useCallback(() => {
    track(EVENTS.GAME_RESET, { game: gameKey, level });
    setIsCorrect(false);
    setShowWrongOverlay(false);
    // Clearing progress empties the round, which re-deals via the effect above.
    resetLetter();
  }, [resetLetter, level, gameKey]);

  const handleReset = useCallback(() => {
    tapFeedback();
    onReset();
  }, [onReset]);

  const handleBackToMenu = useCallback(() => {
    tapFeedback();
    if (showComplete) {
      // Finishing every level is worth celebrating in the moment, but it
      // should not be what a child finds waiting for them next time they
      // open this game - only an in-progress level is worth resuming.
      resetLetter();
    } else {
      track(EVENTS.GAME_ABANDONED, { game: gameKey, level, wrongCount });
    }
    onBackToMenu();
  }, [onBackToMenu, showComplete, level, wrongCount, resetLetter, gameKey]);

  useBackToMenu(handleBackToMenu);

  const handleNextGame = useCallback(() => {
    tapFeedback();
    if (showComplete) {
      resetLetter();
    } else {
      track(EVENTS.GAME_ABANDONED, { game: gameKey, level, wrongCount });
    }
    onNextGame();
  }, [onNextGame, showComplete, level, wrongCount, resetLetter, gameKey]);

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
          { paddingBottom: insets.bottom + BACK_TO_MENU_CLEARANCE },
        ]}
      >
        {/* Top controls */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <Text
            style={[styles.levelText, { fontFamily: 'Bangers_400Regular' }]}
            // See the same fix in trace-letter.game.component.jsx - Android's
            // default line-breaking has mismeasured this custom font often
            // enough to clip the tail of the string.
            textBreakStrategy="simple"
            // Shrink to fit rather than wrap: on some phones the 2nd line is clipped.
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            collapsable={false}
            accessibilityRole="header"
            accessibilityLabel={t(currentLanguage, 'a11yLevelStatus', {
              level,
              max: MAX_LEVEL,
            })}
          >
            {t(currentLanguage, 'level')} {level}/{MAX_LEVEL}
          </Text>
          <View style={styles.topActions}>
            <ConfirmResetButton
              currentLanguage={currentLanguage}
              onConfirm={onReset}
            />
            <NextGameButton
              currentLanguage={currentLanguage}
              onPress={handleNextGame}
            />
            <LanguageToggleButton
              currentLanguage={currentLanguage}
              onToggle={setCurrentLanguage}
            />
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
                style={[styles.animalAnimation, iconScaleStyle(targetAnimal)]}
              />
            )}
          </View>
          {!!targetAnimal && (
            <Text style={styles.animalNameText}>
              {currentLanguage === 'en'
                ? targetAnimal.name
                : targetAnimal.spanish_name}
            </Text>
          )}
          <Animated.View
            renderToHardwareTextureAndroid
            style={{ transform: [{ scale: promptScale }] }}
          >
            <BouncyButton
              onPress={handlePlayPrompt}
              style={[
                styles.promptButton,
                { width: Math.min(windowWidth - 32, 340) },
              ]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yPlayName')}
            >
              {/* A rounded View with a background clips its children on
                  Android regardless of `overflow`, cropping a 2nd line if
                  this ever wraps (long translations, e.g. "Escuchar el
                  Nombre"). Keeping the rounded fill as an absolutely
                  positioned sibling behind the Text avoids that - same
                  trick as the letter option cards below. */}
              <View style={styles.promptButtonBackground} />
              <Text
                style={[
                  styles.promptText,
                  { fontFamily: 'Bangers_400Regular' },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {t(currentLanguage, 'playName')}
              </Text>
            </BouncyButton>
          </Animated.View>
          {!!targetAnimal && (
            <InstructionText
              text={t(currentLanguage, instructionKey)}
              currentLanguage={currentLanguage}
              onReplay={replayInstruction}
              textStyle={styles.helperText}
            />
          )}
        </View>

        {/* Letter options */}
        <View style={styles.optionsContainer}>
          {letter.optionLetters.map(letterOption => {
            const isHinted =
              wrongCount >= hintAfterTries &&
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
                accessibilityLabel={t(currentLanguage, optionLabelKey, {
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
                <Text allowFontScaling={false} style={styles.letterText}>
                  {letterOption}
                </Text>
              </BouncyButton>
            );
          })}
        </View>
      </ScrollView>

      {!showComplete && (
        <BackToMenuButton
          currentLanguage={currentLanguage}
          onPress={handleBackToMenu}
        />
      )}

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
            <Animated.View
              renderToHardwareTextureAndroid
              style={{ transform: [{ scale: promptScale }] }}
            >
              <BouncyButton
                onPress={handleReset}
                style={styles.bigButton}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t(currentLanguage, 'a11yResetButton')}
              >
                <View style={styles.bigButtonBackground} />
                <MaterialIcons name="replay" size={20} color="#0A3D62" />
                <Text style={styles.bigButtonText}>
                  {t(currentLanguage, 'restart')}
                </Text>
              </BouncyButton>
            </Animated.View>
            <BouncyButton
              onPress={handleNextGame}
              style={styles.secondaryButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yNextGame')}
            >
              <View style={styles.secondaryButtonBackground} />
              <MaterialIcons name="skip-next" size={20} color="#0A3D62" />
              <Text style={styles.secondaryButtonText}>
                {t(currentLanguage, 'nextGame')}
              </Text>
            </BouncyButton>
            <BouncyButton
              onPress={handleBackToMenu}
              style={styles.secondaryButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yMainMenuButton')}
            >
              <View style={styles.secondaryButtonBackground} />
              <MaterialIcons name="home" size={20} color="#0A3D62" />
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
    // Without this, a crowded top bar (Reset + Next Game + Language) can
    // squeeze this text to where the level number gets cut off - letting it
    // shrink/wrap instead keeps the whole string visible.
    flex: 1,
    marginRight: 8,
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
    // Wider than the 10dp this used to be - three adjacent small controls
    // this close together risked a mis-tap between neighbors for a child
    // still developing fine motor precision.
    gap: 16,
    paddingBottom: 34,
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
    marginBottom: 10,
  },
  animalAnimation: {
    width: 150,
    height: 150,
  },
  // The written word next to the letter options, so a child connects the
  // animal, its name and the letter rather than guessing blind.
  animalNameText: {
    marginBottom: 10,
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  promptButton: {
    // Plain on purpose - the filled rounded look lives in
    // promptButtonBackground instead. See the comment at its usage above.
    justifyContent: 'center',
    minHeight: LARGE_TOUCH_TARGET,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  promptButtonBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFD700',
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  promptText: {
    fontSize: 24,
    lineHeight: 32,
    includeFontPadding: false,
    textAlign: 'center',
    color: '#0A3D62',
    letterSpacing: 1,
  },
  helperText: {
    fontSize: 20,
    lineHeight: 28,
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
    lineHeight: 72,
    includeFontPadding: false,
    // Deliberately the plain system font, not Bangers, and deliberately
    // not italic/decorative: a child learning to recognize a letter needs
    // the clean, standard letterform they will see in books, not the
    // rough comic-marker style Bangers draws for a bare capital O/E/I -
    // which reads as "broken" in isolation even though it renders fine.
    fontWeight: '800',
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
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  bigButton: {
    // Plain on purpose - see promptButton above for why the fill lives in
    // a separate absolutely positioned sibling instead of on this View.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  bigButtonBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFD700',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  secondaryButtonBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
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
