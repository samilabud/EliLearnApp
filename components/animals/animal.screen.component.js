import React, { useRef, useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ImageBackground,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import LottieView from 'lottie-react-native';
import { animalList } from './animal.list';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const AnimalScreen = ({ currentLanguage }) => {
  const [sound, setSound] = React.useState();
  const [currentAnimation, setCurrentAnimation] = useState();

  const backgroundImage = require('../../assets/backgrounds/pawel-czerwinski-4gWNAWeOvP0-unsplash.jpg');
  const animRef = useRef([]);

  const [fontsLoaded] = useFonts({
    Bangers_400Regular,
  });

  const resetAndPlayAnim = (playCurrent, soundUrl) => {
    if (currentAnimation) {
      currentAnimation.reset();
    }
    setCurrentAnimation(playCurrent);
    playSound(soundUrl);
    playCurrent.play();
  };

  async function playSound(soundFile) {
    const { sound: thesound } = await Audio.Sound.createAsync(soundFile);
    setSound(thesound);
    await thesound.playAsync();
  }

  React.useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ImageBackground
      source={backgroundImage}
      resizeMode="cover"
      style={styles.backgroundImage}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.animationContainer} onLayout={onLayoutRootView}>
          {animalList.map((animatedImage) => (
            <React.Fragment key={`${animatedImage.name}-animatedImage`}>
              <TouchableOpacity
                style={styles.button}
                onPress={() =>
                  resetAndPlayAnim(
                    animRef.current[animatedImage.name],
                    animatedImage.sound
                  )
                }
              >
                <LottieView
                  autoPlay={false}
                  autoSize={false}
                  ref={(el) => (animRef.current[animatedImage.name] = el)}
                  key="animation"
                  resizeMode="contain"
                  loop={false}
                  source={animatedImage.animation_path}
                  style={styles.animation}
                />
                <View style={styles.animationBackground} />
                <Text style={styles.animationName}>
                  {currentLanguage === 'en'
                    ? animatedImage.name
                    : animatedImage.spanish_name}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  animationName: {
    fontFamily: 'Bangers_400Regular',
    position: 'absolute',
    top: Platform.OS === 'ios' ? 91 : 81,
    zIndex: 3,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowRadius: 20,
    textShadowOffset: { width: 1, height: 10 },
    letterSpacing: 1,
  },
  animationContainer: {
    width: '100%',
    justifyContent: 'space-evenly',
    alignContent: 'space-around',
    flexWrap: 'wrap',
    flexDirection: 'row',
    paddingBottom: 60,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  button: {
    width: '26%',
    height: 100,
    marginTop: '12%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  animationBackground: {
    backgroundColor: '#ffffff',
    height: 70,
    width: '100%',
    borderRadius: 10,
    zIndex: 1,
    position: 'absolute',
  },
  animation: {
    zIndex: 2,
  },
});
export default AnimalScreen;
