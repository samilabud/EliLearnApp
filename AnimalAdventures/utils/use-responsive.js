import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  CONTENT_MAX_WIDTH,
  LARGE_TOUCH_TARGET,
  TABLET_MIN_SIDE,
  TABLET_TOUCH_TARGET,
} from '../constants/layout';

/** Short side of the phone every size in this app was first tuned on. */
const BASE_SHORT_SIDE = 390;
const MAX_SCALE = 1.6;

/**
 * One place that knows the screen's shape, so every screen adapts to phones,
 * tablets, portrait and landscape the same way instead of each one doing its
 * own `width > height` math against phone-sized caps.
 *
 * `scale` grows fonts and icons with the device (1 on a phone, up to 1.6 on a
 * large iPad) and never shrinks them below their phone size, since those are
 * already the smallest sizes a child can comfortably read and hit.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const shortSide = Math.min(width, height);
    const isTablet = shortSide >= TABLET_MIN_SIDE;
    const scale = Math.min(MAX_SCALE, Math.max(1, shortSide / BASE_SHORT_SIDE));
    return {
      width,
      height,
      shortSide,
      isLandscape: width > height,
      isTablet,
      scale,
      touchTarget: isTablet ? TABLET_TOUCH_TARGET : LARGE_TOUCH_TARGET,
      contentMaxWidth: Math.min(width, CONTENT_MAX_WIDTH),
    };
  }, [width, height]);
}

/**
 * How many columns of cards at least `minCardWidth` wide fit across
 * `available` points, never fewer than `min` or more than `max`.
 */
export const gridColumns = (available, minCardWidth, gap, min = 1, max = 8) =>
  Math.max(
    min,
    Math.min(max, Math.floor((available + gap) / (minCardWidth + gap)))
  );

export default useResponsive;
