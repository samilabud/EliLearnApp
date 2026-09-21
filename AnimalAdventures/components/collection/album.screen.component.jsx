import React, { useCallback, useMemo, useRef } from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import { AmbientBackground } from '../utility/ambient-background.component';
import { animalList } from '../animals/animal.list';
import { t, MIN_TOUCH_TARGET } from '../../constants';
import { tapFeedback } from '../../utils/haptics';
import { playClip, releasePlayer } from '../../utils/sound';
import { useGameProgress } from '../../contexts/game-progress.context';

const GRID_PADDING_H = 12;
const CARD_MARGIN_TOP = 20;
const PORTRAIT_COLUMNS = 3;
const LANDSCAPE_COLUMNS = 6;
const MIN_CARD_WIDTH = 104;
const CARD_HEIGHT = 128;
const BOX_HEIGHT = 96;

/**
 * Every animal in the app, shown as met or not yet met.
 *
 * Nothing here is locked and nothing is ever taken away - the board only
 * fills up. That is the whole mechanic: a set a child can complete, using
 * artwork the app already ships rather than new assets.
 */
export default function AlbumScreen({ currentLanguage, onBackToMenu }) {
  const [fontsLoaded] = useFonts({ Bangers_400Regular });
  const { met } = useGameProgress();
  const animPlayer = useAudioPlayer(null);
  const voicePlayer = useAudioPlayer(null);
  const animRefs = useRef({});
  const insets = useSafeAreaInsets();

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const columns =
    windowWidth > windowHeight ? LANDSCAPE_COLUMNS : PORTRAIT_COLUMNS;
  const cardWidth = Math.max(
    MIN_CARD_WIDTH,
    Math.floor((windowWidth - GRID_PADDING_H * 2) / columns) - GRID_PADDING_H
  );

  const metSet = useMemo(() => new Set(met), [met]);

  React.useEffect(() => {
    return () => {
      releasePlayer(animPlayer);
      releasePlayer(voicePlayer);
    };
  }, [animPlayer, voicePlayer]);

  const handlePress = useCallback(
    animal => {
      if (!metSet.has(animal.id)) return;
      tapFeedback();
      const ref = animRefs.current[animal.id];
      if (ref && ref.play) {
        try {
          ref.reset();
          ref.play();
        } catch {
          // Animation handle went away with a re-render.
        }
      }
      playClip(animPlayer, animal.sound);
      playClip(
        voicePlayer,
        currentLanguage === 'en' ? animal.voice : animal.spanish_voice
      );
    },
    [metSet, animPlayer, voicePlayer, currentLanguage]
  );

  if (!fontsLoaded) return null;

  return (
    <ImageBackground
      source={require('../../assets/backgrounds/pawel-czerwinski-4gWNAWeOvP0-unsplash.jpg')}
      resizeMode="cover"
      style={styles.backgroundImage}
    >
      <AmbientBackground />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerCount}>
          {t(currentLanguage, 'albumProgress', {
            met: metSet.size,
            total: animalList.length,
          })}
        </Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            tapFeedback();
            onBackToMenu();
          }}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t(currentLanguage, 'a11yMainMenuButton')}
        >
          <Text style={styles.actionText}>
            {t(currentLanguage, 'mainMenu')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
      >
          {metSet.size === 0 && (
            <Text style={[styles.hint, { fontFamily: 'Bangers_400Regular' }]}>
              {t(currentLanguage, 'albumHintEmpty')}
            </Text>
          )}

          <View style={styles.grid}>
            {animalList.map(animal => {
              const isMet = metSet.has(animal.id);
              const name =
                currentLanguage === 'en' ? animal.name : animal.spanish_name;

              return (
                <TouchableOpacity
                  key={animal.id}
                  style={[styles.card, { width: cardWidth }]}
                  onPress={() => handlePress(animal)}
                  disabled={!isMet}
                  accessible
                  accessibilityRole={isMet ? 'button' : 'image'}
                  accessibilityLabel={
                    isMet
                      ? t(currentLanguage, 'a11yAlbumAnimal', { animal: name })
                      : t(currentLanguage, 'a11yAlbumLocked')
                  }
                >
                  <View
                    style={[
                      styles.box,
                      isMet ? styles.boxMet : styles.boxLocked,
                    ]}
                  >
                    {isMet ? (
                      <LottieView
                        autoPlay={false}
                        loop={false}
                        autoSize={false}
                        ref={el => (animRefs.current[animal.id] = el)}
                        resizeMode="contain"
                        source={animal.animation_path}
                        style={styles.animation}
                      />
                    ) : (
                      <Text style={styles.lockedMark}>?</Text>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.label,
                      isMet ? styles.labelMet : styles.labelLocked,
                    ]}
                    numberOfLines={1}
                  >
                    {isMet ? name : t(currentLanguage, 'notMetYet')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  actionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  headerCount: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    flexShrink: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#BD0000',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 60,
    paddingHorizontal: GRID_PADDING_H,
  },
  hint: {
    color: 'white',
    fontSize: 20,
    textAlign: 'center',
    marginTop: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 2 },
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
  },
  card: {
    height: CARD_HEIGHT,
    marginTop: CARD_MARGIN_TOP,
    alignItems: 'center',
  },
  // Met and unmet cards share one geometry. They used to differ - the locked
  // box was pinned with top: 0 while the met box had no inset and fell back
  // to its static position - which stacked the two states at different
  // heights and made every row look ragged.
  box: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BOX_HEIGHT,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  boxMet: {
    backgroundColor: '#ffffff',
    borderColor: '#FFD700',
  },
  boxLocked: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  animation: {
    width: BOX_HEIGHT - 14,
    height: BOX_HEIGHT - 14,
  },
  lockedMark: {
    fontSize: 34,
    fontWeight: 'bold',
    color: 'rgba(10, 61, 98, 0.45)',
  },
  label: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  labelMet: {
    fontFamily: 'Bangers_400Regular',
    fontSize: 18,
    letterSpacing: 1,
    color: '#0A3D62',
    textShadowColor: 'rgba(255, 255, 255, 0.85)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  labelLocked: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
});
