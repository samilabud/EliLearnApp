import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { useAudioPlayer } from 'expo-audio';

export const MySplashScreen = () => {
  const animRef = useRef(null);
  const soundFile = require('../../assets/sounds/background/intro/Stinger_2-2020-10-19_-_Its_A_Good_Day_-_www.FesliyanStudios.com_Steve_Oxen.mp3');
  const player = useAudioPlayer(soundFile);
  const playSound = React.useCallback(() => {
    try {
      player.play();
    } catch (_) {}
  }, [player]);
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
  }, [playSound]);

  React.useEffect(() => {
    return () => {
      try {
        player.remove();
      } catch (_) {}
    };
  }, [player]);

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
