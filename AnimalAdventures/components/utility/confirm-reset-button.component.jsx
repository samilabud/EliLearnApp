import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { t, MIN_TOUCH_TARGET } from '../../constants';
import { tapFeedback } from '../../utils/haptics';
import { BouncyButton } from './bouncy-button.component';

/** How long the button stays armed before quietly disarming itself. */
const CONFIRM_WINDOW_MS = 2500;

/**
 * The in-game "Reset" button, guarded by a second tap.
 *
 * It sits in the top bar, right where a child's thumb rests during play, and
 * a single accidental tap used to wipe the level instantly. The first tap
 * now only arms it (the background flips to yellow as the only cue, since
 * this is icon-only); the level only clears on a second tap that follows
 * within a few seconds, after which it quietly disarms itself again.
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
}) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

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

  return (
    <BouncyButton
      onPress={handlePress}
      style={[styles.button, confirming && styles.buttonConfirming, style]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={t(
        currentLanguage,
        confirming ? confirmLabelKey : labelKey
      )}
    >
      <MaterialIcons name="replay" size={22} color="#0A3D62" />
    </BouncyButton>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    backgroundColor: '#ffffff',
    paddingHorizontal: 6,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  buttonConfirming: {
    backgroundColor: '#FFD700',
    borderColor: '#ffffff',
  },
});

export default ConfirmResetButton;
