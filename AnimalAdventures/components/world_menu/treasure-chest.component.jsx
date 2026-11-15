import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * The Animal Album's door on the world map: a small treasure chest, drawn
 * as vector shapes so it costs bytes, not a bitmap.
 */
export function TreasureChest({ size = 88 }) {
  return (
    <Svg width={size} height={size * 0.85} viewBox="0 0 100 85">
      {/* Body */}
      <Rect x="8" y="38" width="84" height="42" rx="8" fill="#B8692B" />
      <Rect x="8" y="38" width="84" height="12" fill="#9A531C" />
      {/* Lid */}
      <Path
        d="M8 40 C8 12 92 12 92 40 Z"
        fill="#D9843A"
        stroke="#8A4A18"
        strokeWidth="3"
      />
      {/* Gold bands */}
      <Rect x="26" y="20" width="9" height="60" fill="#FFD700" />
      <Rect x="65" y="20" width="9" height="60" fill="#FFD700" />
      <Rect
        x="8"
        y="38"
        width="84"
        height="42"
        rx="8"
        fill="none"
        stroke="#8A4A18"
        strokeWidth="3"
      />
      {/* Lock */}
      <Circle
        cx="50"
        cy="46"
        r="9"
        fill="#FFE873"
        stroke="#8A4A18"
        strokeWidth="3"
      />
      <Rect x="48" y="44" width="4" height="8" rx="2" fill="#8A4A18" />
    </Svg>
  );
}

export default TreasureChest;
