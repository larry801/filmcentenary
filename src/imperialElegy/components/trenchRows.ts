/**
 * The Great War's trench battles, as the War tab lists them.
 *
 * Rule 28.1 keeps one 28.1.1 marker per trench-battle space; the map draws a
 * marker on the space, but a marker alone does not say who is pressing whom.
 * This module turns the markers into rows the panel can render and the map can
 * focus: one row per space, both sides' strength on the space, and the state
 * the next 28.1.1 shift would move from.
 *
 * Pure: it reads `G` and never mutates it, so the panel and the tests use the
 * same values the engine wrote.
 */
import type {ImperialElegyState, Power, SpaceId} from "../types";
import {SPACES} from "../constant/spaces";
import {POWER_KEYS} from "./boardHelpers";

/** Every power the counters can belong to, minor allies aside. */
type CounterPower = Power | "Poland";
const powerRank = (power: CounterPower): number => POWER_KEYS.indexOf(power as Power);
import type {TrenchStatus} from "../engine/combat";

export interface TrenchSide {
  power: Power;
  /** Land units of that power standing on the space. */
  armies: number;
  eliteCorps: number;
  /** True when the power is a belligerent in the Great War. */
  belligerent: boolean;
}

export interface TrenchRow {
  space: SpaceId;
  status: TrenchStatus;
  /** The Great War turn the marker was last updated. */
  turn: number;
  /** The two sides on the space, strongest first; fewer than two when one side holds it alone. */
  sides: TrenchSide[];
  /** The power that holds the stronger force on the space, for the map focus tint. */
  holder: Power | null;
}

const ARMY_KINDS = new Set(["army", "reserveArmy"]);
const ELITE_KIND = "eliteCorps";

/** A power is a belligerent when the Great War lists it on either side. */
const belligerents = (G: ImperialElegyState): Set<Power> => {
  const out = new Set<Power>();
  if (!G.gw) return out;
  for (const power of G.gw.belligerents ?? []) out.add(power);
  for (const power of [...(G.gw.te ?? []), ...(G.gw.ta ?? [])]) out.add(power);
  return out;
};

/**
 * The 28.1.1 rows for the War tab, newest marker first.
 *
 * `G.gw.trenches` is the authoritative record (it is what `setTrenchBattleMarker`
 * writes and `clearTrenchBattleMarker` deletes); a space's own `trench` field is
 * mirrored onto the row so a marker left by an older save still lists.
 */
export const trenchRows = (G: ImperialElegyState): TrenchRow[] => {
  if (!G.gw?.active) return [];
  const atWar = belligerents(G);
  const bySpace = new Map<SpaceId, {status: TrenchStatus; turn: number}>();
  for (const [space, status] of Object.entries(G.gw.trenches ?? {}) as [SpaceId, TrenchStatus][]) {
    const marker = G.spaces[space]?.trench;
    bySpace.set(space, {status, turn: marker?.turn ?? 0});
  }
  for (const space of Object.keys(G.spaces) as SpaceId[]) {
    const marker = G.spaces[space]?.trench;
    if (marker && !bySpace.has(space)) bySpace.set(space, {status: marker.status, turn: marker.turn});
  }

  const rows: TrenchRow[] = [];
  for (const [space, marker] of bySpace) {
    if (!SPACES[space]) continue;
    const tally = new Map<CounterPower, {armies: number; eliteCorps: number}>();
    for (const unit of Object.values(G.units)) {
      if (unit.space !== space) continue;
      if (unit.owner === "Poland") continue;
      const isArmy = ARMY_KINDS.has(unit.kind);
      const isElite = unit.kind === ELITE_KIND;
      if (!isArmy && !isElite) continue;
      const entry = tally.get(unit.owner as CounterPower) ?? {armies: 0, eliteCorps: 0};
      if (isArmy) entry.armies += 1;
      else entry.eliteCorps += 1;
      tally.set(unit.owner as CounterPower, entry);
    }
    const sides: TrenchSide[] = [...tally.entries()]
      .map(([power, counts]) => ({power: power as Power, ...counts, belligerent: atWar.has(power as Power) && power !== "Poland"}))
      .sort((a, b) => (b.armies + b.eliteCorps) - (a.armies + a.eliteCorps) || powerRank(a.power) - powerRank(b.power));
    rows.push({
      space,
      status: marker.status,
      turn: marker.turn,
      sides,
      holder: sides[0]?.power ?? null,
    });
  }
  // A marker updated on a later turn is the fresher problem; ties fall back to
  // the printed space order so the list does not shuffle between renders.
  const order = (row: TrenchRow): number => powerRank(row.sides[0]?.power ?? "GE");
  return rows.sort((a, b) => b.turn - a.turn || order(a) - order(b) || a.space.localeCompare(b.space));
};

/** True when the board should draw the trench list at all. */
export const hasTrenchBattles = (G: ImperialElegyState): boolean => trenchRows(G).length > 0;
