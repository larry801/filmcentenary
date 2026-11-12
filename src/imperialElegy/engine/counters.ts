import {ImperialElegyState, Power, PowerOrMinor, POWERS, UnitKind} from "../types";

/**
 * Rule 4.2 — counter limits.
 *
 * "Players and non-player powers are limited to the number of counters they
 * have.  The GE, AU, and OT players have a counter limit of 2 squadrons and 2
 * dreadnoughts until an event or ability grants them additional units (the
 * additional AU and OT units are marked with NAR to indicate that they are
 * only brought into play via the Naval Arms Race event)."
 *
 * The per-power counter manifest is transcribed below from the publisher's
 * counter chart, `public/imperial-elegy/charts/counter-count.png` (a legible
 * spreadsheet of the physical counter mix).  The player rows read:
 *
 *            GE  UK  FR  AU  RU  OT
 *  Standing   5   5   5   5   5   4
 *  Reserve   11   0   9   9  11   1
 *  Special    -   5   -   -   -   4   (UK: 4 Indian + 1 Commonwealth;
 *                                      OT: 4 Arab, 2 standing + 2 reserve)
 *  EFs        4   5   4   1   3   1
 *  ECs        4   2   3   2   2   2
 *  Squadrons  4   6   4   4   4   4
 *  Dread.     4   6   4   4   4   4
 *
 * The chart's squadron/dreadnought row is the *physical* maximum: GE/AU/OT hold
 * four of each because the two NAR counters are included in the box.  Rule 4.2
 * still restricts GE/AU/OT to 2/2 until A092 (or GE unification) unlocks the
 * additional pair, so `navalCounterLimit` returns the effective printed limit
 * while `PLAYER_COUNTER_CHART` records the physical mix.  UK 6/6, FR 4/4 and
 * RU 4/4 are the chart maxima.
 *
 * No cap below the chart is invented anywhere: every pool value is either a
 * chart row or an explicitly-derived naval limit.  Non-player powers (Italy,
 * the US, the minor powers) are outside rule 4.2's player-counter pools and are
 * not covered here.
 */

export type CounterKind = "army" | "reserveArmy" | "eliteCorps" | "expeditionary" | "squadron" | "dreadnought";

export interface NavalCounterLimit {
  /** Maximum squadron counters, or null when no printed number is known. */
  squadrons: number | null;
  /** Maximum dreadnought counters, or null when no printed number is known. */
  dreadnoughts: number | null;
}

export interface CounterPool {
  army: number | null;
  reserveArmy: number | null;
  eliteCorps: number | null;
  expeditionary: number | null;
  squadron: number | null;
  dreadnought: number | null;
}

/** One player row of the published counter chart. */
export interface PlayerCounterChart {
  /** Standing army counters. */
  standingArmies: number;
  /** Reserve army counters (the holding box). */
  reserveArmies: number;
  /** Special standing armies: UK Indian/Commonwealth, OT Arab. */
  specialStandingArmies: number;
  /** Special reserve armies: the two Ottoman Arab reserve counters. */
  specialReserveArmies: number;
  eliteCorps: number;
  expeditionary: number;
  squadrons: number;
  dreadnoughts: number;
}

/**
 * The transcribed player-counter chart
 * (`public/imperial-elegy/charts/counter-count.png`).  The special-army split
 * comes from the chart's footnote "UK - 4 Indian armies, one Commonwealth (CW)
 * army" / "OT - 4 Arab Armies (2 standing, 2 reserve)".
 */
export const PLAYER_COUNTER_CHART: Readonly<Record<Power, PlayerCounterChart>> = {
  GE: {standingArmies: 5, reserveArmies: 11, specialStandingArmies: 0, specialReserveArmies: 0, eliteCorps: 4, expeditionary: 4, squadrons: 4, dreadnoughts: 4},
  UK: {standingArmies: 5, reserveArmies: 0, specialStandingArmies: 5, specialReserveArmies: 0, eliteCorps: 2, expeditionary: 5, squadrons: 6, dreadnoughts: 6},
  FR: {standingArmies: 5, reserveArmies: 9, specialStandingArmies: 0, specialReserveArmies: 0, eliteCorps: 3, expeditionary: 4, squadrons: 4, dreadnoughts: 4},
  AU: {standingArmies: 5, reserveArmies: 9, specialStandingArmies: 0, specialReserveArmies: 0, eliteCorps: 2, expeditionary: 1, squadrons: 4, dreadnoughts: 4},
  RU: {standingArmies: 5, reserveArmies: 11, specialStandingArmies: 0, specialReserveArmies: 0, eliteCorps: 2, expeditionary: 3, squadrons: 4, dreadnoughts: 4},
  OT: {standingArmies: 4, reserveArmies: 1, specialStandingArmies: 2, specialReserveArmies: 2, eliteCorps: 2, expeditionary: 1, squadrons: 4, dreadnoughts: 4},
};

/**
 * The RU "Special" counter on the player chart (row RU = 1, notes: "RU -
 * Trans-Siberian RR") is the TSRR completion marker.  It is **not** an army
 * counter: 33.5's "rail 1 army along the railroad per impulse" is a movement
 * allowance that moves an existing army counter.  Recording the printed marker
 * here is deliberate — no "railroad army" unit is ever invented.
 */
export const RU_TSRR_MARKER_COUNTERS = 1;

/** Rule 4.2: the three Central Powers start with only 2 squadrons + 2 dreadnoughts. */
export const PRINTED_NAVAL_LIMIT_POWERS: readonly Power[] = ["GE", "AU", "OT"] as const;

/** 4.2 / A092: the Naval Arms Race raises the cap to four of each. */
export const NAR_NAVAL_LIMIT = 4;

/**
 * A092 Naval Arms Race: "If the Ottomans, Austria-Hungary and/or Germany
 * receive the discount, increase their naval counter limit to four squadrons
 * and four dreadnoughts."  The existing event handler stores this as the
 * per-power `navalLimit` flag; effect handlers should call this helper for the
 * chosen partner as well.
 */
export const raiseNavalCounterLimit = (G: ImperialElegyState, power: Power): boolean => {
  if (!PRINTED_NAVAL_LIMIT_POWERS.includes(power)) return false;
  if (G.powers[power].flags.navalLimit === NAR_NAVAL_LIMIT) return false;
  G.powers[power].flags.navalLimit = NAR_NAVAL_LIMIT;
  return true;
};

/**
 * The effective printed naval counter limit for a power.
 *
 * GE's Continental Focus keeps it at 2/2 "until GE unifies"; the chart's
 * physical mix is then available (4/4), exactly like a raised AU/OT limit.
 * UK/FR/RU are limited only by their chart counters.
 */
export const navalCounterLimit = (G: ImperialElegyState, power: Power): NavalCounterLimit => {
  const chart = PLAYER_COUNTER_CHART[power];
  if (!PRINTED_NAVAL_LIMIT_POWERS.includes(power)) {
    return {squadrons: chart.squadrons, dreadnoughts: chart.dreadnoughts};
  }
  const raised = G.powers[power].flags.navalLimit === NAR_NAVAL_LIMIT;
  const unified = power === "GE" && G.powers.GE.unified === true;
  const base = raised || unified ? NAR_NAVAL_LIMIT : 2;
  return {
    squadrons: Math.min(base, chart.squadrons),
    dreadnoughts: Math.min(base, chart.dreadnoughts),
  };
};

/** Counters of `kind` currently owned (on the map, in port or in a box). */
export const countersOwned = (G: ImperialElegyState, power: Power, kind: UnitKind): number =>
  Object.values(G.units).filter((unit) => unit.owner === power && unit.kind === kind).length;

/**
 * Counters a pool kind currently consumes.  An elite colonial EF is an EF
 * counter (chart note: "EFs - 1 Colonial Elite EF for GE, UK, FR, RU"), so it
 * is charged against the same EF pool as a regular expeditionary force.
 */
const countersUsed = (G: ImperialElegyState, power: Power, kind: CounterKind): number => {
  if (kind === "expeditionary") {
    return (
      countersOwned(G, power, "expeditionary") + countersOwned(G, power, "eliteColonialEf")
    );
  }
  return countersOwned(G, power, kind);
};

/**
 * Rule 4.2 counter pool for a **player** power.  Every kind has a transcribed
 * value; `null` is reserved for a future kind with no printed counter manifest.
 * Non-player powers (Italy, the US and the minors) use the printed rows in
 * `nonPlayerCounterPool`; `counterPoolFor` selects the right chart for an
 * arbitrary owner.
 */
export const counterPool = (G: ImperialElegyState, power: Power): CounterPool => {
  const chart = PLAYER_COUNTER_CHART[power];
  const naval = navalCounterLimit(G, power);
  return {
    army: chart.standingArmies + chart.specialStandingArmies,
    reserveArmy: chart.reserveArmies + chart.specialReserveArmies,
    eliteCorps: chart.eliteCorps,
    expeditionary: chart.expeditionary,
    squadron: naval.squadrons,
    dreadnought: naval.dreadnoughts,
  };
};

/**
 * Remaining counters of `kind` a power may still put into play, or null when
 * the rules print no numeric cap.  Enforced by `recruit`, `constructFleet`,
 * `buildEf` and the GW draft.
 */
export const counterRemaining = (
  G: ImperialElegyState,
  power: Power,
  kind: CounterKind,
): number | null => {
  const pool = counterPool(G, power)[kind];
  if (pool === null) return null;
  return Math.max(0, pool - countersUsed(G, power, kind));
};

/** A bool-returning guard for builds: true when the power can create the counter. */
export const hasCounterFor = (G: ImperialElegyState, power: Power, kind: CounterKind): boolean => {
  const remaining = counterRemaining(G, power, kind);
  return remaining === null || remaining > 0;
};

/** Exported for tests and documentation: powers with a transcribed chart row. */
export const COUNTER_CHART_POWERS: readonly Power[] = POWERS;

// ---------------------------------------------------------------------------
// 4.2 — non-player counter pools
// ---------------------------------------------------------------------------

/**
 * One non-player row of `counter-count.png`.  The published chart prints
 * armies, ECs, EFs, squadrons, dreadnoughts and control markers but — unlike
 * the player rows — it does not split standing and reserve armies, so the
 * non-player row keeps the printed lumps.  Poland's 22.5 split (3 standing +
 * 2 reserve) remains in `engine/poland.ts`.
 */
export interface NonPlayerCounterChart {
  /** Every army counter in the row (standing + reserve). */
  armies: number;
  eliteCorps: number;
  expeditionary: number;
  squadrons: number;
  dreadnoughts: number;
  controlMarkers: number;
}

/**
 * The legible non-player rows of `public/imperial-elegy/charts/counter-count.png`,
 * transcribed verbatim:
 *
 *            Armies  EC  EF  Sq  DN  Control
 *  Italy        5    -   1   3   1     5
 *  US           3    -   -   2   2     2
 *  Japan        2    -   -   2   1     2
 *  Bulgarian    2    -   -   -   -     1
 *  Serb         2    -   -   -   -     1
 *  Greek        2    -   -   2   -     1
 *  Belgian      1    -   -   -   -     1
 *  Bosnian      1    -   -   -   -     -
 *  Polish       5    1   -   -   -     -
 *  Bavarian     1    -   -   -   -     -
 *  Hanoverian   1    -   -   -   -     -
 *  Saxon        1    -   -   -   -     -
 *  Romanian     2    -   -   -   -     -
 *  Sar-Pied     2    -   -   1   -     2*
 *  Two Sicilies 2    -   -   1   -     -
 *  Dutch        1    -   -   1   -     -
 *  Danish       1    -   -   1   -     -
 *  Persia       1    -   -   -   -     -
 *  Qing         1    -   -   -   -     -
 *  Ethiopia     1    -   -   -   -     -
 *  Zulu         1    -   -   -   -     -
 *  Mahdi        1    -   -   -   -     -
 *  Generic      4    2   -   -   -     -
 *  Boxers       3    -   -   -   -     -
 *
 * `*` The chart note says the two Sardinia-Piedmont control markers are the
 * Two Sicilies markers on their flip side, so only the Sar-Pied row carries
 * them.
 *
 * The keys are the in-game owner strings: `"IT"` for a unified Italy's units
 * (`italianArmy`), `"US"`, the `minorHome`/`MINOR_POWER_HOMES` name for a minor
 * power, and `"REBEL:<name>"` for a rebel counter.  Rows the chart does not
 * print (Tuscany, the Papal States, Egypt, Morocco, Korea, Mexico, ...) are
 * deliberately absent: `nonPlayerCounterPool` returns `null` for them rather
 * than inventing a cap.
 */
export const NON_PLAYER_COUNTER_CHART: Readonly<Record<string, NonPlayerCounterChart>> = {
  IT: {armies: 5, eliteCorps: 0, expeditionary: 1, squadrons: 3, dreadnoughts: 1, controlMarkers: 5},
  US: {armies: 3, eliteCorps: 0, expeditionary: 0, squadrons: 2, dreadnoughts: 2, controlMarkers: 2},
  Japan: {armies: 2, eliteCorps: 0, expeditionary: 0, squadrons: 2, dreadnoughts: 1, controlMarkers: 2},
  Bulgaria: {armies: 2, eliteCorps: 0, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 1},
  Serbia: {armies: 2, eliteCorps: 0, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 1},
  Greece: {armies: 2, eliteCorps: 0, expeditionary: 0, squadrons: 2, dreadnoughts: 0, controlMarkers: 1},
  Belgium: {armies: 1, eliteCorps: 0, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 1},
  Bosnia: {armies: 1, eliteCorps: 0, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 0},
  Poland: {armies: 5, eliteCorps: 1, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 0},
  Bavaria: {armies: 1, eliteCorps: 0, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 0},
  Hanover: {armies: 1, eliteCorps: 0, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 0},
  Saxony: {armies: 1, eliteCorps: 0, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 0},
  Romania: {armies: 2, eliteCorps: 0, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 0},
  "Sardinia-Piedmont": {armies: 2, eliteCorps: 0, expeditionary: 0, squadrons: 1, dreadnoughts: 0, controlMarkers: 2},
  "Two Sicilies": {armies: 2, eliteCorps: 0, expeditionary: 0, squadrons: 1, dreadnoughts: 0, controlMarkers: 0},
  Netherlands: {armies: 1, eliteCorps: 0, expeditionary: 0, squadrons: 1, dreadnoughts: 0, controlMarkers: 0},
  Denmark: {armies: 1, eliteCorps: 0, expeditionary: 0, squadrons: 1, dreadnoughts: 0, controlMarkers: 0},
  Persia: {armies: 1, eliteCorps: 0, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 0},
  "Qing China": {armies: 1, eliteCorps: 0, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 0},
  Ethiopia: {armies: 1, eliteCorps: 0, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 0},
  "REBEL:Zulu": {armies: 1, eliteCorps: 0, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 0},
  "REBEL:Mahdi": {armies: 1, eliteCorps: 0, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 0},
  Generic: {armies: 4, eliteCorps: 2, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 0},
  "REBEL:Boxer": {armies: 3, eliteCorps: 0, expeditionary: 0, squadrons: 0, dreadnoughts: 0, controlMarkers: 0},
};

/** The kinds a non-player row prints a numeric pool for. */
export type NonPlayerCounterKind = "army" | "eliteCorps" | "expeditionary" | "squadron" | "dreadnought";

/**
 * The non-player chart row a unit kind consumes, or `null` for a kind the row
 * does not print.  Every army-like counter (standing, reserve, minor, Italian,
 * US, rebel) consumes one "Armies" counter; an elite colonial EF consumes the
 * EF row (4.2 chart note).
 */
export const nonPlayerCounterKindFor = (kind: UnitKind): NonPlayerCounterKind | null => {
  if ((NON_PLAYER_ARMY_KINDS as readonly string[]).includes(kind)) return "army";
  if (kind === "eliteCorps") return "eliteCorps";
  if (kind === "expeditionary" || kind === "eliteColonialEf") return "expeditionary";
  if (kind === "squadron") return "squadron";
  if (kind === "dreadnought") return "dreadnought";
  return null;
};

/** The printed non-player row for an owner, or `null` when the chart prints none. */
export const nonPlayerCounterPool = (owner: PowerOrMinor): NonPlayerCounterChart | null =>
  NON_PLAYER_COUNTER_CHART[owner] ?? null;

/** Unit kinds that consume a non-player "Armies" counter (Poland, minors, Italy, US, rebels). */
const NON_PLAYER_ARMY_KINDS: readonly UnitKind[] = [
  "army",
  "reserveArmy",
  "minorArmy",
  "italianArmy",
  "usArmy",
  "rebelArmy",
];

const nonPlayerCountersUsed = (
  G: ImperialElegyState,
  owner: PowerOrMinor,
  kind: NonPlayerCounterKind,
): number => {
  if (kind === "army") {
    return Object.values(G.units).filter(
      (unit) => unit.owner === owner && NON_PLAYER_ARMY_KINDS.includes(unit.kind),
    ).length;
  }
  if (kind === "expeditionary") {
    return Object.values(G.units).filter(
      (unit) =>
        unit.owner === owner &&
        (unit.kind === "expeditionary" || unit.kind === "eliteColonialEf"),
    ).length;
  }
  return Object.values(G.units).filter((unit) => unit.owner === owner && unit.kind === kind).length;
};

/**
 * Remaining printed counters for a non-player owner, or `null` when the chart
 * has no row (the deliberate "no invented cap" case).
 */
export const nonPlayerCounterRemaining = (
  G: ImperialElegyState,
  owner: PowerOrMinor,
  kind: NonPlayerCounterKind,
): number | null => {
  const chart = nonPlayerCounterPool(owner);
  if (chart === null) return null;
  const pool =
    kind === "army"
      ? chart.armies
      : kind === "squadron"
        ? chart.squadrons
        : kind === "dreadnought"
          ? chart.dreadnoughts
          : chart[kind];
  return Math.max(0, pool - nonPlayerCountersUsed(G, owner, kind));
};

/** True when a non-player owner still has a printed counter of `kind` (or no printed cap). */
export const nonPlayerHasCounterFor = (
  G: ImperialElegyState,
  owner: PowerOrMinor,
  kind: NonPlayerCounterKind,
): boolean => {
  const remaining = nonPlayerCounterRemaining(G, owner, kind);
  return remaining === null || remaining > 0;
};

/**
 * Either 4.2 pool, keyed by owner: the player chart for a seat and the
 * non-player chart for everyone else.  `null` when the chart prints no row.
 */
export const counterPoolFor = (
  G: ImperialElegyState,
  owner: PowerOrMinor,
): CounterPool | NonPlayerCounterChart | null =>
  (POWERS as readonly string[]).includes(owner)
    ? counterPool(G, owner as Power)
    : nonPlayerCounterPool(owner);
