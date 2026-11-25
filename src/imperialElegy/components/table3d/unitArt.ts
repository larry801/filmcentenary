/**
 * The module's own counter art, for the standees on the 3D table.
 *
 * `scripts/extract-imperial-elegy.py` publishes the printed face of every unit
 * counter, the back the module flips to after a step loss, and the reserve
 * badge, under `public/imperial-elegy/units/`.  This module is the one place
 * that knows which file belongs to which (power, kind, state), so the scene
 * never guesses from a filename, and a counter on the table is the module's
 * token rather than a lookalike drawn from the palette.
 */
import type {PowerOrMinor, UnitKind} from "../../types";

export interface UnitFaceArt {
  /** The printed front, or the reduced back after a step loss. */
  url: string;
  /** The counter's printed proportions, width / height. */
  aspect: number;
  /** The module's reserve badge, painted over the face of a reserve army. */
  badge?: string;
}

const BASE = "/imperial-elegy/units/";
const SQUARE = 1;
/** A squadron is printed 200 x 120, not on a square. */
const HULL = 200 / 120;
const RESERVE_BADGE = `${BASE}reserve-badge.jpg`;

interface UnitFaceFiles {
  front: string;
  /** The module's "Reduced" layer; absent for the one-step counters. */
  back?: string;
}

/** Every power's counter families, as published by the extraction script. */
const FACES: Record<string, Record<string, UnitFaceFiles | undefined>> = {
  GE: {
    army: {front: "GE-army-full.png", back: "GE-army-reduced.png"},
    elite: {front: "GE-elite-full.png"},
    ef: {front: "GE-ef-full.png"},
    squadron: {front: "GE-squadron-full.png", back: "GE-squadron-reduced.png"},
    dreadnought: {front: "GE-dreadnought-full.png", back: "GE-dreadnought-reduced.png"},
  },
  UK: {
    army: {front: "UK-army-full.png", back: "UK-army-reduced.png"},
    elite: {front: "UK-elite-full.png"},
    ef: {front: "UK-ef-full.png"},
    colonialEf: {front: "UK-colonialEf-full.png"},
    squadron: {front: "UK-squadron-full.png", back: "UK-squadron-reduced.png"},
    dreadnought: {front: "UK-dreadnought-full.png", back: "UK-dreadnought-reduced.png"},
  },
  FR: {
    army: {front: "FR-army-full.png", back: "FR-army-reduced.png"},
    zouave: {front: "FR-zouave-full.png"},
    elite: {front: "FR-elite-full.png"},
    ef: {front: "FR-ef-full.png"},
    colonialEf: {front: "FR-colonialEf-full.png"},
    squadron: {front: "FR-squadron-full.png", back: "FR-squadron-reduced.png"},
    dreadnought: {front: "FR-dreadnought-full.png", back: "FR-dreadnought-reduced.png"},
  },
  AU: {
    army: {front: "AU-army-full.png", back: "AU-army-reduced.png"},
    elite: {front: "AU-elite-full.png"},
    ef: {front: "AU-ef-full.png"},
    squadron: {front: "AU-squadron-full.png", back: "AU-squadron-reduced.png"},
    dreadnought: {front: "AU-dreadnought-full.png", back: "AU-dreadnought-reduced.png"},
  },
  RU: {
    army: {front: "RU-army-full.png", back: "RU-army-reduced.png"},
    elite: {front: "RU-elite-full.png"},
    ef: {front: "RU-ef-full.png"},
    colonialEf: {front: "RU-colonialEf-full.png"},
    squadron: {front: "RU-squadron-full.png", back: "RU-squadron-reduced.png"},
    dreadnought: {front: "RU-dreadnought-full.png", back: "RU-dreadnought-reduced.png"},
  },
  OT: {
    army: {front: "OT-army-full.png", back: "OT-army-reduced.png"},
    elite: {front: "OT-elite-full.png"},
    ef: {front: "OT-ef-full.png"},
    squadron: {front: "OT-squadron-full.png", back: "OT-squadron-reduced.png"},
    dreadnought: {front: "OT-dreadnought-full.png", back: "OT-dreadnought-reduced.png"},
  },
};

/** The printed counter family a kind stands as. */
const roleOf = (kind: UnitKind): string => {
  switch (kind) {
    case "army":
    case "reserveArmy":
      return "army";
    case "eliteCorps":
      return "elite";
    case "expeditionary":
      return "ef";
    case "eliteColonialEf":
      return "colonialEf";
    case "zouave":
      return "zouave";
    case "squadron":
      return "squadron";
    case "dreadnought":
      return "dreadnought";
    // A minor, rebel, Italian or US army prints on the same square as an army
    // of one of the six powers; the stack summary leaves those owners off the
    // table, so this only ever answers a defensive call.
    default:
      return "army";
  }
};

/** A role one power does not print a counter for falls back to its family. */
const FALLBACK_ROLE: Record<string, string> = {colonialEf: "ef"};

const ASPECT: Record<string, number> = {squadron: HULL, dreadnought: HULL};

/**
 * The face a stack entry stands on the table, or null when the module has no
 * counter for that owner (a power the module does not print, or a caller
 * passing a minor power).
 */
export const unitFaceArt = (
  power: PowerOrMinor,
  kind: UnitKind,
  reduced: boolean,
): UnitFaceArt | null => {
  const faces = FACES[power];
  if (faces === undefined) return null;
  const role = roleOf(kind);
  const fallback = FALLBACK_ROLE[role];
  const files = faces[role] ?? (fallback === undefined ? undefined : faces[fallback]);
  if (files === undefined) return null;
  const file = reduced && files.back !== undefined ? files.back : files.front;
  return {
    url: `${BASE}${file}`,
    aspect: ASPECT[role] ?? SQUARE,
    badge: kind === "reserveArmy" ? RESERVE_BADGE : undefined,
  };
};

const pending = new Map<string, Promise<HTMLImageElement | null>>();

/**
 * Decode a published counter face once, shared by every standee that uses it.
 *
 * A failure resolves to null instead of rejecting: the table keeps the drawn
 * stand-in rather than losing a counter to one broken file.
 */
export const loadCounterImage = (url: string): Promise<HTMLImageElement | null> => {
  const cached = pending.get(url);
  if (cached !== undefined) return cached;
  const request = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
  pending.set(url, request);
  return request;
};
