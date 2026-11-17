/**
 * Pure geometry for the Imperial Elegy board: view (pan/zoom) maths, hit
 * testing and label decluttering.
 *
 * These helpers exist so the map behaves the same for mouse, touch and
 * keyboard, and so the interaction rules can be tested without a DOM.  Points
 * and sizes are in *board units* (the printed scan's pixels, which is also the
 * coordinate space of `constant/spaces.ts`) unless a name says `Px`.
 */

export interface MapView {
  /** Zoom factor; 1 shows the whole board. */
  k: number;
  /** Translation in board units. */
  x: number;
  y: number;
}

/** A rectangle in board units: the printed paper, or the board itself. */
export interface BoardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Smallest zoom that still shows the whole board. */
export const MIN_ZOOM = 1;
/** Deep enough to read a single printed space comfortably. */
export const MAX_ZOOM = 6;
/** Framing a handful of neighbouring spaces must not slam the map to max zoom. */
export const MAX_FRAME_ZOOM = 3.2;

/** Screen-pixel hit radius: comfortable for a mouse and for a fingertip. */
export const MOUSE_HIT_PX = 18;
export const TOUCH_HIT_PX = 26;
/** Never make the clickable area smaller than this many board units. */
export const MIN_HIT_UNITS = 60;
/** Never let a near miss select something across the map. */
export const MAX_HIT_UNITS = 320;

/** Below this pointer travel a press is a click, not a drag. */
export const DRAG_THRESHOLD_PX = 6;

/**
 * Board units per CSS pixel at zoom `k`, given the on-screen size the SVG is
 * drawn at.  The viewBox is fitted with `xMidYMid meet`, so the limiting axis
 * decides.
 */
export const unitsPerPixel = (screen: Size, board: Size, k: number): number => {
  const fit = Math.min(screen.width / board.width, screen.height / board.height);
  if (!(fit > 0)) return 1;
  return 1 / (fit * k);
};

/**
 * Clickable radius in board units.  The printed board is ~6700 units wide, so
 * at "fit" zoom a whole space is only a few pixels across: the radius is
 * derived from the *screen* size and clamped so it stays precise when zoomed in.
 */
export const hitRadiusUnits = (screen: Size, board: Size, k: number, coarse: boolean): number => {
  const px = coarse ? TOUCH_HIT_PX : MOUSE_HIT_PX;
  const units = unitsPerPixel(screen, board, k) * px;
  return Math.min(MAX_HIT_UNITS, Math.max(MIN_HIT_UNITS, units));
};

/** Clamp a view so the board always covers the viewport. */
export const clampView = (view: MapView, board: BoardRect): MapView => {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k));
  // Keep every edge of the board outside the viewport edge.
  const minX = (board.x + board.width) * (1 - k);
  const maxX = board.x * (1 - k);
  const minY = (board.y + board.height) * (1 - k);
  const maxY = board.y * (1 - k);
  return {
    k,
    x: Math.min(maxX, Math.max(minX, view.x)),
    y: Math.min(maxY, Math.max(minY, view.y)),
  };
};

/** Zoom by `factor` while keeping the board point under `anchor` still. */
export const zoomAt = (view: MapView, factor: number, anchor: Point, board: BoardRect): MapView => {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k * factor));
  const ratio = k / view.k;
  return clampView({
    k,
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
  }, board);
};

/** View that centres `point` at zoom `k`. */
export const centreOn = (point: Point, k: number, board: BoardRect): MapView =>
  clampView({
    k,
    x: board.x + board.width / 2 - point.x * k,
    y: board.y + board.height / 2 - point.y * k,
  }, board);

/**
 * View that frames every point in `points` with a little margin.  Used by
 * "show me the legal targets": a pending decision can name spaces on opposite
 * sides of the world, and hunting for them by panning is the worst part of the
 * old map.
 */
export const viewForPoints = (
  points: readonly Point[],
  board: BoardRect,
  screen: Size,
  marginPx = 64,
): MapView => {
  if (points.length === 0) return {k: MIN_ZOOM, x: 0, y: 0};
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const usableW = Math.max(1, screen.width - marginPx * 2);
  const usableH = Math.max(1, screen.height - marginPx * 2);
  // Zoom 1 fits the whole board, so the pixels per board unit at that zoom set
  // the scale a `k` multiplies.
  const fit = Math.min(screen.width / board.width, screen.height / board.height);
  const k = Math.min(MAX_FRAME_ZOOM, Math.max(MIN_ZOOM,
    Math.min(usableW / (spanX * fit), usableH / (spanY * fit))));
  return centreOn({x: (minX + maxX) / 2, y: (minY + maxY) / 2}, k, board);
};

/**
 * Pointer position in board units.
 *
 * The SVG letterboxes its viewBox with `xMidYMid meet`, so the conversion has
 * to reproduce that fit: a click lands where the player aimed even in a short,
 * wide viewport, and it stays correct while the board is panned and zoomed.
 */
export const toBoardPoint = (
  client: Point,
  rect: {left: number; top: number; width: number; height: number},
  board: BoardRect,
  view: MapView,
): Point => {
  const fit = Math.min(rect.width / board.width, rect.height / board.height);
  const offsetX = (rect.width - board.width * fit) / 2;
  const offsetY = (rect.height - board.height * fit) / 2;
  // Screen -> viewBox coordinate (the viewBox itself starts at board.x/y).
  const boxX = board.x + (client.x - rect.left - offsetX) / fit;
  const boxY = board.y + (client.y - rect.top - offsetY) / fit;
  return {x: (boxX - view.x) / view.k, y: (boxY - view.y) / view.k};
};

export interface HitCandidate {
  id: string;
  x: number;
  y: number;
  /** Extra weight for sources that must win ties (e.g. legal targets). */
  weight?: number;
}

/**
 * Pick the nearest candidate to a board point.
 *
 * The printed spaces are a few dozen units apart in Europe, so at fit zoom
 * their clickable areas overlap heavily.  Choosing the nearest centre (rather
 * than trusting DOM paint order) makes a click on a visible marker select that
 * marker; `weight` lets a legal target win a tie against an inert neighbour.
 */
export const nearestCandidate = <T extends HitCandidate>(
  point: Point,
  candidates: readonly T[],
  radius: number,
): T | undefined => {
  let best: T | undefined;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    if (distance > radius) continue;
    const score = distance - (candidate.weight ?? 0);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
};

/** Every candidate under the pointer, nearest first — used for the pick list. */
export const candidatesUnder = <T extends HitCandidate>(
  point: Point,
  candidates: readonly T[],
  radius: number,
): T[] =>
  candidates
    .map((candidate) => ({candidate, distance: Math.hypot(point.x - candidate.x, point.y - candidate.y)}))
    .filter((entry) => entry.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .map((entry) => entry.candidate);

export interface LabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Set for obstacles: a label is never blocked by its own marker. */
  id?: string;
}

export interface LabelRequest {
  id: string;
  /** Label anchor in board units (centre of the text). */
  x: number;
  y: number;
  text: string;
  /** Higher wins when two labels overlap. */
  priority: number;
}

/** Rough on-screen width of a label, in board units, at the given font size. */
export const labelBox = (request: LabelRequest, fontSizeUnits: number): LabelBox => {
  // CJK glyphs are about one em wide, Latin about 0.55 em.  A conservative
  // estimate is enough: it only decides which labels to hide.
  let em = 0;
  for (const char of request.text) {
    em += /[\u3000-\u9fff\uff00-\uffef]/.test(char) ? 1 : 0.55;
  }
  const width = em * fontSizeUnits;
  const height = fontSizeUnits * 1.35;
  // `request.y` is a text baseline, so the box hangs above the anchor.
  return {x: request.x - width / 2, y: request.y - height, width, height};
};

const overlaps = (a: LabelBox, b: LabelBox, gap = 0): boolean =>
  a.x < b.x + b.width + gap &&
  b.x < a.x + a.width + gap &&
  a.y < b.y + b.height + gap &&
  b.y < a.y + a.height + gap;

/**
 * Choose which labels to draw.
 *
 * At fit zoom 145 names cannot all show, so the important ones win: the
 * selection, the legal targets, then occupied spaces, then capitals, then
 * everything else.  Survivors never overlap, so a clicked marker's name stays
 * readable instead of colliding with its neighbours.
 */
export const placeLabels = (
  requests: readonly LabelRequest[],
  fontSizeUnits: number,
  options: {always?: ReadonlySet<string>; limit?: number; obstacles?: readonly LabelBox[]} = {},
): string[] => {
  const always = options.always ?? new Set<string>();
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const blocked = [...(options.obstacles ?? [])];
  const ordered = [...requests].sort((a, b) => {
    const pinned = Number(always.has(b.id)) - Number(always.has(a.id));
    if (pinned !== 0) return pinned;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id < b.id ? -1 : 1;
  });
  const placed: LabelBox[] = [];
  const shown: string[] = [];
  for (const request of ordered) {
    if (shown.length >= limit) break;
    const box = labelBox(request, fontSizeUnits);
    if (blocked.some((obstacle) => obstacle.id !== request.id && overlaps(box, obstacle, fontSizeUnits * 0.3))) continue;
    if (placed.some((other) => overlaps(box, other, fontSizeUnits * 0.35))) continue;
    // The label is anchored below its own marker, so its own box must not count
    // as an obstacle.
    placed.push(box);
    shown.push(request.id);
  }
  return shown;
};
