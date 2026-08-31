import * as Haptics from 'expo-haptics';

/**
 * Tactile feedback helpers.
 *
 * Young children rely on multi-sensory confirmation, so every meaningful
 * tap gets a matching buzz alongside its sound - the app stays responsive
 * with the volume turned down.
 *
 * Haptics are unavailable on web and on devices without a motor, and the
 * calls reject rather than throw. Every helper swallows that: feedback is
 * an enhancement and must never interrupt gameplay.
 */

const safely = run => {
  try {
    run()?.catch?.(() => {});
  } catch {
    // Device has no haptic engine - ignore.
  }
};

/** Light tap for routine touches: buttons, flipping a card. */
export const tapFeedback = () =>
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Firmer tap for picking an answer. */
export const selectFeedback = () =>
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** Celebratory buzz for a correct answer or a matched pair. */
export const successFeedback = () =>
  safely(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );

/** Distinct buzz for a wrong answer - different enough to tell apart. */
export const errorFeedback = () =>
  safely(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  );

/** Strong buzz reserved for finishing a level or the whole game. */
export const celebrationFeedback = () =>
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
