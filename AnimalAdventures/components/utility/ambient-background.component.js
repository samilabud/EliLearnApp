import React, { useEffect, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const BUBBLES = [
  { left: '8%', size: 26, duration: 9000, delay: 0 },
  { left: '22%', size: 34, duration: 11000, delay: 1200 },
  { left: '38%', size: 20, duration: 8000, delay: 800 },
  { left: '54%', size: 28, duration: 9500, delay: 1600 },
  { left: '72%', size: 24, duration: 10500, delay: 400 },
  { left: '88%', size: 18, duration: 7500, delay: 2200 },
];

export const AmbientBackground = () => {
  const animated = useMemo(
    () =>
      BUBBLES.map(() => ({
        translateY: new Animated.Value(0),
        sway: new Animated.Value(0),
        opacity: new Animated.Value(0),
      })),
    []
  );

  useEffect(() => {
    const loops = animated.map(({ translateY, sway, opacity }, idx) => {
      const config = BUBBLES[idx];

      // Vertical float up
      const floatUp = Animated.sequence([
        Animated.delay(config.delay),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -700,
            duration: config.duration,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.9,
              duration: Math.min(2400, config.duration * 0.35),
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.2,
              duration: Math.min(2600, config.duration * 0.45),
              useNativeDriver: true,
            }),
          ]),
        ]),
        // reset instantly
        Animated.timing(translateY, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]);

      // Gentle horizontal sway back and forth
      const swayMotion = Animated.loop(
        Animated.sequence([
          Animated.timing(sway, {
            toValue: 1,
            duration: 2400,
            useNativeDriver: true,
          }),
          Animated.timing(sway, {
            toValue: -1,
            duration: 2400,
            useNativeDriver: true,
          }),
        ])
      );

      const mainLoop = Animated.loop(floatUp);

      swayMotion.start();
      mainLoop.start();
      return () => {
        sway.stopAnimation();
        translateY.stopAnimation();
        opacity.stopAnimation();
      };
    });

    return () => loops.forEach(stop => stop && stop());
  }, [animated]);

  return (
    <View pointerEvents="none" style={styles.container}>
      {BUBBLES.map((b, i) => {
        const { translateY, sway, opacity } = animated[i];
        const translateX = sway.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-6, 0, 6],
        });
        return (
          <Animated.View
            key={`bubble-${i}`}
            style={[
              styles.bubble,
              {
                left: b.left,
                width: b.size,
                height: b.size,
                borderRadius: b.size / 2,
                transform: [{ translateY }, { translateX }],
                opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  bubble: {
    position: 'absolute',
    bottom: -40,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.8)',
  },
});

export default AmbientBackground;


