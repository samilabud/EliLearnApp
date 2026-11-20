import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { FONTS } from '../../constants/theme';

/** How much smaller each re-measure pass makes the text. */
const SHRINK_STEP = 0.92;
/** If the text never reports a layout, show it anyway after this long. */
const SETTLE_FALLBACK_MS = 400;

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
 * The text stays invisible until it has settled (usually one or two passes),
 * so there is no visible jump.
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
  const [state, setState] = useState({ key, scale: 1, settled: false });
  let current = state;
  if (state.key !== key) {
    // Derived-state reset: start the new text at full size, unsettled.
    current = { key, scale: 1, settled: false };
    setState(current);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setState(prev =>
        prev.key === key && !prev.settled ? { ...prev, settled: true } : prev
      );
    }, SETTLE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [key]);

  const handleTextLayout = event => {
    rest.onTextLayout?.(event);
    if (state.key !== key || state.settled) return;
    const lines = event.nativeEvent.lines || [];
    // A non-final line that does not end in whitespace means a long word was
    // broken in the middle to make it fit - treat that as not fitting.
    const brokeWord = lines.slice(0, -1).some(line => !/\s$/.test(line.text));
    const overflows = lines.length > maxLines || brokeWord;
    if (overflows && state.scale > minScale + 0.001) {
      setState({
        key,
        scale: Math.max(minScale, state.scale * SHRINK_STEP),
        settled: false,
      });
    } else {
      setState({ ...state, settled: true });
    }
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
          opacity: current.settled ? (flat.opacity ?? 1) : 0,
        },
      ]}
    >
      {text}
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
