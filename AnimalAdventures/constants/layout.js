/**
 * Sizing rules tuned for small hands.
 *
 * Material Design sets a 48dp floor for touch targets, which assumes adult
 * motor control. Children aged roughly 3-6 are still developing fine motor
 * precision, so primary controls here are larger than that floor.
 */

/** Minimum height for any tappable control. */
export const MIN_TOUCH_TARGET = 48;

/** Primary actions (play, answer, mode selection) - deliberately oversized. */
export const LARGE_TOUCH_TARGET = 60;

/**
 * Expands a control's touchable area beyond its visual bounds. Use where a
 * button must stay visually small but should still be easy to hit.
 */
export const TOUCH_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

/**
 * Smallest readable size for early readers. Anything conveying meaning
 * should be at least this large; below it, pair the text with an icon.
 */
export const MIN_FONT_SIZE = 18;
