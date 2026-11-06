import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

/**
 * Picks the column count that gives the largest cards while still fitting
 * every item inside `width` x `height`. Cards are `size` wide and
 * `size * aspect` tall.
 */
export function bestFit(count, width, height, gap, aspect = 1) {
  let best = { columns: 1, size: 0 };
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const byWidth = (width - gap * (columns - 1)) / columns;
    const byHeight = (height - gap * (rows - 1)) / rows / aspect;
    const size = Math.floor(Math.min(byWidth, byHeight));
    if (size > best.size) best = { columns, size };
  }
  return best;
}

/**
 * A grid of answer cards sized from the space it is actually given - width
 * *and* height - instead of from the window width alone.
 *
 * Every quiz screen used to size its cards from width only and cap them at
 * phone sizes, which left most of an iPad (and the bottom of a landscape
 * phone) empty, or pushed cards off-screen in landscape. This measures its
 * own area and chooses the column count that makes the cards as large as
 * possible while still showing every one without scrolling. If even
 * `minSize` cards cannot fit (a very short landscape phone), it falls back
 * to `minSize` cards in a scrollable grid rather than shrinking them past
 * what a child can comfortably hit.
 *
 * `renderItem(item, size, index)` must return an element that fills a
 * `size` x `size * aspect` box; `keyExtractor` names each cell.
 */
export function FitGrid({
  items,
  renderItem,
  keyExtractor,
  gap = 16,
  aspect = 1,
  minSize = 96,
  maxSize = 280,
  style,
}) {
  const [area, setArea] = useState(null);

  const onLayout = event => {
    const { width, height } = event.nativeEvent.layout;
    if (!area || area.width !== width || area.height !== height) {
      setArea({ width, height });
    }
  };

  let grid = null;
  if (area && items.length > 0) {
    const fit = bestFit(items.length, area.width, area.height, gap, aspect);
    const fits = fit.size >= minSize;
    let columns = fit.columns;
    let size = Math.min(maxSize, fit.size);
    if (!fits) {
      columns = Math.max(1, Math.floor((area.width + gap) / (minSize + gap)));
      size = Math.max(
        minSize,
        Math.floor((area.width - gap * (columns - 1)) / columns)
      );
    }
    // Rows stay balanced: 5 items in 3 columns become 3 + 2 centered, not a
    // lone straggler, because the row width is capped to the columns used.
    const rowWidth = columns * size + (columns - 1) * gap;

    const cells = (
      <View style={[styles.wrap, { width: rowWidth, gap }]}>
        {items.map((item, index) => (
          <View
            key={keyExtractor(item, index)}
            style={{ width: size, height: Math.round(size * aspect) }}
          >
            {renderItem(item, size, index)}
          </View>
        ))}
      </View>
    );

    grid = fits ? (
      <View style={styles.center}>{cells}</View>
    ) : (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {cells}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.area, style]} onLayout={onLayout}>
      {grid}
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
    alignSelf: 'stretch',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
});

export default FitGrid;
