/**
 * Rule 19.1 — a multi-box naval move is intercepted at each box it enters,
 * not only at its final destination.  A GW joint naval operation moves two
 * powers' contingents on one 12.3 route, so it must run the same transit
 * interception chain as a single-power GW naval maneuver: park at the first
 * intermediate box adjacent to an enemy port, open the window, and finish the
 * move without spending a second budget point.  A destination box with enemy
 * ports but no enemy ships must also open the window.
 */

import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {navalUnitsIn} from "./engine/rules";
import {performGwManeuver} from "./engine/greatWarFlow";
import {gwJointNaval, resolvePending} from "./moves";

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

const gwState = (): GreatWarState => ({
  active: true,
  turn: 1,
  order: ["GE", "FR", "AU"],
  belligerents: ["GE", "FR", "AU"],
  neutrals: ["UK", "RU", "OT"],
  te: ["FR"],
  ta: ["GE", "AU"],
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

const clearNaval = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

const clearAllNaval = (G: ImperialElegyState): void => {
  for (const unit of Object.values(G.units)) if (unit.naval) removeUnit(G, unit.id);
};

/** GE + AU are allied; FR holds Brittany (a North Atlantic port). */
const jointFixture = (): {G: ImperialElegyState; ge: string; au: string} => {
  const G = setupImperialElegy(makeCtx());
  G.gw = gwState();
  G.powers.GE.alliance = "taCommitted";
  G.powers.AU.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.powers.GE.gwBudget = 6;
  G.powers.GE.flags.gwActionsThisImpulse = 0;
  G.powers.GE.flags.passedGw = false;
  clearAllNaval(G);
  // Denmark is a North Atlantic / Baltic port; making it German gives the
  // winning joint force a friendly port for the 19.8 follow-up.
  G.spaces.denmark.control = "GE";
  G.spaces.brittany.control = "FR";
  placeUnit(G, "FR", "squadron", "brittany", 2);
  const ge = placeUnit(G, "GE", "squadron", "pomerania", 2).id;
  const au = placeUnit(G, "AU", "squadron", "pomerania", 2).id;
  return {G, ge, au};
};

describe("19.1 joint naval transit interception", () => {
  test("the joint move is intercepted at an intermediate box and resumes without a second cost", () => {
    const {G, ge, au} = jointFixture();
    expect(gwJointNaval(
      G,
      makeCtx([], seat("GE")),
      "AU",
      [ge],
      [au],
      "western-mediterranean",
    )).toBeUndefined();
    // Parked in the North Atlantic: the Brittany squadron may intercept there.
    expect(G.units[ge].space).toBe("north-atlantic");
    expect(G.units[au].space).toBe("north-atlantic");
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.power).toBe("FR");
    expect(G.pending?.context?.to).toBe("north-atlantic");
    expect(G.pending?.options.map((option) => option.id)).toContain("intercept:brittany");
    expect(G.navalTransit?.index).toBeGreaterThan(0);
    expect(G.navalTransit?.ally).toBe("AU");
    // One GW budget point for the whole joint maneuver, split or not.
    expect(G.powers.GE.gwBudget).toBe(5);

    expect(resolvePending(G, makeCtx([], seat("FR")), "skip")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.navalTransit).toBeNull();
    expect(G.units[ge].space).toBe("western-mediterranean");
    expect(G.units[au].space).toBe("western-mediterranean");
    expect(G.powers.GE.gwBudget).toBe(5);
  });

  test("a joint destination box with enemy ports but no ships still opens interception", () => {
    const {G, ge, au} = jointFixture();
    expect(gwJointNaval(G, makeCtx([], seat("GE")), "AU", [ge], [au], "north-atlantic")).toBeUndefined();
    expect(G.units[ge].space).toBe("north-atlantic");
    expect(G.units[au].space).toBe("north-atlantic");
    expect(G.navalTransit ?? null).toBeNull();
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.power).toBe("FR");
    expect(G.powers.GE.gwBudget).toBe(5);
  });

  test("the direct flow entry point reaches the same transit window", () => {
    const {G, ge, au} = jointFixture();
    const res = performGwManeuver(G, makeCtx(), {
      kind: "jointNaval",
      power: "GE",
      ally: "AU",
      unitIds: [ge],
      allyUnitIds: [au],
      to: "western-mediterranean",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.to).toBe("north-atlantic");
    expect(G.navalTransit?.ally).toBe("AU");
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.powers.GE.gwBudget).toBe(5);
  });

  test("winning the transit battle keeps the ally in the 19.1 continuation", () => {
    const {G, ge, au} = jointFixture();
    expect(gwJointNaval(
      G,
      makeCtx([], seat("GE")),
      "AU",
      [ge],
      [au],
      "western-mediterranean",
    )).toBeUndefined();
    // Interception roll 5 (success), then the battle dice: GE wins.
    expect(resolvePending(G, makeCtx([5, 6, 1], seat("FR")), "intercept:brittany")).toBeUndefined();
    expect(G.battle).toBeNull();
    // 19.8's port-only move comes first and then hands over to the separate
    // 19.1 continuation; the joint ally is carried in both.
    expect(G.pending?.kind).toBe("navalPortContinuation");
    expect(resolvePending(G, makeCtx([], seat("GE")), "stay")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalContinuation");
    expect(G.pending?.context?.ally).toBe("AU");
    expect(resolvePending(G, makeCtx([], seat("GE")), "western-mediterranean")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.units[ge].space).toBe("western-mediterranean");
    expect(G.units[au].space).toBe("western-mediterranean");
    expect(G.powers.GE.gwBudget).toBe(5);
  });
});
