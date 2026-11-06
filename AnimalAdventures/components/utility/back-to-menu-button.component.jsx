import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t, MIN_TOUCH_TARGET } from '../../constants';
import { BouncyButton } from './bouncy-button.component';

/** How far the button floats above the safe-area bottom inset. */
const BOTTOM_OFFSET = 16;

/**
 * Bottom padding a scrollable screen needs (on top of `insets.bottom`) so
 * its last row never renders underneath the floating button. Covers the
 * button's own offset and height plus a bit of breathing room - a scroll
 * view using less than this will have content hidden behind the button at
 * rest, not just mid-gesture.
 */
export const BACK_TO_MENU_CLEARANCE = BOTTOM_OFFSET + MIN_TOUCH_TARGET + 24;

/**
 * Floating "Main Menu" control anchored to the bottom of a game screen,
 * reachable regardless of scroll position. Kept separate from the top bar
 * (Reset, language) so it is not the button a child's thumb lands on first.
 *
 * Any scrollable content sharing the screen must reserve
 * `BACK_TO_MENU_CLEARANCE` (plus `insets.bottom`) at its bottom, or its last
 * row ends up hidden behind this button.
 *
 * `onPress` is expected to handle its own haptic feedback (every caller
 * already has a `handleBackToMenu` that does, since the same handler also
 * answers the hardware back button via `useBackToMenu`).
 */
export function BackToMenuButton({ currentLanguage, onPress, style }) {
  const insets = useSafeAreaInsets();

  return (
    <BouncyButton
      style={[styles.button, { bottom: insets.bottom + BOTTOM_OFFSET }, style]}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={t(currentLanguage, 'a11yMainMenuButton')}
    >
      <MaterialIcons name="home" size={22} color="#0A3D62" />
      <Text style={styles.text}>{t(currentLanguage, 'mainMenu')}</Text>
    </BouncyButton>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 22,
    backgroundColor: '#ffffff',
    borderRadius: 26,
    borderWidth: 3,
    borderColor: '#FFD700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  // Undoes the floating placement for the header-bar variant.
  inline: {
    position: 'relative',
    alignSelf: 'auto',
    paddingHorizontal: 16,
    shadowOpacity: 0.2,
    elevation: 3,
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A3D62',
  },
});

export default BackToMenuButton;

/**
 * The same "Main Menu" control, but sitting in a screen's header bar rather
 * than floating over its content - the spot `GameScreen` reserves for it on
 * every screen, so a child always finds the way home in the same corner.
 * Keeps its text label: an icon alone is not enough for this audience.
 */
export function HomeButton({ currentLanguage, onPress, style }) {
  return (
    <BouncyButton
      style={[styles.button, styles.inline, style]}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={t(currentLanguage, 'a11yMainMenuButton')}
    >
      <MaterialIcons name="home" size={24} color="#0A3D62" />
      <Text style={styles.text}>{t(currentLanguage, 'mainMenu')}</Text>
    </BouncyButton>
  );
}
