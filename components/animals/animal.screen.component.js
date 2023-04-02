import React, { useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { Audio } from 'expo-av';
import LottieView from 'lottie-react-native';
import { animalList } from './animal.list';

const AnimalScreen = () => {
  const backgroundImage = require('../../assets/backgrounds/pawel-czerwinski-4gWNAWeOvP0-unsplash.jpg');
  const animRef = useRef([]);

  const resetAnim = () => {
    animalList.forEach((animatedImage) => {
      animRef.current[animatedImage.name].reset();
    });
  };
  const resetAndPlayAnim = (playCurrent, soundUrl) => {
    resetAnim();
    playSound(soundUrl);
    playCurrent.play();
  };

  async function playSound(soundFile) {
    const { sound } = await Audio.Sound.createAsync(soundFile);
    await sound.playAsync();
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
            <TouchableOpacity
              key={`${animatedImage.name}-animatedImage`}
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
              {/* <Text>{animatedImage.name}</Text>  */}
            </TouchableOpacity>
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
