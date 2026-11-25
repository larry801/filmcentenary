/**
 * The walk controls are arithmetic: a key set and a stick offset turn into one
 * axis pair, and the camera step they drive is `walkCamera`'s.  Testing the
 * mapping here keeps the component's animation loop a loop.
 */
import {STILL, WALK_PIXELS_PER_SECOND, keysWalk, stickAxis, stickOffset, sumWalk} from "./walk";

test("W and S are opposite on the forward axis, A and D on the right axis", () => {
  expect(keysWalk(["w"])).toEqual({forward: 1, right: 0});
  expect(keysWalk(["s"])).toEqual({forward: -1, right: 0});
  expect(keysWalk(["d"])).toEqual({forward: 0, right: 1});
  expect(keysWalk(["a"])).toEqual({forward: 0, right: -1});
});

test("holding two keys walks diagonally, and opposites cancel", () => {
  expect(keysWalk(["w", "d"])).toEqual({forward: 1, right: 1});
  expect(keysWalk(["w", "s"])).toEqual(STILL);
  expect(keysWalk(["a", "d"])).toEqual(STILL);
});

test("keys the map uses for something else do not walk", () => {
  expect(keysWalk(["ArrowUp", "Enter", "Shift", "q"])).toEqual(STILL);
});

test("a stick's deflection is its speed, clamped to the rim", () => {
  expect(stickAxis(0, 34)).toBe(0);
  expect(stickAxis(17, 34)).toBeCloseTo(0.5, 6);
  expect(stickAxis(-34, 34)).toBe(-1);
  expect(stickAxis(400, 34)).toBe(1);
  expect(stickAxis(-400, 34)).toBe(-1);
  expect(stickAxis(10, 0)).toBe(0);
});

test("the knob follows the thumb but cannot leave the base", () => {
  const centre = {x: 100, y: 100};
  expect(stickOffset({x: 110, y: 100}, centre, 34)).toEqual({x: 10, y: 0});
  const far = stickOffset({x: 100, y: 300}, centre, 34);
  expect(Math.hypot(far.x, far.y)).toBeCloseTo(34, 6);
  expect(far.x).toBeCloseTo(0, 6);
  expect(far.y).toBeCloseTo(34, 6);
});

test("a key and a stick push together, but never past full speed", () => {
  expect(sumWalk({forward: 1, right: 0}, {forward: 0, right: 1})).toEqual({forward: 1, right: 1});
  expect(sumWalk({forward: 1, right: 0}, {forward: 1, right: 0})).toEqual({forward: 1, right: 0});
  expect(sumWalk({forward: 0.5, right: 0}, {forward: 0, right: 0})).toEqual({forward: 0.5, right: 0});
});

test("a full second of walking is a whole second's speed", () => {
  // The loop multiplies by the frame's seconds; one second at full deflection
  // has to cover exactly the documented distance.
  expect(WALK_PIXELS_PER_SECOND * 1).toBe(620);
  expect(WALK_PIXELS_PER_SECOND).toBeGreaterThan(0);
});
