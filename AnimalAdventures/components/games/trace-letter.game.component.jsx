import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ImageBackground,
  PanResponder,
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
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import { AmbientBackground } from '../utility/ambient-background.component';
import { animalList } from '../animals/animal.list';
import ConfettiCannon from 'react-native-confetti-cannon';
import { t, LARGE_TOUCH_TARGET } from '../../constants';
import { useGameProgress } from '../../contexts/game-progress.context';
import { useBackToMenu } from '../../utils/navigation';
import { playClip, stopClip } from '../../utils/sound';
import { firstLetterOf } from '../../utils/helpers';
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

const MAX_LEVEL = 6;

// Square drawing area, clamped so it never outgrows a small phone or
// dominates a tablet.
const MIN_CANVAS_SIZE = 220;
const MAX_CANVAS_SIZE = 320;

// How far in from each edge of the canvas the ghost letter's "target area"
// sits. A traced attempt is checked against this box, not the glyph itself -
// the app has no way to read the actual outline the OS font renderer draws.
const CANVAS_INSET_RATIO = 0.18;

// A trace counts as reaching the letter once its bounding box's diagonal
// spans at least this fraction of the target area's diagonal. Checked on
// the diagonal rather than width and height independently, so a narrow
// letter traced mostly top-to-bottom (like "I") isn't failed for having
// little horizontal spread - this checks "did a preschooler drag a finger
// across roughly the right space", not stroke accuracy.
const MIN_COVERAGE_RATIO = 0.55;
// How far outside the target box the traced shape's center may drift and
// still count - catches a scribble that covers enough area but sits in a
// corner rather than over the letter.
const CENTER_DRIFT_RATIO = 0.12;
// Minimum total finger travel, relative to the target box's own size rather
// than the full canvas, so a single tap or a tiny jiggle can never pass
// while a straight top-to-bottom trace of a narrow letter still can.
const MIN_PATH_LENGTH_RATIO = 0.5;
const MIN_POINTS = 6;

// A lifted finger ends the current stroke; this is how long to wait before
// grading the attempt, so a child can draw a multi-stroke letter (like "A")
// across a few separate strokes without it grading after the first one.
const EVALUATE_DELAY_MS = 700;

export default function TraceLetterGame({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
  onNextGame,
  ambientEnabled,
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const canvasSize = Math.min(
    MAX_CANVAS_SIZE,
    Math.max(MIN_CANVAS_SIZE, windowWidth - 64)
  );
  const guideFontSize = canvasSize * 0.72;
  const [fontsLoaded] = useFonts({ Bangers_400Regular });

  const { trace, updateTrace, resetTrace, markAnimalMet } = useGameProgress();
  const { level, showComplete } = trace;

  const [isCorrect, setIsCorrect] = useState(false);
  const [showWrongOverlay, setShowWrongOverlay] = useState(false);
  const [points, setPoints] = useState([]);
  const [confettiKey, setConfettiKey] = useState(0);
  const [feedbackAnim] = useState(new Animated.Value(0));
  const [promptPulse] = useState(new Animated.Value(0));

  const pointsRef = useRef([]);
  const promptPlayer = useAudioPlayer(null);
  const wrongPlayer = useAudioPlayer(null);
  const gameWinPlayer = useAudioPlayer(null);
  const gameSuccessPlayer = useAudioPlayer(null);

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

  const clearCanvas = useCallback(() => {
    pointsRef.current = [];
    setPoints([]);
  }, []);

  const pickRound = useCallback(() => {
    // Every animal gets a turn as the target before any repeats, so a child
    // never gets asked about the same one twice in one match.
    const unused = animalList.filter(
      a => !trace.usedTargetIds.includes(a.id)
    );
    const pool = unused.length > 0 ? unused : animalList;
    const nextTarget = pool[Math.floor(Math.random() * pool.length)];
    updateTrace(prev => ({
      targetId: nextTarget.id,
      usedTargetIds: [...prev.usedTargetIds, nextTarget.id],
    }));
    setIsCorrect(false);
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
    playClip(promptPlayer, voice);
  }, [targetAnimal, currentLanguage, stopAndUnload, promptPlayer]);

  useEffect(() => {
    if (targetAnimal) {
      playPrompt();
    }
  }, [targetAnimal, currentLanguage, playPrompt]);

  const handleCorrect = useCallback(() => {
    successFeedback();
    setIsCorrect(true);
    markAnimalMet(targetAnimal.id);
    track(EVENTS.LEVEL_COMPLETED, {
      game: 'trace',
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
    later,
    updateTrace,
    markAnimalMet,
  ]);

  const handleIncorrect = useCallback(() => {
    // A rough attempt is a normal part of learning to write, so nothing ends
    // here. The child gets a gentle noise, the name again to compare
    // against, and a clear canvas to try again.
    errorFeedback();
    setShowWrongOverlay(true);
    later(() => setShowWrongOverlay(false), 900);
    later(() => clearCanvas(), 900);
    playClip(wrongPlayer, wrongSoundFile);
    later(() => playPrompt(), 700);
  }, [later, clearCanvas, wrongPlayer, wrongSoundFile, playPrompt]);

  const evaluateAttempt = useCallback(() => {
    if (showComplete || isCorrect || !targetAnimal) return;

    const pts = pointsRef.current;
    const inset = canvasSize * CANVAS_INSET_RATIO;
    const targetBox = {
      left: inset,
      right: canvasSize - inset,
      top: inset,
      bottom: canvasSize - inset,
      width: canvasSize - inset * 2,
      height: canvasSize - inset * 2,
    };

    if (pts.length < MIN_POINTS) {
      handleIncorrect();
      return;
    }

    let minX = pts[0].x;
    let maxX = pts[0].x;
    let minY = pts[0].y;
    let maxY = pts[0].y;
    let length = 0;

    pts.forEach((p, i) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      if (i > 0 && !p.move) {
        const prev = pts[i - 1];
        length += Math.hypot(p.x - prev.x, p.y - prev.y);
      }
    });

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const driftMargin = canvasSize * CENTER_DRIFT_RATIO;

    const targetDiagonal = Math.hypot(targetBox.width, targetBox.height);
    const traceDiagonal = Math.hypot(spanX, spanY);
    const coversEnough = traceDiagonal >= targetDiagonal * MIN_COVERAGE_RATIO;
    const centered =
      centerX >= targetBox.left - driftMargin &&
      centerX <= targetBox.right + driftMargin &&
      centerY >= targetBox.top - driftMargin &&
      centerY <= targetBox.bottom + driftMargin;
    const longEnough = length >= targetBox.height * MIN_PATH_LENGTH_RATIO;

    if (coversEnough && centered && longEnough) {
      handleCorrect();
    } else {
      handleIncorrect();
    }
  }, [showComplete, isCorrect, targetAnimal, canvasSize, handleCorrect, handleIncorrect]);

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

  const handleBackToMenu = useCallback(() => {
    tapFeedback();
    if (!showComplete) {
      track(EVENTS.GAME_ABANDONED, { game: 'trace', level });
    }
    onBackToMenu();
  }, [onBackToMenu, showComplete, level]);

  useBackToMenu(handleBackToMenu);

  const handleNextGame = useCallback(() => {
    tapFeedback();
    if (!showComplete) {
      track(EVENTS.GAME_ABANDONED, { game: 'trace', level });
    }
    onNextGame();
  }, [onNextGame, showComplete, level]);

  const handlePlayPrompt = useCallback(() => {
    tapFeedback();
    playPrompt();
  }, [playPrompt]);

  if (!fontsLoaded) return null;
  const promptScale = promptPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const pathD = points.reduce(
    (acc, p, i) =>
      acc + (p.move || i === 0 ? `M ${p.x} ${p.y} ` : `L ${p.x} ${p.y} `),
    ''
  );

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
              {t(currentLanguage, 'traceInstruction')}
            </Text>
          )}
        </View>

        {/* Drawing canvas */}
        <View style={styles.canvasWrapper}>
          <View
            style={[
              styles.canvas,
              { width: canvasSize, height: canvasSize },
            ]}
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
              {!!correctLetter && (
                <SvgText
                  x={canvasSize / 2}
                  y={canvasSize / 2 + guideFontSize * 0.35}
                  fontSize={guideFontSize}
                  fontWeight="bold"
                  textAnchor="middle"
                  fill="none"
                  stroke="#FFD700"
                  strokeWidth={4}
                  strokeDasharray="12,16"
                  strokeLinecap="round"
                >
                  {correctLetter}
                </SvgText>
              )}
              {!!pathD && (
                <Path
                  d={pathD}
                  stroke="#0A3D62"
                  strokeWidth={16}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              )}
            </Svg>
          </View>
          <BouncyButton
            onPress={handleClear}
            style={styles.clearButton}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t(currentLanguage, 'a11yClearDrawing')}
          >
            <Text style={styles.clearButtonText}>
              {t(currentLanguage, 'clearDrawing')}
            </Text>
          </BouncyButton>
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
              onPress={handleNextGame}
              style={styles.secondaryButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yNextGame')}
            >
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
    // Bangers clips on Android without both of these - see
    // first-letter.game.component.jsx for the full explanation.
    lineHeight: 30,
    includeFontPadding: false,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 3 },
    paddingBottom: 20,
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 20,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  animalContainer: {
    paddingTop: 4,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  animalCard: {
    width: 110,
    height: 110,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  animalAnimation: {
    width: 92,
    height: 92,
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
  canvasWrapper: {
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  canvas: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#FFD700',
    overflow: 'hidden',
  },
  clearButton: {
    marginTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: LARGE_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  clearButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
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
