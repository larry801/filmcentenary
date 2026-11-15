import {ConnectionType} from "../types";

/**
 * Printed connection styles.
 *
 * Taken from the printed board, which draws three kinds of frontier:
 *
 *  - a **solid dark line** across an ordinary land border;
 *  - a **dashed dark line** across a difficult frontier (the Alps, the
 *    Carpathians, the Caucasus);
 *  - a **solid red line** across water, the cue for what a fleet can reach;
 *
 * plus the Trans-Siberian Railroad's dash-dot line.
 *
 * Sizes are in **board units** (the printed scan's pixels, 1 unit ≈ 0.1 mm).
 * The board is 6693 units wide, so a line that reads like the printed ~1 mm
 * frontier is about 10 units.  `map.tsx` never draws below one screen pixel, so
 * the network stays legible at fit zoom.
 */
export interface ConnectionStyle {
  stroke: string;
  /** Dash pattern, in board units. */
  dash?: [number, number];
  /** Line weight, in board units. */
  width: number;
}

export const CONNECTION_STYLE: Record<ConnectionType, ConnectionStyle> = {
  clear: {stroke: "#3b2e20", width: 11},
  difficult: {stroke: "#51402a", width: 10, dash: [40, 26]},
  severe: {stroke: "#8a3a22", width: 11, dash: [32, 20]},
  tsrr: {stroke: "#5a4a2e", width: 10, dash: [50, 18]},
  sea: {stroke: "#c0392b", width: 6},
};

/**
 * Stroke width in board units: the printed weight, but never below 1.1 screen
 * pixels so the network does not vanish when the whole board is in view.
 */
export const connectionWidth = (style: ConnectionStyle, unitsPerPx: number): number =>
  Math.max(style.width, unitsPerPx * 1.1);

/** Dash pattern in board units; `undefined` for a solid line. */
export const connectionDash = (style: ConnectionStyle, unitsPerPx: number): string | undefined =>
  style.dash
    ? `${Math.max(style.dash[0], unitsPerPx * 4.5)} ${Math.max(style.dash[1], unitsPerPx * 3)}`
    : undefined;

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Shorten both ends of a frontier line so it starts and stops at the edge of
 * the printed markers instead of running underneath them, the way the board
 * prints it.  `gapA` / `gapB` are the marker radii plus a little clearance.
 */
export const trimSegment = (
  a: {x: number; y: number},
  b: {x: number; y: number},
  gapA: number,
  gapB: number,
): Segment | null => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  // Overlapping or coincident markers: nothing to draw.
  if (length <= gapA + gapB) return null;
  const ux = dx / length;
  const uy = dy / length;
  return {
    x1: a.x + ux * gapA,
    y1: a.y + uy * gapA,
    x2: b.x - ux * gapB,
    y2: b.y - uy * gapB,
  };
};
