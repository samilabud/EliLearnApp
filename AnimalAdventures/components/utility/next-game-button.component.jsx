import React from 'react';
import { StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { t, MIN_TOUCH_TARGET } from '../../constants';
import { tapFeedback } from '../../utils/haptics';
import { BouncyButton } from './bouncy-button.component';

/**
 * Jumps straight to the next game in the main menu's order, skipping the
 * trip back through the menu. Used in every game's top bar, next to the
 * language toggle - icon-only to stay compact alongside it.
 */
export function NextGameButton({ currentLanguage, onPress, style }) {
  const handlePress = () => {
    tapFeedback();
    onPress();
  };

  return (
    <BouncyButton
      style={[styles.button, style]}
      onPress={handlePress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={t(currentLanguage, 'a11yNextGame')}
    >
      <MaterialIcons name="skip-next" size={24} color="white" />
    </BouncyButton>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
});

export default NextGameButton;
