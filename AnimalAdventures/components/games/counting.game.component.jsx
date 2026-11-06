import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import { animalList, iconScaleStyle } from '../animals/animal.list';
import { t } from '../../constants';
import { CATEGORY_COLORS, PALETTE, RADIUS } from '../../constants/theme';
import { useGameProgress } from '../../contexts/game-progress.context';
import { useSettings } from '../../contexts/settings.context';
import {
  getCountingDifficulty,
  getHintAfterTries,
} from '../../constants/difficulty';
import { useBackToMenu } from '../../utils/navigation';
import { playClip, releasePlayer, playVoice } from '../../utils/sound';
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
import { getNumberSound } from '../../utils/number-sounds';

const MAX_LEVEL = 6;
// Phone-size ceilings, grown by the device scale on tablets. Below them,
// FitGrid sizes the animals and number cards from the space they get, so a
// lone animal is big and ten still fit.
const COUNT_ICON_MAX = 200;
const OPTION_CARD_MAX = 130;

export default function CountingGame({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
  onNextGame,
}) {
  const { isLandscape, scale, touchTarget } = useResponsive();
  const { wiggle, triggerFor } = useWiggles();
  const {
    counting,
    updateCounting,
    resetCounting,
    markAnimalMet,
    markLevelStarred,
  } = useGameProgress();
  const { level, targetCount, optionCounts, wrongCount, showComplete } =
    counting;
  // The age band sets the largest group, how many number cards appear and
  // how soon the right one glows (see constants/difficulty.js).
  const { childAgeBand } = useSettings();
  const hintAfterTries = getHintAfterTries(childAgeBand);
  const { maxCount, optionCount } = getCountingDifficulty(childAgeBand, level);

  const [isCorrect, setIsCorrect] = useState(false);
  const [showWrongOverlay, setShowWrongOverlay] = useState(false);
  const [feedbackAnim] = useState(new Animated.Value(0));
  const [confettiKey, setConfettiKey] = useState(0);

  const soundPlayer = useAudioPlayer(null);
  const voicePlayer = useAudioPlayer(null);
  const wrongPlayer = useAudioPlayer(null);
  const gameWinPlayer = useAudioPlayer(null);
  const gameSuccessPlayer = useAudioPlayer(null);
  const numberPlayer = useAudioPlayer(null);
  const voiceTimer = useRef(null);

  // The instruction is spoken once when the game opens; tapping it replays.
  const { replay: replayInstruction, stop: stopInstruction } =
    useInstructionPrompt('counting', currentLanguage);

  // Say the answer aloud. A missing clip (not recorded yet) is just silence.
  const sayNumber = useCallback(
    n => {
      const clip = getNumberSound(n, currentLanguage);
      if (clip) playVoice(numberPlayer, clip);
    },
    [numberPlayer, currentLanguage]
  );

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

  const targetAnimal = useMemo(
    () => animalsById[counting.targetId] || null,
    [animalsById, counting.targetId]
  );

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
    track(counting.targetId ? EVENTS.GAME_RESUMED : EVENTS.GAME_STARTED, {
      game: 'counting',
      level,
    });
    // Fires once per visit to the game, not once per round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      releasePlayer(soundPlayer);
      releasePlayer(voicePlayer);
      try {
        wrongPlayer.remove();
      } catch {}
      try {
        gameWinPlayer.remove();
      } catch {}
      try {
        gameSuccessPlayer.remove();
      } catch {}
      releasePlayer(numberPlayer);
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
    };
  }, [
    soundPlayer,
    voicePlayer,
    wrongPlayer,
    gameWinPlayer,
    gameSuccessPlayer,
    numberPlayer,
  ]);

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
    // Every animal gets a turn as the target before any repeats, same
    // rotation guess-animal.game.component.jsx's pickRound uses.
    const unused = animalList.filter(
      a => !counting.usedTargetIds.includes(a.id)
    );
    const targetPool = unused.length > 0 ? unused : animalList;
    const nextTarget = shuffle(targetPool)[0];
    // maxCount grows with the level and the child's age band, and is capped
    // so the on-screen group never gets too crowded to count on a phone.
    const nextCount = 1 + Math.floor(Math.random() * maxCount);
    // The wrong answers must always be enough to fill every card, even when
    // maxCount is tiny (under-4 level 1 has only 1-2 to choose from) - a short
    // round would never match optionCount and be re-dealt forever.
    const distractorPool = [];
    for (let n = 1; n <= Math.max(maxCount, optionCount, nextCount + 1); n++) {
      if (n !== nextCount) distractorPool.push(n);
    }
    const distractors = shuffle(distractorPool).slice(0, optionCount - 1);
    const nextOptionCounts = shuffle([nextCount, ...distractors]);
    updateCounting(prev => ({
      targetId: nextTarget.id,
      targetCount: nextCount,
      optionCounts: nextOptionCounts,
      usedTargetIds: [...prev.usedTargetIds, nextTarget.id],
    }));
    setIsCorrect(false);
    setShowWrongOverlay(false);
    roundStartedAt.current = Date.now();
  }, [maxCount, optionCount, shuffle, updateCounting, counting.usedTargetIds]);

  // A round is dealt only when the saved one doesn't have the right number of
  // options, which covers a first run, a level change, a reset and a change
  // of age band - mirrors guess-animal's
  // identical "deal only if the saved round doesn't fit" effect, so
  // resuming or rotating the device resumes the same question.
  useEffect(() => {
    if (optionCounts.length !== optionCount) {
      pickRound();
    }
  }, [optionCounts.length, optionCount, pickRound]);

  const playAnimalSound = useCallback(
    animal => {
      if (!animal.sound) return;
      tapFeedback();
      playClip(soundPlayer, animal.sound);
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
      voiceTimer.current = setTimeout(() => {
        playVoice(
          voicePlayer,
          currentLanguage === 'en' ? animal.voice : animal.spanish_voice
        );
      }, 1000);
    },
    [soundPlayer, voicePlayer, currentLanguage]
  );

  const onSelect = useCallback(
    async selectedCount => {
      if (showComplete || isCorrect || !targetAnimal) return;
      const correct = selectedCount === targetCount;
      if (correct) {
        successFeedback();
        stopInstruction();
        // Say the number right away; the success jingle follows a second
        // later so the two never talk over each other.
        sayNumber(targetCount);
        setIsCorrect(true);
        updateCounting({ wrongCount: 0 });
        markAnimalMet(targetAnimal.id, 'counting');
        markLevelStarred('counting', level);
        track(EVENTS.LEVEL_COMPLETED, {
          game: 'counting',
          level,
          duration_ms: Date.now() - roundStartedAt.current,
        });

        later(() => {
          if (level < MAX_LEVEL) {
            playClip(gameSuccessPlayer, gameSuccessSoundFile);
          }
        }, 1000);

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

        later(() => {
          updateCounting(prev => {
            if (prev.level < MAX_LEVEL) {
              return {
                level: prev.level + 1,
                targetId: null,
                targetCount: null,
                optionCounts: [],
              };
            }
            track(EVENTS.GAME_COMPLETED, {
              game: 'counting',
              level: prev.level,
            });
            return { showComplete: true };
          });
        }, 2500);
      } else {
        // A wrong pick is a normal part of learning, so nothing ends here -
        // same "gentle noise, help kicks in after a few tries" approach as
        // every other quiz mode.
        errorFeedback();
        wiggle(selectedCount);
        setShowWrongOverlay(true);
        later(() => setShowWrongOverlay(false), 900);
        playClip(wrongPlayer, wrongSoundFile);
        updateCounting(prev => ({ wrongCount: prev.wrongCount + 1 }));
        // Once the hint glow appears, also say the right number - extra
        // help, not a penalty.
        if (wrongCount + 1 === hintAfterTries) {
          later(() => sayNumber(targetCount), 1200);
        }
      }
    },
    [
      showComplete,
      isCorrect,
      targetAnimal,
      targetCount,
      level,
      feedbackAnim,
      wrongSoundFile,
      wrongPlayer,
      gameSuccessPlayer,
      gameSuccessSoundFile,
      later,
      updateCounting,
      markAnimalMet,
      markLevelStarred,
      stopInstruction,
      sayNumber,
      wrongCount,
      hintAfterTries,
      wiggle,
    ]
  );

  const onReset = useCallback(() => {
    track(EVENTS.GAME_RESET, { game: 'counting', level });
    setIsCorrect(false);
    setShowWrongOverlay(false);
    resetCounting();
  }, [resetCounting, level]);

  const handleReset = useCallback(() => {
    tapFeedback();
    onReset();
  }, [onReset]);

  const handleBackToMenu = useCallback(() => {
    tapFeedback();
    if (showComplete) {
      resetCounting();
    } else {
      track(EVENTS.GAME_ABANDONED, { game: 'counting', level, wrongCount });
    }
    onBackToMenu();
  }, [onBackToMenu, showComplete, level, wrongCount, resetCounting]);

  useBackToMenu(handleBackToMenu);

  const handleNextGame = useCallback(() => {
    tapFeedback();
    if (showComplete) {
      resetCounting();
    } else {
      track(EVENTS.GAME_ABANDONED, { game: 'counting', level, wrongCount });
    }
    onNextGame();
  }, [onNextGame, showComplete, level, wrongCount, resetCounting]);

  const countItems = Array.from({ length: targetCount || 0 }, (_, i) => i);

  return (
    <GameScreen
      currentLanguage={currentLanguage}
      setCurrentLanguage={setCurrentLanguage}
      onHome={handleBackToMenu}
      onNextGame={handleNextGame}
      onReset={onReset}
      level={level}
      maxLevel={MAX_LEVEL}
      instruction={t(currentLanguage, 'howManyDoYouSee')}
      onReplayInstruction={replayInstruction}
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
      {/* The animals to count get most of the space - stacked over the
          number cards in portrait, beside them in landscape - and size
          themselves to it, so one lone animal is big and ten still fit. */}
      <View style={isLandscape ? styles.splitRow : styles.splitColumn}>
        <View
          style={[styles.countArea, { flex: 3 }]}
          accessible={!!targetAnimal}
          accessibilityLabel={
            targetAnimal
              ? t(currentLanguage, 'a11yCountingAnimal', {
                  animal:
                    currentLanguage === 'en'
                      ? targetAnimal.name
                      : targetAnimal.spanish_name,
                })
              : undefined
          }
        >
          {!!targetAnimal && (
            <FitGrid
              items={countItems}
              keyExtractor={i => `count-${i}`}
              gap={6}
              minSize={48}
              maxSize={COUNT_ICON_MAX * scale}
              renderItem={(_, size) => (
                <BouncyButton
                  style={{ width: size, height: size }}
                  onPress={() => playAnimalSound(targetAnimal)}
                  accessible={false}
                >
                  <LottieView
                    autoPlay
                    loop
                    resizeMode="contain"
                    source={targetAnimal.animation_path}
                    style={[
                      { width: size, height: size },
                      iconScaleStyle(targetAnimal),
                    ]}
                  />
                </BouncyButton>
              )}
            />
          )}
        </View>
        <View style={{ flex: 2 }}>
          <FitGrid
            items={optionCounts}
            keyExtractor={count => `option-${count}`}
            gap={20}
            minSize={touchTarget}
            maxSize={OPTION_CARD_MAX * scale}
            renderItem={(count, size) => (
              <AnswerCard
                category="letters"
                hinted={wrongCount >= hintAfterTries && count === targetCount}
                wiggleTrigger={triggerFor(count)}
                onPress={() => onSelect(count)}
                accessibilityLabel={t(currentLanguage, 'a11yCountOption', {
                  count,
                })}
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.optionDigit,
                    { fontSize: size * 0.5, lineHeight: size * 0.62 },
                  ]}
                >
                  {count}
                </Text>
              </AnswerCard>
            )}
          />
        </View>
      </View>
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  splitColumn: {
    flex: 1,
    flexDirection: 'column',
    gap: 16,
  },
  splitRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 24,
  },
  countArea: {
    backgroundColor: CATEGORY_COLORS.letters.fill,
    borderRadius: RADIUS.lg,
    padding: 12,
  },
  // System bold, not Bangers: Bangers' slanted digits were clipping at the
  // edges of their glyph box on some devices.
  optionDigit: {
    fontWeight: '900',
    color: PALETTE.ink,
    includeFontPadding: false,
    textAlign: 'center',
  },
});
