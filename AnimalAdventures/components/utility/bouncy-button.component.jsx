import React, { useState } from 'react';
import { Animated, Pressable } from 'react-native';

/**
 * A button that shrinks on press and springs back, used everywhere instead
 * of TouchableOpacity's default opacity dim. A child tapping a button and
 * seeing it fade reads as "broken, nothing happened" - a small, bouncy scale
 * reads as "that worked" instead, and it is consistent across the app rather
 * than per-screen.
 */
export function BouncyButton({
  onPress,
  onPressIn,
  onPressOut,
  style,
  children,
  pressedScale = 0.93,
  ...rest
}) {
  const [scale] = useState(() => new Animated.Value(1));

  const animateTo = toValue => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 12,
    }).start();
  };

  const handlePressIn = event => {
    animateTo(pressedScale);
    onPressIn?.(event);
  };

  const handlePressOut = event => {
    animateTo(1);
    onPressOut?.(event);
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      {/* Android can clip/truncate a child Text (showing only its first
          word) while this view's transform is actively animating - a GPU
          layer-flattening glitch, not a layout bug. Rendering this view to
          its own hardware texture avoids it; no-op on iOS. */}
      <Animated.View
        renderToHardwareTextureAndroid
        style={[style, { transform: [{ scale }] }]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default BouncyButton;
