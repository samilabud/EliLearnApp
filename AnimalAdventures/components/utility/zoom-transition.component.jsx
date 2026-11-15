import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

const OPEN_MS = 380;
const CLOSE_MS = 420;
const FADE_MS = 260;
/** Lets the game mount under the cover before the cover lifts. */
const MOUNT_GRACE_MS = 90;

/**
 * A coloured circle that grows out of a tapped landmark until it covers the
 * screen (opening a game) or shrinks back onto it (returning to the map).
 *
 * The caller swaps the screen underneath inside `onCovered`, at the moment
 * nothing of the old screen shows. Taps are swallowed for the whole
 * transition, so an impatient second tap cannot launch anything twice. Under
 * reduced motion there is no circle - `onCovered` runs at once.
 *
 * Imperative on purpose: `ref.current.run({ origin, color, direction,
 * onCovered })`, where `origin` is the landmark's window rectangle.
 */
const ZoomTransition = React.forwardRef(function ZoomTransition(_props, ref) {
  const { width, height } = useWindowDimensions();
  const [job, setJob] = useState(null);
  const [progress] = useState(() => new Animated.Value(0));
  const [cover] = useState(() => new Animated.Value(1));
  const busy = useRef(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(on => {
        reduceMotion.current = on;
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      on => {
        reduceMotion.current = on;
      }
    );
    return () => sub.remove();
  }, []);

  const finish = useCallback(() => {
    busy.current = false;
    setJob(null);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      run({ origin, color, direction, onCovered }) {
        if (busy.current || reduceMotion.current || !origin) {
          onCovered();
          return;
        }
        busy.current = true;
        const opening = direction === 'open';
        progress.setValue(opening ? 0 : 1);
        cover.setValue(1);
        setJob({ origin, color });

        if (opening) {
          Animated.timing(progress, {
            toValue: 1,
            duration: OPEN_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            onCovered();
            setTimeout(() => {
              Animated.timing(cover, {
                toValue: 0,
                duration: FADE_MS,
                useNativeDriver: true,
              }).start(finish);
            }, MOUNT_GRACE_MS);
          });
        } else {
          // Swap first, under the full cover, then shrink onto the landmark.
          onCovered();
          setTimeout(() => {
            Animated.timing(progress, {
              toValue: 0,
              duration: CLOSE_MS,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start(finish);
          }, MOUNT_GRACE_MS);
        }
      },
    }),
    [progress, cover, finish]
  );

  if (!job) return null;

  const { origin, color } = job;
  const cx = origin.x + origin.width / 2;
  const cy = origin.y + origin.height / 2;
  // Big enough to cover the farthest corner from where the circle starts.
  const radius = Math.hypot(
    Math.max(cx, width - cx),
    Math.max(cy, height - cy)
  );
  const startScale = Math.max(0.02, origin.width / 2 / radius);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: cx - radius,
          top: cy - radius,
          width: radius * 2,
          height: radius * 2,
          borderRadius: radius,
          backgroundColor: color,
          opacity: cover,
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [startScale, 1],
              }),
            },
          ],
        }}
      />
    </View>
  );
});

export default ZoomTransition;
