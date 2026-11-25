/**
 * Picking on the table: the same "nearest marker wins, a legal target wins a
 * tie" rule the SVG map uses, in board units after the pointer's ray lands.
 */
import {MAX_HIT_UNITS, MIN_HIT_UNITS} from "../map-geometry";
import {defaultCamera} from "./camera";
import {pickRadius, pickSpace} from "./hitTest";

const viewport = {width: 1200, height: 800};
const spaces = [
  {id: "berlin", x: 2000, y: 1500},
  {id: "potsdam", x: 2060, y: 1500},
  {id: "paris", x: 1000, y: 2200},
];

test("the pick radius stays between the printed bounds", () => {
  const near = pickRadius(defaultCamera(), viewport, false);
  expect(near).toBeGreaterThanOrEqual(MIN_HIT_UNITS);
  expect(near).toBeLessThanOrEqual(MAX_HIT_UNITS);
  const far = pickRadius({...defaultCamera(), distance: 60}, viewport, false);
  expect(far).toBeLessThanOrEqual(MAX_HIT_UNITS);
  // A finger is a bigger target than a mouse at the same distance.
  expect(pickRadius(defaultCamera(), viewport, true)).toBeGreaterThan(near);
});

test("the nearest marker under the pointer wins", () => {
  expect(pickSpace({x: 2005, y: 1500}, 80, spaces)).toBe("berlin");
  expect(pickSpace({x: 2056, y: 1500}, 80, spaces)).toBe("potsdam");
});

test("nothing within the radius means no selection", () => {
  expect(pickSpace({x: 6000, y: 4000}, 80, spaces)).toBeNull();
});

test("a legal target wins a tie against an inert neighbour", () => {
  const point = {x: 2030, y: 1500};
  expect(pickSpace(point, 80, spaces)).toBe("berlin");
  expect(pickSpace(point, 80, spaces, new Set(["potsdam"]))).toBe("potsdam");
});

test("a target never steals a click from a clearly nearer marker", () => {
  expect(pickSpace({x: 2002, y: 1500}, 80, spaces, new Set(["potsdam"]))).toBe("berlin");
});
