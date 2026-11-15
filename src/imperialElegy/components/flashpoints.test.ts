import {FLASHPOINT_REGIONS, convexHull, flashpointHulls} from "./flashpoints";

describe("flashpoint shading", () => {
  test("the rules name seven flashpoint theatres", () => {
    expect(FLASHPOINT_REGIONS.map((region) => region.id).sort()).toEqual([
      "africa", "balkans", "centralEurope", "chinaJapan",
      "germany", "greatGame", "italy", "lowCountries",
    ].sort());
  });

  test("each theatre has member spaces", () => {
    for (const region of FLASHPOINT_REGIONS) {
      expect(region.spaces.length).toBeGreaterThan(1);
    }
  });

  test("a hull of three points is the triangle", () => {
    const hull = convexHull([{x: 0, y: 0}, {x: 10, y: 0}, {x: 0, y: 10}]);
    expect(hull).toHaveLength(3);
  });

  test("interior points are dropped", () => {
    const hull = convexHull([
      {x: 0, y: 0}, {x: 10, y: 0}, {x: 10, y: 10}, {x: 0, y: 10},
      {x: 5, y: 5},
    ]);
    expect(hull).toHaveLength(4);
  });

  test("every theatre becomes at least one closed path", () => {
    const hulls = flashpointHulls(120);
    const named = new Set(hulls.map((hull) => hull.id.split(":")[0]));
    expect(named.size).toBe(FLASHPOINT_REGIONS.length);
    for (const hull of hulls) {
      expect(hull.d.startsWith("M")).toBe(true);
      expect(hull.d.endsWith("Z")).toBe(true);
    }
  });

  test("a theatre is split per printed panel, not smeared across the ocean", () => {
    // Africa names spaces on the main map and on the inset board; one hull over
    // both would cover the whole Atlantic.
    const africa = flashpointHulls(120).filter((hull) => hull.id.startsWith("africa:"));
    expect(africa.length).toBeGreaterThan(1);
    for (const hull of africa) {
      const numbers = hull.d.match(/-?\d+/g)!.map(Number);
      const xs = numbers.filter((_, i) => i % 2 === 0);
      const ys = numbers.filter((_, i) => i % 2 === 1);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(4000);
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(4000);
    }
  });

  test("a degenerate theatre yields no path rather than a line", () => {
    // Two spaces on one axis cannot bound an area.
    const hull = convexHull([{x: 0, y: 0}, {x: 100, y: 0}]);
    expect(hull.length).toBeLessThan(3);
  });
});
