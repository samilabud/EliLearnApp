import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  CATEGORY_COLORS,
  CARD_SHADOW,
  PALETTE,
  RADIUS,
} from '../../constants/theme';
import { BouncyButton } from './bouncy-button.component';
import { Wiggle } from './wiggle.component';

/**
 * One answer tile in a quiz grid: a white rounded card with its activity
 * group's pastel ring, filling whatever box `FitGrid` gives it.
 *
 * `hinted` turns the ring gold and glows - shown only after several tries,
 * so it reads as help rather than an answer key. `wiggleTrigger` plays the
 * puzzled head-tilt after a wrong pick.
 */
export function AnswerCard({
  category = 'listen',
  hinted,
  wiggleTrigger,
  onPress,
  accessibilityLabel,
  disabled,
  // Background color; white by default. Memory's face-down cards use it.
  fill,
  accessibilityState,
  style,
  children,
}) {
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.listen;
  return (
    <Wiggle trigger={wiggleTrigger} style={styles.fill}>
      <BouncyButton
        onPress={onPress}
        disabled={disabled}
        containerStyle={styles.fill}
        style={[styles.card, style]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
      >
        {/* The rounded fill and ring live on an absolutely positioned
            sibling, never on the view BouncyButton animates: on Android a
            border radius + fill on that transformed view glitches at one
            corner, and a rounded filled parent clips its Text children. */}
        <View
          style={[
            styles.background,
            { borderColor: colors.ring },
            fill && { backgroundColor: fill },
            hinted && styles.hinted,
          ]}
        />
        {children}
      </BouncyButton>
    </Wiggle>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  card: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: PALETTE.white,
    borderRadius: RADIUS.md,
    borderWidth: 4,
    ...CARD_SHADOW,
  },
  hinted: {
    borderColor: PALETTE.gold,
    borderWidth: 6,
    backgroundColor: '#FFF7C2',
    shadowColor: PALETTE.gold,
    shadowOpacity: 0.9,
    shadowRadius: 14,
  },
});

export default AnswerCard;
