import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the device's "reduce motion" / "remove animations" setting is on.
 *
 * Children with vestibular or sensory sensitivities can be bothered by
 * looping, bouncing or flashing motion. Anything that loops or celebrates
 * should check this and hold still (or use a short fade) when it is true.
 * Starts false and updates as soon as the system answers or the setting
 * changes while the app is open.
 */
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(on => !cancelled && setReduceMotion(on))
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

export default useReduceMotion;
