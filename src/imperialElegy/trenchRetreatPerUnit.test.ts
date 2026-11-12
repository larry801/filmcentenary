/**
 * 18.7 / 28.1.1 — a trench battle forces the losing side out of the shared
 * space.  When the defeated force is mixed (e.g. two allied contingents whose
 * only legal spaces differ), `combatRetreat` offers per-unit destinations as
 * one single decision; a single possible assignment stays deterministic and a
 * unit with no legal space is eliminated.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn} from "./engine/rules";
import {finishBattle, setTrenchBattleMarker} from "./engine/combat";
import {declinePending, resolvePending} from "./moves";

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
    phase: "gwManeuver",
  } as unknown as Ctx;
};

const gwState = (): GreatWarState => ({
  active: true,
  turn: 1,
  order: ["GE", "FR", "UK"],
  belligerents: ["GE", "FR", "UK"],
  neutrals: ["AU", "RU", "OT"],
  te: ["FR", "UK"],
  ta: ["GE"],
  usIn: false,
  italyIn: false,
  usStability: 3,
  usManpower: 3,
  usBudget: 4,
  italyStability: 3,
  italyManpower: 3,
  italyBudget: 2,
  trenches: {},
  lastColonialWar: null,
  victor: null,
  outbreakDone: true,
  nationalWillDone: true,
  bonusImpulses: [],
});

const clearLand = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space)]) removeUnit(G, unit.id);
};

/**
 * A same-space trench battle at Saxony: GE attacks the shared space and wins,
 * pushing the FR + UK defenders out.  Bavaria/Bohemia can be made friendly to
 * FR only and Silesia to UK only, so the two contingents cannot share a space.
 */
const fixture = (spaces: {
  bavaria: "FR" | "UK" | "GE";
  silesia: "FR" | "UK" | "GE";
  bohemia: "FR" | "UK" | "GE";
}): {G: ImperialElegyState; ctx: Ctx; fr: string; uk: string} => {
  const G = setupImperialElegy(makeCtx());
  G.gw = gwState();
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.powers.UK.alliance = "teCommitted";
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  for (const space of ["saxony", "berlin", "bavaria", "silesia", "bohemia"]) clearLand(G, space);
  setTrenchBattleMarker(G, "saxony", "deadlock", 1);
  const ge = placeUnit(G, "GE", "army", "saxony", 2).id;
  const fr = placeUnit(G, "FR", "army", "saxony", 2).id;
  const uk = placeUnit(G, "UK", "army", "saxony", 2).id;
  // GE's own spaces stay enemy-held for the retreating allies; the three
  // border spaces are minor-controlled and aligned to one of the two allies.
  G.spaces.berlin.control = "GE";
  for (const [space, ally] of Object.entries(spaces) as [string, string][]) {
    const state = G.spaces[space];
    state.control = ally === "FR" ? "Bavaria" : ally === "UK" ? "Saxony" : "GE";
    state.ally = ally === "GE" ? null : ally;
  }
  G.battle = {
    kind: "land",
    attacker: "GE",
    defender: "FR",
    from: "saxony",
    to: "saxony",
    mainAttack: [ge],
    mainDefense: [fr, uk],
    forceOwners: {attacker: ["GE"], defender: ["FR", "UK"]},
    supportAttack: [],
    supportDefense: [],
    stage: "roll",
    supportSide: "attacker",
    attackerDrm: 0,
    defenderDrm: 0,
    attackerLosses: 0,
    defenderLosses: 0,
    decisive: false,
    winner: "attacker",
    trench: true,
    notes: [],
  };
  return {G, ctx: makeCtx([], "2"), fr, uk};
};

describe("28.1.1 per-unit trench retreat", () => {
  test("units with different legal spaces get one split decision", () => {
    const {G, ctx, fr, uk} = fixture({bavaria: "FR", silesia: "UK", bohemia: "FR"});
    finishBattle(G, ctx);
    expect(G.battle).not.toBeNull();
    expect(G.pending?.kind).toBe("combatRetreat");
    expect(G.pending?.power).toBe("FR");
    const ids = G.pending!.options.map((option) => option.id);
    // No space is legal for the whole force, so only split assignments exist.
    expect(ids.every((id) => id.startsWith("split:"))).toBe(true);
    expect(ids.length).toBeGreaterThan(0);
    const destinations = G.pending!.context?.unitDestinations as Record<string, string[]>;
    expect(destinations[fr].sort()).toEqual(["bavaria", "bohemia"]);
    expect(destinations[uk]).toEqual(["silesia"]);

    // Stale/foreign answers keep the decision open.
    expect(resolvePending(G, makeCtx([], "0"), ids[0])).toBe(INVALID_MOVE);
    expect(resolvePending(G, ctx, "berlin")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("combatRetreat");

    const chosen = G.pending!.options[0];
    const assignments = chosen.data?.assignments as {unitId: string; space: string}[];
    expect(assignments).toHaveLength(2);
    expect(resolvePending(G, ctx, chosen.id)).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.pending).toBeNull();
    for (const entry of assignments) {
      expect(G.units[entry.unitId].space).toBe(entry.space);
    }
    expect(G.units[fr].space).not.toBe("saxony");
    expect(G.units[uk].space).toBe("silesia");
    expect(G.spaces.saxony.trench).toBeFalsy();
    expect(G.spaces.saxony.occupiedBy).toBe("GE");
  });

  test("a single possible assignment stays deterministic and opens no decision", () => {
    const {G, ctx, fr, uk} = fixture({bavaria: "FR", silesia: "UK", bohemia: "GE"});
    finishBattle(G, ctx);
    expect(G.pending).toBeNull();
    expect(G.battle).toBeNull();
    expect(G.units[fr].space).toBe("bavaria");
    expect(G.units[uk].space).toBe("silesia");
    expect(landUnitsIn(G, "saxony").filter((unit) => unit.owner === "FR" || unit.owner === "UK")).toHaveLength(0);
  });

  test("declining a split decision applies the first deterministic assignment", () => {
    const {G, ctx, uk} = fixture({bavaria: "FR", silesia: "UK", bohemia: "FR"});
    finishBattle(G, ctx);
    expect(G.pending?.kind).toBe("combatRetreat");
    expect(declinePending(G, makeCtx([], "0"))).toBe(INVALID_MOVE);
    expect(declinePending(G, ctx)).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.units[uk].space).toBe("silesia");
  });

  test("a unit with no legal space is eliminated while the rest retreat", () => {
    const {G, ctx, uk} = fixture({bavaria: "FR", silesia: "GE", bohemia: "FR"});
    finishBattle(G, ctx);
    // UK has no legal space: only FR is movable, with Bavaria and Bohemia as
    // group choices.
    expect(G.pending?.kind).toBe("combatRetreat");
    expect(G.pending?.power).toBe("FR");
    expect(G.pending!.options.map((option) => option.id).sort()).toEqual(["bavaria", "bohemia"]);
    const choice = G.pending!.options[0];
    expect(resolvePending(G, ctx, choice.id)).toBeUndefined();
    expect(G.units[uk]).toBeUndefined();
    expect(G.battle).toBeNull();
  });
});
