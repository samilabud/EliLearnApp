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
import { CARD_SHADOW, FONTS, PALETTE, RADIUS } from '../../constants/theme';
import { useGameProgress } from '../../contexts/game-progress.context';
import { useSettings } from '../../contexts/settings.context';
import {
  getAnimalOptionCount,
  getHintAfterTries,
} from '../../constants/difficulty';
import { useBackToMenu } from '../../utils/navigation';
import { playClip, stopClip, playVoice } from '../../utils/sound';
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

// Smallest card a child can reliably hit and still recognise the animal in;
// FitGrid scrolls rather than shrinking below it.
// Smallest card a child can reliably hit and still recognise the animal in;
// FitGrid scrolls rather than shrinking below it.
const MIN_OPTION_SIZE = 96;
// Phone-size ceiling, grown by the device scale on tablets.
const MAX_OPTION_SIZE = 200;

const MAX_LEVEL = 8;

// How soon the right answer glows after wrong tries is age-based - see
// getHintAfterTries in constants/difficulty.js. The game never ends on a
// mistake; it just gets more helpful.

// Short settle time before the very first sound of a screen visit plays, so
// it doesn't fire while the screen transition is still animating in.
const FIRST_ROUND_DELAY_MS = 600;

/**
 * The reverse of "Find the Animal": the mystery here is the sound, not the
 * name. The animal noise plays first (language-independent - a bark is a
 * bark in either language), and a correct pick is rewarded with the
 * animal's spoken name, which does depend on the current language.
 */
export default function WhoseSoundGame({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
  onNextGame,
}) {
  // Card sizes come from the space FitGrid is actually given, so the grid
  // fills a phone, a landscape phone and an iPad alike.
  const { scale, touchTarget } = useResponsive();
  const { wiggle, triggerFor } = useWiggles();
  // Level, the current round and lives are saved progress and live in the
  // context, so they survive a trip to the menu, a rotation, or the app being
  // killed. Only state meaningless outside the current round stays local.
  const {
    whoseSound,
    updateWhoseSound,
    resetWhoseSound,
    markAnimalMet,
    markLevelStarred,
  } = useGameProgress();
  const { level, wrongCount, showComplete } = whoseSound;

  const [isCorrect, setIsCorrect] = useState(false);
  // The first round's audio waits for the spoken instruction to finish so
  // the two never overlap. Later rounds find this already true.
  const [instructionDone, setInstructionDone] = useState(false);
  const { replay: replayInstruction, stop: stopInstruction } =
    useInstructionPrompt('whoseSound', currentLanguage, {
      onFinished: () => setInstructionDone(true),
    });
  const promptPlayer = useAudioPlayer(null);
  const [feedbackAnim] = useState(new Animated.Value(0));
  const [promptPulse] = useState(new Animated.Value(0));
  const [showWrongOverlay, setShowWrongOverlay] = useState(false);
  const wrongPlayer = useAudioPlayer(null);
  const gameWinPlayer = useAudioPlayer(null);
  const gameSuccessPlayer = useAudioPlayer(null);
  const rewardSfxPlayer = useAudioPlayer(null);
  const [confettiKey, setConfettiKey] = useState(0);

  const optionAnimRefs = useRef({});
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

  // The saved round stores animal ids only. Artwork and audio are re-attached
  // here rather than persisted, because Metro module ids shift between builds
  // and would otherwise restore a round pointing at the wrong animal.
  const targetAnimal = useMemo(
    () => animalsById[whoseSound.targetId] || null,
    [animalsById, whoseSound.targetId]
  );
  const options = useMemo(
    () => whoseSound.optionIds.map(id => animalsById[id]).filter(Boolean),
    [animalsById, whoseSound.optionIds]
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
    track(whoseSound.targetId ? EVENTS.GAME_RESUMED : EVENTS.GAME_STARTED, {
      game: 'whoseSound',
      level,
    });
    // Fires once per visit to the game, not once per round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The age band sets how many choices a level shows and how soon the right
  // answer starts to glow (see constants/difficulty.js).
  const { childAgeBand } = useSettings();
  const hintAfterTries = getHintAfterTries(childAgeBand);
  const optionsCount = useMemo(
    () => getAnimalOptionCount(childAgeBand, level),
    [childAgeBand, level]
  );

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
        rewardSfxPlayer.remove();
      } catch {}
    };
  }, [
    stopAndUnload,
    promptPlayer,
    wrongPlayer,
    gameWinPlayer,
    gameSuccessPlayer,
    rewardSfxPlayer,
  ]);

  // Continuous bubble effect on the Play Sound button
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
    // Every animal gets a turn as the target before any repeats, so a
    // child never gets asked about the same one twice in one match while
    // others go untouched. Falls back to the full list once everything
    // has had a turn, rather than running out of animals mid-match.
    const unused = animalList.filter(
      a => !whoseSound.usedTargetIds.includes(a.id)
    );
    const targetPool = unused.length > 0 ? unused : animalList;
    const nextTarget = shuffle(targetPool)[0];
    const distractors = shuffle(
      animalList.filter(a => a.id !== nextTarget.id)
    ).slice(0, optionsCount - 1);
    const nextOptions = shuffle([nextTarget, ...distractors]);
    updateWhoseSound(prev => ({
      targetId: nextTarget.id,
      optionIds: nextOptions.map(a => a.id),
      usedTargetIds: [...prev.usedTargetIds, nextTarget.id],
    }));
    setIsCorrect(false);
    setShowWrongOverlay(false);
    roundStartedAt.current = Date.now();
  }, [optionsCount, shuffle, updateWhoseSound, whoseSound.usedTargetIds]);

  // A round is dealt only when the saved one does not fit the current level,
  // which covers a first run, a level change and a reset. A saved round that
  // does fit is restored untouched, so returning from the menu or rotating the
  // device resumes the same question rather than silently replacing it.
  useEffect(() => {
    if (whoseSound.optionIds.length !== optionsCount) {
      pickRound();
    }
  }, [whoseSound.optionIds.length, optionsCount, pickRound]);

  // The mystery sound itself - language-independent, unlike the reward below.
  const playPrompt = useCallback(async () => {
    if (!targetAnimal) return;
    await stopAndUnload();
    playClip(promptPlayer, targetAnimal.sound);
  }, [targetAnimal, stopAndUnload, promptPlayer]);

  // The very first sound of a screen visit gets a brief settle delay so it
  // doesn't fire mid-transition; every later round or language toggle plays
  // immediately.
  const hasPlayedFirstRef = useRef(false);

  useEffect(() => {
    if (!targetAnimal || !instructionDone) return;
    if (!hasPlayedFirstRef.current) {
      hasPlayedFirstRef.current = true;
      later(() => playPrompt(), FIRST_ROUND_DELAY_MS);
    } else {
      playPrompt();
    }
  }, [targetAnimal, instructionDone, playPrompt, later]);

  const onSelect = useCallback(
    async selected => {
      if (showComplete || isCorrect) return;
      stopInstruction();
      const correct = selected.id === targetAnimal.id;
      if (correct) {
        successFeedback();
        setIsCorrect(true);
        updateWhoseSound({ wrongCount: 0 });
        markAnimalMet(selected.id, 'whoseSound');
        markLevelStarred('whoseSound', level);
        track(EVENTS.LEVEL_COMPLETED, {
          game: 'whoseSound',
          level,
          duration_ms: Date.now() - roundStartedAt.current,
        });

        // The reward is the animal's spoken name - the flip of "Find the
        // Animal", which rewards a correct pick with the animal's own sound.
        playVoice(
          rewardSfxPlayer,
          currentLanguage === 'en' ? selected.voice : selected.spanish_voice
        );

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
          updateWhoseSound(prev => {
            if (prev.level < MAX_LEVEL) {
              return { level: prev.level + 1, targetId: null, optionIds: [] };
            }
            track(EVENTS.GAME_COMPLETED, {
              game: 'whoseSound',
              level: prev.level,
            });
            return { showComplete: true };
          });
        }, 2500);
      } else {
        // A wrong pick is a normal part of learning, so nothing ends here.
        // The child gets a gentle noise, the sound again to compare against,
        // and after a few tries the right answer starts to glow.
        errorFeedback();
        wiggle(selected.id);
        setShowWrongOverlay(true);
        later(() => setShowWrongOverlay(false), 900);
        try {
          const wrongAnim = optionAnimRefs.current[selected.id];
          if (wrongAnim && wrongAnim.reset) wrongAnim.reset();
        } catch {}
        playClip(wrongPlayer, wrongSoundFile);
        later(() => playPrompt(), 700);
        updateWhoseSound(prev => ({ wrongCount: prev.wrongCount + 1 }));
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
      rewardSfxPlayer,
      currentLanguage,
      isCorrect,
      later,
      updateWhoseSound,
      markAnimalMet,
      markLevelStarred,
      playPrompt,
      stopInstruction,
      wiggle,
    ]
  );

  const onReset = useCallback(() => {
    track(EVENTS.GAME_RESET, { game: 'whoseSound', level });
    setIsCorrect(false);
    setShowWrongOverlay(false);
    // Clearing progress empties the round, which re-deals via the effect above.
    resetWhoseSound();
  }, [resetWhoseSound, level]);

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
      resetWhoseSound();
    } else {
      track(EVENTS.GAME_ABANDONED, { game: 'whoseSound', level, wrongCount });
    }
    onBackToMenu();
  }, [onBackToMenu, showComplete, level, wrongCount, resetWhoseSound]);

  useBackToMenu(handleBackToMenu);

  const handleNextGame = useCallback(() => {
    tapFeedback();
    if (showComplete) {
      resetWhoseSound();
    } else {
      track(EVENTS.GAME_ABANDONED, { game: 'whoseSound', level, wrongCount });
    }
    onNextGame();
  }, [onNextGame, showComplete, level, wrongCount, resetWhoseSound]);

  const handlePlayPrompt = useCallback(() => {
    tapFeedback();
    playPrompt();
  }, [playPrompt]);

  const promptScale = promptPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const prompt = (
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
        accessibilityLabel={t(currentLanguage, 'a11yPlaySound')}
      >
        {/* Fill lives on a sibling, not the animated view - see AnswerCard. */}
        <View style={styles.promptButtonBackground} />
        <MaterialIcons name="volume-up" size={32 * scale} color={PALETTE.ink} />
        <Text
          style={[
            styles.promptText,
            { fontSize: 26 * scale, lineHeight: 34 * scale },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {t(currentLanguage, 'playSound')}
        </Text>
      </BouncyButton>
    </Animated.View>
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
      instruction={
        targetAnimal ? t(currentLanguage, 'whoseSoundHelperText') : null
      }
      onReplayInstruction={replayInstruction}
      prompt={prompt}
      promptPaneRatio={0.32}
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
        items={options}
        keyExtractor={opt => opt.id}
        minSize={MIN_OPTION_SIZE}
        maxSize={MAX_OPTION_SIZE * scale}
        renderItem={(opt, size) => (
          <AnswerCard
            category="listen"
            hinted={
              wrongCount >= hintAfterTries &&
              !!targetAnimal &&
              opt.id === targetAnimal.id
            }
            wiggleTrigger={triggerFor(opt.id)}
            onPress={() => onSelect(opt)}
            accessibilityLabel={t(currentLanguage, 'a11yWhoseSoundOption', {
              animal: currentLanguage === 'en' ? opt.name : opt.spanish_name,
            })}
          >
            <LottieView
              autoPlay={false}
              loop={false}
              ref={el => (optionAnimRefs.current[opt.id] = el)}
              resizeMode="contain"
              source={opt.animation_path}
              style={[
                { width: size * 0.8, height: size * 0.8 },
                iconScaleStyle(opt),
              ]}
            />
          </AnswerCard>
        )}
      />
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  promptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
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
});
