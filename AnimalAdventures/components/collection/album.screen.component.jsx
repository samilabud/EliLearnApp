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
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
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
        } catch (e) {
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            tapFeedback();
            onBackToMenu();
          }}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t(currentLanguage, 'a11yBackButton')}
        >
          <MaterialIcons name="arrow-back" size={28} color="white" />
          <Text style={styles.backButtonText}>
            {t(currentLanguage, 'back')}
          </Text>
        </TouchableOpacity>

        <Text style={styles.headerCount}>
          {t(currentLanguage, 'albumProgress', {
            met: metSet.size,
            total: animalList.length,
          })}
        </Text>
      </View>

      <ImageBackground
        source={require('../../assets/backgrounds/pawel-czerwinski-4gWNAWeOvP0-unsplash.jpg')}
        resizeMode="cover"
        style={styles.backgroundImage}
      >
        <AmbientBackground />
        <ScrollView contentContainerStyle={styles.scrollContent}>
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
                  {isMet ? (
                    <>
                      <LottieView
                        autoPlay={false}
                        loop={false}
                        autoSize={false}
                        ref={el => (animRefs.current[animal.id] = el)}
                        resizeMode="contain"
                        source={animal.animation_path}
                        style={styles.animation}
                      />
                      <View style={styles.cardBackground} />
                      <Text style={styles.cardName}>{name}</Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.lockedBackground}>
                        <Text style={styles.lockedMark}>?</Text>
                      </View>
                      <Text style={styles.lockedName}>
                        {t(currentLanguage, 'notMetYet')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#BD0000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  backButtonText: {
    marginLeft: 8,
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerCount: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    flexShrink: 1,
    textAlign: 'right',
  },
  backgroundImage: {
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
    height: 132,
    marginTop: CARD_MARGIN_TOP,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  cardBackground: {
    backgroundColor: '#ffffff',
    height: 85,
    width: '100%',
    borderRadius: 18,
    zIndex: 1,
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  animation: {
    zIndex: 2,
    width: 90,
    height: 90,
  },
  cardName: {
    fontFamily: 'Bangers_400Regular',
    fontSize: 18,
    position: 'absolute',
    bottom: 0,
    zIndex: 3,
    letterSpacing: 1,
    color: '#0A3D62',
    textShadowColor: 'rgba(0, 34, 68, 0.55)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 4 },
  },
  lockedBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    height: 85,
    width: '100%',
    borderRadius: 18,
    position: 'absolute',
    top: 0,
    borderWidth: 3,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedMark: {
    fontSize: 34,
    fontWeight: 'bold',
    color: 'rgba(10, 61, 98, 0.45)',
  },
  lockedName: {
    fontSize: 14,
    position: 'absolute',
    bottom: 0,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
});
