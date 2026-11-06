import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View, Animated, Easing } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { animalList, iconScaleStyle } from '../animals/animal.list';
import { t } from '../../constants';
import {
  CARD_SHADOW,
  CATEGORY_COLORS,
  FONTS,
  PALETTE,
  RADIUS,
} from '../../constants/theme';
import { useGameProgress } from '../../contexts/game-progress.context';
import { useSettings } from '../../contexts/settings.context';
import {
  getHintAfterTries,
  getLetterDifficulty,
} from '../../constants/difficulty';
import { useBackToMenu } from '../../utils/navigation';
import { playClip, stopClip, playVoice } from '../../utils/sound';
import { firstLetterOf, lastLetterOf } from '../../utils/helpers';
import { getLetterSound } from '../../utils/letter-sounds';
import { EVENTS, track } from '../../utils/analytics';
import {
  tapFeedback,
  successFeedback,
  errorFeedback,
} from '../../utils/haptics';
import { useResponsive } from '../../utils/use-responsive';
import { BouncyButton } from '../utility/bouncy-button.component';
import { GameScreen } from '../utility/game-screen.component';
import { FitGrid } from '../utility/fit-grid.component';
import { AnswerCard } from '../utility/answer-card.component';
import { useWiggles } from '../utility/wiggle.component';
import {
  CompletionOverlay,
  CorrectBurst,
  TryAgainBanner,
} from '../utility/feedback-overlays.component';
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

const MIN_OPTION_SIZE = 96;
// Phone-size ceilings, grown by the device scale on tablets.
const MAX_OPTION_SIZE = 180;
const MAX_ANIMAL_CARD = 180;

const isVowel = letter => VOWELS.includes(letter);

export default function FirstLetterGame({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
  onNextGame,
  position = 'first',
}) {
  const { height, isLandscape, scale, touchTarget } = useResponsive();
  const { wiggle, triggerFor } = useWiggles();
  const isLast = position === 'last';
  const { gameKey, instructionKey, optionLabelKey, letterOf } =
    POSITIONS[isLast ? 'last' : 'first'];
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
    playVoice(promptPlayer, voice);
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
          playVoice(letterNamePlayer, letterSound);
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
        wiggle(selectedLetter);
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
      wiggle,
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

  const promptScale = promptPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  // The animal card grows with the device but leaves room for the name and
  // the button under it: on a landscape phone the pane is short, on an iPad
  // it is large.
  const animalCardSize = Math.round(
    Math.min(
      MAX_ANIMAL_CARD * scale,
      isLandscape ? height * 0.3 : height * 0.22
    )
  );

  const prompt = (
    <View style={styles.promptColumn}>
      <View
        style={[
          styles.animalCard,
          { width: animalCardSize, height: animalCardSize },
        ]}
      >
        {!!targetAnimal && (
          <LottieView
            autoPlay={false}
            loop={false}
            ref={el => (targetAnimRef.current = el)}
            resizeMode="contain"
            source={targetAnimal.animation_path}
            style={[
              { width: animalCardSize * 0.88, height: animalCardSize * 0.88 },
              iconScaleStyle(targetAnimal),
            ]}
          />
        )}
      </View>
      {!!targetAnimal && (
        <Text style={[styles.animalNameText, { fontSize: 24 * scale }]}>
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
            { minHeight: touchTarget, paddingHorizontal: 24 * scale },
          ]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t(currentLanguage, 'a11yPlayName')}
        >
          {/* Fill lives on a sibling, not the animated view - see AnswerCard. */}
          <View style={styles.promptButtonBackground} />
          <MaterialIcons
            name="volume-up"
            size={30 * scale}
            color={PALETTE.ink}
          />
          <Text
            style={[
              styles.promptText,
              { fontSize: 24 * scale, lineHeight: 32 * scale },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {t(currentLanguage, 'playName')}
          </Text>
        </BouncyButton>
      </Animated.View>
    </View>
  );

  return (
    <GameScreen
      currentLanguage={currentLanguage}
      setCurrentLanguage={setCurrentLanguage}
      onHome={handleBackToMenu}
      onNextGame={handleNextGame}
      onReset={onReset}
      level={level}
      maxLevel={MAX_LEVEL}
      instruction={targetAnimal ? t(currentLanguage, instructionKey) : null}
      onReplayInstruction={replayInstruction}
      prompt={prompt}
      overlay={
        <>
          <CorrectBurst
            visible={isCorrect}
            opacity={feedbackAnim}
            confettiKey={confettiKey}
          />
          <TryAgainBanner
            visible={showWrongOverlay}
            currentLanguage={currentLanguage}
          />
          <CompletionOverlay
            visible={showComplete}
            currentLanguage={currentLanguage}
            confettiKey={confettiKey}
            onRestart={handleReset}
            onNextGame={handleNextGame}
            onHome={handleBackToMenu}
          />
        </>
      }
    >
      <FitGrid
        items={letter.optionLetters}
        keyExtractor={l => l}
        gap={20}
        minSize={MIN_OPTION_SIZE}
        maxSize={MAX_OPTION_SIZE * scale}
        renderItem={(letterOption, size) => (
          <AnswerCard
            category="letters"
            hinted={
              wrongCount >= hintAfterTries &&
              !!targetAnimal &&
              letterOption === correctLetter
            }
            wiggleTrigger={triggerFor(letterOption)}
            onPress={() => onSelect(letterOption)}
            accessibilityLabel={t(currentLanguage, optionLabelKey, {
              letter: letterOption,
            })}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.letterText,
                { fontSize: size * 0.5, lineHeight: size * 0.64 },
              ]}
            >
              {letterOption}
            </Text>
          </AnswerCard>
        )}
      />
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  promptColumn: {
    alignItems: 'center',
    gap: 10,
  },
  animalCard: {
    backgroundColor: PALETTE.white,
    borderRadius: RADIUS.md,
    borderWidth: 4,
    borderColor: CATEGORY_COLORS.letters.ring,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  animalNameText: {
    fontFamily: FONTS.bodyHeavy,
    color: PALETTE.ink,
    textAlign: 'center',
  },
  promptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  promptButtonBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: PALETTE.gold,
    borderRadius: RADIUS.pill,
    borderWidth: 4,
    borderColor: PALETTE.white,
    ...CARD_SHADOW,
  },
  promptText: {
    fontFamily: FONTS.title,
    includeFontPadding: false,
    textAlign: 'center',
    color: PALETTE.ink,
    letterSpacing: 1,
  },
  letterText: {
    includeFontPadding: false,
    // Deliberately the plain system font, not Bangers, and deliberately
    // not italic/decorative: a child learning to recognize a letter needs
    // the clean, standard letterform they will see in books, not the
    // rough comic-marker style Bangers draws for a bare capital O/E/I -
    // which reads as "broken" in isolation even though it renders fine.
    fontWeight: '800',
    color: PALETTE.ink,
    textAlign: 'center',
  },
});
