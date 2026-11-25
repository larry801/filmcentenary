/**
 * The table camera is arithmetic, so it is tested as arithmetic: no canvas, no
 * WebGL, no React.  The one contract the rest of the feature leans on is that
 * a pointer's pixel and the board point under it agree — `unprojectPoint` must
 * invert `projectPoint` exactly.
 */
import {
  MAX_DISTANCE,
  MAX_PITCH,
  MIN_DISTANCE,
  MIN_PITCH,
  OVERHEAD_PITCH,
  type TableCamera,
  boundsOf,
  cameraBasis,
  clampCamera,
  defaultCamera,
  fitDistance,
  frameBox,
  clampTarget,
  orbitCamera,
  panCamera,
  projectPoint,
  tweenCamera,
  unprojectPoint,
  walkCamera,
  zoomCamera,
} from "./camera";

const viewport = {width: 1200, height: 800};

const camera = (overrides: Partial<TableCamera> = {}): TableCamera => ({
  ...defaultCamera({x: 3853, y: 2731}),
  ...overrides,
});

test("the camera target lands in the middle of the viewport", () => {
  const projected = projectPoint({x: 3853, y: 2731}, camera(), viewport);
  expect(projected).not.toBeNull();
  expect(projected!.x).toBeCloseTo(600, 5);
  expect(projected!.y).toBeCloseTo(400, 5);
});

test.each([
  ["overhead", OVERHEAD_PITCH, 0, [{x: 10, y: 20}, {x: 600, y: 400}, {x: 1180, y: 780}]],
  ["tilted", 0.9, 0.8, [{x: 10, y: 20}, {x: 600, y: 400}, {x: 1180, y: 780}]],
  // At a grazing angle the top of the viewport is above the horizon: a
  // pointer there is in the air, which correctly has no table point.
  ["low", 0.3, -2.1, [{x: 600, y: 400}, {x: 300, y: 700}, {x: 900, y: 780}]],
])("a pointer round-trips through the table from a %s camera", (_label, pitch, yaw, screens) => {
  const view = camera({pitch, yaw, distance: 9});
  for (const screen of screens) {
    const board = unprojectPoint(screen, view, viewport);
    expect(board).not.toBeNull();
    const back = projectPoint(board!, view, viewport);
    expect(back).not.toBeNull();
    expect(back!.x).toBeCloseTo(screen.x, 3);
    expect(back!.y).toBeCloseTo(screen.y, 3);
  }
});

test("a pointer aimed above the horizon has no table point", () => {
  // The reader cannot reach this camera any more — the elevation floor is
  // higher — but the projection still has to refuse a ray that never meets the
  // table, because a framing tween can pass through any intermediate camera.
  const view = camera({pitch: 0.3, distance: 9});
  expect(unprojectPoint({x: 600, y: 10}, view, viewport)).toBeNull();
});

test("a point behind the eye has no projection", () => {
  const view = camera({pitch: 0.4, distance: 2});
  // Far off the far side of the table, behind the camera's back.
  expect(projectPoint({x: 3853, y: 2731 + 60000}, view, viewport)).toBeNull();
});

test("the camera basis stays orthonormal away from the vertical", () => {
  const {forward, right, up} = cameraBasis(camera({pitch: MIN_PITCH, yaw: 1.1}));
  const dot = (a: {x: number; y: number; z: number}, b: {x: number; y: number; z: number}) =>
    a.x * b.x + a.y * b.y + a.z * b.z;
  expect(dot(forward, forward)).toBeCloseTo(1, 6);
  expect(dot(right, right)).toBeCloseTo(1, 6);
  expect(dot(up, up)).toBeCloseTo(1, 6);
  expect(dot(forward, right)).toBeCloseTo(0, 6);
});

test("the elevation cannot be lowered into a grazing view", () => {
  // Players asked for the floor: below it the sheet foreshortens into a sliver
  // and every flat layer shares its depth buckets.
  expect(MIN_PITCH).toBeGreaterThan(0.45);
  expect(clampCamera(camera({pitch: 0.05})).pitch).toBe(MIN_PITCH);
  expect(orbitCamera(camera(), 0, 5000).pitch).toBe(MIN_PITCH);
});

test("pitch, distance and yaw are clamped", () => {
  expect(clampCamera(camera({pitch: 9})).pitch).toBe(MAX_PITCH);
  expect(clampCamera(camera({pitch: -9})).pitch).toBe(MIN_PITCH);
  expect(clampCamera(camera({distance: 0.0001})).distance).toBe(MIN_DISTANCE);
  expect(clampCamera(camera({distance: 1000})).distance).toBe(MAX_DISTANCE);
  expect(clampCamera(camera({yaw: -Math.PI / 2 - Math.PI * 4})).yaw).toBeGreaterThanOrEqual(0);
});

test("orbiting turns the camera and never rolls it past the table", () => {
  const start = camera();
  const turned = orbitCamera(start, 120, 0);
  expect(turned.yaw).toBeCloseTo((start.yaw - 0.72 + Math.PI * 2) % (Math.PI * 2), 5);
  expect(orbitCamera(start, -120, 0).yaw).toBeCloseTo(0.72, 5);
  expect(orbitCamera(start, 0, 10000).pitch).toBe(MIN_PITCH);
  expect(orbitCamera(start, 0, -10000).pitch).toBe(MAX_PITCH);
});

test("zooming changes the distance and stops at the limits", () => {
  const start = camera({distance: 8});
  expect(zoomCamera(start, 0.5).distance).toBeCloseTo(4, 5);
  expect(zoomCamera(start, 0.0001).distance).toBe(MIN_DISTANCE);
  expect(zoomCamera(start, 100000).distance).toBe(MAX_DISTANCE);
});

test("panning moves the look-at point along the table, not into the air", () => {
  const start = camera({pitch: OVERHEAD_PITCH});
  const moved = panCamera(start, 120, 0, viewport);
  expect(moved.target.y).toBeCloseTo(start.target.y, 6);
  expect(Math.abs(moved.target.x - start.target.x)).toBeGreaterThan(100);
  const vertical = panCamera(start, 0, 90, viewport);
  expect(Math.abs(vertical.target.y - start.target.y)).toBeGreaterThan(50);
  expect(vertical.target.x).toBeCloseTo(start.target.x, 3);
});

test("walking moves the look-at point the way the screen reads", () => {
  const start = camera({pitch: OVERHEAD_PITCH, yaw: 0});
  const forward = walkCamera(start, 90, 0, viewport);
  // The camera looks from +z, so walking up the screen moves the target -y.
  expect(Math.abs(forward.target.y - start.target.y)).toBeGreaterThan(50);
  expect(forward.target.y).toBeLessThan(start.target.y);
  const right = walkCamera(start, 0, 90, viewport);
  expect(right.target.x).toBeGreaterThan(start.target.x);
  expect(right.target.y).toBeCloseTo(start.target.y, 3);
});

test("walking is screen-relative, so an orbit does not invert it", () => {
  const turned = camera({pitch: OVERHEAD_PITCH, yaw: Math.PI});
  const walked = walkCamera(turned, 90, 0, viewport);
  // From the far side of the table, "up the screen" is the other way on the
  // board — the same gesture, read from where the reader is standing.
  expect(walked.target.y).toBeGreaterThan(turned.target.y);
});

test("a step scales with how far the camera is", () => {
  const near = walkCamera(camera({distance: 3}), 120, 0, viewport);
  const far = walkCamera(camera({distance: 12}), 120, 0, viewport);
  const nearStep = Math.hypot(near.target.x - camera({distance: 3}).target.x, near.target.y - camera({distance: 3}).target.y);
  const farStep = Math.hypot(far.target.x - camera({distance: 12}).target.x, far.target.y - camera({distance: 12}).target.y);
  expect(farStep).toBeGreaterThan(nearStep);
});

test("a held key cannot walk the table off the sheet", () => {
  const sheet = {x: 0, y: 0, width: 7706, height: 5462};
  let view = camera({pitch: OVERHEAD_PITCH});
  for (let i = 0; i < 400; i += 1) view = walkCamera(view, 200, 200, viewport, sheet);
  // Forward walks up the screen (toward the sheet's y = 0 edge) and right walks
  // toward +x, so a held key ends up pinned in that corner, not off the sheet.
  expect(view.target.x).toBeLessThanOrEqual(sheet.width);
  expect(view.target.x).toBeGreaterThan(sheet.width - 1);
  expect(view.target.y).toBeGreaterThanOrEqual(sheet.y);
  expect(view.target.y).toBeLessThan(sheet.y + 1);
});

test("a look-at point is clamped onto the sheet, never outside it", () => {
  const sheet = {x: 100, y: 50, width: 400, height: 300};
  expect(clampTarget({x: -900, y: 9999}, sheet)).toEqual({x: 100, y: 350});
  expect(clampTarget({x: 300, y: 200}, sheet)).toEqual({x: 300, y: 200});
});

test("framing a box keeps all four of its corners on screen", () => {
  const box = {x: 2000, y: 1200, width: 1800, height: 1100};
  const fitted = frameBox(camera(), viewport, box);
  expect(fitted.target.x).toBeCloseTo(box.x + box.width / 2, 5);
  expect(fitted.target.y).toBeCloseTo(box.y + box.height / 2, 5);
  const corners = [
    {x: box.x, y: box.y},
    {x: box.x + box.width, y: box.y},
    {x: box.x, y: box.y + box.height},
    {x: box.x + box.width, y: box.y + box.height},
  ];
  for (const corner of corners) {
    const projected = projectPoint(corner, fitted, viewport);
    expect(projected).not.toBeNull();
    expect(projected!.x).toBeGreaterThan(0);
    expect(projected!.x).toBeLessThan(viewport.width);
    expect(projected!.y).toBeGreaterThan(0);
    expect(projected!.y).toBeLessThan(viewport.height);
  }
});

test("a wider box needs a longer lens", () => {
  const small = fitDistance(camera(), viewport, {x: 3000, y: 2000, width: 600, height: 400});
  const large = fitDistance(camera(), viewport, {x: 1000, y: 500, width: 5000, height: 4000});
  expect(large).toBeGreaterThan(small);
});

test("boundsOf spans every point it is given", () => {
  expect(boundsOf([{x: 10, y: 40}, {x: -5, y: 12}])).toEqual({x: -5, y: 12, width: 15, height: 28});
});

test("a camera tween starts and ends exactly at its endpoints", () => {
  const from = camera({yaw: 0.2, pitch: 1.0, distance: 10, target: {x: 100, y: 200}});
  const to = camera({yaw: 0.9, pitch: 0.5, distance: 4, target: {x: 900, y: 700}});
  const start = tweenCamera(from, to, 0);
  const end = tweenCamera(from, to, 1);
  expect(start.distance).toBeCloseTo(from.distance, 6);
  expect(start.target.x).toBeCloseTo(from.target.x, 6);
  expect(end.distance).toBeCloseTo(to.distance, 6);
  expect(end.target.y).toBeCloseTo(to.target.y, 6);
  expect(end.yaw).toBeCloseTo(to.yaw, 6);
  const middle = tweenCamera(from, to, 0.5);
  expect(middle.distance).toBeLessThan(from.distance);
  expect(middle.distance).toBeGreaterThan(to.distance);
});

test("a tween takes the short way round the orbit", () => {
  const from = camera({yaw: 0.1});
  const to = camera({yaw: Math.PI * 2 - 0.1});
  const middle = tweenCamera(from, to, 0.5);
  // The long way would pass PI; the short way stays near zero.
  expect(Math.min(middle.yaw, Math.PI * 2 - middle.yaw)).toBeLessThan(0.2);
});
