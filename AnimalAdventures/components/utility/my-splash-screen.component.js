import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import LottieView from 'lottie-react-native';
import { useAudioPlayer } from 'expo-audio';
import { WideIntro } from './wide-intro.component';

// The wide intro is decoration; if it ever fails to draw, fall back to the
// phone intro rather than leaving a red screen.
class IntroBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.log('WideIntro failed:', error && error.message);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export const MySplashScreen = () => {
  const animRef = useRef(null);
  const { width, height } = useWindowDimensions();
  // The tall phone logo only suits an upright phone; a screen on its side
  // or a tablet gets the wide scene instead.
  const wide = width > height || Math.min(width, height) >= 600;
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

  const phoneIntro = (
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
  );

  return (
    <View style={styles.splashContainer}>
      {wide ? (
        <IntroBoundary fallback={phoneIntro}>
          <WideIntro width={width} height={height} />
        </IntroBoundary>
      ) : (
        phoneIntro
      )}
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
