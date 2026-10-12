/**
 * Simplified capital-letter stroke paths, one entry per letter this app can
 * ever ask a child to trace (derived from `firstLetterOf` across
 * `animalList` - see letter-sounds.js for the same derivation applied to
 * audio). Each letter is a list of strokes, each stroke a polyline of
 * points in a normalized 0-100 square (x right, y down).
 *
 * This exists because the trace game used to grade a freehand drawing only
 * against its bounding box (coverage/centered/length), which can't tell a
 * real letter from an unrelated scribble that happens to fill the same box
 * - there was no actual letter shape anywhere in the code to compare
 * against. This data is that shape: both the dashed guide drawn on the
 * canvas and the grading in trace-grading.js are built from it, so what a
 * child sees and what they're graded against are exactly the same path.
 *
 * These are deliberately simple geometric approximations (straight
 * segments and circular/elliptical arcs), not a real font's outlines -
 * plenty for a shape a preschooler can recognize and trace.
 */

/** Points along an ellipse arc, `steps+1` of them, start/end in degrees (0 = +x, 90 = +y, clockwise). */
const arc = (cx, cy, rx, ry, startDeg, endDeg, steps = 12) => {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const deg = startDeg + ((endDeg - startDeg) * i) / steps;
    const rad = (deg * Math.PI) / 180;
    pts.push({
      x: Math.round((cx + rx * Math.cos(rad)) * 10) / 10,
      y: Math.round((cy + ry * Math.sin(rad)) * 10) / 10,
    });
  }
  return pts;
};

/** A straight stroke through the given [x, y] waypoints. */
const line = (...coords) => coords.map(([x, y]) => ({ x, y }));

export const LETTER_PATHS = {
  A: [line([12, 96], [50, 6]), line([50, 6], [88, 96]), line([28, 62], [72, 62])],
  B: [
    line([18, 6], [18, 96]),
    arc(18, 28, 28, 22, -90, 90, 10),
    arc(18, 73, 32, 23, -90, 90, 10),
  ],
  C: [arc(50, 51, 42, 45, 40, 320, 16)],
  D: [line([18, 6], [18, 96]), arc(18, 51, 38, 45, -90, 90, 14)],
  E: [
    line([18, 6], [18, 96]),
    line([18, 6], [82, 6]),
    line([18, 51], [65, 51]),
    line([18, 96], [82, 96]),
  ],
  F: [line([18, 6], [18, 96]), line([18, 6], [82, 6]), line([18, 51], [65, 51])],
  G: [arc(50, 51, 42, 45, 40, 320, 16), line([92, 51], [58, 51], [58, 72])],
  H: [line([18, 6], [18, 96]), line([82, 6], [82, 96]), line([18, 51], [82, 51])],
  I: [line([50, 6], [50, 96])],
  K: [line([18, 6], [18, 96]), line([18, 51], [85, 6]), line([18, 51], [85, 96])],
  L: [line([18, 6], [18, 96]), line([18, 96], [80, 96])],
  M: [
    line([12, 96], [12, 6]),
    line([12, 6], [50, 55]),
    line([50, 55], [88, 6]),
    line([88, 6], [88, 96]),
  ],
  O: [arc(50, 51, 42, 45, -90, 270, 18)],
  P: [line([18, 6], [18, 96]), arc(18, 28, 30, 22, -90, 90, 10)],
  R: [
    line([18, 6], [18, 96]),
    arc(18, 28, 30, 22, -90, 90, 10),
    line([18, 50], [85, 96]),
  ],
  S: [
    line(
      [72, 16],
      [40, 10],
      [20, 22],
      [22, 38],
      [42, 48],
      [58, 54],
      [78, 64],
      [80, 80],
      [60, 92],
      [28, 88]
    ),
  ],
  T: [line([15, 6], [85, 6]), line([50, 6], [50, 96])],
  V: [line([12, 6], [50, 96]), line([50, 96], [88, 6])],
  W: [line([8, 6], [30, 96], [50, 40], [70, 96], [92, 6])],
};

/**
 * A letter's strokes mapped from the normalized 0-100 square onto a real
 * target box (e.g. the canvas's inset drawing area). The box should be
 * square (equal width/height) for the letters to keep their proportions.
 * @param {{x:number,y:number}[][]} strokes
 * @param {{left:number, top:number, width:number, height:number}} box
 * @returns {{x:number,y:number}[][]}
 */
export const scaleStrokes = (strokes, box) =>
  strokes.map(stroke =>
    stroke.map(p => ({
      x: box.left + (p.x / 100) * box.width,
      y: box.top + (p.y / 100) * box.height,
    }))
  );

/**
 * Scaled strokes with extra points interpolated along each straight
 * segment, so consecutive waypoints are never more than ~stepPx apart.
 *
 * Grading checks "is there a guide point near this drawn point" (and the
 * reverse) by nearest neighbor. A straight stroke like a stem or a leg is
 * only two waypoints - start and end - so without this, a point drawn
 * exactly on the middle of that stroke can be far from BOTH waypoints and
 * wrongly fail, even though it's precisely on the line. Curved strokes
 * (built with the `arc` helper above) are already densely sampled and
 * barely affected by this.
 * @param {{x:number,y:number}[][]} strokes
 * @param {{left:number, top:number, width:number, height:number}} box
 * @param {number} [stepPx]
 * @returns {{x:number,y:number}[][]}
 */
export const densifyScaledStrokes = (strokes, box, stepPx = 6) =>
  scaleStrokes(strokes, box).map(stroke => {
    const out = [];
    for (let i = 0; i < stroke.length - 1; i++) {
      const a = stroke[i];
      const b = stroke[i + 1];
      const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.round(segmentLength / stepPx));
      for (let s = 0; s < steps; s++) {
        out.push({
          x: a.x + ((b.x - a.x) * s) / steps,
          y: a.y + ((b.y - a.y) * s) / steps,
        });
      }
    }
    const last = stroke[stroke.length - 1];
    if (last) out.push(last);
    return out;
  });

/**
 * An SVG path `d` string for a letter's strokes, scaled onto a box - for
 * drawing the dashed guide. Each stroke is its own "M ... L ... L ..."
 * subpath, so a stroke break never renders as a straight line connecting
 * two unrelated strokes.
 * @param {{x:number,y:number}[][]} strokes
 * @param {{left:number, top:number, width:number, height:number}} box
 * @returns {string}
 */
export const buildGuidePath = (strokes, box) =>
  scaleStrokes(strokes, box)
    .map(stroke =>
      stroke
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ')
    )
    .join(' ');
