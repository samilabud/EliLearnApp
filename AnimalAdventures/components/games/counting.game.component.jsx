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
  View,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import ConfettiCannon from 'react-native-confetti-cannon';
import { AmbientBackground } from '../utility/ambient-background.component';
import { animalList } from '../animals/animal.list';
import { t } from '../../constants';
import { useGameProgress } from '../../contexts/game-progress.context';
import { useBackToMenu } from '../../utils/navigation';
import { playClip, releasePlayer } from '../../utils/sound';
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
const COUNT_ICON_SIZE = 56;

// After this many wrong tries the right answer starts to glow - same
// threshold/spirit as guess-animal.game.component.jsx.
const HINT_AFTER_TRIES = 3;

export default function CountingGame({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
  onNextGame,
  ambientEnabled,
}) {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Bangers_400Regular });
  const { counting, updateCounting, resetCounting, markAnimalMet, markLevelStarred } =
    useGameProgress();
  const { level, targetCount, optionCounts, wrongCount, showComplete } = counting;

  const [isCorrect, setIsCorrect] = useState(false);
  const [showWrongOverlay, setShowWrongOverlay] = useState(false);
  const [feedbackAnim] = useState(new Animated.Value(0));
  const [confettiKey, setConfettiKey] = useState(0);

  const soundPlayer = useAudioPlayer(null);
  const voicePlayer = useAudioPlayer(null);
  const wrongPlayer = useAudioPlayer(null);
  const gameWinPlayer = useAudioPlayer(null);
  const gameSuccessPlayer = useAudioPlayer(null);
  const voiceTimer = useRef(null);

  const backgroundImage = require('../../assets/backgrounds/pawel-czerwinski-4gWNAWeOvP0-unsplash.jpg');
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
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
    };
  }, [soundPlayer, voicePlayer, wrongPlayer, gameWinPlayer, gameSuccessPlayer]);

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
    // Grows from 1-3 at level 1 to 1-8 by level 6 - capped at 8 so the
    // on-screen group never gets too crowded to count on a phone.
    const maxCount = Math.min(2 + level, 8);
    const nextCount = 1 + Math.floor(Math.random() * maxCount);
    const distractorPool = [];
    for (let n = 1; n <= Math.max(maxCount, nextCount + 1); n++) {
      if (n !== nextCount) distractorPool.push(n);
    }
    const distractors = shuffle(distractorPool).slice(0, 2);
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
  }, [level, shuffle, updateCounting, counting.usedTargetIds]);

  // A round is dealt only when the saved one doesn't have 3 options, which
  // covers a first run, a level change and a reset - mirrors guess-animal's
  // identical "deal only if the saved round doesn't fit" effect, so
  // resuming or rotating the device resumes the same question.
  useEffect(() => {
    if (optionCounts.length !== 3) {
      pickRound();
    }
  }, [optionCounts.length, pickRound]);

  const playAnimalSound = useCallback(
    animal => {
      if (!animal.sound) return;
      tapFeedback();
      playClip(soundPlayer, animal.sound);
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
      voiceTimer.current = setTimeout(() => {
        playClip(
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
            track(EVENTS.GAME_COMPLETED, { game: 'counting', level: prev.level });
            return { showComplete: true };
          });
        }, 2500);
      } else {
        // A wrong pick is a normal part of learning, so nothing ends here -
        // same "gentle noise, help kicks in after a few tries" approach as
        // every other quiz mode.
        errorFeedback();
        setShowWrongOverlay(true);
        later(() => setShowWrongOverlay(false), 900);
        playClip(wrongPlayer, wrongSoundFile);
        updateCounting(prev => ({ wrongCount: prev.wrongCount + 1 }));
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

  if (!fontsLoaded) return null;

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
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <Text
            style={[styles.levelText, { fontFamily: 'Bangers_400Regular' }]}
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

        <View style={styles.promptContainer}>
          <Text style={[styles.promptText, { fontFamily: 'Bangers_400Regular' }]}>
            {t(currentLanguage, 'howManyDoYouSee')}
          </Text>
        </View>

        {!!targetAnimal && (
          <View
            style={styles.countArea}
            accessible={true}
            accessibilityLabel={t(currentLanguage, 'a11yCountingAnimal', {
              animal:
                currentLanguage === 'en'
                  ? targetAnimal.name
                  : targetAnimal.spanish_name,
            })}
          >
            {Array.from({ length: targetCount || 0 }).map((_, i) => (
              <BouncyButton
                key={i}
                style={styles.countIconWrapper}
                onPress={() => playAnimalSound(targetAnimal)}
                accessible={false}
              >
                <LottieView
                  autoPlay
                  loop
                  resizeMode="contain"
                  source={targetAnimal.animation_path}
                  style={{ width: COUNT_ICON_SIZE, height: COUNT_ICON_SIZE }}
                />
              </BouncyButton>
            ))}
          </View>
        )}

        <View style={styles.optionsContainer}>
          {optionCounts.map(count => {
            const isHinted = wrongCount >= HINT_AFTER_TRIES && count === targetCount;
            return (
              <BouncyButton
                key={count}
                style={styles.optionCard}
                onPress={() => onSelect(count)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t(currentLanguage, 'a11yCountOption', {
                  count,
                })}
              >
                <View
                  style={[
                    styles.optionCardBackground,
                    isHinted && styles.optionCardBackgroundHinted,
                  ]}
                />
                <Text
                  style={[
                    styles.optionDigit,
                    { fontFamily: 'Bangers_400Regular' },
                  ]}
                >
                  {count}
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

      {isCorrect && (
        <Animated.View
          pointerEvents="none"
          style={[styles.feedbackOverlay, { opacity: feedbackAnim }]}
        >
          <Text style={[styles.feedbackText, { fontFamily: 'Bangers_400Regular' }]}>
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

      {showWrongOverlay && (
        <View pointerEvents="none" style={styles.feedbackOverlay}>
          <Text style={[styles.tryAgainText, { fontFamily: 'Bangers_400Regular' }]}>
            {t(currentLanguage, 'tryOnceMore')}
          </Text>
        </View>
      )}

      {showComplete && (
        <View style={styles.completionOverlay}>
          <Text style={[styles.completionTitle, { fontFamily: 'Bangers_400Regular' }]}>
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
    flexShrink: 1,
    lineHeight: 30,
    includeFontPadding: false,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 3 },
    paddingBottom: 34,
  },
  topActions: {
    flexDirection: 'row',
    gap: 16,
    paddingBottom: 34,
  },
  promptContainer: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  promptText: {
    fontSize: 26,
    lineHeight: 34,
    includeFontPadding: false,
    color: 'white',
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 3 },
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  countArea: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  countIconWrapper: {
    width: COUNT_ICON_SIZE,
    height: COUNT_ICON_SIZE,
  },
  optionsContainer: {
    flexGrow: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 20,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  // Plain layout only - no background/border here. Those live on a
  // separate absolutely-positioned sibling (optionCardBackground) instead,
  // same reasoning as promptButton/promptButtonBackground above: a rounded
  // border+fill applied directly to the view BouncyButton animates produces
  // a visible rendering glitch at one corner on Android (the transform's
  // hardware layer and the border radius don't composite cleanly together).
  optionCard: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCardBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  optionCardBackgroundHinted: {
    borderWidth: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
  },
  optionDigit: {
    fontSize: 48,
    lineHeight: 56,
    includeFontPadding: false,
    color: '#0A3D62',
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
