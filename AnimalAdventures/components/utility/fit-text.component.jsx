import React, { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { FONTS } from '../../constants/theme';

/**
 * A non-breaking space added after every title. Bangers is slanted and its
 * last letter overhangs its advance width. Android 15 counts that overhang
 * when it draws the text but not when it measures the box, so a one-line
 * title that is measured to the exact pixel wraps its last word onto a second
 * line that the box has no height for. The extra advance gives the draw
 * pass room; trailing white space never wraps and is invisible.
 */
const TRAILING_SLACK = '\u00A0';
/** How much smaller each re-measure pass makes the text. */
const SHRINK_STEP = 0.92;

/**
 * The one way to show a title or label that might not fit its box.
 *
 * Why this exists: `numberOfLines` plus `adjustsFontSizeToFit` is unreliable
 * on Android with the Bangers font. When the shrinking does not happen,
 * `numberOfLines` cuts the text off with no ellipsis, so a wrapped title
 * shows only its first word or two. This component never truncates:
 *
 * 1. It lays the text out at full size and reads the real line breaks from
 *    `onTextLayout`.
 * 2. If it needs more than `maxLines` lines, or a long word was broken in
 *    the middle, it shrinks the font by about 8% and measures again, down to
 *    `minScale`.
 * 3. If it still does not fit at `minScale`, it keeps every line and its box
 *    grows taller. A slightly tall label is fine; a missing word is not.
 *
 * The text is always visible: it may show at full size for a moment and then
 * shrink. (Hiding it while measuring left an empty label for seconds on a
 * busy screen, which is worse than a small resize.)
 *
 * Container rules, which are what keep the text from being clipped by its
 * parent:
 * - The parent must not have a fixed `height`; use `minHeight`.
 * - The parent must have a width limit (a row needs `flexShrink: 1` or
 *   `minWidth: 0` on this component's ancestor chain) or there is nothing to
 *   wrap against.
 * - Do not put this text inside a pressable or animated view that has both
 *   `borderRadius` and `backgroundColor`: Android clips its text. Draw the
 *   fill on an absolutely positioned sibling instead (see `AnswerCard`).
 *
 * It also bundles the Android fixes for Bangers: `includeFontPadding: false`,
 * an explicit line height and `textBreakStrategy="simple"`, plus a little
 * horizontal padding because the slanted font overhangs its last letter.
 * Never set `numberOfLines` or `adjustsFontSizeToFit` elsewhere in
 * child-facing UI; ESLint forbids it.
 *
 * @param {object} props
 * @param {string} props.children - The text to show.
 * @param {object} [props.style] - Text style. `fontSize` and `lineHeight`
 *   are the full-size values the text starts from.
 * @param {number} [props.maxLines=2] - Lines allowed before it shrinks.
 * @param {number} [props.minScale=0.75] - Smallest fraction of `fontSize`.
 * @param {'title'|'body'} [props.font='title'] - Bangers or Nunito.
 */
export function FitText({
  children,
  style,
  maxLines = 2,
  minScale = 0.75,
  font = 'title',
  ...rest
}) {
  const { width: windowWidth } = useWindowDimensions();
  const flat = StyleSheet.flatten(style) || {};
  const baseSize = flat.fontSize || 18;
  const baseLineHeight =
    flat.lineHeight || Math.round(baseSize * (font === 'title' ? 1.3 : 1.25));
  const text = Array.isArray(children)
    ? children.join('')
    : String(children ?? '');

  // Measurement restarts whenever anything that changes the layout changes.
  const key = `${text}|${baseSize}|${baseLineHeight}|${maxLines}|${windowWidth}`;
  const [state, setState] = useState({ key, scale: 1 });
  let current = state;
  if (state.key !== key) {
    // Derived-state reset: start the new text at full size.
    current = { key, scale: 1 };
    setState(current);
  }

  // Every layout report is checked, not just the first. Android can report a
  // wide first layout and then wrap the text once its parent has been sized,
  // so a "settled after the first report" rule left wrapped titles clipped.
  // Shrinking only ever goes down, so this cannot loop.
  const handleTextLayout = event => {
    rest.onTextLayout?.(event);
    const lines = event.nativeEvent.lines || [];
    // A non-final line that does not end in whitespace means a long word was
    // broken in the middle to make it fit - treat that as not fitting.
    const brokeWord = lines.slice(0, -1).some(line => !/\s$/.test(line.text));
    const overflows = lines.length > maxLines || brokeWord;
    if (!overflows) return;
    setState(prev =>
      prev.key === key && prev.scale > minScale + 0.001
        ? { key, scale: Math.max(minScale, prev.scale * SHRINK_STEP) }
        : prev
    );
  };

  if (!text) return null;

  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={1.3}
      {...rest}
      onTextLayout={handleTextLayout}
      textBreakStrategy="simple"
      style={[
        styles.base,
        { fontFamily: font === 'title' ? FONTS.title : FONTS.bodyHeavy },
        style,
        {
          fontSize: baseSize * current.scale,
          lineHeight: baseLineHeight * current.scale,
        },
      ]}
    >
      {text + TRAILING_SLACK}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
    flexShrink: 1,
    // The slanted display font overhangs its last letter.
    paddingHorizontal: 3,
  },
});

export default FitText;
