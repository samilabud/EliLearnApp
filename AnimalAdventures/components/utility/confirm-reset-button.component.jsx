import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { t, MIN_TOUCH_TARGET, LARGE_TOUCH_TARGET } from '../../constants';
import { tapFeedback } from '../../utils/haptics';
import { useReduceMotion } from '../../utils/use-reduce-motion';
import { BouncyButton } from './bouncy-button.component';
import { FitText } from './fit-text.component';

/** How long the button stays armed before quietly disarming itself. */
const CONFIRM_WINDOW_MS = 2500;

/**
 * The in-game "Again" button, guarded by a second tap.
 *
 * It sits in the top bar, right where a child's thumb rests during play, and
 * a single accidental tap used to wipe the level instantly. The first tap
 * now only arms it: the button turns yellow, says "Tap again!" and pulses
 * gently (held still when the device asks to reduce motion), so a child who
 * cannot hear a screen reader still sees what is being asked. The level only
 * clears on a second tap that follows within a few seconds, after which the
 * button quietly disarms itself.
 * Deliberately not used for the "Play Again" button on the completion
 * screen - that tap is already a considered choice, not an accidental one.
 */
export function ConfirmResetButton({
  currentLanguage,
  onConfirm,
  style,
  // Overridable for screens where "start this level again" doesn't fit -
  // Build a Scene has no level, so it passes its own "clear the scene"
  // strings instead. Every other caller relies on these defaults.
  labelKey = 'a11yResetButton',
  confirmLabelKey = 'a11yResetConfirm',
  // The short word shown next to the icon ("Again", or "Clear").
  visibleLabelKey = 'resetShort',
}) {
  const [confirming, setConfirming] = useState(false);
  const [pulse] = useState(() => new Animated.Value(0));
  const reduceMotion = useReduceMotion();
  const timer = useRef(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  useEffect(() => {
    if (!confirming || reduceMotion) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 450,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 450,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [confirming, reduceMotion, pulse]);

  const handlePress = useCallback(() => {
    tapFeedback();
    if (confirming) {
      if (timer.current) clearTimeout(timer.current);
      setConfirming(false);
      onConfirm();
      return;
    }
    setConfirming(true);
    timer.current = setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
  }, [confirming, onConfirm]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <BouncyButton
        onPress={handlePress}
        style={[styles.button, style]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={t(
          currentLanguage,
          confirming ? confirmLabelKey : labelKey
        )}
      >
        {/* Fill on a sibling: Android clips the text of a pressable view
            that has both a border radius and a fill. */}
        <View
          style={[styles.fill, confirming && styles.fillConfirming]}
          importantForAccessibility="no"
        />
        <MaterialIcons name="replay" size={22} color="#0A3D62" />
        <FitText font="body" style={styles.text} maxLines={2} minScale={0.8}>
          {t(currentLanguage, confirming ? 'tapAgainShort' : visibleLabelKey)}
        </FitText>
      </BouncyButton>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Icon over label: narrower than side by side, so Again, Next and the
  // level chip fit one row on a 360 pt phone even at a large font size.
  button: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: LARGE_TOUCH_TARGET,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  fillConfirming: {
    backgroundColor: '#FFD700',
    borderColor: '#ffffff',
  },
  text: {
    fontSize: 16,
    color: '#0A3D62',
    textAlign: 'center',
  },
});

export default ConfirmResetButton;
