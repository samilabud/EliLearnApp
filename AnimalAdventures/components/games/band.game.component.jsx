import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FitText } from '../utility/fit-text.component';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { animalList, iconScaleStyle } from '../animals/animal.list';
import { t } from '../../constants';
import { CARD_SHADOW, FONTS, PALETTE, RADIUS } from '../../constants/theme';
import { useBackToMenu } from '../../utils/navigation';
import { playClip, releasePlayer } from '../../utils/sound';
import { EVENTS, track } from '../../utils/analytics';
import { tapFeedback } from '../../utils/haptics';
import { useResponsive } from '../../utils/use-responsive';
import { useReduceMotion } from '../../utils/use-reduce-motion';
import { BouncyButton } from '../utility/bouncy-button.component';
import { GameScreen } from '../utility/game-screen.component';
import { FitGrid } from '../utility/fit-grid.component';
import { AnswerCard } from '../utility/answer-card.component';
import { useInstructionPrompt } from '../../utils/use-instruction-prompt';
import { useGameProgress } from '../../contexts/game-progress.context';
import { useCreativeStar } from '../../utils/use-creative-star';
import { StarToast } from '../utility/feedback-overlays.component';

/** The band: animals with a clear, short sound that sit well together. */
const BAND_IDS = [
  'dog-tail-wag',
  'fitness-cow',
  'sheep',
  'chicken',
  'duck',
  'horse',
  'elephant',
  'frog',
];
const BAND = BAND_IDS.map(id => animalList.find(a => a.id === id)).filter(
  Boolean
);

/** The song remembers the last few notes - enough for a tune, never a chore. */
const SONG_LENGTH = 8;
/** Space between notes when the song plays back. */
const NOTE_GAP_MS = 850;

/**
 * One bright color per band member. A tap floats a note in the animal's
 * color and adds a dot of the same color to the song strip, so a child can
 * see which animal made which note.
 */
const NOTE_COLORS = [
  '#FF6B6B',
  '#4D96FF',
  '#6BCB77',
  '#FFB703',
  '#C77DFF',
  '#FF8C42',
  '#2EC4B6',
  '#F72585',
];
const colorFor = id => NOTE_COLORS[BAND_IDS.indexOf(id) % NOTE_COLORS.length];

/** A music note that floats up from a card each time its animal sounds. */
function NoteBurst({ trigger, color }) {
  const [rise] = useState(() => new Animated.Value(0));
  const reduceMotion = useReduceMotion();
  const last = useRef(trigger);
  useEffect(() => {
    if (!trigger || trigger === last.current) return;
    last.current = trigger;
    // Reduced motion: the animal's own movement and sound are enough.
    if (reduceMotion) return;
    rise.setValue(0);
    Animated.timing(rise, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [trigger, reduceMotion, rise]);
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no"
      style={[
        styles.note,
        {
          opacity: rise.interpolate({
            inputRange: [0, 0.15, 0.8, 1],
            outputRange: [0, 1, 1, 0],
          }),
          transform: [
            {
              translateY: rise.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -28],
              }),
            },
            {
              scale: rise.interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: [0.6, 1.25, 1],
              }),
            },
          ],
        },
      ]}
    >
      <MaterialIcons name="music-note" size={34} color={color} />
    </Animated.View>
  );
}

const MIN_CARD_SIZE = 96;
const MAX_CARD_SIZE = 200;

/**
 * Animal Band - tap animals to make music, then hear the tune back.
 *
 * It is free play: nothing to get wrong, no levels, no stars. The last eight
 * taps become "my song", and the Play button replays them one animal at a
 * time, each animal moving as its sound plays.
 */
export default function BandGame({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
  onNextGame,
}) {
  const { scale, touchTarget } = useResponsive();
  const { markAnimalMet } = useGameProgress();
  const [playedSong, setPlayedSong] = useState(false);
  const starToast = useCreativeStar('band', playedSong);
  const { replay: replayInstruction } = useInstructionPrompt(
    'band',
    currentLanguage
  );
  const player = useAudioPlayer(null);
  const lotties = useRef({});
  const timers = useRef([]);

  const [song, setSong] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [lit, setLit] = useState(null);
  const [litIndex, setLitIndex] = useState(-1);
  // Per-animal tap counters: each change floats one note off that card.
  const [taps, setTaps] = useState({});

  useEffect(() => {
    track(EVENTS.GAME_STARTED, { game: 'band', level: 0 });
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      releasePlayer(player);
    };
  }, [player]);

  const later = useCallback((fn, ms) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const sound = useCallback(
    animal => {
      lotties.current[animal.id]?.reset?.();
      lotties.current[animal.id]?.play?.();
      playClip(player, animal.sound);
      setTaps(prev => ({ ...prev, [animal.id]: (prev[animal.id] || 0) + 1 }));
    },
    [player]
  );

  const handleTap = useCallback(
    animal => {
      if (playing) return;
      tapFeedback();
      sound(animal);
      // Playing with an animal is meeting it, so the band feeds the Album
      // like every other mode.
      markAnimalMet(animal.id, 'band');
      setSong(prev => [...prev, animal.id].slice(-SONG_LENGTH));
    },
    [playing, sound, markAnimalMet]
  );

  const handlePlaySong = useCallback(() => {
    if (playing || song.length === 0) return;
    tapFeedback();
    setPlaying(true);
    setPlayedSong(true);
    song.forEach((id, i) => {
      later(() => {
        const animal = BAND.find(a => a.id === id);
        if (animal) {
          setLit(id);
          setLitIndex(i);
          sound(animal);
        }
      }, i * NOTE_GAP_MS);
    });
    later(() => {
      setLit(null);
      setLitIndex(-1);
      setPlaying(false);
    }, song.length * NOTE_GAP_MS);
  }, [playing, song, later, sound]);

  // Start over: stops a song in progress and empties the strip.
  const handleReset = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlaying(false);
    setLit(null);
    setLitIndex(-1);
    setSong([]);
  }, []);

  const handleBackToMenu = useCallback(() => {
    tapFeedback();
    onBackToMenu();
  }, [onBackToMenu]);
  const handleNextGame = useCallback(() => {
    tapFeedback();
    onNextGame();
  }, [onNextGame]);
  useBackToMenu(handleBackToMenu);

  const prompt = (
    <View style={styles.promptColumn}>
      <BouncyButton
        onPress={handlePlaySong}
        disabled={song.length === 0 || playing}
        style={[
          styles.playButton,
          {
            minHeight: touchTarget,
            paddingHorizontal: 24 * scale,
            opacity: song.length === 0 || playing ? 0.55 : 1,
          },
        ]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t(currentLanguage, 'a11yBandPlay')}
      >
        <View style={styles.playButtonBackground} />
        <MaterialIcons
          name="play-arrow"
          size={36 * scale}
          color={PALETTE.ink}
        />
        <FitText
          style={[
            styles.playText,
            { fontSize: 26 * scale, lineHeight: 34 * scale },
          ]}
          maxLines={1}
          minScale={0.6}
        >
          {t(currentLanguage, 'bandPlaySong')}
        </FitText>
      </BouncyButton>
      {/* One dot per note in the song so far - the tune made visible. */}
      <View style={styles.dots} importantForAccessibility="no">
        {Array.from({ length: SONG_LENGTH }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < song.length && {
                backgroundColor: colorFor(song[i]),
                borderColor: colorFor(song[i]),
              },
              i === litIndex && styles.dotLit,
            ]}
          />
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
      resetLabelKey="a11yClearSong"
      resetConfirmLabelKey="a11yClearSongConfirm"
      resetVisibleLabelKey="clearShort"
      instruction={t(currentLanguage, 'bandHelperText')}
      onReplayInstruction={replayInstruction}
      prompt={prompt}
      promptPaneRatio={0.3}
      overlay={
        <StarToast visible={starToast} currentLanguage={currentLanguage} />
      }
    >
      <FitGrid
        items={BAND}
        keyExtractor={animal => animal.id}
        minSize={MIN_CARD_SIZE}
        maxSize={MAX_CARD_SIZE * scale}
        renderItem={(animal, size) => (
          <AnswerCard
            category="create"
            hinted={lit === animal.id}
            onPress={() => handleTap(animal)}
            accessibilityLabel={t(currentLanguage, 'a11yBandAnimal', {
              animal:
                currentLanguage === 'en' ? animal.name : animal.spanish_name,
            })}
          >
            <LottieView
              autoPlay={false}
              loop={false}
              ref={el => (lotties.current[animal.id] = el)}
              resizeMode="contain"
              source={animal.animation_path}
              style={[
                { width: size * 0.8, height: size * 0.8 },
                iconScaleStyle(animal),
              ]}
            />
            <NoteBurst trigger={taps[animal.id]} color={colorFor(animal.id)} />
          </AnswerCard>
        )}
      />
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  promptColumn: {
    alignItems: 'center',
    gap: 14,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  playButtonBackground: {
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
  playText: {
    fontFamily: FONTS.title,
    includeFontPadding: false,
    textAlign: 'center',
    color: PALETTE.ink,
    letterSpacing: 1,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  note: {
    position: 'absolute',
    top: 8,
    right: 10,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: PALETTE.creamDeep,
    borderWidth: 2,
    borderColor: PALETTE.white,
  },
  dotLit: {
    transform: [{ scale: 1.5 }],
  },
});
