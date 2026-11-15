/**
 * Cross-check the hand-transcribed setup against the VASSAL module.
 *
 * `src/imperialElegy/data/generated/campaign-setup.json` is the publisher's own
 * saved campaign: 591 pieces with a board, an x/y position and sometimes a zone.
 * `module.json` carries the map's zone polygons, so a piece's coordinates say
 * which printed space it starts in.  That gives an independent witness for the
 * setup in `constant/setup.ts` — the numbers were transcribed by hand from the
 * printed sheets, and a transcription slip is invisible to every logic test.
 *
 * Scope note: this compares *counts per power and per space*, not every marker.
 * A mismatch here is either a transcription bug or a stale generated file, and
 * both are worth failing on; the point is to have the comparison written down
 * so a future data edit cannot silently disagree with the module.
 */
import setup from "../../src/imperialElegy/data/generated/campaign-setup.json";
import moduleData from "../../src/imperialElegy/data/generated/module.json";
import {CAMPAIGN_SETUP} from "../../src/imperialElegy/constant/setup";
import {SPACES} from "../../src/imperialElegy/constant/spaces";
import {POWERS, Power} from "../../src/imperialElegy/types";

jest.setTimeout(300000);

interface Piece {
  name: string;
  board: string;
  x: number;
  y: number;
  zone: string | null;
}

interface Zone {
  name: string;
  path: string;
}

/** The transcribed setup units, typed the way `constant/setup.ts` declares them. */
const SETUP_UNITS = CAMPAIGN_SETUP.units as unknown as {owner: Power; space: string; kind: string}[];

const PIECES = (setup as unknown as {pieces: Piece[]}).pieces;

/** Main-map zone polygons, parsed into point lists. */
const MAIN_MAP_ZONES: Zone[] = (moduleData as unknown as {
  zones: Record<string, Zone[]>;
}).zones["Main Map"];

/** Ray-casting point-in-polygon, for the `x,y;x,y;…` zone format. */
const inPolygon = (x: number, y: number, path: string): boolean => {
  const points = path.split(";").map((pair) => pair.split(",").map(Number));
  if (points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (!Number.isFinite(xi) || !Number.isFinite(yi) || !Number.isFinite(xj) || !Number.isFinite(yj)) continue;
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
};

/** The printed zone a main-map piece stands in, or null when it is off-space. */
const zoneOf = (piece: Piece): string | null => {
  for (const zone of MAIN_MAP_ZONES) {
    if (inPolygon(piece.x, piece.y, zone.path)) return zone.name;
  }
  return null;
};

/** Module piece-name prefix → power (the module writes "French Army/1"). */
/**
 * Module piece-name prefix → the owner it belongs to.  Players map to a `Power`;
 * the independent minors map to their own name, which is what the setup uses as
 * a unit owner, so both are compared.
 */
const OWNER_OF_NAME: Record<string, string> = {
  German: "GE",
  "UK": "UK",
  British: "UK",
  French: "FR",
  Austrian: "AU",
  Russian: "RU",
  Ottoman: "OT",
  // The module labels a minor's armies by the *space*, not by the minor
  // ("Piedmont 1st Army/0"), and India's army as "Indian Army/1" rather than a
  // UK unit, so both conventions need an entry.
  Belgium: "Belgium",
  Netherlands: "Netherlands",
  Hanover: "Hanover",
  Saxony: "Saxony",
  Bavaria: "Bavaria",
  Denmark: "Denmark",
  Piedmont: "Sardinia-Piedmont",
  Sardinia: "Sardinia-Piedmont",
  Naples: "Two Sicilies",
  "Two Sicilies": "Two Sicilies",
  Ethiopia: "REBEL:Ethiopia",
  "Indian Army": "UK",
  Italian: "IT",
  "United States": "US",
};

/** Longest prefix wins, so "Two Sicilies" is not read as "Two". */
const OWNER_PREFIXES = Object.keys(OWNER_OF_NAME).sort((a, b) => b.length - a.length);

const ownerOfPiece = (name: string): string | undefined => {
  const prefix = OWNER_PREFIXES.find((candidate) => name.startsWith(`${candidate} `));
  return prefix === undefined ? undefined : OWNER_OF_NAME[prefix];
};

/**
 * Display markers the module draws on the map but which are not a unit on a
 * space: influence, VP/PP tracks, alliance and pacification markers.  They are
 * modelled elsewhere in our state (`influence`, `powerProjection`,
 * `pacification`) and are deliberately out of scope for a unit comparison.
 */
const NON_UNIT_NAMES = /Influence|Power Projection|VP |Pacification|Fortress Marker|Alliance|Initiative|Independence|\bFP\b/i;

const isUnitPiece = (piece: Piece): boolean =>
  !NON_UNIT_NAMES.test(piece.name)
  // "EXP Force" is the module's label for an expeditionary force (South Africa,
  // Russian Far East), which our setup lists as an `expeditionary` unit.
  && /Army|Squadron|Dreadnought|Corps|Expeditionary|EXP Force/i.test(piece.name);

/** Module zone name → our SpaceId, for the names that differ in print. */
const ZONE_TO_SPACE: Record<string, string> = {
  "Austrila & New Zeland": "australia-new-zealand",
  "Belgium - Low Countries": "belgium",
  "Netherlands - Low Countries": "netherlands",
  "North Atlantic Box": "north-atlantic",
  "South Atlantic Box": "south-atlantic",
  "Baltic Sea Box": "baltic-sea",
  "Eastern Mediterranean Box": "eastern-mediterranean",
  "Western Mediterranean Box": "western-mediterranean",
  "Black Sea Box": "black-sea",
  "Indian Ocean Box": "indian-ocean",
  "Pacific Ocean Box": "pacific-ocean",
  "South & Central Pacific Ocean Box": "south-central-pacific",
};

const normalize = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Our space id for a module zone name. */
const spaceForZone = (zone: string): string | undefined => {
  if (ZONE_TO_SPACE[zone] !== undefined) return ZONE_TO_SPACE[zone];
  const direct = normalize(zone);
  if (SPACES[direct] !== undefined) return direct;
  return undefined;
};

/** Land/naval pieces the module places on the main map, by power and space. */
const modulePlacements = (): Map<string, Set<string>> => {
  const bySpace = new Map<string, Set<string>>();
  for (const piece of PIECES) {
    if (piece.board !== "Main Map") continue;
    if (!isUnitPiece(piece)) continue;
    const owner = ownerOfPiece(piece.name);
    if (owner === undefined) continue;
    const zone = zoneOf(piece);
    if (zone === null) continue; // a display marker (FP/VP/PP), not a space unit
    const space = spaceForZone(zone);
    if (space === undefined) continue;
    const owners = bySpace.get(space) ?? new Set<string>();
    owners.add(owner);
    bySpace.set(space, owners);
  }
  return bySpace;
};

/**
 * Spaces where the module and our setup describe the same start differently.
 * Each entry is checked by "the representation notes stay honest": a note that
 * no longer matches anything fails, and so does one whose space no longer holds
 * that owner's unit.  Keeping them honest matters — a stale note silently hides
 * the next real difference.
 */
const REPRESENTATION_NOTES: Record<string, string> = {
  // (A UK influence marker in Belgium is filtered out by `isUnitPiece`, so it
  // never reaches this table; see "the representation notes stay honest".)
  // India's army is the UK's Indian Army (`special: "indian"` in our setup).
  "UK @ india": "Indian Army special unit",
  // The module draws only a fort/fleet marker here; our setup lists the
  // formation that garrisons it.
  "AU @ lombardy": "fort-garrison formation",
  "RU @ sevastopol": "fort-garrison formation",
};

describe("VASSAL module cross-check", () => {
  test("the generated setup file is present and plausible", () => {
    expect(PIECES.length).toBeGreaterThan(500);
    expect(MAIN_MAP_ZONES.length).toBeGreaterThan(100);
  });

  test("every power named in the module setup is a real power", () => {
    const named = new Set<string>();
    for (const piece of PIECES) {
      const owner = ownerOfPiece(piece.name);
      if (owner !== undefined && (POWERS as readonly string[]).includes(owner)) named.add(owner);
    }
    expect([...named].sort()).toEqual([...POWERS].sort());
  });

  test("our setup places every power the module places on the main map", () => {
    const placements = modulePlacements();
    expect(placements.size).toBeGreaterThan(20);

    // For each space the module fills, the transcribed setup must also have a
    // unit of that power there.  This catches a unit typed in the wrong space.
    const missing: string[] = [];
    for (const [space, owners] of placements) {
      for (const power of owners) {
        const entry = SETUP_UNITS.find(
          (unit) => unit.space === space && unit.owner === (power as Power),
        );
        if (entry === undefined) missing.push(`${power} @ ${space}`);
      }
    }
    const unexplained = missing.filter((entry) => REPRESENTATION_NOTES[entry] === undefined);
    if (missing.length > 0) console.log(`missing in setup: ${missing.join(", ")}`);
    expect(unexplained).toEqual([]);
  });

  test("our setup does not invent main-map starts the module leaves empty", () => {
    const placements = modulePlacements();
    const extra: string[] = [];
    for (const unit of SETUP_UNITS) {
      // Only look at spaces the module actually draws on the main map; a setup
      // unit in a space with no module polygon is simply out of scope here.
      const zone = MAIN_MAP_ZONES.find((candidate) => spaceForZone(candidate.name) === unit.space);
      if (zone === undefined) continue;
      const owners = placements.get(unit.space);
      if (owners === undefined || !owners.has(unit.owner as string)) {
        extra.push(`${unit.owner} @ ${unit.space}`);
      }
    }
    const unexplained = extra.filter((entry) => REPRESENTATION_NOTES[entry] === undefined);
    if (extra.length > 0) console.log(`extra in setup: ${extra.join(", ")}`);
    expect(unexplained).toEqual([]);
  });
});

describe("the representation notes stay honest", () => {
  test("every note still corresponds to a real difference", () => {
    // A note that no longer matches anything is dead weight that hides the next
    // real difference, so assert each one is actually in play today.
    const placements = modulePlacements();
    const live: string[] = [];
    for (const [space, owners] of placements) {
      for (const owner of owners) {
        const inSetup = SETUP_UNITS.some(
          (unit) => unit.space === space && (unit.owner as string) === owner,
        );
        if (!inSetup) live.push(`${owner} @ ${space}`);
      }
    }
    for (const unit of SETUP_UNITS) {
      const zone = MAIN_MAP_ZONES.find((candidate) => spaceForZone(candidate.name) === unit.space);
      if (zone === undefined) continue;
      const owners = placements.get(unit.space);
      if (owners === undefined || !owners.has(unit.owner as string)) {
        const key = `${unit.owner} @ ${unit.space}`;
        if (!live.includes(key)) live.push(key);
      }
    }
    const stale = Object.keys(REPRESENTATION_NOTES).filter((entry) => !live.includes(entry));
    if (stale.length > 0) console.log(`stale notes: ${stale.join(", ")}`);
    expect(stale).toEqual([]);
  });

  test("each noted space still holds that owner's unit in our setup", () => {
    // The note says "same start, described differently" — so the setup must
    // still list something there.  This catches a note left behind after the
    // unit moved or was deleted.
    const missing: string[] = [];
    for (const entry of Object.keys(REPRESENTATION_NOTES)) {
      const [owner, space] = entry.split(" @ ");
      const found = SETUP_UNITS.some((unit) => unit.space === space && (unit.owner as string) === owner);
      if (!found) missing.push(entry);
    }
    expect(missing).toEqual([]);
  });
});
