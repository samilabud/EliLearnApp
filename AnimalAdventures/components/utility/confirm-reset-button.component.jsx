import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
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
 * now only arms it (the label flips to a question); the level only clears on
 * a second tap that follows within a few seconds, after which it quietly
 * disarms itself again. Deliberately not used for the "Play Again" button on
 * the completion screen - that tap is already a considered choice, not an
 * accidental one.
 */
export function ConfirmResetButton({ currentLanguage, onConfirm, style }) {
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
        confirming ? 'a11yResetConfirm' : 'a11yResetButton'
      )}
    >
      <Text style={[styles.text, confirming && styles.textConfirming]}>
        {t(currentLanguage, confirming ? 'resetConfirm' : 'reset')}
      </Text>
    </BouncyButton>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  buttonConfirming: {
    backgroundColor: '#FFD700',
    borderColor: '#ffffff',
  },
  text: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  textConfirming: {
    color: '#0A3D62',
    textShadowColor: 'transparent',
  },
});

export default ConfirmResetButton;
