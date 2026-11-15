import {SPACES, SPACE_IDS} from "../constant/spaces";
import {SpaceId, Submap} from "../types";

export interface Point {
  x: number;
  y: number;
}

/**
 * Convex hull (monotone chain) of a set of board points.
 *
 * The printed board shades its "flashpoint" regions — the Low Countries,
 * Germany, Central Europe, Italy, the Balkans, Africa, the Great Game and
 * China–Japan — with a tinted hatch.  The rules name the member spaces, so the
 * hull of those spaces is a faithful, data-driven outline for that shading: no
 * extra artwork, and nothing to drift out of date when a space moves.
 */
export const convexHull = (points: readonly Point[]): Point[] => {
  if (points.length < 3) return [...points];
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o: Point, a: Point, b: Point): number =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
};

/** Every flashpoint region named by the rules, with its member spaces. */
export const FLASHPOINT_REGIONS: {id: string; spaces: SpaceId[]}[] = (() => {
  const groups = new Map<string, SpaceId[]>();
  for (const id of SPACE_IDS) {
    for (const name of SPACES[id]?.flashpoints ?? []) {
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push(id);
    }
  }
  return [...groups.entries()]
    .map(([id, spaces]) => ({id, spaces}))
    .sort((a, b) => a.id.localeCompare(b.id));
})();

/** Grow a hull away from its centre so the tint clears the printed markers. */
const grow = (points: readonly Point[], pad: number): Point[] => {
  const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  return points.map((point) => {
    const dx = point.x - cx;
    const dy = point.y - cy;
    const length = Math.hypot(dx, dy) || 1;
    return {x: point.x + (dx / length) * pad, y: point.y + (dy / length) * pad};
  });
};

/**
 * A band around a two-space region.  The Low Countries are only two spaces, so
 * their hull is a line; the printed board still shades them, so widen the line
 * into a quadrilateral instead of dropping the region.
 */
const bandAround = (a: Point, b: Point, pad: number): Point[] | null => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const nx = (-dy / length) * pad;
  const ny = (dx / length) * pad;
  const ux = (dx / length) * pad * 0.6;
  const uy = (dy / length) * pad * 0.6;
  return [
    {x: a.x - ux + nx, y: a.y - uy + ny},
    {x: b.x + ux + nx, y: b.y + uy + ny},
    {x: b.x + ux - nx, y: b.y + uy - ny},
    {x: a.x - ux - nx, y: a.y - uy - ny},
  ];
};

const toPath = (points: readonly Point[]): string =>
  `M${points.map((point) => `${point.x.toFixed(0)},${point.y.toFixed(0)}`).join("L")}Z`;

/**
 * Hull polygons for the flashpoint shading.
 *
 * A theatre can span more than one printed panel — the African flashpoint names
 * both the Mediterranean coast on the main map and the inset board — so the
 * hull is computed per panel; one hull across both would smear a huge tinted
 * wedge over the ocean between them.
 */
export const flashpointHulls = (pad: number): {id: string; d: string}[] => {
  const out: {id: string; d: string}[] = [];
  for (const region of FLASHPOINT_REGIONS) {
    const byPanel = new Map<Submap, Point[]>();
    for (const id of region.spaces) {
      const space = SPACES[id];
      if (!space) continue;
      if (!byPanel.has(space.submap)) byPanel.set(space.submap, []);
      byPanel.get(space.submap)!.push({x: space.x, y: space.y});
    }
    for (const [panel, points] of byPanel) {
      if (points.length >= 3) {
        const hull = convexHull(points);
        // Collinear points cannot bound an area; widen them into a band.
        const shape = hull.length >= 3 ? grow(hull, pad) : bandAround(points[0], points[points.length - 1], pad);
        if (shape) out.push({id: `${region.id}:${panel}`, d: toPath(shape)});
      } else if (points.length === 2) {
        const shape = bandAround(points[0], points[1], pad);
        if (shape) out.push({id: `${region.id}:${panel}`, d: toPath(shape)});
      }
    }
  }
  return out;
};
