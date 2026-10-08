import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { t, MIN_TOUCH_TARGET, LARGE_TOUCH_TARGET } from '../../constants';
import { tapFeedback } from '../../utils/haptics';
import { BouncyButton } from './bouncy-button.component';

/**
 * EN/ES toggle used in every screen header. Pulled out once five screens
 * needed the exact same button rather than five copies of the same JSX.
 */
export function LanguageToggleButton({ currentLanguage, onToggle, style }) {
  const handlePress = () => {
    tapFeedback();
    onToggle(currentLanguage === 'en' ? 'es' : 'en');
  };

  return (
    <BouncyButton
      style={[styles.button, style]}
      onPress={handlePress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={t(currentLanguage, 'a11yLanguageToggle')}
    >
      <MaterialIcons name="translate" size={20} color="white" />
      <Text style={styles.text}>{currentLanguage.toUpperCase()}</Text>
    </BouncyButton>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: LARGE_TOUCH_TARGET,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default LanguageToggleButton;
