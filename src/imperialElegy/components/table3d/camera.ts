/**
 * The 3D table's camera, as plain arithmetic.
 *
 * The scene builds a `THREE.PerspectiveCamera` from exactly these numbers, and
 * the table's pointer handling, hit testing and HTML overlay all project with
 * the same functions here.  Keeping the projection out of three.js means it can
 * be unit tested in Node, where there is no WebGL: a round trip through
 * `unproject(project(p))` has to return the board point the pointer is over.
 *
 * Coordinates: board units are the SVG map's (x right, y down, 7706 x 5462).
 * World units are board units / `WORLD_SCALE`, with y up, so the table is the
 * y = 0 plane and board (x, y) is world (x / S, 0, y / S).
 */
export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface BoardBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TableArt = "felt" | "paper";

export interface TableCamera {
  /** Orbit angle around the table, radians. 0 looks from the south edge. */
  yaw: number;
  /** Elevation above the table, radians. 0 is grazing, PI/2 dead overhead. */
  pitch: number;
  /** Distance from the target point, world units. */
  distance: number;
  /** Look-at point on the table, board units. */
  target: Vec2;
  /** Vertical field of view, degrees (three's convention). */
  fov: number;
}

/** Board units per world unit. */
export const WORLD_SCALE = 1000;

/**
 * The lowest elevation the reader can reach, radians (about 29 degrees).
 *
 * A tabletop seen from lower than this stops being a board: the sheet
 * foreshortens into a sliver, the printed names disappear behind the front
 * counters, and every flat layer (plates, rings, standee faces) squeezes into
 * the same few depth buckets.  Players asked for the floor; a grazing camera
 * was never usable, so this is a limit rather than a preference.
 */
export const MIN_PITCH = 0.5;
export const MAX_PITCH = 1.45;
export const MIN_DISTANCE = 0.45;
export const MAX_DISTANCE = 60;
export const DEFAULT_FOV = 45;
/** A one-press return to the table's most readable angle. */
export const OVERHEAD_PITCH = 1.13;
const NEAR = 0.05;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

export const defaultCamera = (target: Vec2 = {x: 3853, y: 2731}): TableCamera => ({
  yaw: 0,
  pitch: OVERHEAD_PITCH,
  distance: 13,
  target,
  fov: DEFAULT_FOV,
});

/** The camera's eye, in world units. */
export const cameraPosition = (camera: TableCamera): Vec3 => {
  const cosPitch = Math.cos(camera.pitch);
  return {
    x: (camera.target.x / WORLD_SCALE) + Math.sin(camera.yaw) * cosPitch * camera.distance,
    y: Math.sin(camera.pitch) * camera.distance,
    z: (camera.target.y / WORLD_SCALE) + Math.cos(camera.yaw) * cosPitch * camera.distance,
  };
};

export const boardToWorld = (point: Vec2): Vec3 => ({
  x: point.x / WORLD_SCALE,
  y: 0,
  z: point.y / WORLD_SCALE,
});

export const worldToBoard = (point: Vec3): Vec2 => ({
  x: point.x * WORLD_SCALE,
  y: point.z * WORLD_SCALE,
});

const subtract = (a: Vec3, b: Vec3): Vec3 => ({x: a.x - b.x, y: a.y - b.y, z: a.z - b.z});
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const normalise = (v: Vec3): Vec3 => {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return {x: v.x / length, y: v.y / length, z: v.z / length};
};

/** The camera basis: forward, right and up in world space. */
export const cameraBasis = (camera: TableCamera): {forward: Vec3; right: Vec3; up: Vec3} => {
  const eye = cameraPosition(camera);
  const target = boardToWorld(camera.target);
  const forward = normalise(subtract(target, eye));
  // The table is never viewed exactly edge-on (pitch is clamped below PI/2),
  // so world up is always a safe reference.
  const right = normalise(cross(forward, {x: 0, y: 1, z: 0}));
  const up = cross(right, forward);
  return {forward, right, up};
};

export interface ProjectedPoint {
  x: number;
  y: number;
  /** Camera-space depth; negative means the point is behind the eye. */
  depth: number;
}

/** Board point -> CSS pixel in a viewport, or null when it is off-camera. */
export const projectPoint = (
  point: Vec2,
  camera: TableCamera,
  viewport: Viewport,
): ProjectedPoint | null => {
  const eye = cameraPosition(camera);
  const {forward, right, up} = cameraBasis(camera);
  const offset = subtract(boardToWorld(point), eye);
  const depth = dot(offset, forward);
  if (depth <= NEAR) return null;
  const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
  const aspect = viewport.width / Math.max(1, viewport.height);
  const ndcX = dot(offset, right) / (depth * tanHalf * aspect);
  const ndcY = dot(offset, up) / (depth * tanHalf);
  return {
    x: (ndcX + 1) * 0.5 * viewport.width,
    y: (1 - ndcY) * 0.5 * viewport.height,
    depth,
  };
};

/**
 * CSS pixel -> the board point under it on the table plane.
 *
 * The ray is built from the same basis as `projectPoint`, so a drag that starts
 * on a marker and a click that lands on it agree to the pixel.
 */
export const unprojectPoint = (
  screen: Vec2,
  camera: TableCamera,
  viewport: Viewport,
): Vec2 | null => {
  const eye = cameraPosition(camera);
  const {forward, right, up} = cameraBasis(camera);
  const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
  const aspect = viewport.width / Math.max(1, viewport.height);
  const ndcX = (screen.x / Math.max(1, viewport.width)) * 2 - 1;
  const ndcY = 1 - (screen.y / Math.max(1, viewport.height)) * 2;
  const direction = normalise({
    x: forward.x + right.x * ndcX * tanHalf * aspect + up.x * ndcY * tanHalf,
    y: forward.y + right.y * ndcX * tanHalf * aspect + up.y * ndcY * tanHalf,
    z: forward.z + right.z * ndcX * tanHalf * aspect + up.z * ndcY * tanHalf,
  });
  if (Math.abs(direction.y) < 1e-6) return null;
  const t = -eye.y / direction.y;
  if (t <= 0) return null;
  return worldToBoard({x: eye.x + direction.x * t, y: 0, z: eye.z + direction.z * t});
};

export const clampCamera = (camera: TableCamera): TableCamera => ({
  ...camera,
  pitch: clamp(camera.pitch, MIN_PITCH, MAX_PITCH),
  distance: clamp(camera.distance, MIN_DISTANCE, MAX_DISTANCE),
  yaw: ((camera.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
});

/** Drag by pixels: horizontal orbits, vertical changes the elevation. */
export const orbitCamera = (
  camera: TableCamera,
  dxPixels: number,
  dyPixels: number,
): TableCamera => clampCamera({
  ...camera,
  yaw: camera.yaw - dxPixels * 0.006,
  pitch: camera.pitch - dyPixels * 0.005,
});

/** Multiply the distance; `factor` below 1 moves closer. */
export const zoomCamera = (camera: TableCamera, factor: number): TableCamera =>
  clampCamera({...camera, distance: camera.distance * factor});

/** A world unit per CSS pixel at the look-at point, for hit radii and drags. */
export const worldPerPixel = (camera: TableCamera, viewport: Viewport): number =>
  (2 * camera.distance * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, viewport.height);

/** Board units per CSS pixel at the look-at point. */
export const boardPerPixel = (camera: TableCamera, viewport: Viewport): number =>
  worldPerPixel(camera, viewport) * WORLD_SCALE;

/** Slide the look-at point across the table by a screen drag. */
export const panCamera = (
  camera: TableCamera,
  dxPixels: number,
  dyPixels: number,
  viewport: Viewport,
): TableCamera => {
  const perPixel = worldPerPixel(camera, viewport);
  const {forward, right} = cameraBasis(camera);
  // "Screen up" flattened onto the table: walking north as the reader drags.
  const flat = normalise({x: forward.x, y: 0, z: forward.z});
  const target = {
    x: camera.target.x + (-right.x * dxPixels + flat.x * dyPixels) * perPixel * WORLD_SCALE,
    y: camera.target.y + (-right.z * dxPixels + flat.z * dyPixels) * perPixel * WORLD_SCALE,
  };
  return clampCamera({...camera, target});
};

/** Keep a look-at point on the sheet, so the table can never be walked away. */
export const clampTarget = (point: Vec2, box: BoardBox): Vec2 => ({
  x: clamp(point.x, box.x, box.x + box.width),
  y: clamp(point.y, box.y, box.y + box.height),
});

/**
 * Walk the look-at point across the table by one step of a held control.
 *
 * `forward` and `right` are in screen pixels, the same unit `panCamera` takes,
 * so the speed of a key or a joystick is expressed the way a drag is: forward
 * walks up the screen (away from the camera), right walks toward the right of
 * the screen, whatever the orbit is.  Unlike a drag — which ends when the
 * pointer lifts — a held key repeats forever, so `bounds` keeps the look-at
 * point on the sheet and a player cannot walk the table out of sight.
 */
export const walkCamera = (
  camera: TableCamera,
  forward: number,
  right: number,
  viewport: Viewport,
  bounds?: BoardBox,
): TableCamera => {
  const moved = panCamera(camera, -right, forward, viewport);
  return bounds === undefined ? moved : {...moved, target: clampTarget(moved.target, bounds)};
};

export const boundsOf = (points: readonly Vec2[]): BoardBox => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y};
};

const boxCorners = (box: BoardBox): Vec2[] => [
  {x: box.x, y: box.y},
  {x: box.x + box.width, y: box.y},
  {x: box.x, y: box.y + box.height},
  {x: box.x + box.width, y: box.y + box.height},
];

const boxFits = (camera: TableCamera, viewport: Viewport, corners: Vec2[], inset: number): boolean =>
  corners.every((corner) => {
    const projected = projectPoint(corner, camera, viewport);
    if (projected === null) return false;
    return projected.x >= inset && projected.x <= viewport.width - inset &&
      projected.y >= inset && projected.y <= viewport.height - inset;
  });

/**
 * The distance at which `box` fills the viewport at the camera's current angle.
 *
 * Bisection rather than a closed form: the visible extent of a tilted
 * rectangle depends on both angles, and this has to agree with `projectPoint`
 * exactly, not approximately.
 */
export const fitDistance = (
  camera: TableCamera,
  viewport: Viewport,
  box: BoardBox,
  inset = 24,
): number => {
  const corners = boxCorners(box);
  // The tightest framing is the *closest* distance that still fits: any
  // further away also fits, but wastes the viewport on the table around it.
  if (boxFits({...camera, distance: MIN_DISTANCE}, viewport, corners, inset)) return MIN_DISTANCE;
  if (!boxFits({...camera, distance: MAX_DISTANCE}, viewport, corners, inset)) return MAX_DISTANCE;
  let near = MIN_DISTANCE;
  let far = MAX_DISTANCE;
  for (let i = 0; i < 32; i += 1) {
    const mid = (near + far) / 2;
    if (boxFits({...camera, distance: mid}, viewport, corners, inset)) far = mid;
    else near = mid;
  }
  return far;
};

/** A camera framing `box` from the current angle. */
export const frameBox = (
  camera: TableCamera,
  viewport: Viewport,
  box: BoardBox,
  inset = 24,
): TableCamera => clampCamera({
  ...camera,
  target: {x: box.x + box.width / 2, y: box.y + box.height / 2},
  distance: fitDistance(camera, viewport, box, inset),
});

const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;

/** Shortest angular path, so a tween never spins the long way round. */
export const shortestAngle = (from: number, to: number): number => {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
};

/** Sample a camera tween; `t` is 0..1 and is eased here. */
export const tweenCamera = (from: TableCamera, to: TableCamera, t: number): TableCamera => {
  const eased = easeInOut(clamp(t, 0, 1));
  return {
    yaw: from.yaw + shortestAngle(from.yaw, to.yaw) * eased,
    pitch: from.pitch + (to.pitch - from.pitch) * eased,
    distance: from.distance + (to.distance - from.distance) * eased,
    target: {
      x: from.target.x + (to.target.x - from.target.x) * eased,
      y: from.target.y + (to.target.y - from.target.y) * eased,
    },
    fov: from.fov + (to.fov - from.fov) * eased,
  };
};
