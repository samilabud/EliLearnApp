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

/**
 * Shortest screen side, in points, from which a device is treated as a
 * tablet. 600 is the usual Android "sw600dp" breakpoint and every iPad
 * clears it in either orientation, while the largest phones stay below it.
 */
export const TABLET_MIN_SIDE = 600;

/** Primary touch target on tablets, where small hands reach further. */
export const TABLET_TOUCH_TARGET = 72;

/**
 * Widest a column of reading content gets on a large screen. Past this a
 * line of text or a row of buttons stretches too far for a child's eye to
 * follow, so content centers inside it instead.
 */
export const CONTENT_MAX_WIDTH = 960;

/** Scale a phone-tuned size by the factor from `useResponsive`. */
export const scaled = (size, scale) => Math.round(size * scale);
