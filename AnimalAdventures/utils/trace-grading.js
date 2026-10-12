/**
 * Grades a freehand trace against a letter's real stroke path (see
 * letter-paths.js), rather than just the trace's own bounding box.
 *
 * A bounding-box check (does it span enough area, stay centered, avoid big
 * empty gaps) can't tell a real letter from an unrelated scribble that
 * happens to fill the same box - there was nothing in that approach
 * representing the letter's actual shape to compare against. This checks
 * two things instead, both against the real path:
 *   - precision: most of what the child drew should land near the path,
 *     not off wandering somewhere a G/M/whatever doesn't go.
 *   - coverage: most of the path should have something drawn near it, so
 *     tracing only a fraction of the letter doesn't pass just because that
 *     fraction was accurate.
 * Both directions are needed - precision alone would pass a trace that
 * only covers one small correct corner of the letter; coverage alone would
 * pass a trace that wanders everywhere, including over the letter.
 */

import { densifyScaledStrokes } from './letter-paths';

const MIN_POINTS = 6;
// How close a drawn point must be to the guide path to count as "on" it,
// as a fraction of the canvas size. Tuned against synthetic traces rather
// than guessed: with the dense, interpolated guide points densifyScaledStrokes
// produces, a value as generous as it sounds (e.g. 0.16) makes nearly every
// point in the box "close enough" to something, since the guide points end
// up only a few px apart - good letters passed but so did a random scribble.
// 0.045 is generous for finger jitter (heavy, ~18px synthetic jitter still
// passes) while still rejecting an unrelated scribble or scattered strokes
// that only coincidentally span the same box.
const PROXIMITY_RATIO = 0.045;
const MIN_PRECISION_RATIO = 0.6;
const MIN_COVERAGE_RATIO = 0.65;

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const nearestDistance = (point, candidates) => {
  let min = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const d = distance(point, candidates[i]);
    if (d < min) min = d;
  }
  return min;
};

/**
 * @param {object} params
 * @param {{x:number,y:number}[]} params.tracePoints - Everything the child
 *   drew this attempt, in canvas coordinates (same space as `box`).
 * @param {{x:number,y:number}[][]} [params.letterStrokes] - From
 *   LETTER_PATHS, in the normalized 0-100 square.
 * @param {{left:number, top:number, width:number, height:number}} params.box
 *   - The same box the guide is drawn into (see buildGuidePath).
 * @param {number} params.canvasSize - Used to scale the proximity
 *   tolerance to the actual on-screen canvas size.
 * @returns {boolean}
 */
export function gradeTrace({ tracePoints, letterStrokes, box, canvasSize }) {
  if (!letterStrokes || !tracePoints || tracePoints.length < MIN_POINTS) {
    return false;
  }

  const guidePoints = densifyScaledStrokes(letterStrokes, box).flat();
  if (guidePoints.length === 0) return false;

  const tolerance = canvasSize * PROXIMITY_RATIO;

  const closeTraceCount = tracePoints.filter(
    p => nearestDistance(p, guidePoints) <= tolerance
  ).length;
  const precision = closeTraceCount / tracePoints.length;
  if (precision < MIN_PRECISION_RATIO) return false;

  const coveredGuideCount = guidePoints.filter(
    g => nearestDistance(g, tracePoints) <= tolerance
  ).length;
  const coverage = coveredGuideCount / guidePoints.length;

  return coverage >= MIN_COVERAGE_RATIO;
}
