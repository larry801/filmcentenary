/**
 * Rules 18.7 / 19.7 — "Defenders retreat one space ... Units do not have to
 * retreat to the same space" (18.7) and "Losers must retreat to an adjacent
 * friendly port or to an adjacent naval box that does not contain enemy units"
 * (19.7).  When the defeated force is mixed and its units have different legal
 * spaces, the `combatRetreat` decision (previously raised only for same-space
 * trench battles) covers the whole force in one decision: common group spaces
 * stay group options, and divergent units get per-unit split assignments.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {SPACES} from "./constant/spaces";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn, navalUnitsIn} from "./engine/rules";
import {beginLandBattle, beginNavalBattle, finishBattle} from "./engine/combat";
import {resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "wartime",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const warState = (attacker: Power, defender: Power, defenderAllies: Power[] = []): WarState => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies,
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: [],
  status: "maneuver",
  budgets: {},
  initiative: [],
  treaties: [],
  victor: null,
  truceTurns: 2,
  passed: [],
  startedTurn: 1,
} as unknown as WarState);

const clearLand = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space)]) removeUnit(G, unit.id);
};

const clearAllNaval = (G: ImperialElegyState): void => {
  for (const unit of Object.values(G.units)) if (unit.naval) removeUnit(G, unit.id);
};

interface LandSpaces {
  bavaria: "FR" | "UK" | "GE";
  silesia: "FR" | "UK" | "GE";
  bohemia: "FR" | "UK" | "GE";
}

/**
 * GE attacks Saxony from Berlin and wins.  FR + UK armies defend Saxony; the
 * three border spaces are assigned to one power (minor ally) or to GE so the
 * two contingents can have different legal retreat spaces.
 */
const landFixture = (spaces: LandSpaces): {
  G: ImperialElegyState;
  ctx: Ctx;
  fr: string;
  uk: string;
} => {
  const G = setupImperialElegy(makeCtx());
  G.gw = null;
  G.phase = "wartime";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.war = warState("GE", "FR", ["UK"]);
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.powers.UK.alliance = "teCommitted";
  const relevant = ["saxony", "berlin", "bavaria", "silesia", "bohemia"];
  for (const space of relevant) clearLand(G, space);
  for (const space of relevant) {
    const state = G.spaces[space];
    state.control = "GE";
    state.ally = null;
    state.influence = null;
    state.occupiedBy = null;
  }
  for (const [space, owner] of Object.entries(spaces) as [string, "FR" | "UK" | "GE"][]) {
    const state = G.spaces[space];
    if (owner === "GE") continue;
    // Minor-controlled border space allied to one player only.
    state.control = owner === "FR" ? "Bavaria" : "Saxony";
    state.ally = owner;
  }
  const fr = placeUnit(G, "FR", "army", "saxony", 2).id;
  const uk = placeUnit(G, "UK", "army", "saxony", 2).id;
  placeUnit(G, "GE", "army", "berlin", 2);
  const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "saxony");
  if (!battle) throw new Error("land battle did not start");
  G.pending = null;
  battle.winner = "attacker";
  battle.attackerLosses = 0;
  battle.defenderLosses = 0;
  return {G, ctx: makeCtx([], seat("FR")), fr, uk};
};

describe("18.7 ordinary land retreat choice", () => {
  test("units with different legal spaces get one split decision", () => {
    const {G, ctx, fr, uk} = landFixture({bavaria: "FR", silesia: "UK", bohemia: "FR"});
    finishBattle(G, ctx);
    expect(G.battle).not.toBeNull();
    expect(G.pending?.kind).toBe("combatRetreat");
    expect(G.pending?.power).toBe("FR");
    const options = G.pending!.options;
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((option) => option.id.startsWith("split:"))).toBe(true);
    const destinations = G.pending!.context?.unitDestinations as Record<string, string[]>;
    expect((destinations[fr] ?? []).sort()).toEqual(["bavaria", "bohemia"]);
    expect(destinations[uk]).toEqual(["silesia"]);

    // Stale/foreign answers keep the decision open.
    expect(resolvePending(G, makeCtx([], seat("GE")), options[0].id)).toBe(INVALID_MOVE);
    expect(resolvePending(G, ctx, "berlin")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("combatRetreat");

    const chosen = G.pending!.options[0];
    const assignments = chosen.data?.assignments as {unitId: string; space: string}[];
    expect(resolvePending(G, ctx, chosen.id)).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.pending).toBeNull();
    for (const entry of assignments) expect(G.units[entry.unitId].space).toBe(entry.space);
    expect(G.units[fr].space).not.toBe("saxony");
    expect(G.units[uk].space).not.toBe("saxony");
    // The winning attacker advances into the vacated space.
    expect(landUnitsIn(G, "saxony").some((unit) => unit.owner === "GE")).toBe(true);
  });

  test("a common destination stays a group option", () => {
    const {G, ctx} = landFixture({bavaria: "FR", silesia: "UK", bohemia: "FR"});
    // Bavaria is FR-controlled, so the allied UK may also retreat there.
    G.spaces.bavaria.control = "FR";
    G.spaces.bavaria.ally = null;
    finishBattle(G, ctx);
    expect(G.pending?.kind).toBe("combatRetreat");
    const ids = G.pending!.options.map((option) => option.id);
    expect(ids).toContain("bavaria");
    expect(ids.some((id) => id.startsWith("split:"))).toBe(true);
    expect(resolvePending(G, ctx, "bavaria")).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(landUnitsIn(G, "bavaria").map((unit) => unit.owner).sort()).toEqual(["FR", "UK"]);
  });

  test("a single possible assignment stays deterministic and opens no decision", () => {
    const {G, ctx, fr, uk} = landFixture({bavaria: "FR", silesia: "UK", bohemia: "GE"});
    finishBattle(G, ctx);
    expect(G.pending).toBeNull();
    expect(G.battle).toBeNull();
    expect(G.units[fr].space).toBe("bavaria");
    expect(G.units[uk].space).toBe("silesia");
  });

  test("a unit with no legal space is eliminated while the rest retreat", () => {
    const {G, ctx, fr, uk} = landFixture({bavaria: "FR", silesia: "GE", bohemia: "GE"});
    finishBattle(G, ctx);
    expect(G.pending).toBeNull();
    expect(G.battle).toBeNull();
    expect(G.units[fr].space).toBe("bavaria");
    expect(G.units[uk]).toBeUndefined();
  });

  test("a homogeneous force keeps the deterministic group retreat", () => {
    const G = setupImperialElegy(makeCtx());
    G.gw = null;
    G.phase = "wartime";
    G.activePower = "GE";
    G.pending = null;
    G.pendingStack = [];
    G.battle = null;
    G.war = warState("GE", "FR");
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    for (const space of ["saxony", "berlin", "bavaria", "silesia", "bohemia"]) {
      clearLand(G, space);
      G.spaces[space].control = "GE";
      G.spaces[space].ally = null;
    }
    G.spaces.bavaria.control = "Bavaria";
    G.spaces.bavaria.ally = "FR";
    G.spaces.bohemia.control = "Bavaria";
    G.spaces.bohemia.ally = "FR";
    const fr = placeUnit(G, "FR", "army", "saxony", 2).id;
    placeUnit(G, "GE", "army", "berlin", 2);
    const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "saxony")!;
    G.pending = null;
    battle.winner = "attacker";
    battle.attackerLosses = 0;
    battle.defenderLosses = 0;
    finishBattle(G, makeCtx([], seat("FR")));
    // One unit cannot diverge from itself: the first legal space stays the
    // deterministic fallback (no prompt).
    expect(G.pending).toBeNull();
    expect(G.units[fr].space).toBe("bavaria");
  });
});

/**
 * GE attacks the North Atlantic where a FR and a UK squadron defend together.
 * The two contingents' ports are made friendly through influence only, so the
 * allied fleets really do have different legal retreat spaces.
 */
const navalFixture = (withUk: boolean): {G: ImperialElegyState; fr: string; uk?: string} => {
  const G = setupImperialElegy(makeCtx());
  G.gw = null;
  G.phase = "action";
  G.activePower = "GE";
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.cpRemaining = 6;
  G.war = warState("GE", "FR", ["UK"]);
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.powers.UK.alliance = "teCommitted";
  for (const power of POWERS) {
    G.powers[power].hand = [];
    G.powers[power].gwCard = null;
  }
  // Hold the naval battle at the pre-dice card window.
  G.powers.GE.hand = ["IE-A061"];
  clearAllNaval(G);
  for (const def of Object.values(SPACES)) {
    if (!def.ports?.includes("north-atlantic")) continue;
    const state = G.spaces[def.id];
    state.control = "GE";
    state.ally = null;
    state.influence = null;
    state.occupiedBy = null;
  }
  const influence = (space: string, power: Power): void => {
    G.spaces[space].control = null;
    G.spaces[space].influence = power;
  };
  influence("brittany", "FR");
  influence("picardy", "FR");
  influence("london", "UK");
  influence("wales", "UK");
  placeUnit(G, "GE", "squadron", "western-mediterranean", 2);
  const fr = placeUnit(G, "FR", "squadron", "north-atlantic", 2).id;
  const uk = withUk ? placeUnit(G, "UK", "squadron", "north-atlantic", 2).id : undefined;
  const battle = beginNavalBattle(G, makeCtx(), "GE", "western-mediterranean", "north-atlantic");
  if (!battle) throw new Error("naval battle did not start");
  G.pending = null;
  battle.winner = "attacker";
  battle.attackerLosses = 0;
  battle.defenderLosses = 0;
  return {G, fr, uk};
};

describe("19.7 ordinary naval retreat choice", () => {
  test("a mixed fleet with different friendly ports gets one split decision", () => {
    const {G, fr, uk} = navalFixture(true);
    finishBattle(G, makeCtx([], seat("FR")));
    expect(G.battle).not.toBeNull();
    expect(G.pending?.kind).toBe("combatRetreat");
    expect(G.pending?.power).toBe("FR");
    const ids = G.pending!.options.map((option) => option.id);
    // The Baltic Sea is a shared friendly box, so it stays a group option; the
    // divergent ports are offered as split assignments.
    expect(ids).toContain("baltic-sea");
    expect(ids.some((id) => id.startsWith("split:"))).toBe(true);
    const destinations = G.pending!.context?.unitDestinations as Record<string, string[]>;
    expect((destinations[fr] ?? []).sort()).toEqual(["baltic-sea", "brittany", "picardy"]);
    expect((destinations[uk!] ?? []).sort()).toEqual(["baltic-sea", "london", "wales"]);

    const combined = G.pending!.options.find((option) => {
      const assignments = option.data?.assignments as {unitId: string; space: string}[] | undefined;
      const byUnit = new Map((assignments ?? []).map((entry) => [entry.unitId, entry.space]));
      return byUnit.get(fr) === "brittany" && byUnit.get(uk!) === "london";
    });
    expect(combined).toBeDefined();
    expect(resolvePending(G, makeCtx([], seat("FR")), combined!.id)).toBeUndefined();
    // 19.8 then offers the winning attacker a port-only move; this test is
    // about the retreat itself, so the attacker stays at sea.
    expect(G.pending?.kind).toBe("navalPortContinuation");
    expect(resolvePending(G, makeCtx([], seat("GE")), "stay")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.battle).toBeNull();
    expect(G.units[fr].space).toBe("brittany");
    expect(G.units[uk!].space).toBe("london");
  });

  test("a single-power fleet keeps the deterministic first port", () => {
    const {G, fr} = navalFixture(false);
    finishBattle(G, makeCtx([], seat("FR")));
    expect(G.pending?.kind).toBe("navalPortContinuation");
    expect(resolvePending(G, makeCtx([], seat("GE")), "stay")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.battle).toBeNull();
    // Deterministic first legal space (the connection order, not a prompt).
    expect(["baltic-sea", "brittany", "picardy"]).toContain(G.units[fr].space);
  });

  test("a fleet with no legal retreat space is eliminated", () => {
    const {G, fr} = navalFixture(false);
    // No port adjacent to the North Atlantic is friendly to FR any more, and a
    // German squadron blocks the last friendly adjacent box.
    for (const def of Object.values(SPACES)) {
      if (!def.ports?.includes("north-atlantic")) continue;
      G.spaces[def.id].influence = null;
      G.spaces[def.id].control = "GE";
      G.spaces[def.id].ally = null;
    }
    placeUnit(G, "GE", "squadron", "baltic-sea", 2);
    finishBattle(G, makeCtx([], seat("FR")));
    expect(G.pending?.kind).toBe("navalPortContinuation");
    expect(resolvePending(G, makeCtx([], seat("GE")), "stay")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.battle).toBeNull();
    expect(G.units[fr]).toBeUndefined();
    expect(navalUnitsIn(G, "north-atlantic").some((unit) => unit.owner === "FR")).toBe(false);
  });
});
