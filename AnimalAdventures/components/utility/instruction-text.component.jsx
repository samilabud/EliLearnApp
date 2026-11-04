import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BouncyButton } from './bouncy-button.component';
import { t } from '../../constants';
import { MIN_TOUCH_TARGET } from '../../constants/layout';

/**
 * A game's instruction line with a speaker icon; tapping it says the
 * instruction aloud again. Lets a child who can't read the text hear it
 * whenever they need to, not just once when the game opens.
 *
 * The Bangers text carries the Android clipping fix (textBreakStrategy /
 * collapsable) described in trace-letter.game.component.jsx.
 */
export function InstructionText({
  text,
  currentLanguage,
  onReplay,
  textStyle,
}) {
  return (
    <BouncyButton
      onPress={onReplay}
      style={styles.row}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${text}. ${t(currentLanguage, 'a11yReplayInstruction')}`}
    >
      <MaterialIcons
        name="volume-up"
        size={28}
        color="white"
        style={styles.icon}
      />
      <Text
        style={[styles.text, { fontFamily: 'Bangers_400Regular' }, textStyle]}
        textBreakStrategy="simple"
        collapsable={false}
      >
        {text}
      </Text>
    </BouncyButton>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  icon: {
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 3 },
  },
  text: {
    flexShrink: 1,
    fontSize: 26,
    lineHeight: 34,
    includeFontPadding: false,
    color: 'white',
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 3 },
  },
});
