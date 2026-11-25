/**
 * Pointer -> space for the 3D table.
 *
 * The SVG map hits tests in screen pixels through its own fit; the table hits
 * tests in board units after a perspective ray lands on the table plane.  Both
 * end in the same rule: the nearest marker wins, and a legal target wins a tie,
 * so a click on a dense corner of Europe selects what the player aimed at.
 */
import {MAX_HIT_UNITS, MIN_HIT_UNITS, MOUSE_HIT_PX, TOUCH_HIT_PX, nearestCandidate} from "../map-geometry";
import {type TableCamera, type Vec2, type Viewport, boardPerPixel} from "./camera";

export interface PickableSpace {
  id: string;
  x: number;
  y: number;
}

/** How forgiving a pointer is, in board units, at this camera distance. */
export const pickRadius = (
  camera: TableCamera,
  viewport: Viewport,
  coarse: boolean,
): number => {
  const pixels = coarse ? TOUCH_HIT_PX : MOUSE_HIT_PX;
  return Math.min(MAX_HIT_UNITS, Math.max(MIN_HIT_UNITS, pixels * boardPerPixel(camera, viewport)));
};

/**
 * The space under a board point.
 *
 * `targets` are the legal destinations of the move in progress: they are what
 * the player is aiming at, so they beat an inert neighbour at the same
 * distance, exactly as the SVG map's rings do.
 */
export const pickSpace = (
  point: Vec2,
  radius: number,
  spaces: readonly PickableSpace[],
  targets: ReadonlySet<string> = new Set(),
): string | null => {
  // The same strength the SVG map gives its rings: a target is pulled toward
  // the pointer by a quarter of the pick radius, so it wins a tie against an
  // inert neighbour but never steals a click from a marker clearly nearer.
  const candidates = spaces.map((space) => ({
    ...space,
    weight: targets.has(space.id) ? radius * 0.25 : 0,
  }));
  return nearestCandidate(point, candidates, radius)?.id ?? null;
};
