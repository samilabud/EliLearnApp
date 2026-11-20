import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import { animalList, iconScaleStyle } from '../animals/animal.list';
import { t } from '../../constants';
import { CATEGORY_COLORS, FONTS, PALETTE, RADIUS } from '../../constants/theme';
import { useGameProgress } from '../../contexts/game-progress.context';
import { useSettings } from '../../contexts/settings.context';
import { getHintAfterTries } from '../../constants/difficulty';
import { useBackToMenu } from '../../utils/navigation';
import { playClip, releasePlayer } from '../../utils/sound';
import { EVENTS, track } from '../../utils/analytics';
import {
  tapFeedback,
  successFeedback,
  errorFeedback,
} from '../../utils/haptics';
import { useResponsive } from '../../utils/use-responsive';
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
const MIN_OPTION_SIZE = 96;
const MAX_OPTION_SIZE = 200;
const GAP = 12;

/** Animals on the board at a level: a few at first, never more than six. */
const boardSizeFor = (band, level) => {
  if (band === 'under4') return Math.min(4, level + 2);
  if (band === '7plus') return Math.min(6, level + 3);
  return Math.min(5, level + 2);
};
const optionCountFor = band =>
  band === 'under4' ? 2 : band === '7plus' ? 4 : 3;
/** Time to look at the full board - longer when there is more to take in. */
const lookMs = count => 2500 + count * 700;

const shuffle = arr => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * One round: the animals on the board, the one that will go away, and the
 * choices (that animal plus others that were never on the board, so exactly
 * one answer is right).
 */
const dealRound = (band, level) => {
  const board = shuffle(animalList).slice(0, boardSizeFor(band, level));
  const missing = board[Math.floor(Math.random() * board.length)];
  const onBoard = new Set(board.map(a => a.id));
  const distractors = shuffle(animalList.filter(a => !onBoard.has(a.id))).slice(
    0,
    optionCountFor(band) - 1
  );
  return {
    boardIds: board.map(a => a.id),
    missingId: missing.id,
    optionIds: shuffle([missing, ...distractors]).map(a => a.id),
  };
};

const ANIMALS_BY_ID = Object.fromEntries(animalList.map(a => [a.id, a]));
const WRONG_SOUND = require('../../assets/sounds/background/animals/wrong-answer-bird-call.mp3');
const WIN_SOUND = require('../../assets/sounds/game/game_win.mp3');
const SUCCESS_SOUND = require('../../assets/sounds/game/game_success.mp3');

/**
 * What's Missing? - look at a few animals, then one goes away; tap which.
 *
 * Like every quiz here it never ends on a mistake: a wrong tap wiggles and
 * the right answer starts to glow after a few tries. Progress within a visit
 * is local (rounds are quick); stars are permanent.
 */
export default function MissingAnimalGame({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
  onNextGame,
}) {
  const { scale, width, isLandscape, contentMaxWidth } = useResponsive();
  const { wiggle, triggerFor } = useWiggles();
  const { markAnimalMet, markLevelStarred } = useGameProgress();
  const { childAgeBand } = useSettings();
  const hintAfterTries = getHintAfterTries(childAgeBand);

  const [level, setLevel] = useState(1);
  const [round, setRound] = useState(() => dealRound(childAgeBand, 1));
  // 'look' (all there) -> 'guess' (one gone) -> 'solved' (it is back).
  const [phase, setPhase] = useState('look');
  const [wrongCount, setWrongCount] = useState(0);
  const [showWrong, setShowWrong] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [instructionDone, setInstructionDone] = useState(false);
  const [feedbackAnim] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(1));

  const { replay: replayInstruction, stop: stopInstruction } =
    useInstructionPrompt('missing', currentLanguage, {
      onFinished: () => setInstructionDone(true),
    });
  const wrongPlayer = useAudioPlayer(null);
  const winPlayer = useAudioPlayer(null);
  const successPlayer = useAudioPlayer(null);
  const rewardPlayer = useAudioPlayer(null);

  const timers = useRef([]);
  const later = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);
  const roundStartedAt = useRef(0);

  useEffect(() => {
    roundStartedAt.current = Date.now();
    track(EVENTS.GAME_STARTED, { game: 'missing', level: 1 });
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  useEffect(
    () => () => {
      [wrongPlayer, winPlayer, successPlayer, rewardPlayer].forEach(
        releasePlayer
      );
    },
    [wrongPlayer, winPlayer, successPlayer, rewardPlayer]
  );

  // The look period starts once the spoken instruction is done, so the two
  // never overlap, and ends by itself - a child is never left waiting on a
  // button they may not understand.
  useEffect(() => {
    if (phase !== 'look' || !instructionDone) return undefined;
    const id = setTimeout(
      () => setPhase('guess'),
      lookMs(round.boardIds.length)
    );
    return () => clearTimeout(id);
  }, [phase, instructionDone, round]);

  // The animal going away pops its slot into a question mark.
  useEffect(() => {
    if (phase !== 'guess') return;
    pop.setValue(0.5);
    Animated.spring(pop, {
      toValue: 1,
      friction: 4,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [phase, pop]);

  useEffect(() => {
    if (showComplete) playClip(winPlayer, WIN_SOUND);
  }, [showComplete, winPlayer]);

  const missingAnimal = ANIMALS_BY_ID[round.missingId];
  const boardAnimals = round.boardIds.map(id => ANIMALS_BY_ID[id]);
  const options = round.optionIds.map(id => ANIMALS_BY_ID[id]);

  const startLevel = useCallback(
    next => {
      setLevel(next);
      setRound(dealRound(childAgeBand, next));
      setPhase('look');
      setWrongCount(0);
      setShowWrong(false);
      roundStartedAt.current = Date.now();
    },
    [childAgeBand]
  );

  const onSelect = useCallback(
    selected => {
      if (phase !== 'guess' || showComplete) return;
      stopInstruction();
      if (selected.id === missingAnimal.id) {
        successFeedback();
        setPhase('solved');
        markAnimalMet(selected.id, 'missing');
        markLevelStarred('missing', level);
        track(EVENTS.LEVEL_COMPLETED, {
          game: 'missing',
          level,
          duration_ms: Date.now() - roundStartedAt.current,
        });
        playClip(rewardPlayer, selected.sound);
        later(() => {
          if (level < MAX_LEVEL) playClip(successPlayer, SUCCESS_SOUND);
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
        setConfettiKey(k => k + 1);
        later(() => {
          if (level < MAX_LEVEL) {
            startLevel(level + 1);
          } else {
            track(EVENTS.GAME_COMPLETED, { game: 'missing', level });
            setShowComplete(true);
          }
        }, 2500);
      } else {
        // A wrong pick is just part of learning: a gentle noise, a wiggle,
        // and after a few tries the right answer glows.
        errorFeedback();
        wiggle(selected.id);
        setShowWrong(true);
        later(() => setShowWrong(false), 900);
        playClip(wrongPlayer, WRONG_SOUND);
        setWrongCount(n => n + 1);
      }
    },
    [
      phase,
      showComplete,
      missingAnimal,
      level,
      stopInstruction,
      markAnimalMet,
      markLevelStarred,
      rewardPlayer,
      successPlayer,
      wrongPlayer,
      feedbackAnim,
      later,
      startLevel,
      wiggle,
    ]
  );

  const restart = useCallback(() => {
    setShowComplete(false);
    setInstructionDone(true);
    startLevel(1);
  }, [startLevel]);

  const handleReset = useCallback(() => {
    track(EVENTS.GAME_RESET, { game: 'missing', level });
    restart();
  }, [restart, level]);

  const leave = useCallback(
    next => {
      tapFeedback();
      if (!showComplete) {
        track(EVENTS.GAME_ABANDONED, { game: 'missing', level, wrongCount });
      }
      next();
    },
    [showComplete, level, wrongCount]
  );
  const handleBackToMenu = useCallback(
    () => leave(onBackToMenu),
    [leave, onBackToMenu]
  );
  const handleNextGame = useCallback(
    () => leave(onNextGame),
    [leave, onNextGame]
  );
  useBackToMenu(handleBackToMenu);

  // Board sizing: up to three across, as large as the space allows.
  const colors = CATEGORY_COLORS.memory;
  const columns = round.boardIds.length <= 3 ? round.boardIds.length : 3;
  const available = isLandscape
    ? width * 0.32
    : Math.min(width, contentMaxWidth) - 48;
  const cell = Math.max(
    72,
    Math.min(
      Math.floor((available - GAP * (columns - 1)) / columns),
      Math.round(130 * scale),
      isLandscape ? 110 : 999
    )
  );

  const renderSlot = animal => {
    const isMissing = animal.id === missingAnimal.id;
    if (isMissing && phase === 'guess') {
      return (
        <Animated.View
          style={[
            styles.slotInner,
            { backgroundColor: colors.fill, transform: [{ scale: pop }] },
          ]}
        >
          <Text style={[styles.slotMark, { fontSize: cell * 0.55 }]}>?</Text>
        </Animated.View>
      );
    }
    return (
      <LottieView
        autoPlay
        loop={phase === 'look'}
        resizeMode="contain"
        source={animal.animation_path}
        style={[
          { width: cell * 0.85, height: cell * 0.85 },
          iconScaleStyle(animal),
        ]}
      />
    );
  };

  const prompt = (
    <View
      style={[
        styles.board,
        { borderColor: colors.ring, backgroundColor: PALETTE.white },
      ]}
      accessible
      accessibilityLabel={boardAnimals
        .filter(a => phase !== 'guess' || a.id !== missingAnimal.id)
        .map(a => (currentLanguage === 'en' ? a.name : a.spanish_name))
        .join(', ')}
    >
      <View
        style={[
          styles.boardRow,
          { width: columns * cell + (columns - 1) * GAP, gap: GAP },
        ]}
      >
        {boardAnimals.map(animal => (
          <View
            key={animal.id}
            style={[styles.cell, { width: cell, height: cell }]}
          >
            {renderSlot(animal)}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <GameScreen
      currentLanguage={currentLanguage}
      setCurrentLanguage={setCurrentLanguage}
      onHome={handleBackToMenu}
      onNextGame={handleNextGame}
      onReset={handleReset}
      level={level}
      maxLevel={MAX_LEVEL}
      instruction={t(
        currentLanguage,
        phase === 'look' ? 'missingLookText' : 'missingGuessText'
      )}
      onReplayInstruction={replayInstruction}
      prompt={prompt}
      promptPaneRatio={0.4}
      overlay={
        <>
          <CorrectBurst
            visible={phase === 'solved'}
            opacity={feedbackAnim}
            confettiKey={confettiKey}
          />
          <TryAgainBanner
            visible={showWrong}
            currentLanguage={currentLanguage}
          />
          <CompletionOverlay
            visible={showComplete}
            currentLanguage={currentLanguage}
            confettiKey={confettiKey}
            onRestart={restart}
            onNextGame={handleNextGame}
            onHome={handleBackToMenu}
          />
        </>
      }
    >
      {phase === 'look' ? (
        <View style={styles.lookMessage}>
          <Text
            style={[
              styles.lookText,
              { fontSize: 34 * scale, lineHeight: 44 * scale },
            ]}
          >
            {t(currentLanguage, 'missingLookText')}
          </Text>
        </View>
      ) : (
        <FitGrid
          items={options}
          keyExtractor={opt => opt.id}
          minSize={MIN_OPTION_SIZE}
          maxSize={MAX_OPTION_SIZE * scale}
          renderItem={(opt, size) => (
            <AnswerCard
              category="memory"
              hinted={
                wrongCount >= hintAfterTries && opt.id === missingAnimal.id
              }
              wiggleTrigger={triggerFor(opt.id)}
              disabled={phase === 'solved'}
              onPress={() => onSelect(opt)}
              accessibilityLabel={t(currentLanguage, 'a11yMissingOption', {
                animal: currentLanguage === 'en' ? opt.name : opt.spanish_name,
              })}
            >
              <LottieView
                autoPlay={false}
                loop={false}
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
      )}
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  board: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 4,
  },
  boardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotInner: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  slotMark: {
    fontFamily: FONTS.title,
    includeFontPadding: false,
    color: PALETTE.ink,
  },
  lookMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookText: {
    fontFamily: FONTS.title,
    includeFontPadding: false,
    textAlign: 'center',
    color: CATEGORY_COLORS.memory.ink,
    letterSpacing: 1,
  },
});
