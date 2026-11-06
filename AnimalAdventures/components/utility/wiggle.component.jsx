import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * A soft head-tilt for a wrong answer: the tapped card tips side to side
 * like a puzzled animal, then settles. It tells the child "not that one"
 * without a buzzer, a red X or the word "wrong".
 *
 * Bump `trigger` (any changing number) to play it once; 0 never plays.
 */
export function Wiggle({ trigger, style, children }) {
  const [tilt] = useState(() => new Animated.Value(0));
  const last = useRef(trigger);

  useEffect(() => {
    if (!trigger || trigger === last.current) return;
    last.current = trigger;
    tilt.setValue(0);
    Animated.sequence([
      Animated.timing(tilt, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(tilt, {
        toValue: -1,
        duration: 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(tilt, {
        toValue: 0.5,
        duration: 180,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(tilt, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [trigger, tilt]);

  const rotate = tilt.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-12deg', '12deg'],
  });

  return (
    <Animated.View style={[style, { transform: [{ rotate }] }]}>
      {children}
    </Animated.View>
  );
}

/**
 * Per-option wiggle counters: `wiggle(id)` plays it on that option,
 * `triggerFor(id)` is the value to pass to its `<Wiggle trigger>`.
 */
export function useWiggles() {
  const [state, setState] = useState({ id: null, n: 0 });
  return {
    wiggle: id => setState(prev => ({ id, n: prev.n + 1 })),
    triggerFor: id => (state.id === id ? state.n : 0),
  };
}

export default Wiggle;
