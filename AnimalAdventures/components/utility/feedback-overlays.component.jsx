import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ConfettiCannon from 'react-native-confetti-cannon';
import { t } from '../../constants';
import { PALETTE, RADIUS, titleText } from '../../constants/theme';
import { BouncyButton } from './bouncy-button.component';
import { FitText } from './fit-text.component';
import { useResponsive } from '../../utils/use-responsive';
import { useReduceMotion } from '../../utils/use-reduce-motion';

/**
 * The celebration and encouragement layers every quiz game shares. They were
 * copied into each game file; keeping them here means a correct answer, a
 * wrong one and finishing the game look and sound the same everywhere.
 */

/** Big check mark and confetti after a correct answer. */
export function CorrectBurst({ visible, opacity, confettiKey }) {
  const { width } = useResponsive();
  const reduceMotion = useReduceMotion();
  if (!visible) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.fill, styles.center, { opacity }]}
    >
      <Text style={styles.check}>✅</Text>
      {!reduceMotion && (
        <ConfettiCannon
          key={`confetti-${confettiKey}`}
          count={80}
          fadeOut={true}
          explosionSpeed={350}
          fallSpeed={3000}
          origin={{ x: width / 2, y: 0 }}
        />
      )}
    </Animated.View>
  );
}

/**
 * "Try again!" after a wrong answer - encouragement, never a failure mark:
 * no red, no X, and it clears itself.
 */
export function TryAgainBanner({ visible, currentLanguage }) {
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={[styles.fill, styles.center]}>
      <View style={styles.tryAgainPill}>
        <View style={styles.tryAgainFill} importantForAccessibility="no" />
        <FitText style={styles.tryAgainText} maxLines={2} minScale={0.6}>
          {t(currentLanguage, 'tryOnceMore')}
        </FitText>
      </View>
    </View>
  );
}

/**
 * One button on the completion card. The fill is a sibling of the label, not
 * on the animated button itself: Android clips the text of a pressable view
 * that has both a border radius and a fill, and this label can wrap.
 */
function ActionButton({ icon, label, a11yLabel, onPress, primary }) {
  return (
    <BouncyButton
      onPress={onPress}
      style={styles.action}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <View
        style={[styles.actionFill, primary && styles.actionFillPrimary]}
        importantForAccessibility="no"
      />
      <MaterialIcons name={icon} size={24} color={PALETTE.ink} />
      <FitText
        font="body"
        style={styles.actionText}
        maxLines={2}
        minScale={0.8}
      >
        {label}
      </FitText>
    </BouncyButton>
  );
}

/** End-of-game celebration with Play Again, Next Game and Menu. */
export function CompletionOverlay({
  visible,
  currentLanguage,
  confettiKey,
  onRestart,
  onNextGame,
  onHome,
  title,
  subtitle,
}) {
  const { width } = useResponsive();
  const reduceMotion = useReduceMotion();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible || reduceMotion) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, reduceMotion, pulse]);

  if (!visible) return null;
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  return (
    <View style={[styles.fill, styles.center, styles.dim]}>
      <View style={styles.card}>
        <FitText style={styles.title} maxLines={2} minScale={0.6}>
          {title || t(currentLanguage, 'amazing')}
        </FitText>
        <FitText
          font="body"
          style={styles.subtitle}
          maxLines={3}
          minScale={0.8}
        >
          {subtitle || t(currentLanguage, 'finishedAllLevels')}
        </FitText>
        <View style={styles.actions}>
          {onRestart && (
            <Animated.View
              renderToHardwareTextureAndroid
              style={{ transform: [{ scale }] }}
            >
              <ActionButton
                primary
                icon="replay"
                label={t(currentLanguage, 'restart')}
                a11yLabel={t(currentLanguage, 'a11yResetButton')}
                onPress={onRestart}
              />
            </Animated.View>
          )}
          {onNextGame && (
            <ActionButton
              icon="skip-next"
              label={t(currentLanguage, 'nextGame')}
              a11yLabel={t(currentLanguage, 'a11yNextGame')}
              onPress={onNextGame}
            />
          )}
          {onHome && (
            <ActionButton
              icon="home"
              label={t(currentLanguage, 'mainMenuFull')}
              a11yLabel={t(currentLanguage, 'a11yMainMenuButton')}
              onPress={onHome}
            />
          )}
        </View>
      </View>
      {!reduceMotion && (
        <ConfettiCannon
          key={`final-${confettiKey}`}
          count={200}
          fadeOut={true}
          explosionSpeed={300}
          fallSpeed={3500}
          origin={{ x: width / 2, y: 0 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    backgroundColor: 'rgba(10, 61, 98, 0.45)',
    paddingHorizontal: 24,
  },
  check: {
    fontSize: 80,
  },
  tryAgainPill: {
    maxWidth: '92%',
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  tryAgainFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: PALETTE.white,
    borderRadius: RADIUS.lg,
    borderWidth: 4,
    borderColor: PALETTE.gold,
  },
  tryAgainText: {
    ...titleText(40, PALETTE.ink),
    textAlign: 'center',
  },
  card: {
    alignItems: 'center',
    backgroundColor: PALETTE.cream,
    borderRadius: RADIUS.lg,
    borderWidth: 4,
    borderColor: PALETTE.gold,
    paddingHorizontal: 24,
    paddingVertical: 24,
    maxWidth: 640,
  },
  title: {
    ...titleText(48, PALETTE.red),
  },
  subtitle: {
    marginTop: 4,
    fontFamily: 'Nunito_700Bold',
    fontSize: 20,
    color: PALETTE.ink,
    textAlign: 'center',
  },
  actions: {
    marginTop: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 60,
    paddingHorizontal: 22,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  actionFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: PALETTE.white,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: PALETTE.gold,
  },
  actionFillPrimary: {
    backgroundColor: PALETTE.gold,
    borderColor: PALETTE.white,
  },
  actionText: {
    fontFamily: 'Nunito_900Black',
    fontSize: 18,
    color: PALETTE.ink,
  },
});
