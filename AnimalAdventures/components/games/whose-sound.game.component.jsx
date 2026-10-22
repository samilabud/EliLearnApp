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
import { animalList } from '../animals/animal.list';
import ConfettiCannon from 'react-native-confetti-cannon';
import { t, LARGE_TOUCH_TARGET } from '../../constants';
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
import { LanguageToggleButton } from '../utility/language-toggle-button.component';
import { NextGameButton } from '../utility/next-game-button.component';
import {
  BackToMenuButton,
  BACK_TO_MENU_CLEARANCE,
} from '../utility/back-to-menu-button.component';
import { ConfirmResetButton } from '../utility/confirm-reset-button.component';

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
  ambientEnabled,
}) {
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
  const {
    whoseSound,
    updateWhoseSound,
    resetWhoseSound,
    markAnimalMet,
    markLevelStarred,
  } = useGameProgress();
  const { level, wrongCount, showComplete } = whoseSound;

  const [isCorrect, setIsCorrect] = useState(false);
  const promptPlayer = useAudioPlayer(null);
  const [feedbackAnim] = useState(new Animated.Value(0));
  const [promptPulse] = useState(new Animated.Value(0));
  const [showWrongOverlay, setShowWrongOverlay] = useState(false);
  const wrongPlayer = useAudioPlayer(null);
  const gameWinPlayer = useAudioPlayer(null);
  const gameSuccessPlayer = useAudioPlayer(null);
  const rewardSfxPlayer = useAudioPlayer(null);
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
    if (!targetAnimal) return;
    if (!hasPlayedFirstRef.current) {
      hasPlayedFirstRef.current = true;
      later(() => playPrompt(), FIRST_ROUND_DELAY_MS);
    } else {
      playPrompt();
    }
  }, [targetAnimal, playPrompt, later]);

  const onSelect = useCallback(
    async selected => {
      if (showComplete || isCorrect) return;
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
        playClip(
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

        {/* Prompt */}
        <View style={styles.promptContainer}>
          <Animated.View
            renderToHardwareTextureAndroid
            style={{ transform: [{ scale: promptScale }] }}
          >
            <BouncyButton
              onPress={handlePlayPrompt}
              style={styles.promptButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yPlaySound')}
            >
              {/* A rounded View with a background clips its children on
                  Android regardless of `overflow`, cropping a 2nd line if
                  this ever wraps. Keeping the rounded fill as an absolutely
                  positioned sibling behind the Text avoids that. */}
              <View style={styles.promptButtonBackground} />
              <Text
                style={[
                  styles.promptText,
                  { fontFamily: 'Bangers_400Regular' },
                ]}
              >
                {t(currentLanguage, 'playSound')}
              </Text>
            </BouncyButton>
          </Animated.View>
          {!!targetAnimal && (
            <Text style={styles.helperText}>
              {t(currentLanguage, 'whoseSoundHelperText')}
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
              <BouncyButton
                key={opt.id}
                style={[
                  styles.optionCard,
                  { width: optionSize },
                  isHinted && styles.optionCardHinted,
                ]}
                onPress={() => onSelect(opt)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t(currentLanguage, 'a11yWhoseSoundOption', {
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
    flexShrink: 1,
    // Bangers clips on Android without both of these - see promptText below.
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
  promptContainer: {
    paddingTop: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  promptButton: {
    // Plain on purpose - the filled rounded look lives in
    // promptButtonBackground instead. See the comment at its usage above.
    justifyContent: 'center',
    minHeight: LARGE_TOUCH_TARGET,
    paddingHorizontal: 36,
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
    // Bangers clips on Android without both of these: a generous lineHeight
    // alone is not enough, because Android's own font-padding guess for
    // this font is also wrong. includeFontPadding:false hands sizing fully
    // to our own lineHeight instead of fighting it.
    lineHeight: 32,
    includeFontPadding: false,
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
    lineHeight: 58,
    includeFontPadding: false,
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
