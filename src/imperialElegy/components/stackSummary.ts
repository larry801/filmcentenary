/**
 * Stack summary for the map's unit tokens (pure, no React).
 *
 * A space holds a stack of unit ids; the map draws the top few as printed-style
 * counters and a `+N` marker for the rest.  `stackSummary` turns that stack into
 * a stable, ordered list of (power, kind, reduced) groups so the same stack
 * always paints in the same order and identical counters collapse into one
 * entry with a count.
 */
import type {Power, SpaceId, Unit, UnitKind} from "../types";
import {POWER_KEYS} from "./boardHelpers";

/** One counter group standing on a space: same owner, same kind, same state. */
export interface StackEntry {
  power: Power;
  kind: UnitKind;
  /** How many units of this (power, kind, reduced) are in the stack. */
  count: number;
  /** True when these counters have taken a step loss (one step left). */
  reduced: boolean;
}

/** The shapes a counter can print as. */
export type TokenShape = "army" | "elite" | "ef" | "ship" | "fort";

/**
 * Fixed kind order.  The rulebook's counter family order, largest to smallest,
 * then the navy; a kind not listed here sorts last so a new counter type never
 * jumps ahead of the printed ones.
 */
const KIND_ORDER: UnitKind[] = [
  "army",
  "reserveArmy",
  "eliteCorps",
  "expeditionary",
  "squadron",
  "dreadnought",
];

const kindRank = (kind: UnitKind): number => {
  const index = KIND_ORDER.indexOf(kind);
  return index < 0 ? KIND_ORDER.length : index;
};

/**
 * The shape `UnitToken` draws for a kind.
 *
 * `reserveArmy` is still a square (it prints an "R" inside, the token decides
 * that), `squadron`/`dreadnought` share the ship hull.  Every other kind
 * (colonial EF, zouave, the minor-power armies) draws as an army square rather
 * than inventing a shape it does not have.  A fort is space terrain, not a
 * unit, so it never reaches this function; `fort` stays in `TokenShape` for the
 * map's own hexagon.
 */
export const tokenKindOf = (kind: UnitKind): TokenShape => {
  switch (kind) {
    case "eliteCorps": return "elite";
    case "expeditionary": return "ef";
    case "squadron":
    case "dreadnought": return "ship";
    default: return "army";
  }
};

/** True for the counters that only ever have a single step. */
const isOneStep = (kind: UnitKind): boolean =>
  kind === "eliteCorps" || kind === "expeditionary";

/**
 * Group the land and naval units standing on `space` by (power, kind, reduced).
 *
 * Order: `POWER_KEYS` order, then the fixed kind order, then full counters
 * before reduced ones.  Nothing is capped — the map decides how many of the
 * entries it shows.  Units of a minor power, a rebel or the US/Italian
 * counters have no token colour, so they are left to the space overlay.
 */
export const stackSummary = (units: Unit[], space: SpaceId): StackEntry[] => {
  const groups = new Map<string, StackEntry>();
  for (const unit of units) {
    if (unit.space !== space) continue;
    if (!(POWER_KEYS as string[]).includes(unit.owner)) continue;
    const reduced = isOneStep(unit.kind) ? false : unit.steps <= 1;
    const key = `${unit.owner}|${unit.kind}|${reduced ? "r" : "f"}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, {power: unit.owner as Power, kind: unit.kind, count: 1, reduced});
    }
  }

  const powerRank = (power: Power): number => {
    const index = POWER_KEYS.indexOf(power);
    return index < 0 ? POWER_KEYS.length : index;
  };
  return [...groups.values()].sort((a, b) =>
    powerRank(a.power) - powerRank(b.power) ||
    kindRank(a.kind) - kindRank(b.kind) ||
    Number(a.reduced) - Number(b.reduced));
};
