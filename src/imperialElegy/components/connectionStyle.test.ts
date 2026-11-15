import {CONNECTION_STYLE, connectionDash, connectionWidth, trimSegment} from "./connectionStyle";

describe("printed connection styles", () => {
  test("every connection type has a style", () => {
    expect(Object.keys(CONNECTION_STYLE).sort()).toEqual(
      ["clear", "difficult", "sea", "severe", "tsrr"],
    );
  });

  test("land frontiers are solid", () => {
    expect(CONNECTION_STYLE.clear.dash).toBeUndefined();
    expect(connectionDash(CONNECTION_STYLE.clear, 7)).toBeUndefined();
  });

  test("difficult, severe and railroad frontiers are dashed", () => {
    for (const type of ["difficult", "severe", "tsrr"] as const) {
      expect(CONNECTION_STYLE[type].dash).toBeDefined();
      expect(connectionDash(CONNECTION_STYLE[type], 7)).toMatch(/^\d+(\.\d+)? \d+(\.\d+)?$/);
    }
  });

  test("sea routes are the red ones", () => {
    const land = new Set(
      (["clear", "difficult", "severe"] as const).map((type) => CONNECTION_STYLE[type].stroke),
    );
    expect(land.has(CONNECTION_STYLE.sea.stroke)).toBe(false);
    expect(CONNECTION_STYLE.sea.stroke).toMatch(/^#c0392b$/i);
  });

  test("widths never fall below one screen pixel", () => {
    // At fit zoom a board unit is ~7 px, so a 5-unit line would be invisible.
    expect(connectionWidth(CONNECTION_STYLE.clear, 40)).toBeGreaterThanOrEqual(40);
    // Zoomed in, the printed weight wins and the line does not balloon.
    expect(connectionWidth(CONNECTION_STYLE.clear, 1)).toBe(CONNECTION_STYLE.clear.width);
  });

  test("dashes keep a visible length at any zoom", () => {
    const tight = connectionDash(CONNECTION_STYLE.difficult, 40)!;
    const [on] = tight.split(" ").map(Number);
    expect(on).toBeGreaterThanOrEqual(4.5 * 40 - 1e-9);
  });
});

describe("line trimming", () => {
  test("a line stops at the marker edges", () => {
    const trimmed = trimSegment({x: 0, y: 0}, {x: 100, y: 0}, 20, 30)!;
    expect(trimmed.x1).toBeCloseTo(20, 6);
    expect(trimmed.x2).toBeCloseTo(70, 6);
  });

  test("the trim is symmetric along the segment's direction", () => {
    const trimmed = trimSegment({x: 0, y: 0}, {x: 0, y: 100}, 10, 40)!;
    expect(trimmed.y1).toBeCloseTo(10, 6);
    expect(trimmed.y2).toBeCloseTo(60, 6);
    expect(trimmed.x1).toBeCloseTo(0, 6);
    expect(trimmed.x2).toBeCloseTo(0, 6);
  });

  test("markers that touch leave nothing to draw", () => {
    expect(trimSegment({x: 0, y: 0}, {x: 50, y: 0}, 30, 30)).toBeNull();
  });

  test("coincident markers do not produce a degenerate line", () => {
    expect(trimSegment({x: 10, y: 10}, {x: 10, y: 10}, 5, 5)).toBeNull();
  });
});
