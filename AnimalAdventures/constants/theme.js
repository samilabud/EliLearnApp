/**
 * Visual template: "red frame, warm canvas".
 *
 * The splash's red stays the brand - it frames every screen as a header band
 * - while the content itself sits on a warm cream canvas with soft pastel
 * tiles, which reads calmer and leaves the animals as the brightest thing on
 * screen. Every screen pulls colors from here instead of hard-coding them, so
 * the look stays consistent from the menu through every game.
 */

export const PALETTE = {
  red: '#BD0000',
  redDeep: '#8E0000',
  gold: '#FFD700',
  goldSoft: '#FFE873',
  ink: '#0A3D62',
  inkSoft: '#4A6A85',
  cream: '#FFF6E9',
  creamDeep: '#F6E7CF',
  white: '#FFFFFF',
  shadow: '#5B2A00',
};

/**
 * One pastel per activity group, used for the menu tiles and for the ring
 * around a game's answer cards so a child sees the same color in the menu
 * and in the game it opens.
 */
export const CATEGORY_COLORS = {
  listen: { fill: '#FFF1B8', ring: '#F5C518', ink: '#7A5A00' },
  letters: { fill: '#D4F5E4', ring: '#3DBE84', ink: '#13603E' },
  memory: { fill: '#D7ECFF', ring: '#4D9DE8', ink: '#154A7A' },
  create: { fill: '#FFE0D1', ring: '#F28A5B', ink: '#7A3010' },
};

export const RADIUS = {
  sm: 16,
  md: 24,
  lg: 32,
  pill: 999,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const FONTS = {
  title: 'Bangers_400Regular',
  body: 'Nunito_700Bold',
  bodyHeavy: 'Nunito_900Black',
};

/** Soft, warm drop shadow for cards on the cream canvas. */
export const CARD_SHADOW = {
  shadowColor: PALETTE.shadow,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 8,
  elevation: 4,
};

/**
 * Bangers clips on Android unless lineHeight is set explicitly and the
 * platform's own font padding is turned off - see the long-form note in
 * trace-letter.game.component.jsx. Spread this into any Bangers text style.
 */
export const titleText = (fontSize, color = PALETTE.white) => ({
  fontFamily: FONTS.title,
  fontSize,
  lineHeight: Math.round(fontSize * 1.3),
  includeFontPadding: false,
  color,
  letterSpacing: 1,
});
