import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  Animated,
  Easing,
} from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import Svg, { Path } from 'react-native-svg';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { animalList, iconScaleStyle } from '../animals/animal.list';
import { t, LARGE_TOUCH_TARGET } from '../../constants';
import {
  CARD_SHADOW,
  CATEGORY_COLORS,
  FONTS,
  PALETTE,
  RADIUS,
} from '../../constants/theme';
import { useGameProgress } from '../../contexts/game-progress.context';
import { useSettings } from '../../contexts/settings.context';
import { getTraceTolerance } from '../../constants/difficulty';
import { useBackToMenu } from '../../utils/navigation';
import { playClip, stopClip, playVoice } from '../../utils/sound';
import { firstLetterOf } from '../../utils/helpers';
import { getLetterSound } from '../../utils/letter-sounds';
import { LETTER_PATHS, buildGuidePath } from '../../utils/letter-paths';
import { gradeTrace } from '../../utils/trace-grading';
import { EVENTS, track } from '../../utils/analytics';
import {
  tapFeedback,
  successFeedback,
  errorFeedback,
} from '../../utils/haptics';
import { useResponsive } from '../../utils/use-responsive';
import { BouncyButton } from '../utility/bouncy-button.component';
import { GameScreen } from '../utility/game-screen.component';
import {
  CompletionOverlay,
  CorrectBurst,
  TryAgainBanner,
} from '../utility/feedback-overlays.component';
import { useInstructionPrompt } from '../../utils/use-instruction-prompt';

const MAX_LEVEL = 6;

// Square drawing area: as large as the space below the prompt allows, so it
// fills a tablet, but never smaller than a phone can comfortably trace on.
const MIN_CANVAS_SIZE = 180;
// Space reserved under the canvas for the Clear button.
const CLEAR_ROW_HEIGHT = LARGE_TOUCH_TARGET + 8;

// How far in from each edge of the canvas the guide letter's target box
// sits. Both the dashed guide drawn on screen and the grading in
// trace-grading.js are built from the same LETTER_PATHS data scaled into
// this box, so what a child sees and what they're graded against match.
const CANVAS_INSET_RATIO = 0.18;

// A lifted finger ends the current stroke; this is how long to wait before
// grading the attempt, so a child can draw a multi-stroke letter (like "A")
// across a few separate strokes without it grading after the first one.
const EVALUATE_DELAY_MS = 700;

// A trace that doesn't yet cover enough of the letter is a normal part of
// a multi-stroke letter in progress (e.g. the loops of a "B" after its
// vertical line), not a wrong answer - so it is left on screen rather than
// cleared. Only after this many checkpoints in a row still haven't passed
// does the canvas actually clear and the child hear "try again". Matches
// the hint-after-N-tries threshold used by the other letter games.
const MAX_ATTEMPTS_BEFORE_CLEAR = 3;

// A new stroke starting less than EVALUATE_DELAY_MS after the last one's
// release cancels that pending evaluation (see onPanResponderGrant), so a
// child mid-letter doesn't get graded between strokes. Fast, continuous
// scribbling can keep doing that indefinitely though, with no gap ever
// long enough for the debounced evaluation to fire - nothing ever gets
// graded or cleared, no matter how many strokes pile up. This is a backstop
// independent of that debounce: a timer started on the first stroke of a
// burst and never reset by later ones, forcing an evaluation this long
// after a burst starts even if the child never once pauses.
// Needs to be generous: gradeTrace only requires ~65% coverage to pass (see
// trace-grading.js), so firing this mid-stroke, while a finger is still down
// drawing a letter like "P" in one continuous motion, can already read as
// "correct" before the loop is actually closed - ending the round out from
// under a child who was still mid-letter, not scribbling.
const MAX_BURST_MS = 6000;

// A hard ceiling on the whole attempt, independent of EVALUATE_DELAY_MS and
// MAX_BURST_MS above: those two still let an incomplete multi-stroke letter
// sit ungraded indefinitely as long as each checkpoint quietly asks for "one
// more stroke" (see MAX_ATTEMPTS_BEFORE_CLEAR). This forces a definitive
// pass/fail the moment this much time has passed since the child's first
// touch on a fresh attempt, bypassing that leniency so nothing is ever left
// without a verdict. 4s cut off multi-stroke letters (e.g. "P"'s loop)
// mid-draw, so this is deliberately generous rather than a tight deadline.
const FORCE_EVALUATE_MS = 8000;

export default function TraceLetterGame({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
  onNextGame,
}) {
  const { height, isLandscape, scale, touchTarget } = useResponsive();
  const [canvasArea, setCanvasArea] = useState(null);
  const canvasAreaRef = useRef(null);
  const canvasSize = canvasArea
    ? Math.max(
        MIN_CANVAS_SIZE,
        Math.floor(
          Math.min(canvasArea.width, canvasArea.height - CLEAR_ROW_HEIGHT)
        )
      )
    : MIN_CANVAS_SIZE;
  // The square the guide letter is drawn into and graded against - see
  // CANVAS_INSET_RATIO above.
  const targetBox = useMemo(() => {
    const inset = canvasSize * CANVAS_INSET_RATIO;
    return {
      left: inset,
      top: inset,
      width: canvasSize - inset * 2,
      height: canvasSize - inset * 2,
    };
  }, [canvasSize]);

  const { trace, updateTrace, resetTrace, markAnimalMet, markLevelStarred } =
    useGameProgress();
  const { level, showComplete, wrongCount } = trace;

  const [isCorrect, setIsCorrect] = useState(false);
  // How closely the finger must follow the letter depends on the child's age
  // band (see getTraceTolerance in constants/difficulty.js).
  const { childAgeBand } = useSettings();
  const { proximityRatio, minCoverageRatio } = getTraceTolerance(childAgeBand);
  // The first round's audio waits for the spoken instruction to finish so
  // the two never overlap. Later rounds find this already true.
  const [instructionDone, setInstructionDone] = useState(false);
  const { replay: replayInstruction } = useInstructionPrompt(
    'trace',
    currentLanguage,
    {
      onFinished: () => setInstructionDone(true),
    }
  );
  // Mirrors isCorrect, but settable synchronously. evaluateAttempt can be
  // triggered twice in quick succession for the same completed trace - the
  // debounced timer from onPanResponderRelease and the independent
  // MAX_BURST_MS backstop can both fire within a few ms of each other on a
  // multi-stroke letter. setIsCorrect(true) doesn't take effect until the
  // next render, so a guard on the isCorrect *state* can miss that race and
  // grade the same trace twice, advancing two rounds instead of one. This
  // ref closes that window.
  const isCorrectRef = useRef(false);
  const [showWrongOverlay, setShowWrongOverlay] = useState(false);
  const [points, setPoints] = useState([]);
  const [confettiKey, setConfettiKey] = useState(0);
  const [feedbackAnim] = useState(new Animated.Value(0));
  const [promptPulse] = useState(new Animated.Value(0));

  const pointsRef = useRef([]);
  // Backstop for MAX_BURST_MS - see its comment above.
  const burstTimer = useRef(null);
  // Backstop for FORCE_EVALUATE_MS - see its comment above.
  const forceEvaluateTimer = useRef(null);
  const promptPlayer = useAudioPlayer(null);
  const wrongPlayer = useAudioPlayer(null);
  const gameWinPlayer = useAudioPlayer(null);
  const gameSuccessPlayer = useAudioPlayer(null);
  const letterNamePlayer = useAudioPlayer(null);

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

  const targetAnimal = useMemo(
    () => animalsById[trace.targetId] || null,
    [animalsById, trace.targetId]
  );
  const correctLetter = useMemo(
    () => (targetAnimal ? firstLetterOf(targetAnimal, currentLanguage) : null),
    [targetAnimal, currentLanguage]
  );

  // Every delayed action is registered here so unmounting cancels it. Without
  // this, leaving mid-round leaves timers that later grade or clear a drawing
  // in a game the child has already left.
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
    track(trace.targetId ? EVENTS.GAME_RESUMED : EVENTS.GAME_STARTED, {
      game: 'trace',
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

  const clearCanvas = useCallback(() => {
    pointsRef.current = [];
    setPoints([]);
    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = null;
    if (forceEvaluateTimer.current) clearTimeout(forceEvaluateTimer.current);
    forceEvaluateTimer.current = null;
    // A fresh canvas means a fresh set of checkpoints before it clears
    // again - covers a new round, a language switch, the 3rd failed
    // checkpoint, and the child's own manual Clear tap.
    updateTrace({ wrongCount: 0 });
  }, [updateTrace]);

  const pickRound = useCallback(() => {
    // Every animal gets a turn as the target before any repeats, so a child
    // never gets asked about the same one twice in one match.
    const unused = animalList.filter(a => !trace.usedTargetIds.includes(a.id));
    const pool = unused.length > 0 ? unused : animalList;
    const nextTarget = pool[Math.floor(Math.random() * pool.length)];
    updateTrace(prev => ({
      targetId: nextTarget.id,
      usedTargetIds: [...prev.usedTargetIds, nextTarget.id],
    }));
    setIsCorrect(false);
    isCorrectRef.current = false;
    setShowWrongOverlay(false);
    clearCanvas();
    roundStartedAt.current = Date.now();
  }, [updateTrace, trace.usedTargetIds, clearCanvas]);

  // A round is dealt only when the saved one is missing, which covers a
  // first run, a level change and a reset. A saved round that already has a
  // target is restored untouched, so returning from the menu or rotating the
  // device resumes the same animal rather than silently replacing it.
  useEffect(() => {
    if (!trace.targetId) {
      pickRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trace.targetId]);

  // The letter being traced can change shape on a language toggle (e.g.
  // "Owl" -> "Buho"), so any half-drawn attempt from the other language no
  // longer means anything. Clearing it also covers dealing a fresh round.
  useEffect(() => {
    clearCanvas();
  }, [correctLetter, clearCanvas]);

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

  const handleCorrect = useCallback(() => {
    successFeedback();
    isCorrectRef.current = true;
    setIsCorrect(true);
    markAnimalMet(targetAnimal.id, 'trace');
    markLevelStarred('trace', level);
    track(EVENTS.LEVEL_COMPLETED, {
      game: 'trace',
      level,
      duration_ms: Date.now() - roundStartedAt.current,
    });

    // Names the letter the child just traced (e.g. "P" -> "pee"), so the
    // win confirms what was learned, not just that the attempt passed.
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
      updateTrace(prev => {
        if (prev.level < MAX_LEVEL) {
          return { level: prev.level + 1, targetId: null };
        }
        track(EVENTS.GAME_COMPLETED, { game: 'trace', level: prev.level });
        return { showComplete: true };
      });
    }, 2500);
  }, [
    targetAnimal,
    level,
    feedbackAnim,
    gameSuccessPlayer,
    gameSuccessSoundFile,
    letterNamePlayer,
    correctLetter,
    currentLanguage,
    later,
    updateTrace,
    markAnimalMet,
    markLevelStarred,
  ]);

  const handleIncorrect = useCallback(() => {
    // Reached only after MAX_ATTEMPTS_BEFORE_CLEAR checkpoints in a row
    // haven't passed. The game never ends on a mistake, so this is
    // encouragement, not failure: a gentle noise, the name again to compare
    // against, and a clear canvas to try again.
    errorFeedback();
    setShowWrongOverlay(true);
    later(() => setShowWrongOverlay(false), 900);
    later(() => clearCanvas(), 900);
    playClip(wrongPlayer, wrongSoundFile);
    later(() => playPrompt(), 700);
  }, [later, clearCanvas, wrongPlayer, wrongSoundFile, playPrompt]);

  // A checkpoint that hasn't passed yet usually just means a multi-stroke
  // letter (like "B") is still in progress, so the drawing is left on
  // screen rather than cleared. Only once MAX_ATTEMPTS_BEFORE_CLEAR
  // checkpoints in a row have failed does it actually reset.
  const registerFailedAttempt = useCallback(() => {
    const nextCount = wrongCount + 1;
    if (nextCount >= MAX_ATTEMPTS_BEFORE_CLEAR) {
      handleIncorrect();
    } else {
      updateTrace({ wrongCount: nextCount });
    }
  }, [wrongCount, handleIncorrect, updateTrace]);

  const evaluateAttempt = useCallback(() => {
    if (showComplete || isCorrectRef.current || !targetAnimal) return;
    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = null;

    const passed = gradeTrace({
      tracePoints: pointsRef.current,
      letterStrokes: LETTER_PATHS[correctLetter],
      box: targetBox,
      canvasSize,
      proximityRatio,
      minCoverageRatio,
    });

    if (passed) {
      handleCorrect();
    } else {
      registerFailedAttempt();
    }
  }, [
    showComplete,
    targetAnimal,
    correctLetter,
    targetBox,
    canvasSize,
    proximityRatio,
    minCoverageRatio,
    handleCorrect,
    registerFailedAttempt,
  ]);

  // FORCE_EVALUATE_MS backstop - unlike evaluateAttempt above, a fail here
  // goes straight to handleIncorrect rather than registerFailedAttempt: this
  // only fires once the attempt has already run this long without a verdict,
  // so the MAX_ATTEMPTS_BEFORE_CLEAR leniency for an in-progress multi-stroke
  // letter no longer applies - the child gets a definitive answer now.
  const forceEvaluateAttempt = useCallback(() => {
    forceEvaluateTimer.current = null;
    if (showComplete || isCorrectRef.current || !targetAnimal) return;
    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = null;
    if (evaluateTimer.current) clearTimeout(evaluateTimer.current);

    const passed = gradeTrace({
      tracePoints: pointsRef.current,
      letterStrokes: LETTER_PATHS[correctLetter],
      box: targetBox,
      canvasSize,
      proximityRatio,
      minCoverageRatio,
    });

    if (passed) {
      handleCorrect();
    } else {
      handleIncorrect();
    }
  }, [
    showComplete,
    targetAnimal,
    correctLetter,
    targetBox,
    canvasSize,
    proximityRatio,
    minCoverageRatio,
    handleCorrect,
    handleIncorrect,
  ]);

  const evaluateTimer = useRef(null);
  const scheduleEvaluate = useCallback(() => {
    if (evaluateTimer.current) clearTimeout(evaluateTimer.current);
    evaluateTimer.current = setTimeout(evaluateAttempt, EVALUATE_DELAY_MS);
    timers.current.push(evaluateTimer.current);
  }, [evaluateAttempt]);

  useEffect(() => {
    return () => {
      if (evaluateTimer.current) clearTimeout(evaluateTimer.current);
    };
  }, []);

  // PanResponder is built once, inside an effect rather than during render
  // (reading a ref's `.current` while rendering is not allowed). It reads
  // `scheduleEvaluate` through a ref kept current by the effect below rather
  // than closing over it directly - otherwise the first render's (stale)
  // evaluate logic would run forever, since the responder itself is never
  // recreated.
  const scheduleEvaluateRef = useRef(scheduleEvaluate);
  useEffect(() => {
    scheduleEvaluateRef.current = scheduleEvaluate;
  }, [scheduleEvaluate]);

  // Same "latest ref" reasoning as scheduleEvaluateRef, for the MAX_BURST_MS
  // backstop - it calls evaluateAttempt directly rather than through the
  // schedule/cancel dance above, since the whole point is to run even while
  // strokes keep cancelling that pending evaluation.
  const evaluateAttemptRef = useRef(evaluateAttempt);
  useEffect(() => {
    evaluateAttemptRef.current = evaluateAttempt;
  }, [evaluateAttempt]);

  // Same "latest ref" reasoning again, for the FORCE_EVALUATE_MS backstop.
  const forceEvaluateAttemptRef = useRef(forceEvaluateAttempt);
  useEffect(() => {
    forceEvaluateAttemptRef.current = forceEvaluateAttempt;
  }, [forceEvaluateAttempt]);

  const [panResponder, setPanResponder] = useState(null);
  useEffect(() => {
    setPanResponder(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: evt => {
          if (evaluateTimer.current) clearTimeout(evaluateTimer.current);
          // Started only on the first stroke of a burst and never reset by
          // later ones (unlike evaluateTimer above) - see MAX_BURST_MS.
          if (!burstTimer.current) {
            burstTimer.current = setTimeout(() => {
              burstTimer.current = null;
              evaluateAttemptRef.current();
            }, MAX_BURST_MS);
            timers.current.push(burstTimer.current);
          }
          // Only armed on the very first touch of a fresh attempt (an empty
          // canvas) and, unlike burstTimer, never cleared by a normal
          // evaluateAttempt call - see FORCE_EVALUATE_MS.
          if (pointsRef.current.length === 0 && !forceEvaluateTimer.current) {
            forceEvaluateTimer.current = setTimeout(() => {
              forceEvaluateAttemptRef.current();
            }, FORCE_EVALUATE_MS);
            timers.current.push(forceEvaluateTimer.current);
          }
          const { locationX, locationY } = evt.nativeEvent;
          const next = [
            ...pointsRef.current,
            { x: locationX, y: locationY, move: true },
          ];
          pointsRef.current = next;
          setPoints(next);
        },
        onPanResponderMove: evt => {
          const { locationX, locationY } = evt.nativeEvent;
          const next = [
            ...pointsRef.current,
            { x: locationX, y: locationY, move: false },
          ];
          pointsRef.current = next;
          setPoints(next);
        },
        onPanResponderRelease: () => {
          scheduleEvaluateRef.current();
        },
        onPanResponderTerminate: () => {
          scheduleEvaluateRef.current();
        },
      })
    );
  }, []);

  const onReset = useCallback(() => {
    track(EVENTS.GAME_RESET, { game: 'trace', level });
    setIsCorrect(false);
    isCorrectRef.current = false;
    setShowWrongOverlay(false);
    // Clearing progress empties the round, which re-deals via the effect above.
    resetTrace();
  }, [resetTrace, level]);

  const handleReset = useCallback(() => {
    tapFeedback();
    onReset();
  }, [onReset]);

  const handleClear = useCallback(() => {
    tapFeedback();
    if (evaluateTimer.current) clearTimeout(evaluateTimer.current);
    clearCanvas();
  }, [clearCanvas]);

  // Strokes are stored in canvas pixels, so a canvas that changes size (the
  // device rotated) would leave a half-drawn letter misaligned with its
  // guide. Starting that attempt over is kinder than grading a wrong shape.
  const handleCanvasAreaLayout = useCallback(
    event => {
      const { width, height: areaHeight } = event.nativeEvent.layout;
      const prev = canvasAreaRef.current;
      if (prev && prev.width === width && prev.height === areaHeight) return;
      if (prev && pointsRef.current.length > 0) {
        if (evaluateTimer.current) clearTimeout(evaluateTimer.current);
        clearCanvas();
      }
      canvasAreaRef.current = { width, height: areaHeight };
      setCanvasArea(canvasAreaRef.current);
    },
    [clearCanvas]
  );

  const handleBackToMenu = useCallback(() => {
    tapFeedback();
    if (showComplete) {
      // Finishing every level is worth celebrating in the moment, but it
      // should not be what a child finds waiting for them next time they
      // open this game - only an in-progress level is worth resuming.
      resetTrace();
    } else {
      track(EVENTS.GAME_ABANDONED, { game: 'trace', level });
    }
    onBackToMenu();
  }, [onBackToMenu, showComplete, level, resetTrace]);

  useBackToMenu(handleBackToMenu);

  const handleNextGame = useCallback(() => {
    tapFeedback();
    if (showComplete) {
      resetTrace();
    } else {
      track(EVENTS.GAME_ABANDONED, { game: 'trace', level });
    }
    onNextGame();
  }, [onNextGame, showComplete, level, resetTrace]);

  const handlePlayPrompt = useCallback(() => {
    tapFeedback();
    playPrompt();
  }, [playPrompt]);

  const promptScale = promptPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const hasTrace = points.length > 0;

  const pathD = points.reduce(
    (acc, p, i) =>
      acc + (p.move || i === 0 ? `M ${p.x} ${p.y} ` : `L ${p.x} ${p.y} `),
    ''
  );

  const animalCardSize = Math.round(
    Math.min(140 * scale, isLandscape ? height * 0.3 : height * 0.14)
  );

  const prompt = (
    <View style={[styles.promptColumn, !isLandscape && styles.promptRow]}>
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
              { width: animalCardSize * 0.86, height: animalCardSize * 0.86 },
              iconScaleStyle(targetAnimal),
            ]}
          />
        )}
      </View>
      <View style={styles.promptColumn}>
        {!!targetAnimal && (
          <Text style={[styles.animalNameText, { fontSize: 22 * scale }]}>
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
              { minHeight: touchTarget, paddingHorizontal: 20 * scale },
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t(currentLanguage, 'a11yPlayName')}
          >
            {/* Fill lives on a sibling, not the animated view - see AnswerCard. */}
            <View style={styles.promptButtonBackground} />
            <MaterialIcons
              name="volume-up"
              size={28 * scale}
              color={PALETTE.ink}
            />
            <Text
              style={[
                styles.promptText,
                { fontSize: 22 * scale, lineHeight: 30 * scale },
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
      instruction={targetAnimal ? t(currentLanguage, 'traceInstruction') : null}
      onReplayInstruction={replayInstruction}
      prompt={prompt}
      promptPaneRatio={0.34}
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
      {/* The canvas is the largest square the area allows (minus the Clear
          row), so it is big on an iPad and still fits a landscape phone. */}
      <View style={styles.canvasArea} onLayout={handleCanvasAreaLayout}>
        <View
          style={[styles.canvas, { width: canvasSize, height: canvasSize }]}
          {...(panResponder ? panResponder.panHandlers : {})}
          accessible={true}
          accessibilityLabel={t(currentLanguage, 'a11yTraceCanvas', {
            letter: correctLetter || '',
          })}
        >
          <Svg
            width={canvasSize}
            height={canvasSize}
            style={StyleSheet.absoluteFill}
          >
            {!!correctLetter && LETTER_PATHS[correctLetter] && (
              <Path
                d={buildGuidePath(LETTER_PATHS[correctLetter], targetBox)}
                fill="none"
                stroke={PALETTE.gold}
                strokeWidth={4 * scale}
                strokeDasharray="12,16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {!!pathD && (
              <Path
                d={pathD}
                stroke={PALETTE.ink}
                strokeWidth={16 * scale}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
          </Svg>
        </View>
        {/* The row is always reserved so the canvas never jumps when the
            button appears with the first stroke. */}
        <View style={styles.clearRow}>
          {hasTrace && (
            <BouncyButton
              onPress={handleClear}
              style={styles.clearButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yClearDrawing')}
            >
              <View style={styles.clearButtonBackground} />
              <MaterialCommunityIcons
                name="eraser"
                size={22}
                color={PALETTE.ink}
              />
              <Text style={styles.clearButtonText}>
                {t(currentLanguage, 'clearDrawing')}
              </Text>
            </BouncyButton>
          )}
        </View>
      </View>
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  promptColumn: {
    alignItems: 'center',
    gap: 8,
  },
  // In portrait the animal sits beside its name and button, leaving the
  // height to the canvas.
  promptRow: {
    flexDirection: 'row',
    gap: 16,
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
  canvasArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    backgroundColor: PALETTE.white,
    borderRadius: RADIUS.md,
    borderWidth: 4,
    borderColor: CATEGORY_COLORS.letters.ring,
    overflow: 'hidden',
  },
  clearRow: {
    height: CLEAR_ROW_HEIGHT,
    justifyContent: 'center',
  },
  clearButton: {
    // Plain on purpose - the fill lives in clearButtonBackground.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: LARGE_TOUCH_TARGET,
    paddingHorizontal: 28,
  },
  clearButtonBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: PALETTE.white,
    borderRadius: RADIUS.pill,
    borderWidth: 3,
    borderColor: PALETTE.gold,
  },
  clearButtonText: {
    fontFamily: FONTS.bodyHeavy,
    fontSize: 18,
    color: PALETTE.ink,
  },
});
