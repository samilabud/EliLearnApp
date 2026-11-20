import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/**
 * Android will not stretch these bitmaps past their native 1024dp width -
 * on a tablet or a phone on its side the scene simply stopped partway
 * across. So a wide layer is laid out as a row of segments no wider than
 * that, each mirrored from its neighbour so the seams stay invisible.
 */
const MAX_SEGMENT = 960;
export function WideImage({ source, width, height, resizeMode, tintColor }) {
  const count = Math.max(1, Math.ceil(width / MAX_SEGMENT));
  const segment = width / count;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => (
        <Image
          key={i}
          source={source}
          resizeMode={resizeMode}
          style={{
            position: 'absolute',
            top: 0,
            left: i * segment,
            // A pixel of overlap hides rounding hairlines between segments.
            width: segment + 1,
            height,
            tintColor,
            transform: i % 2 ? [{ scaleX: -1 }] : undefined,
          }}
        />
      ))}
    </View>
  );
}
