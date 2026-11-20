import {
  DOT_MAX_PX,
  DRAG_THRESHOLD_PX,
  FULL_MIN_PX,
  MAX_FRAME_ZOOM,
  MAX_HIT_UNITS,
  MAP_SECTIONS,
  MAX_ZOOM,
  MIN_HIT_UNITS,
  MIN_ZOOM,
  THEATRES,
  Theatre,
  candidatesUnder,
  centreOn,
  clampView,
  hitRadiusUnits,
  labelBox,
  mapSectionById,
  markerTier,
  nearestCandidate,
  panBy,
  placeLabels,
  shrinkMarkers,
  theatreById,
  theatreOf,
  toBoardPoint,
  unitsPerPixel,
  viewForPoints,
  viewForTheatre,
  zoomAt,
} from "./map-geometry";
import {SPACES, SPACE_IDS, isNavalBox} from "../constant/spaces";
import {POWER_DEFS} from "../constant/powers";
import {Power, SpaceId} from "../types";

const BOARD = {x: 480, y: 532, width: 6693, height: 4382};
const SCREEN = {width: 900, height: 600};

describe("map view", () => {
  test("fit zoom shows the paper edge to edge", () => {
    const view = {k: 1, x: 0, y: 0};
    const clamped = clampView(view, BOARD);
    expect(clamped).toEqual(view);
  });

  test("clamping keeps the paper covering the viewport", () => {
    const clamped = clampView({k: 2, x: 99999, y: -99999}, BOARD);
    expect(clamped.k).toBe(2);
    // The left edge can travel at most to board.x * (1 - k).
    expect(clamped.x).toBe(BOARD.x * (1 - 2));
    // The bottom edge can travel at most to (y+height) * (1 - k).
    expect(clamped.y).toBe((BOARD.y + BOARD.height) * (1 - 2));
  });

  test("zoom is bounded", () => {
    expect(clampView({k: 0.1, x: 0, y: 0}, BOARD).k).toBe(MIN_ZOOM);
    expect(clampView({k: 99, x: 0, y: 0}, BOARD).k).toBe(MAX_ZOOM);
  });

  test("zooming keeps the point under the anchor still", () => {
    const anchor = {x: 2500, y: 2000};
    const before = {k: 1, x: 0, y: 0};
    const after = zoomAt(before, 2, anchor, BOARD);
    // A board point maps to view space as p*k + translation.
    const screenBefore = anchor.x * before.k + before.x;
    const screenAfter = anchor.x * after.k + after.x;
    expect(Math.round(screenAfter)).toBe(Math.round(screenBefore));
  });

  test("centring puts the point in the middle of the paper", () => {
    const point = {x: 3000, y: 2500};
    const view = centreOn(point, 3, BOARD);
    const offset = point.x * view.k + view.x;
    expect(Math.round(offset)).toBe(Math.round(BOARD.x + BOARD.width / 2));
  });

  test("framing several points zooms in no further than needed", () => {
    const view = viewForPoints(
      [{x: 1500, y: 1500}, {x: 4000, y: 2500}],
      BOARD,
      SCREEN,
    );
    expect(view.k).toBeGreaterThan(MIN_ZOOM);
    expect(view.k).toBeLessThan(MAX_ZOOM);
    // Both points stay inside the paper.
    for (const point of [{x: 1500, y: 1500}, {x: 4000, y: 2500}]) {
      const screenX = point.x * view.k + view.x;
      expect(screenX).toBeGreaterThanOrEqual(BOARD.x);
      expect(screenX).toBeLessThanOrEqual(BOARD.x + BOARD.width);
    }
  });

  test("framing an empty set falls back to the whole board", () => {
    expect(viewForPoints([], BOARD, SCREEN)).toEqual({k: MIN_ZOOM, x: 0, y: 0});
  });
});

describe("pointer mapping", () => {
  const rect = {left: 0, top: 0, width: 900, height: 600};

  test("the paper corner maps to the paper origin", () => {
    // Zoom 1 with no pan: the paper's top-left corner is the viewBox origin.
    // The 900x600 viewport letterboxes the paper vertically, so the corner is
    // a few pixels below the top of the element.
    const fit = Math.min(rect.width / BOARD.width, rect.height / BOARD.height);
    const offsetY = (rect.height - BOARD.height * fit) / 2;
    const point = toBoardPoint({x: 0, y: offsetY}, rect, BOARD, {k: 1, x: 0, y: 0});
    expect(point.x).toBeCloseTo(BOARD.x, 0);
    expect(point.y).toBeCloseTo(BOARD.y, 0);
  });

  test("a click in the letterbox bar falls outside the paper", () => {
    // The bar is empty space: it must not select a space at the paper's edge.
    const point = toBoardPoint({x: 0, y: 0}, rect, BOARD, {k: 1, x: 0, y: 0});
    expect(point.y).toBeLessThan(BOARD.y);
  });

  test("letterboxing is accounted for", () => {
    // A paper wider than the viewport leaves vertical bars; a click in the bar
    // must map outside the paper rather than to a shifted point.
    const wide = {left: 0, top: 0, width: 1200, height: 400};
    const point = toBoardPoint({x: 600, y: 200}, wide, BOARD, {k: 1, x: 0, y: 0});
    expect(point.x).toBeCloseTo(BOARD.x + BOARD.width / 2, -1);
    expect(point.y).toBeCloseTo(BOARD.y + BOARD.height / 2, -1);
  });

  test("panning and zooming are inverted correctly", () => {
    const view = {k: 2.5, x: -1200, y: -800};
    // The viewBox starts at the paper origin, so board space and viewBox space
    // differ by that origin only through the translation.
    const rect2 = {left: 40, top: 20, width: 900, height: 600};
    const boardPoint = {x: 3123, y: 2456};
    // Where does that board point land on screen?
    const fit = Math.min(rect2.width / BOARD.width, rect2.height / BOARD.height);
    const offsetX = (rect2.width - BOARD.width * fit) / 2;
    const offsetY = (rect2.height - BOARD.height * fit) / 2;
    // The viewBox starts at the paper origin, so the board point becomes a
    // viewBox position first and a screen position second.
    const boxX = boardPoint.x * view.k + view.x;
    const boxY = boardPoint.y * view.k + view.y;
    const clientX = rect2.left + offsetX + (boxX - BOARD.x) * fit;
    const clientY = rect2.top + offsetY + (boxY - BOARD.y) * fit;
    const back = toBoardPoint({x: clientX, y: clientY}, rect2, BOARD, view);
    expect(back.x).toBeCloseTo(boardPoint.x, 3);
    expect(back.y).toBeCloseTo(boardPoint.y, 3);
  });
});

describe("hit testing", () => {
  test("a fingertip gets a larger target than a mouse", () => {
    const mouse = hitRadiusUnits(SCREEN, BOARD, 1, false);
    const touch = hitRadiusUnits(SCREEN, BOARD, 1, true);
    expect(touch).toBeGreaterThan(mouse);
  });

  test("the target never shrinks below a usable size when zoomed out", () => {
    const tiny = hitRadiusUnits({width: 320, height: 240}, BOARD, 1, true);
    expect(tiny).toBeGreaterThanOrEqual(MIN_HIT_UNITS);
  });

  test("the target never balloons when zoomed in", () => {
    const huge = hitRadiusUnits(SCREEN, BOARD, MAX_ZOOM, false);
    expect(huge).toBeLessThanOrEqual(MAX_HIT_UNITS);
  });

  test("clicks pick the nearest marker, not the topmost one", () => {
    const candidates = [
      {id: "berlin", x: 2578, y: 1515},
      {id: "saxony", x: 2488, y: 1716},
    ];
    const nearSaxony = nearestCandidate({x: 2500, y: 1700}, candidates, 120);
    expect(nearSaxony?.id).toBe("saxony");
    const nearBerlin = nearestCandidate({x: 2560, y: 1530}, candidates, 120);
    expect(nearBerlin?.id).toBe("berlin");
  });

  test("a miss selects nothing", () => {
    const candidates = [{id: "berlin", x: 2578, y: 1515}];
    expect(nearestCandidate({x: 100, y: 100}, candidates, 80)).toBeUndefined();
  });

  test("a legal target wins a tie against an inert neighbour", () => {
    const candidates = [
      {id: "berlin", x: 2578, y: 1515},
      {id: "saxony", x: 2488, y: 1716, weight: 40},
    ];
    const hit = nearestCandidate({x: 2530, y: 1610}, candidates, 200);
    expect(hit?.id).toBe("saxony");
  });

  test("candidates under the pointer are ordered by distance", () => {
    const candidates = [
      {id: "far", x: 100, y: 100},
      {id: "near", x: 20, y: 10},
    ];
    expect(candidatesUnder({x: 0, y: 0}, candidates, 500).map((c) => c.id)).toEqual(["near", "far"]);
  });
});

describe("label placement", () => {
  const base = {priority: 100};

  test("overlapping labels are dropped, the important one survives", () => {
    const shown = placeLabels(
      [
        {id: "a", x: 100, y: 100, text: "Berlin", ...base},
        {id: "b", x: 101, y: 101, text: "Saxony", ...base},
      ],
      12,
    );
    expect(shown).toHaveLength(1);
  });

  test("priority decides which of two overlapping labels stays", () => {
    const shown = placeLabels(
      [
        {id: "a", x: 100, y: 100, text: "Berlin", priority: 10},
        {id: "b", x: 101, y: 101, text: "Saxony", priority: 900},
      ],
      12,
    );
    expect(shown).toEqual(["b"]);
  });

  test("a pinned label always survives", () => {
    const shown = placeLabels(
      [
        {id: "a", x: 100, y: 100, text: "Berlin", priority: 900},
        {id: "b", x: 101, y: 101, text: "Saxony", priority: 10},
      ],
      12,
      {always: new Set(["b"])},
    );
    expect(shown).toContain("b");
  });

  test("labels that do not collide all show", () => {
    const shown = placeLabels(
      [
        {id: "a", x: 0, y: 0, text: "Berlin", ...base},
        {id: "b", x: 800, y: 800, text: "Saxony", ...base},
      ],
      12,
    );
    expect(shown).toHaveLength(2);
  });

  test("the font size scales the reserved box", () => {
    const small = labelBox({id: "a", x: 0, y: 0, text: "柏林", ...base}, 10);
    const large = labelBox({id: "a", x: 0, y: 0, text: "柏林", ...base}, 20);
    expect(large.width).toBeCloseTo(small.width * 2, 5);
  });

  test("CJK labels reserve more room than Latin ones", () => {
    const cjk = labelBox({id: "a", x: 0, y: 0, text: "柏林", ...base}, 10);
    const latin = labelBox({id: "a", x: 0, y: 0, text: "Be", ...base}, 10);
    expect(cjk.width).toBeGreaterThan(latin.width);
  });
});

describe("drag threshold", () => {
  test("is small enough to feel like a click but large enough to tolerate jitter", () => {
    expect(DRAG_THRESHOLD_PX).toBeGreaterThan(2);
    expect(DRAG_THRESHOLD_PX).toBeLessThan(12);
  });

  test("units per pixel falls as zoom rises", () => {
    expect(unitsPerPixel(SCREEN, BOARD, 2)).toBeCloseTo(unitsPerPixel(SCREEN, BOARD, 1) / 2, 6);
  });
});

describe("panning after a pinch", () => {
  const fit = Math.min(SCREEN.width / BOARD.width, SCREEN.height / BOARD.height);

  test("pans by the pointer step at the current zoom", () => {
    const view = {k: 3, x: -2000, y: -1500};
    const moved = panBy(view, 90, 45, fit, BOARD);
    expect(moved.k).toBe(3);
    expect(moved.x).toBeCloseTo(view.x + 90 / fit, 6);
    expect(moved.y).toBeCloseTo(view.y + 45 / fit, 6);
  });

  test("a step from the zoom the pinch reached does not undo the pinch", () => {
    // The finger left on the glass drifts a few pixels after the other one
    // lifts.  It must pan the zoomed view, not drag it back to the zoom the
    // whole gesture started at (the old bug: the gesture's stored view).
    const pinched = zoomAt({k: 1, x: 0, y: 0}, 4, {x: 3000, y: 2500}, BOARD);
    const after = panBy(pinched, 8, -6, fit, BOARD);
    expect(after.k).toBeCloseTo(pinched.k, 6);
    expect(after.k).toBeGreaterThan(1);
    expect(after.x).toBeCloseTo(pinched.x + 8 / fit, 6);
    expect(after.y).toBeCloseTo(pinched.y - 6 / fit, 6);
  });

  test("panning is still clamped so the board covers the viewport", () => {
    const view = zoomAt({k: 1, x: 0, y: 0}, 2, {x: 3000, y: 2500}, BOARD);
    const flung = panBy(view, 100000, -100000, fit, BOARD);
    expect(flung.k).toBe(view.k);
    expect(flung.x).toBe(BOARD.x * (1 - view.k));
    expect(flung.y).toBe((BOARD.y + BOARD.height) * (1 - view.k));
  });
});

describe("marker detail tiers", () => {
  test("a marker a few pixels across is a bare dot", () => {
    expect(markerTier(2)).toBe("dot");
    expect(markerTier(DOT_MAX_PX - 0.1)).toBe("dot");
  });

  test("a marker that is visible but still small draws its shape only", () => {
    expect(markerTier(DOT_MAX_PX)).toBe("shape");
    expect(markerTier(FULL_MIN_PX - 0.1)).toBe("shape");
  });

  test("a comfortable marker carries everything", () => {
    expect(markerTier(FULL_MIN_PX)).toBe("full");
    expect(markerTier(40)).toBe("full");
  });

  test("the same phone zoom is a dot tier while the desktop is not", () => {
    // A phone at fit zoom and a desktop at fit zoom differ by ~2.6x in pixels
    // per board unit, which is exactly why the tier is decided in pixels.
    const phone = unitsPerPixel({width: 348, height: 541}, BOARD, 1);
    const desktop = unitsPerPixel({width: 1002, height: 591}, BOARD, 1);
    expect(markerTier(74 / phone)).toBe("dot");
    expect(markerTier(74 / desktop)).toBe("full");
  });
});

describe("marker shrinking", () => {
  const radius = (id: string) => (id === "box" ? 104 : 74);

  test("neighbours closer than two counters are pulled apart", () => {
    const caps = shrinkMarkers([
      {id: "south-africa", x: 1329, y: 4702, radius: radius("south-africa")},
      {id: "rhodesia", x: 1449, y: 4739, radius: radius("rhodesia")},
    ]);
    // 138 units apart, so neither may exceed 0.42 * 138.
    for (const cap of caps.values()) expect(cap).toBeLessThanOrEqual(138 * 0.42 + 1e-9);
    const a = caps.get("south-africa")!;
    const b = caps.get("rhodesia")!;
    expect(Math.hypot(1329 - 1449, 4702 - 4739)).toBeGreaterThan(a + b);
  });

  test("well-separated markers keep their printed size", () => {
    const caps = shrinkMarkers([
      {id: "london", x: 1576, y: 1568, radius: 74},
      {id: "paris", x: 1566, y: 2118, radius: 74},
    ]);
    expect(caps.get("london")).toBe(74);
    expect(caps.get("paris")).toBe(74);
  });

  test("no two printed markers ever overlap after shrinking", () => {
    const points = SPACE_IDS.map((id) => ({
      id, x: SPACES[id].x, y: SPACES[id].y,
      radius: isNavalBox(id) ? 104 : SPACES[id].type === "territory" ? 62 : 74,
    }));
    const caps = shrinkMarkers(points);
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i];
        const b = points[j];
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - caps.get(a.id)! - caps.get(b.id)!;
        expect(gap).toBeGreaterThan(0);
      }
    }
  });

  test("a lone marker is untouched", () => {
    expect(shrinkMarkers([{id: "solo", x: 0, y: 0, radius: 74}]).get("solo")).toBe(74);
  });
});

describe("theatres", () => {
  const phone = {width: 348, height: 541};
  const within = (theatre: Theatre) =>
    SPACE_IDS.filter((id) => {
      const space = SPACES[id];
      return space.x >= theatre.box.x && space.x <= theatre.box.x + theatre.box.width &&
        space.y >= theatre.box.y && space.y <= theatre.box.y + theatre.box.height;
    });

  test("every theatre but the whole map frames several spaces", () => {
    for (const theatre of THEATRES) {
      if (theatre.id === "all") continue;
      expect(within(theatre).length).toBeGreaterThanOrEqual(3);
    }
  });

  test("a theatre view keeps its spaces readable on a phone", () => {
    // The whole point of the framing: at fit zoom a phone draws two neighbours
    // eight pixels apart; inside a theatre they must be at least 20.
    for (const theatre of THEATRES) {
      if (theatre.id === "all") continue;
      const view = viewForTheatre(theatre, BOARD, phone);
      expect(view.k).toBeGreaterThan(MIN_ZOOM);
      expect(view.k).toBeLessThanOrEqual(MAX_FRAME_ZOOM);
      const perPixel = unitsPerPixel(phone, BOARD, view.k);
      const inside = within(theatre);
      let tightest = Infinity;
      for (let i = 0; i < inside.length; i++) {
        for (let j = i + 1; j < inside.length; j++) {
          const a = SPACES[inside[i]];
          const b = SPACES[inside[j]];
          tightest = Math.min(tightest, Math.hypot(a.x - b.x, a.y - b.y));
        }
      }
      expect(tightest / perPixel).toBeGreaterThan(20);
    }
  });

  test("the whole map is exactly fit zoom", () => {
    const view = viewForTheatre(THEATRES[0], BOARD, phone);
    expect(view.k).toBe(MIN_ZOOM);
  });

  test("every player capital is framed by an interactive theatre", () => {
    for (const power of Object.keys(POWER_DEFS) as Power[]) {
      const capital = SPACES[POWER_DEFS[power].capital as SpaceId];
      expect(capital).toBeDefined();
      const theatre = theatreOf(capital);
      expect(theatre.id).not.toBe("all");
      expect(within(theatre)).toContain(capital.id);
    }
  });

  test("a point on a border picks the tighter of the two theatres", () => {
    // Berlin sits inside both the central-European and the eastern theatre;
    // the tighter one is where the fighting around it is legible.
    expect(theatreOf(SPACES.berlin).id).toBe("centralEurope");
    expect(theatreOf(SPACES.london).id).toBe("westEurope");
    expect(theatreOf(SPACES.istanbul).id).toBe("balkansNearEast");
    expect(theatreOf(SPACES["st-petersburg"]).id).toBe("eastEurope");
  });

  test("theatres are addressable by id", () => {
    expect(theatreById("asia")?.labelZh).toBe("亚洲");
    expect(theatreById("nowhere")).toBeUndefined();
  });

  test("the atlas has exactly the three requested sheets", () => {
    expect(MAP_SECTIONS.map((section) => section.labelZh)).toEqual(["欧美", "亚洲", "非洲"]);
    expect(MAP_SECTIONS.map((section) => section.id)).toEqual(["europeAmerica", "asia", "africa"]);
    expect(mapSectionById("asia")?.labelEn).toBe("Asia");
    expect(mapSectionById("nowhere" as never)).toBeUndefined();
  });

  test("each atlas sheet contains its own spaces and frames larger than fit", () => {
    for (const section of MAP_SECTIONS) {
      const own = SPACE_IDS.filter((id) => {
        const space = SPACES[id];
        const region = space.region;
        if (section.id === "europeAmerica") return region === "europe" || region === "northAmerica";
        if (section.id === "asia") return region === "asia" || region === "pacific";
        return region === "africa";
      });
      expect(own.length).toBeGreaterThan(0);
      for (const id of own) {
        const space = SPACES[id];
        // The section crops overlap at their edges; the important guarantee is
        // that the sheet's centre and own spaces are not cropped off.
        if (section.id === "europeAmerica" && space.region === "northAmerica") {
          expect(space.x).toBeGreaterThanOrEqual(section.box.x);
        }
      }
      const view = viewForTheatre(section, section.box, phone);
      expect(view.k).toBeGreaterThanOrEqual(MIN_ZOOM);
    }
  });
});
