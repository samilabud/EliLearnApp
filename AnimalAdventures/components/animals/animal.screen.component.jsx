import React, { useRef, useState, Fragment, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import { animalList } from './animal.list';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import { t } from '../../constants';
import { tapFeedback } from '../../utils/haptics';
import { EVENTS, track } from '../../utils/analytics';
import { playClip, releasePlayer } from '../../utils/sound';
import { useGameProgress } from '../../contexts/game-progress.context';

const GRID_PADDING_H = 12;
const CARD_MARGIN_TOP = 24;
const PORTRAIT_COLUMNS = 3;
const LANDSCAPE_COLUMNS = 6;
// The artwork inside a card is a fixed 90dp square, so cards must never be
// narrower than that plus breathing room.
const MIN_CARD_WIDTH = 104;

const AnimalScreen = ({ currentLanguage }) => {
  const soundPlayer = useAudioPlayer(null);
  const voicePlayer = useAudioPlayer(null);
  const { markAnimalMet } = useGameProgress();
  const [currentAnimation, setCurrentAnimation] = useState();

  // Cards used to be a flat 26% of the container width. With the portrait lock
  // removed that became a ~620dp-wide white slab around 90dp of artwork in
  // landscape, so the width is now derived from the window instead. The
  // vertical design is deliberately untouched.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const columns =
    windowWidth > windowHeight ? LANDSCAPE_COLUMNS : PORTRAIT_COLUMNS;
  const cardWidth = Math.max(
    MIN_CARD_WIDTH,
    Math.floor((windowWidth - GRID_PADDING_H * 2) / columns) - GRID_PADDING_H
  );

  const animRef = useRef([]);

  const [fontsLoaded] = useFonts({
    Bangers_400Regular,
  });

  const resetAndPlayAnim = (playCurrent, soundUrl, voiceUrl, animalId) => {
    tapFeedback();
    track(EVENTS.ANIMAL_VIEWED, { animal: animalId });
    // Hearing an animal counts as meeting it, so Learn fills the album too.
    markAnimalMet(animalId);
    if (currentAnimation && typeof currentAnimation.reset === 'function') {
      try {
        currentAnimation.reset();
      } catch (e) {
        // no-op
      }
    }
    setCurrentAnimation(playCurrent);
    playSound(soundUrl, voiceUrl);
    delay(200).then(() => {
      if (playCurrent && typeof playCurrent.play === 'function') {
        try {
          playCurrent.play();
        } catch (e) {
          // no-op
        }
      }
    });
  };
  function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  }
  function playSound(soundFile, voiceFile) {
    playClip(voicePlayer, voiceFile);
    delay(1000).then(() => playClip(soundPlayer, soundFile));
  }

  useEffect(() => {
    return () => {
      releasePlayer(soundPlayer);
      releasePlayer(voicePlayer);
    };
  }, [soundPlayer, voicePlayer]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={{ paddingTop: 10 }}
    >
      <View style={styles.animationContainer}>
        {animalList.map(animatedImage => (
            <Fragment key={`${animatedImage.name}-animatedImage`}>
              <TouchableOpacity
                style={[styles.button, { width: cardWidth }]}
                onPress={() =>
                  resetAndPlayAnim(
                    animRef.current[animatedImage.name],
                    animatedImage.sound,
                    currentLanguage === 'en'
                      ? animatedImage.voice
                      : animatedImage.spanish_voice,
                    animatedImage.id
                  )
                }
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t(currentLanguage, 'a11yAnimalCard', {
                  animal:
                    currentLanguage === 'en'
                      ? animatedImage.name
                      : animatedImage.spanish_name,
                })}
              >
                <View style={styles.animationBackground}>
                  <LottieView
                    autoPlay={false}
                    autoSize={false}
                    ref={el => (animRef.current[animatedImage.name] = el)}
                    resizeMode="contain"
                    loop={false}
                    source={animatedImage.animation_path}
                    style={styles.animation}
                  />
                </View>
                <Text style={styles.animationName} accessible={false}>
                  {currentLanguage === 'en'
                    ? animatedImage.name
                    : animatedImage.spanish_name}
                </Text>
              </TouchableOpacity>
          </Fragment>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  animationName: {
    fontFamily: 'Bangers_400Regular',
    fontSize: 18,
    position: 'absolute',
    top: Platform.OS === 'ios' ? 91 : 116,
    zIndex: 3,
    textShadowColor: 'rgba(0, 34, 68, 0.55)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 4 },
    letterSpacing: 1,
    color: '#0A3D62',
  },
  animationContainer: {
    width: '100%',
    justifyContent: 'space-evenly',
    alignContent: 'space-around',
    flexWrap: 'wrap',
    flexDirection: 'row',
    paddingBottom: 60,
    paddingHorizontal: GRID_PADDING_H,
  },
  button: {
    height: 132,
    marginTop: CARD_MARGIN_TOP,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  animationBackground: {
    backgroundColor: '#ffffff',
    height: 85,
    width: '100%',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    // Some source animations (esp. raster ones) don't leave much margin
    // around the character. Clipping here, like the album screen does,
    // keeps any future poorly-padded asset contained to the card instead
    // of spilling past its border.
    overflow: 'hidden',
  },
  animation: {
    width: 90,
    height: 90,
  },
});
export default AnimalScreen;
