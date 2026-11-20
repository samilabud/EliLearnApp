import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { t, MIN_TOUCH_TARGET } from '../../constants';
import { tapFeedback } from '../../utils/haptics';
import { BouncyButton } from './bouncy-button.component';
import { FitText } from './fit-text.component';

/**
 * Jumps straight to the next game in the main menu's order, skipping the
 * trip back through the menu. Used in every game's top bar. It keeps a text
 * label next to the icon: an icon alone is not enough for this audience.
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
      {/* Fill on a sibling: Android clips the text of a pressable view
          that has both a border radius and a fill. */}
      <View style={styles.fill} importantForAccessibility="no" />
      <FitText font="body" style={styles.text} maxLines={2} minScale={0.8}>
        {t(currentLanguage, 'nextShort')}
      </FitText>
      <MaterialIcons name="skip-next" size={22} color="#0A3D62" />
    </BouncyButton>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    // Floor kept at MIN_TOUCH_TARGET for small hands.
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  text: {
    fontSize: 16,
    color: '#0A3D62',
    textAlign: 'center',
  },
});

export default NextGameButton;
