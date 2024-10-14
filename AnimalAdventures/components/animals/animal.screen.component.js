import { useRef, useState, Fragment, useEffect } from 'react';
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

const AnimalScreen = ({ currentLanguage }) => {
  const [sound, setSound] = useState();
  const [voice, setVoice] = useState();
  const [currentAnimation, setCurrentAnimation] = useState();

  const backgroundImage = require('../../assets/backgrounds/pawel-czerwinski-4gWNAWeOvP0-unsplash.jpg');
  const animRef = useRef([]);

  const [fontsLoaded] = useFonts({
    Bangers_400Regular,
  });

  const resetAndPlayAnim = (playCurrent, soundUrl, voiceUrl) => {
    if (currentAnimation) {
      currentAnimation.reset();
    }
    setCurrentAnimation(playCurrent);
    playSound(soundUrl, voiceUrl);
    delay(1500).then(() => {
      playCurrent.play();
    });
  };
  function delay(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }
  async function playSound(soundFile, voiceFile) {
    const { sound: theSound } = await Audio.Sound.createAsync(soundFile);
    const { sound: theVoice } = await Audio.Sound.createAsync(voiceFile);
    setSound(theSound);
    setVoice(theVoice);
    delay(1000).then(() => {
      theSound.playAsync();
    });
    await theVoice.playAsync();
  }

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  useEffect(() => {
    return voice
      ? () => {
          voice.unloadAsync();
        }
      : undefined;
  }, [voice]);

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
        <View style={styles.animationContainer}>
          {animalList.map((animatedImage) => (
            <Fragment key={`${animatedImage.name}-animatedImage`}>
              <TouchableOpacity
                style={styles.button}
                onPress={() =>
                  resetAndPlayAnim(
                    animRef.current[animatedImage.name],
                    animatedImage.sound,
                    currentLanguage === 'en'
                      ? animatedImage.voice
                      : animatedImage.spanish_voice
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
            </Fragment>
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
    backgroundColor: '#BD0000',
  },
  button: {
    width: '26%',
    height: 100,
    marginTop: '7%',
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
    width: 80,
    height: 80,
  },
});
export default AnimalScreen;
