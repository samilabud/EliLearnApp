import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { Audio } from 'expo-av';

export const MySplashScreen = () => {
  const [sound, setSound] = React.useState();
  const animRef = useRef(null);
  async function playSound() {
    const soundFile = require('../../assets/sounds/background/intro/Stinger_2-2020-10-19_-_Its_A_Good_Day_-_www.FesliyanStudios.com_Steve_Oxen.mp3');
    const { sound: theSound } = await Audio.Sound.createAsync(soundFile);
    setSound(theSound);
    theSound.playAsync();
  }
  useEffect(() => {
    playSound();
    // Fallback: ensure animation starts shortly after mount
    const raf = requestAnimationFrame(() => {
      if (animRef.current && typeof animRef.current.play === 'function') {
        try {
          animRef.current.play();
        } catch (_) {}
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  React.useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  return (
    <View style={styles.splashContainer}>
      <LottieView
        autoPlay
        key="animation"
        resizeMode="cover"
        loop={false}
        source={require('../../assets/animations/logo/logo-animation.json')}
        style={styles.introAnimation}
        ref={animRef}
        onLayout={() => {
          if (animRef.current && typeof animRef.current.play === 'function') {
            try {
              animRef.current.play();
            } catch (_) {}
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#BD0000',
  },
  introAnimation: {
    width: '100%',
    height: '100%',
  },
});
