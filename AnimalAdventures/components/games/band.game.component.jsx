import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FitText } from '../utility/fit-text.component';
import { StyleSheet, View } from 'react-native';
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
import { useBackToMenu } from '../../utils/navigation';
import { playClip, releasePlayer } from '../../utils/sound';
import { EVENTS, track } from '../../utils/analytics';
import { tapFeedback } from '../../utils/haptics';
import { useResponsive } from '../../utils/use-responsive';
import { BouncyButton } from '../utility/bouncy-button.component';
import { GameScreen } from '../utility/game-screen.component';
import { FitGrid } from '../utility/fit-grid.component';
import { AnswerCard } from '../utility/answer-card.component';
import { useInstructionPrompt } from '../../utils/use-instruction-prompt';

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
    },
    [player]
  );

  const handleTap = useCallback(
    animal => {
      if (playing) return;
      tapFeedback();
      sound(animal);
      setSong(prev => [...prev, animal.id].slice(-SONG_LENGTH));
    },
    [playing, sound]
  );

  const handlePlaySong = useCallback(() => {
    if (playing || song.length === 0) return;
    tapFeedback();
    setPlaying(true);
    song.forEach((id, i) => {
      later(() => {
        const animal = BAND.find(a => a.id === id);
        if (animal) {
          setLit(id);
          sound(animal);
        }
      }, i * NOTE_GAP_MS);
    });
    later(() => {
      setLit(null);
      setPlaying(false);
    }, song.length * NOTE_GAP_MS);
  }, [playing, song, later, sound]);

  const handleBackToMenu = useCallback(() => {
    tapFeedback();
    onBackToMenu();
  }, [onBackToMenu]);
  const handleNextGame = useCallback(() => {
    tapFeedback();
    onNextGame();
  }, [onNextGame]);
  useBackToMenu(handleBackToMenu);

  const colors = CATEGORY_COLORS.create;
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
              i < song.length && { backgroundColor: colors.ring },
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
      instruction={t(currentLanguage, 'bandHelperText')}
      onReplayInstruction={replayInstruction}
      prompt={prompt}
      promptPaneRatio={0.3}
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
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: PALETTE.creamDeep,
    borderWidth: 2,
    borderColor: PALETTE.white,
  },
});
