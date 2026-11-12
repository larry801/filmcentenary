/**
 * Rule 18.7 / 19.7 — "Units do not have to retreat to the same space."  The
 * printed choice is one destination per unit, so the live `combatRetreat`
 * decision must offer real force sizes completely.  The old generator stopped
 * after eight split assignments, which truncated a four-ship allied fleet; the
 * deterministic enumerator now covers every assignment up to
 * `SPLIT_RETREAT_OPTION_LIMIT` (512) and falls back to a deterministic
 * single-divergence cover only for pathological combinations.
 */

import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {SPACES} from "./constant/spaces";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {beginNavalBattle, enumerateRetreatSplits, finishBattle, SPLIT_RETREAT_OPTION_LIMIT, type RetreatAssignment} from "./engine/combat";
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
    phase: "action",
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

const clearAllNaval = (G: ImperialElegyState): void => {
  for (const unit of Object.values(G.units)) if (unit.naval) removeUnit(G, unit.id);
};

const port = (id: string) => (id === "brittany" || id === "picardy" || id === "aquitaine" || id === "london" || id === "wales");

/**
 * GE attacks two FR and two UK ships in the North Atlantic.  Only three French
 * and two British ports are friendly, and German squadrons block the adjacent
 * boxes, so each ship has 3 or 2 legal retreat spaces (36 assignments).
 */
const splitFixture = (): {G: ImperialElegyState; ctx: Ctx; fr: string[]; uk: string[]} => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.passed = [];
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
  influence("aquitaine", "FR");
  influence("london", "UK");
  influence("wales", "UK");
  // Block the two adjacent boxes so the destinations stay port-only.
  placeUnit(G, "GE", "squadron", "baltic-sea", 2);
  placeUnit(G, "GE", "squadron", "western-mediterranean", 2);
  // Hold the battle at the pre-dice card window.
  G.powers.GE.hand = ["IE-A061"];
  const ge = placeUnit(G, "GE", "squadron", "north-atlantic", 2).id;
  const fr = [
    placeUnit(G, "FR", "squadron", "north-atlantic", 2).id,
    placeUnit(G, "FR", "squadron", "north-atlantic", 2).id,
  ];
  const uk = [
    placeUnit(G, "UK", "squadron", "north-atlantic", 2).id,
    placeUnit(G, "UK", "squadron", "north-atlantic", 2).id,
  ];
  const battle = beginNavalBattle(G, makeCtx(), "GE", "north-atlantic", "north-atlantic", {
    attackerUnits: [ge],
  });
  if (!battle) throw new Error("naval battle did not start");
  G.pending = null;
  battle.winner = "attacker";
  battle.attackerLosses = 0;
  battle.defenderLosses = 0;
  return {G, ctx: makeCtx([], seat("FR")), fr, uk};
};

describe("retreat split enumerator", () => {
  test("four units with three destinations each enumerate completely", () => {
    const unitIds = ["u1", "u2", "u3", "u4"];
    const options = new Map<string, readonly string[]>([
      ["u1", ["a", "b", "c"]],
      ["u2", ["a", "b", "c"]],
      ["u3", ["a", "b", "c"]],
      ["u4", ["a", "b", "c"]],
    ]);
    const splits = enumerateRetreatSplits(unitIds, options);
    // 3^4 total assignments, minus the three same-space (group) ones.
    expect(splits).toHaveLength(81 - 3);
    const canonical = (assignment: RetreatAssignment[]): string =>
      assignment.map((entry) => `${entry.unitId}@${entry.space}`).join("|");
    expect(splits.map(canonical)).toContain("u1@c|u2@b|u3@a|u4@c");
    // Every assignment covers the whole force.
    expect(splits.every((assignment) => assignment.length === 4)).toBe(true);
  });

  test("the bound is far above the old eight-option cap", () => {
    expect(SPLIT_RETREAT_OPTION_LIMIT).toBeGreaterThanOrEqual(64);
  });

  test("a pathological force falls back to a deterministic single-divergence cover", () => {
    const unitIds = ["u1", "u2", "u3", "u4", "u5"];
    const options = new Map<string, readonly string[]>([
      ["u1", ["a", "b", "c", "d"]],
      ["u2", ["a", "b", "c", "d"]],
      ["u3", ["a", "b", "c", "d"]],
      ["u4", ["a", "b", "c", "d"]],
      ["u5", ["a", "b", "c", "d"]],
    ]);
    // 4^5 = 1024 > 512: no full enumeration.
    const splits = enumerateRetreatSplits(unitIds, options);
    expect(splits.length).toBeLessThanOrEqual(1 + unitIds.length * 4);
    const canonical = (assignment: RetreatAssignment[]): string =>
      assignment.map((entry) => `${entry.unitId}@${entry.space}`).join("|");
    const ids = splits.map(canonical);
    // Every single-unit divergence is still offered, deterministically.
    expect(ids).toContain("u1@b|u2@a|u3@a|u4@a|u5@a");
    expect(ids).toContain("u1@a|u2@a|u3@a|u4@a|u5@d");
    // The same call is stable.
    expect(enumerateRetreatSplits(unitIds, options).map(canonical)).toEqual(ids);
  });

  test("a single unit has no split assignment", () => {
    const options = new Map<string, readonly string[]>([["u1", ["a", "b", "c"]]]);
    expect(enumerateRetreatSplits(["u1"], options)).toEqual([]);
  });
});

describe("19.7 four-ship allied retreat choice", () => {
  test("the live decision offers all 36 assignments, not the old eight", () => {
    const {G, ctx, fr, uk} = splitFixture();
    finishBattle(G, ctx);
    expect(G.pending?.kind).toBe("combatRetreat");
    expect(G.pending?.power).toBe("FR");
    const splitIds = G.pending!.options.filter((option) => option.id.startsWith("split:"));
    expect(splitIds.length).toBe(36);
    expect(splitIds.length).toBeGreaterThan(8);

    const combined = G.pending!.options.find((option) => {
      const assignment = new Map(
        ((option.data?.assignments as RetreatAssignment[] | undefined) ?? []).map((entry) => [
          entry.unitId,
          entry.space,
        ]),
      );
      return assignment.get(fr[0]) === "brittany" &&
        assignment.get(fr[1]) === "picardy" &&
        assignment.get(uk[0]) === "london" &&
        assignment.get(uk[1]) === "wales";
    });
    expect(combined).toBeDefined();
    expect(resolvePending(G, ctx, combined!.id)).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.units[fr[0]].space).toBe("brittany");
    expect(G.units[fr[1]].space).toBe("picardy");
    expect(G.units[uk[0]].space).toBe("london");
    expect(G.units[uk[1]].space).toBe("wales");
    // 19.8 then offers GE the port-only follow-up; stay at sea to finish.
    expect(G.pending?.kind).toBe("navalPortContinuation");
    expect(resolvePending(G, makeCtx([], seat("GE")), "stay")).toBeUndefined();
    expect(G.pending).toBeNull();
  });
});
