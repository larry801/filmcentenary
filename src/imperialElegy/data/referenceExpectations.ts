/**
 * Independent reference expectations for the Imperial Elegy map and tracks.
 *
 * Every number here was read from a source other than `constant/spaces.ts`:
 *
 *  - `PLAYBOOK_START_KEYS` comes from the campaign-setup markers in the
 *    module's saved game (`data/generated/campaign-setup.json`) and the
 *    circled spaces on the printed player displays.  The saved markers are
 *    authoritative: for example the UK colonial-keys marker is on box 7.
 *  - `TRACK_LENGTHS` and the printed-value tables come from the six player
 *    display images in `public/imperial-elegy/displays/`.  A track's array is
 *    indexed by the track box, so a display whose last box is 6 needs seven
 *    entries.
 *  - `ZONE_ALIASES`, `NON_SPACE_ZONES` and `SPACES_WITHOUT_ZONE` describe the
 *    VASSAL `Main Map` zone metadata (`data/generated/module.json`), including
 *    the handful of zone names that carry a printed typo or a region suffix.
 *
 * Keep this file limited to reference data.  The assertions live in
 * `mapValidation.test.ts`.
 */
import {Power} from "../types";

export interface KeyStart {
  territorial: number;
  colonial: number;
  arab?: number;
}

/** Campaign setup key totals, read from the playbook display markers. */
export const PLAYBOOK_START_KEYS: Record<Power, KeyStart> = {
  GE: {territorial: 5, colonial: 0},
  // The saved campaign marker is on Colonial Key-7, not 9.  India counts twice
  // (Crown Jewel), so the seven boxes are Canada, South Africa, India (x2),
  // Bengal, Singapore and Australia/New Zealand.
  UK: {territorial: 5, colonial: 7},
  FR: {territorial: 9, colonial: 0},
  AU: {territorial: 9, colonial: 0},
  RU: {territorial: 12, colonial: 0},
  OT: {territorial: 8, colonial: 0, arab: 5},
};

/**
 * Manpower printed in each key-track box, transcribed from the player
 * displays.  The array is indexed by the number of keys controlled.
 */
export const KEY_MANPOWER_EXPECTED: Record<Power, number[]> = {
  GE: [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5],
  UK: [1, 1, 1, 2, 2, 3],
  FR: [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5],
  AU: [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5],
  RU: [2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6],
  OT: [1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4],
};

export interface TrackLengths {
  stability: number;
  industryCards: number;
  keyManpower: number;
  secondaryKeyManpower?: number;
}

/**
 * Number of printed boxes on each player display.  Manpower arrays are indexed
 * by the key box.  A final box that prints only "AUTO VICTORY" is omitted
 * (GE/FR/AU box 15, RU box 20, OT box 14); a final box that also prints a
 * manpower value is included (UK Colonial Keys 17+ prints MP=4).
 */
export const TRACK_LENGTHS: Record<Power, TrackLengths> = {
  GE: {stability: 7, industryCards: 8, keyManpower: 15},
  UK: {stability: 7, industryCards: 7, keyManpower: 6, secondaryKeyManpower: 18},
  FR: {stability: 7, industryCards: 7, keyManpower: 15},
  AU: {stability: 7, industryCards: 7, keyManpower: 15},
  RU: {stability: 7, industryCards: 7, keyManpower: 20},
  OT: {stability: 7, industryCards: 7, keyManpower: 14, secondaryKeyManpower: 7},
};

/**
 * Printed UK Colonial Keys track values at the boxes that carry an explicit
 * label: box 4 = MP 1, box 8 = MP 2, box 12 = MP 3 and box 17+ = MP 4.  Box 14
 * also prints "+1 card", which is a card bonus rather than a manpower step and
 * is therefore not asserted here.
 */
export const UK_SECONDARY_KEY_MANPOWER_EXPECTED: {index: number; value: number}[] = [
  {index: 7, value: 1},
  {index: 8, value: 2},
  {index: 9, value: 2},
  {index: 10, value: 2},
  {index: 11, value: 2},
  {index: 12, value: 3},
  {index: 13, value: 3},
  {index: 14, value: 3},
  {index: 15, value: 3},
  {index: 16, value: 3},
  {index: 17, value: 4},
];

/**
 * The rulebook's Arab key spaces for the Ottoman Empire (33.6).  This set is
 * duplicated here intentionally so a change in the engine constant cannot make
 * the validation agree with itself.
 */
export const OT_ARAB_KEY_SPACES: string[] = ["arabia", "mecca", "baghdad", "kuwait", "syria"];

/** `Main Map` zone names that are not spaces. */
export const NON_SPACE_ZONES: string[] = [
  "End Phase Build Box",
  "The Alliance Track",
  "Wartime Initiative Order",
  "VP & PP",
];

/**
 * Spaces whose printed position is not present in the generated `Main Map`
 * zones: the North America inset (The South, Mexico), the Africa inset, and
 * Rome.  The VASSAL module has no zone for the Papal States capital even though
 * the printed map shows the star-shaped Rome space, so its coordinates are
 * reviewed against the map image rather than a zone bounding box.
 */
export const SPACES_WITHOUT_ZONE: string[] = [
  "the-south",
  "mexico",
  "rome",
  "morocco",
  "nigeria",
  "cameroon",
  "west-congo",
  "central-congo",
  "east-africa",
  "somalia",
  "sudan",
  "southwest-africa",
  "rhodesia",
  "madagascar",
];

/** Printed zone-name typos/aliases mapped directly to a space id. */
export const ZONE_ALIASES: Record<string, string> = {
  "Austrila & New Zeland": "australia-new-zealand",
  Aquitane: "aquitaine",
  Popmerania: "pomerania",
  "Afganistan - The Great Game": "afghanistan",
  "Alsace Lorraine": "alsace-lorraine",
  "St Petersburg": "st-petersburg",
};

/** Region suffixes the VASSAL map appends to some zone names. */
export const ZONE_REGION_SUFFIXES: string[] = [
  "Low Countries",
  "Central Europe",
  "Balkans",
  "Africa",
  "Caucasus",
  "The Great Game",
  "China & Japan",
];

/** Maximum allowed difference between a space's x/y and a zone's bbox centre. */
export const ZONE_CENTER_TOLERANCE = 2;
