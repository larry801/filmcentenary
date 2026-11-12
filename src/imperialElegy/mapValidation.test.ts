/**
 * Independent validation of the Imperial Elegy map, setup and printed tracks.
 *
 * This file deliberately does not import engine helpers that compute the same
 * values it checks.  It reads the map data, the campaign setup and the VASSAL
 * metadata directly, and compares them with the printed player displays and
 * the saved campaign setup in `data/generated/campaign-setup.json`.
 *
 * Failures are reported as a list of named offenders rather than as a bare
 * boolean, so a broken space/connection/track can be fixed without debugging
 * the test itself.
 */
import fs from "fs";
import path from "path";
import {SPACES, SPACE_IDS, CONNECTIONS, NAVAL_BOXES, connectionsOf} from "./constant/spaces";
import {CAMPAIGN_SETUP, MINOR_POWER_HOMES} from "./constant/setup";
import {POWER_DEFS} from "./constant/powers";
import {GOALS, CAMPAIGN_GOALS, GOALS_BY_ID, CAMPAIGN_GOAL_IDS} from "./constant/goals";
import {Power, POWERS} from "./types";
import {
  PLAYBOOK_START_KEYS,
  TRACK_LENGTHS,
  KEY_MANPOWER_EXPECTED,
  UK_SECONDARY_KEY_MANPOWER_EXPECTED,
  OT_ARAB_KEY_SPACES,
  NON_SPACE_ZONES,
  SPACES_WITHOUT_ZONE,
  ZONE_ALIASES,
  ZONE_REGION_SUFFIXES,
  ZONE_CENTER_TOLERANCE,
} from "./data/referenceExpectations";

const POWER_TABLE: Power[] = [...POWERS];
const POWER_SET = new Set<string>(POWERS);

const OVERRIDES = new Map<string, string | null>(
  CAMPAIGN_SETUP.controlOverrides.map((override) => [override.space, override.control]),
);

/** Initial control after the campaign setup's control overrides. */
const effectiveControl = (space: string): string | null => {
  if (OVERRIDES.has(space)) return OVERRIDES.get(space) ?? null;
  return SPACES[space]?.control ?? null;
};

const isPower = (value: string | null): value is Power => value !== null && POWER_SET.has(value);
const isMinor = (value: string | null): boolean =>
  value !== null && !POWER_SET.has(value) && Object.prototype.hasOwnProperty.call(MINOR_POWER_HOMES, value);
const isNavalBox = (space: string): boolean => SPACES[space]?.type === "navalBox";
const hasPort = (space: string): boolean => (SPACES[space]?.ports?.length ?? 0) > 0;
const pairKey = (a: string, b: string): string => [a, b].sort().join("|");

/** The other endpoint of an undirected connection. */
const endpoint = (connection: {a: string; b: string}, id: string): string =>
  connection.a === id ? connection.b : connection.a;

const report = (heading: string, violations: string[]): void => {
  if (violations.length > 0) {
    throw new Error(`${heading}\n${violations.map((violation) => `  - ${violation}`).join("\n")}`);
  }
};

interface ModuleZone {
  name: string;
  path: string;
}

interface ModuleMetadata {
  zones: Record<string, ModuleZone[]>;
}

const moduleMetadata: ModuleMetadata = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data/generated/module.json"), "utf8"),
) as ModuleMetadata;
const MAIN_MAP_ZONES = moduleMetadata.zones["Main Map"] ?? [];

const normalizeName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");

const suffixPattern = new RegExp(
  ` - (?:${ZONE_REGION_SUFFIXES.map((suffix) => suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`,
);

const zoneToSpaceId = (zoneName: string): string | undefined => {
  const alias = ZONE_ALIASES[zoneName];
  if (alias) return SPACES[alias] ? alias : undefined;
  const base = zoneName.replace(suffixPattern, "");
  const wanted = normalizeName(base);
  for (const space of Object.values(SPACES)) {
    if (normalizeName(space.name) === wanted) return space.id;
  }
  return undefined;
};

const zoneCenter = (zone: ModuleZone): {x: number; y: number} => {
  const points = zone.path
    .split(";")
    .filter((point) => point.trim().length > 0)
    .map((point) => point.split(",").map((value) => Number(value.trim())));
  if (points.length === 0 || points.some((point) => point.length < 2 || point.some((value) => !Number.isFinite(value)))) {
    throw new Error(`zone ${zone.name} has an unparseable path: ${zone.path}`);
  }
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return {x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2};
};

interface KeyCounts {
  territorial: number;
  colonial: number;
  arab: number;
}

const countKeysFromMap = (): Record<Power, KeyCounts> => {
  const counts = {
    GE: {territorial: 0, colonial: 0, arab: 0},
    UK: {territorial: 0, colonial: 0, arab: 0},
    FR: {territorial: 0, colonial: 0, arab: 0},
    AU: {territorial: 0, colonial: 0, arab: 0},
    RU: {territorial: 0, colonial: 0, arab: 0},
    OT: {territorial: 0, colonial: 0, arab: 0},
  } as Record<Power, KeyCounts>;

  for (const space of Object.values(SPACES)) {
    if (!space.keyType) continue;
    const owner = effectiveControl(space.id);
    if (!isPower(owner)) continue;
    if (owner === "OT") {
      if (OT_ARAB_KEY_SPACES.includes(space.id)) counts.OT.arab += 1;
      else counts.OT.territorial += 1;
      continue;
    }
    if (space.keyType === "colonial") {
      // Crown Jewel: controlling India counts as two colonial keys.
      counts[owner].colonial += owner === "UK" && space.id === "india" ? 2 : 1;
    } else {
      counts[owner].territorial += 1;
    }
  }
  return counts;
};

// ---------------------------------------------------------------------------
// Ports and naval boxes
// ---------------------------------------------------------------------------

test("every port entry names a real naval box", () => {
  const violations: string[] = [];
  for (const space of Object.values(SPACES)) {
    const ports = space.ports ?? [];
    if (new Set(ports).size !== ports.length) {
      violations.push(`${space.id}: duplicate entry in ports [${ports.join(", ")}]`);
    }
    for (const box of ports) {
      if (!SPACES[box] || SPACES[box].type !== "navalBox") {
        violations.push(`${space.id}: port "${box}" is not a naval box`);
      }
    }
  }
  report("Port entries must name naval boxes:", violations);
});

test("every port entry has a sea connection to the naval box it names", () => {
  const violations: string[] = [];
  for (const space of Object.values(SPACES)) {
    for (const box of space.ports ?? []) {
      if (!SPACES[box] || SPACES[box].type !== "navalBox") continue;
      const link = CONNECTIONS.find(
        (connection) =>
          connection.type === "sea" &&
          pairKey(connection.a, connection.b) === pairKey(space.id, box),
      );
      if (!link) {
        violations.push(
          `${space.id}: lists port ${box} but there is no sea connection; add ["${space.id}", "${box}", "sea"]`,
        );
      }
    }
  }
  report("Port entries without a sea connection:", violations);
});

test.each([...NAVAL_BOXES])("naval box %s is reachable from a connected port", (box) => {
  const users = Object.values(SPACES).filter((space) => (space.ports ?? []).includes(box));
  if (users.length === 0) throw new Error(`naval box ${box} is not listed as a port by any space`);
  const connected = users.filter((space) =>
    CONNECTIONS.some(
      (connection) =>
        connection.type === "sea" &&
        pairKey(connection.a, connection.b) === pairKey(space.id, box),
    ),
  );
  if (connected.length === 0) {
    throw new Error(`naval box ${box} has no sea connection to any of its listed ports`);
  }
  const navalNeighbours = CONNECTIONS.filter(
    (connection) =>
      connection.type === "sea" &&
      isNavalBox(connection.a) &&
      isNavalBox(connection.b) &&
      (connection.a === box || connection.b === box),
  );
  if (navalNeighbours.length === 0 && connected.length === 0) {
    throw new Error(`naval box ${box} is isolated from the naval-box graph`);
  }
});

test("the naval-box sea graph is connected", () => {
  const adjacency = new Map<string, string[]>(NAVAL_BOXES.map((box) => [box, []]));
  for (const connection of CONNECTIONS) {
    if (connection.type !== "sea") continue;
    if (!isNavalBox(connection.a) || !isNavalBox(connection.b)) continue;
    adjacency.get(connection.a)!.push(connection.b);
    adjacency.get(connection.b)!.push(connection.a);
  }
  const visited = new Set<string>();
  const queue = [NAVAL_BOXES[0]];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) queue.push(next);
  }
  const unreachable = NAVAL_BOXES.filter((box) => !visited.has(box));
  report("Naval boxes are not mutually reachable by sea:", unreachable.map((box) => `${box} is unreachable`));
});

// ---------------------------------------------------------------------------
// Connection graph
// ---------------------------------------------------------------------------

test("connections have no self-links, duplicates or dangling endpoints and are symmetric", () => {
  const violations: string[] = [];
  const seen = new Map<string, string>();
  for (const connection of CONNECTIONS) {
    const label = `${connection.a} -- ${connection.b}`;
    if (connection.a === connection.b) {
      violations.push(`${label}: self-link`);
      continue;
    }
    if (!SPACES[connection.a]) violations.push(`${label}: unknown endpoint ${connection.a}`);
    if (!SPACES[connection.b]) violations.push(`${label}: unknown endpoint ${connection.b}`);
    const key = pairKey(connection.a, connection.b);
    const previous = seen.get(key);
    if (previous) {
      violations.push(`${label}: duplicate of ${previous}`);
    } else {
      seen.set(key, label);
    }
    const reverse = connectionsOf(connection.b).find(
      (candidate) => endpoint(candidate, connection.b) === connection.a,
    );
    if (!reverse) {
      violations.push(`${label}: not present in connectionsOf(${connection.b})`);
    } else if (reverse.type !== connection.type) {
      violations.push(`${label}: type ${connection.type} but reverse record is ${reverse.type}`);
    }
    const forward = connectionsOf(connection.a).filter(
      (candidate) => endpoint(candidate, connection.a) === connection.b,
    );
    if (forward.length !== 1) {
      violations.push(`${label}: connectionsOf(${connection.a}) contains it ${forward.length} times`);
    }
  }
  report("Connection graph is not a clean undirected graph:", violations);
});

test("land/sea connection types are structurally possible", () => {
  const violations: string[] = [];
  for (const connection of CONNECTIONS) {
    const label = `${connection.a} -- ${connection.b} (${connection.type})`;
    const aIsBox = isNavalBox(connection.a);
    const bIsBox = isNavalBox(connection.b);
    const aIsNavalBase = SPACES[connection.a]?.type === "navalBase";
    const bIsNavalBase = SPACES[connection.b]?.type === "navalBase";

    if (connection.type !== "sea") {
      if (aIsBox || bIsBox) violations.push(`${label}: a land connection cannot involve a naval box`);
      if (aIsNavalBase || bIsNavalBase) {
        violations.push(`${label}: armies cannot enter naval bases, so this must be a sea connection`);
      }
      continue;
    }

    if (aIsBox && bIsBox) continue;
    if (aIsBox || bIsBox) {
      const landEnd = aIsBox ? connection.b : connection.a;
      const box = aIsBox ? connection.a : connection.b;
      if (!hasPort(landEnd)) {
        violations.push(`${label}: sea link to ${box} from a space with no port`);
      } else if (!(SPACES[landEnd].ports ?? []).includes(box)) {
        violations.push(`${label}: ${landEnd} is not listed as a port of ${box}`);
      }
      continue;
    }
    if (!hasPort(connection.a) || !hasPort(connection.b)) {
      violations.push(`${label}: sea link between land spaces that are not both ports`);
    }
  }
  report("Impossible land/sea connection type:", violations);
});

test("every space has at least one connection", () => {
  const violations = SPACE_IDS.filter((id) => connectionsOf(id).length === 0).map(
    (id) => `${id} has no connections`,
  );
  report("Isolated spaces:", violations);
});

// ---------------------------------------------------------------------------
// Key counts against the campaign playbook markers
// ---------------------------------------------------------------------------

test.each(POWER_TABLE)("%s initial key count matches the playbook start marker", (power) => {
  const actual = countKeysFromMap()[power];
  const expected = PLAYBOOK_START_KEYS[power];
  const violations: string[] = [];
  if (actual.territorial !== expected.territorial) {
    violations.push(
      `${power} territorial keys: map/effective control gives ${actual.territorial}, playbook marker is ${expected.territorial}`,
    );
  }
  if (actual.colonial !== expected.colonial) {
    violations.push(
      `${power} colonial keys: map/effective control gives ${actual.colonial}, playbook marker is ${expected.colonial}`,
    );
  }
  if (actual.arab !== (expected.arab ?? 0)) {
    violations.push(
      `${power} Arab keys: map/effective control gives ${actual.arab}, playbook marker is ${expected.arab ?? 0}`,
    );
  }

  if (violations.length > 0 && power === "UK" && actual.colonial !== expected.colonial) {
    const ukColonial = Object.values(SPACES)
      .filter((space) => space.keyType === "colonial" && effectiveControl(space.id) === "UK")
      .map((space) => `${space.id} (${space.type})`);
    violations.push(
      `UK keyed colonial spaces: ${ukColonial.join(", ")}. The seven printed boxes are Canada, South Africa, India (counts twice), Bengal, Singapore and Australia/New Zealand. Malta (a naval base) and Hong Kong (a ship-icon port, not a square) are not colonial keys: remove their keyType and make Hong Kong type "territory".`,
    );
  }

  report(`${power} key count does not match the campaign playbook:`, violations);
});

test.each(POWER_TABLE)("%s CAMPAIGN_SETUP and POWER_DEFS.start match the playbook marker", (power) => {
  const setup = CAMPAIGN_SETUP.powers[power];
  const start = POWER_DEFS[power].start;
  const expected = PLAYBOOK_START_KEYS[power];
  const fields: {setupKey: "territorialKeys" | "colonialKeys" | "arabKeys"; refKey: "territorial" | "colonial" | "arab"}[] = [
    {setupKey: "territorialKeys", refKey: "territorial"},
    {setupKey: "colonialKeys", refKey: "colonial"},
    {setupKey: "arabKeys", refKey: "arab"},
  ];
  const violations: string[] = [];
  for (const field of fields) {
    const want = expected[field.refKey] ?? 0;
    const fromSetup = setup[field.setupKey] ?? 0;
    const fromStart = start[field.setupKey] ?? 0;
    if (fromSetup !== want) {
      violations.push(`CAMPAIGN_SETUP.powers.${power}.${field.setupKey} = ${fromSetup}, playbook marker = ${want}`);
    }
    if (fromStart !== want) {
      violations.push(`POWER_DEFS.${power}.start.${field.setupKey} = ${fromStart}, playbook marker = ${want}`);
    }
  }
  report(`${power} setup data does not match the campaign playbook:`, violations);
});

test("CAMPAIGN_SETUP mirrors POWER_DEFS.start for every track start", () => {
  const fields = [
    "stability",
    "manpower",
    "secondaryManpower",
    "industry",
    "territorialKeys",
    "colonialKeys",
    "arabKeys",
  ] as const;
  const violations: string[] = [];
  for (const power of POWER_TABLE) {
    const setup = CAMPAIGN_SETUP.powers[power] as Record<string, number | undefined>;
    const start = POWER_DEFS[power].start as Record<string, number | undefined>;
    for (const field of fields) {
      if ((setup[field] ?? 0) !== (start[field] ?? 0)) {
        violations.push(
          `${power}.${field}: CAMPAIGN_SETUP = ${setup[field] ?? 0}, POWER_DEFS.start = ${start[field] ?? 0}`,
        );
      }
    }
  }
  report("CAMPAIGN_SETUP and POWER_DEFS.start disagree:", violations);
});

// ---------------------------------------------------------------------------
// Printed tracks
// ---------------------------------------------------------------------------

test.each(POWER_TABLE)("%s track array lengths match the printed player display", (power) => {
  const definition = POWER_DEFS[power];
  const expected = TRACK_LENGTHS[power];
  const actual: Record<string, number | undefined> = {
    stability: definition.stability.length,
    industryCards: definition.industryCards.length,
    keyManpower: definition.keyManpower.length,
    secondaryKeyManpower: definition.secondaryKeyManpower?.length,
  };
  const printed: Record<string, string> = {
    stability: "Stability 0-6",
    industryCards: power === "GE" ? "Industry 0-7" : "Industry 0-6",
    keyManpower:
      power === "UK"
        ? "Territorial Keys 0-5"
        : power === "OT"
          ? "All other Keys 0-13"
          : power === "RU"
            ? "Total Keys 0-19"
            : "the key track",
    secondaryKeyManpower: power === "UK" ? "Colonial Keys 0-17" : power === "OT" ? "Arab Keys 0-6" : "the secondary key track",
  };
  const violations: string[] = [];
  for (const track of ["stability", "industryCards", "keyManpower", "secondaryKeyManpower"] as const) {
    const want = expected[track];
    const got = actual[track];
    if (want === undefined && got !== undefined) {
      violations.push(`${power} ${track}: data has ${got} entries but the printed display has no such track`);
    } else if (want !== undefined && got !== want) {
      const detail = got !== undefined && got > want ? " (trim the extra trailing entries)" : "";
      violations.push(
        `${power} ${track}: printed ${printed[track]} has ${want} entries (indices 0-${want - 1}); data has ${got}${detail}`,
      );
    }
  }
  report(`${power} track lengths do not match the player display:`, violations);
});

test.each(POWER_TABLE)("%s key manpower table matches the printed display", (power) => {
  const actual = POWER_DEFS[power].keyManpower;
  const expected = KEY_MANPOWER_EXPECTED[power];
  const violations: string[] = [];
  // Length mismatches are reported by the dedicated track-length test; here we
  // only compare the boxes that both tables claim to describe.
  const length = Math.min(actual.length, expected.length);
  for (let index = 0; index < length; index += 1) {
    if (actual[index] !== expected[index]) {
      violations.push(
        `${power} keyManpower[${index}] = ${actual[index]}, printed key box ${index} says MP=${expected[index]}`,
      );
    }
  }
  if (violations.length > 0 && power === "GE") {
    violations.push(
      "The shared keyManpower15 table should be [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5] (box 11 is MP=4, not MP=5).",
    );
  }
  report(`${power} key manpower does not match the player display:`, violations);
});

test.each(POWER_TABLE)("%s track arrays are monotonic", (power) => {
  const definition = POWER_DEFS[power];
  const violations: string[] = [];

  const checkNonDecreasing = (values: number[], label: string): void => {
    for (let index = 0; index + 1 < values.length; index += 1) {
      if (values[index] > values[index + 1]) {
        violations.push(
          `${power} ${label}[${index}] = ${values[index]} > ${label}[${index + 1}] = ${values[index + 1]}`,
        );
      }
    }
  };
  const checkNonIncreasing = (values: number[], label: string): void => {
    for (let index = 0; index + 1 < values.length; index += 1) {
      if (values[index] < values[index + 1]) {
        violations.push(
          `${power} ${label}[${index}] = ${values[index]} < ${label}[${index + 1}] = ${values[index + 1]}`,
        );
      }
    }
  };

  checkNonDecreasing(definition.stability.map((entry) => entry.vp ?? 0), "stability.vp");
  checkNonDecreasing(definition.stability.map((entry) => entry.bm ?? 0), "stability.bm");
  checkNonDecreasing(definition.stability.map((entry) => entry.abm ?? 0), "stability.abm");
  checkNonIncreasing(definition.stability.map((entry) => entry.cards ?? 0), "stability.cards");
  definition.stability.forEach((entry, index) => {
    if ((entry.cardDelta ?? 0) < 0) {
      violations.push(`${power} stability.cardDelta[${index}] = ${entry.cardDelta} must not be negative`);
    }
  });
  checkNonDecreasing(definition.industryCards, "industryCards");
  checkNonDecreasing(definition.keyManpower, "keyManpower");
  if (definition.secondaryKeyManpower) {
    checkNonDecreasing(definition.secondaryKeyManpower, "secondaryKeyManpower");
  }
  report(`${power} track is not monotonic:`, violations);
});

test.each(POWER_TABLE)("%s start manpower is consistent with the printed key tracks", (power) => {
  const definition = POWER_DEFS[power];
  const setup = CAMPAIGN_SETUP.powers[power];
  const keys = PLAYBOOK_START_KEYS[power];
  const violations: string[] = [];

  const keyManpower = definition.keyManpower[keys.territorial];
  if (keyManpower !== setup.manpower) {
    violations.push(
      `${power} keyManpower[${keys.territorial}] = ${keyManpower}, but campaign manpower is ${setup.manpower}`,
    );
  }
  if (definition.start.manpower !== setup.manpower) {
    violations.push(
      `${power} POWER_DEFS.start.manpower = ${definition.start.manpower}, CAMPAIGN_SETUP.manpower = ${setup.manpower}`,
    );
  }
  if (definition.start.stability !== setup.stability) {
    violations.push(
      `${power} POWER_DEFS.start.stability = ${definition.start.stability}, CAMPAIGN_SETUP.stability = ${setup.stability}`,
    );
  }
  if (definition.start.industry !== setup.industry) {
    violations.push(
      `${power} POWER_DEFS.start.industry = ${definition.start.industry}, CAMPAIGN_SETUP.industry = ${setup.industry}`,
    );
  }

  const secondaryIndex = power === "UK" ? keys.colonial : power === "OT" ? keys.arab : undefined;
  if (secondaryIndex !== undefined) {
    const track = definition.secondaryKeyManpower;
    const value = track?.[secondaryIndex];
    if (value !== setup.secondaryManpower) {
      violations.push(
        `${power} secondaryKeyManpower[${secondaryIndex}] = ${value}, but campaign secondary manpower is ${setup.secondaryManpower}`,
      );
    }
  }

  report(`${power} start manpower is inconsistent:`, violations);
});

test("UK colonial manpower follows the printed Colonial Keys track", () => {
  const track = POWER_DEFS.UK.secondaryKeyManpower;
  if (!track) throw new Error("UK secondaryKeyManpower is missing");
  const violations: string[] = [];
  for (const {index, value} of UK_SECONDARY_KEY_MANPOWER_EXPECTED) {
    if (track[index] !== value) {
      violations.push(`UK secondaryKeyManpower[${index}] = ${track[index]}, printed Colonial Keys box says ${value}`);
    }
  }
  if (violations.length > 0) {
    violations.push(
      "The printed track steps are box 4 = 1, box 8 = 2, box 12 = 3 and box 17+ = 4; set indices 8-11 to 2 and index 16 to 3.",
    );
  }
  report("UK colonial manpower does not match the printed track:", violations);
});

// ---------------------------------------------------------------------------
// Initial control, home and minor fields
// ---------------------------------------------------------------------------

test("keyType is only used on square/star spaces and every capital is a key", () => {
  const violations: string[] = [];
  for (const space of Object.values(SPACES)) {
    if (space.keyType && !["key", "capital", "subcapital"].includes(space.type)) {
      violations.push(
        `${space.id}: type "${space.type}" has keyType "${space.keyType}"; only square/star spaces are keys (3.2.1/3.2.8)`,
      );
    }
    if ((space.type === "capital" || space.type === "subcapital") && !space.keyType) {
      violations.push(`${space.id}: ${space.type} is missing keyType`);
    }
  }
  report("keyType/type classification is inconsistent:", violations);
});

test("initial control/home/minor fields are coherent", () => {
  const violations: string[] = [];

  for (const override of CAMPAIGN_SETUP.controlOverrides) {
    if (!SPACES[override.space]) {
      violations.push(`control override targets unknown space ${override.space}`);
      continue;
    }
    if (override.control !== null && !isPower(override.control) && !isMinor(override.control)) {
      violations.push(`control override for ${override.space} names unknown controller ${override.control}`);
    }
  }

  for (const [minor, home] of Object.entries(MINOR_POWER_HOMES)) {
    if (!SPACES[home]) violations.push(`MINOR_POWER_HOMES.${minor} points at unknown space ${home}`);
  }

  for (const space of Object.values(SPACES)) {
    const control = effectiveControl(space.id);
    if (control !== null && !isPower(control) && !isMinor(control)) {
      violations.push(`${space.id}: unknown initial controller ${control}`);
    }
    if (space.home !== null && space.home !== undefined && !isPower(space.home)) {
      violations.push(`${space.id}: home ${space.home} is not a player power`);
    }
    if (space.minorHome !== null && space.minorHome !== undefined && !isMinor(space.minorHome)) {
      violations.push(`${space.id}: minorHome ${space.minorHome} is not a known minor power`);
    }
    if (control !== null && isMinor(control) && space.minorHome !== control) {
      violations.push(
        `${space.id}: controlled by minor ${control} but minorHome is ${space.minorHome ?? "null"}; add minorHome: "${control}"`,
      );
    }
  }

  report("Initial control/home/minor fields are incoherent:", violations);
});

test("Egypt starts as an independent minor power", () => {
  const egyptian = ["egypt", "sinai", "great-sand-sea"];
  for (const id of egyptian) {
    if (!SPACES[id]) throw new Error(`${id} is missing from SPACES`);
    if (effectiveControl(id) !== "Egypt") {
      throw new Error(`${id} must start under Egyptian control, got ${effectiveControl(id)}`);
    }
    if (SPACES[id].special !== "egypt") {
      throw new Error(`${id} must carry the Egypt special marker, got ${SPACES[id].special ?? "none"}`);
    }
  }
  if (MINOR_POWER_HOMES.Egypt !== "egypt") {
    throw new Error(`MINOR_POWER_HOMES.Egypt must be egypt, got ${MINOR_POWER_HOMES.Egypt}`);
  }
  expect(
    CAMPAIGN_SETUP.controlOverrides.map((override) => override.space).sort(),
  ).toEqual([...egyptian].sort());
});

test("campaign setup units and markers reference coherent spaces", () => {
  const violations: string[] = [];
  const knownMinor = (owner: string): boolean => {
    const minor = owner.startsWith("REBEL:") ? owner.slice("REBEL:".length) : owner;
    return Object.prototype.hasOwnProperty.call(MINOR_POWER_HOMES, minor);
  };

  for (const unit of CAMPAIGN_SETUP.units) {
    if (unit.space === null) continue;
    if (!SPACES[unit.space]) {
      violations.push(`unit ${unit.owner} ${unit.kind} is in unknown space ${unit.space}`);
      continue;
    }
    const control = effectiveControl(unit.space);
    const owner = unit.owner.startsWith("REBEL:") ? unit.owner.slice("REBEL:".length) : unit.owner;
    if (!isPower(unit.owner) && !knownMinor(unit.owner)) {
      violations.push(`unit ${unit.owner} ${unit.kind} has an unknown owner`);
    }
    if (control !== owner) {
      violations.push(
        `unit ${unit.owner} ${unit.kind} is in ${unit.space}, which starts controlled by ${control ?? "nobody"}`,
      );
    }
  }

  for (const fort of CAMPAIGN_SETUP.forts) {
    if (effectiveControl(fort.space) !== fort.power) {
      violations.push(
        `fort ${fort.power} level ${fort.level} is in ${fort.space}, controlled by ${effectiveControl(fort.space) ?? "nobody"}`,
      );
    }
  }
  for (const marker of CAMPAIGN_SETUP.diplomacy) {
    const control = effectiveControl(marker.space);
    if (control === null || isPower(control)) {
      violations.push(`diplomacy marker ${marker.power} is in ${marker.space}, which is not a minor power space`);
    }
  }
  for (const marker of CAMPAIGN_SETUP.influence) {
    if (SPACES[marker.space].control !== null) {
      violations.push(`influence marker ${marker.power} is in ${marker.space}, which starts controlled`);
    }
  }
  for (const marker of CAMPAIGN_SETUP.pacification) {
    const control = effectiveControl(marker.space);
    if (!isPower(control)) {
      violations.push(`pacification marker in ${marker.space} is not in a power-controlled space`);
    }
  }
  report("Campaign setup units/markers are incoherent:", violations);
});

test("Austria's scenario-only goal is outside the campaign pool", () => {
  expect(GOALS).toHaveLength(49);
  expect(CAMPAIGN_GOALS).toHaveLength(48);
  for (const power of POWER_TABLE) {
    const goals = CAMPAIGN_GOALS.filter((goal) => goal.power === power);
    if (goals.length !== 8) throw new Error(`${power} must have exactly 8 campaign goals, got ${goals.length}`);
  }
  expect(GOALS.filter((goal) => goal.power === "AU")).toHaveLength(9);
  const goal = GOALS_BY_ID["NG-31"];
  if (!goal) throw new Error("NG-31 must exist");
  expect(goal.power).toBe("AU");
  expect(goal.scenarioOnly).toBe(true);
  expect(CAMPAIGN_GOAL_IDS).not.toContain("NG-31");
});

// ---------------------------------------------------------------------------
// VASSAL zone metadata
// ---------------------------------------------------------------------------

test("Main Map zone names and centres match the spaces they represent", () => {
  const violations: string[] = [];
  const zoneNames = new Set<string>();
  const bySpace = new Map<string, ModuleZone>();

  for (const zone of MAIN_MAP_ZONES) {
    if (zoneNames.has(zone.name)) violations.push(`duplicate Main Map zone name ${zone.name}`);
    zoneNames.add(zone.name);

    const id = zoneToSpaceId(zone.name);
    if (!id) {
      if (!NON_SPACE_ZONES.includes(zone.name)) {
        violations.push(`Main Map zone ${zone.name} does not match any space (and is not a known non-space zone)`);
      }
      continue;
    }
    const previous = bySpace.get(id);
    if (previous) {
      violations.push(`${id}: matched by both zone ${previous.name} and zone ${zone.name}`);
      continue;
    }
    bySpace.set(id, zone);
  }

  const missing = SPACE_IDS.filter((id) => !bySpace.has(id)).sort();
  const expectedMissing = [...SPACES_WITHOUT_ZONE].sort();
  if (JSON.stringify(missing) !== JSON.stringify(expectedMissing)) {
    const gained = expectedMissing.filter((id) => !missing.includes(id));
    const lost = missing.filter((id) => !expectedMissing.includes(id));
    violations.push(
      `spaces without a Main Map zone changed: missing [${missing.join(", ")}]; expected [${expectedMissing.join(", ")}]` +
        `${gained.length ? `; now matched: [${gained.join(", ")}]` : ""}` +
        `${lost.length ? `; newly unmatched: [${lost.join(", ")}]` : ""}`,
    );
  }

  for (const [id, zone] of bySpace) {
    const centre = zoneCenter(zone);
    const space = SPACES[id];
    const dx = Math.abs(space.x - centre.x);
    const dy = Math.abs(space.y - centre.y);
    if (dx > ZONE_CENTER_TOLERANCE || dy > ZONE_CENTER_TOLERANCE) {
      violations.push(
        `${id}: spaces.ts (${space.x}, ${space.y}) vs zone "${zone.name}" bbox centre (${centre.x}, ${centre.y}); ` +
          `delta (${dx}, ${dy}) exceeds tolerance ${ZONE_CENTER_TOLERANCE}`,
      );
    }
  }

  report("Main Map zone metadata does not match spaces.ts:", violations);
});
