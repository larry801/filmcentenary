/**
 * 5.6.1 / 5.6.2 — broken lines of communication for non-player (minor) powers.
 *
 * 5.6.1: a non-player supply source is a home key the minor controls and needs
 * no second key; a non-player power may also trace to an allied player's supply
 * source.  5.6.2: an out-of-supply army loses one step at the start of the
 * owning player's impulse, takes -1 in battle and cannot support.  For a minor
 * army that impulse belongs to its controlling player (or, when independent and
 * fighting on a side, the first player on that side).
 */

import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {
  beginImpulseUpkeep,
  brokenLocSpaces,
  impulsePenalties,
  landUnitsIn,
  minorBrokenLoc,
  minorController,
  minorHasLoc,
  minorUpkeepPower,
} from "./engine/rules";
import {beginLandBattle, chooseSupport, supportCandidates} from "./engine/combat";
import {createWarState} from "./engine/limitedWar";
import {resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3,
    },
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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/** Remove every land unit so only the fixture's armies can create penalties. */
const clearAllLand = (G: ImperialElegyState): void => {
  for (const state of Object.values(G.spaces)) {
    for (const id of [...state.units]) {
      const unit = G.units[id];
      if (unit && !unit.naval) removeUnit(G, id);
    }
  }
};

/** A limited war with Serbia as a controlled RU minor ally. */
const controlledMinorWar = (): ImperialElegyState => {
  const G = fresh();
  G.phase = "wartime";
  G.activePower = "RU";
  G.pending = null;
  G.battle = null;
  G.war = createWarState(G, "RU", "GE", "conquest", ["berlin"], 3);
  G.war.status = "maneuver";
  clearAllLand(G);
  G.spaces.serbia.control = "Serbia";
  G.spaces.serbia.ally = "RU";
  return G;
};

const finishSupportWindows = (G: ImperialElegyState, ctx: Ctx): void => {
  let guard = 0;
  while (G.pending?.kind === "combatSupport" && guard++ < 6) chooseSupport(G, ctx, "done");
};

// ---------------------------------------------------------------------------
// 5.6.1 supply and detection
// ---------------------------------------------------------------------------

describe("5.6.1 minor supply", () => {
  test("a minor in its own controlled home key is in supply without a second key", () => {
    const G = controlledMinorWar();
    placeUnit(G, "Serbia", "minorArmy", "serbia", 2);
    expect(minorController(G, "Serbia")).toBe("RU");
    expect(minorHasLoc(G, "Serbia", "serbia")).toBe(true);
    expect(minorBrokenLoc(G, "Serbia", "serbia")).toBe(false);
    expect(impulsePenalties(G, "RU").some((penalty) => penalty.space === "serbia")).toBe(false);
  });

  test("a minor far from its home or its controller's supply is out of supply", () => {
    const G = controlledMinorWar();
    placeUnit(G, "Serbia", "minorArmy", "berlin", 2);
    expect(minorHasLoc(G, "Serbia", "berlin")).toBe(false);
    expect(minorBrokenLoc(G, "Serbia", "berlin")).toBe(true);
    // Player-power detection (brokenLocSpaces) is unchanged by minor units.
    expect(brokenLocSpaces(G, "RU")).not.toContain("berlin");
  });

  test("a non-player supply source may trace to its controlling player's supply source", () => {
    const G = controlledMinorWar();
    // Serbia's home is lost, but the unit sits in a German home key RU has
    // captured and linked to its own supply network.
    G.spaces.serbia.control = "GE";
    for (const space of ["warsaw", "vilnius", "minsk", "moscow", "st-petersburg", "riga"]) {
      if (G.spaces[space]) G.spaces[space].control = "RU";
    }
    // RU home keys still supply RU, so a minor in a friendly, connected space
    // traces to RU's source.
    const supplied = minorHasLoc(G, "Serbia", "moscow");
    expect(supplied).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5.6.2 (1) step loss at the controlling player's impulse
// ---------------------------------------------------------------------------

describe("5.6.2 minor step loss", () => {
  test("a controlled minor's broken army loses its step on the controller's impulse only", () => {
    const G = controlledMinorWar();
    const army = placeUnit(G, "Serbia", "minorArmy", "berlin", 2);
    expect(minorUpkeepPower(G, "Serbia")).toBe("RU");
    expect(impulsePenalties(G, "RU").some((penalty) => penalty.space === "berlin")).toBe(true);
    expect(impulsePenalties(G, "GE").some((penalty) => penalty.space === "berlin")).toBe(false);
    expect(beginImpulseUpkeep(G, makeCtx([], seat("RU")), "RU")).toBe(false);
    expect(G.units[army.id].steps).toBe(1);
  });

  test("the controller chooses which minor army takes the step when several qualify", () => {
    const G = controlledMinorWar();
    const first = placeUnit(G, "Serbia", "minorArmy", "berlin", 2);
    const second = placeUnit(G, "Serbia", "minorArmy", "berlin", 2);
    G.units[first.id].space = "berlin";
    const ctx = makeCtx([], seat("RU"));
    expect(beginImpulseUpkeep(G, ctx, "RU")).toBe(true);
    expect(G.pending?.kind).toBe("impulseLoss");
    expect(G.pending?.power).toBe("RU");
    expect(G.pending?.options.map((option) => option.id).sort()).toEqual([first.id, second.id].sort());
    expect(resolvePending(G, ctx, second.id)).toBeUndefined();
    expect(G.units[second.id].steps).toBe(1);
    expect(G.units[first.id].steps).toBe(2);
  });

  test("an independent minor on a side is charged to the first player on that side", () => {
    const G = fresh();
    G.phase = "wartime";
    G.activePower = "GE";
    G.pending = null;
    G.battle = null;
    G.war = createWarState(G, "GE", "RU", "conquest", ["warsaw"], 3);
    G.war.status = "maneuver";
    G.war.attackerMinors = ["Serbia"];
    clearAllLand(G);
    G.spaces.serbia.control = "Serbia";
    G.spaces.serbia.ally = null;
    // Paris is enemy ground with no route into the German supply network.
    const army = placeUnit(G, "Serbia", "minorArmy", "paris", 2);
    expect(minorController(G, "Serbia")).toBeNull();
    expect(minorUpkeepPower(G, "Serbia")).toBe("GE");
    expect(impulsePenalties(G, "GE").some((penalty) => penalty.space === "paris")).toBe(true);
    expect(beginImpulseUpkeep(G, makeCtx([], seat("GE")), "GE")).toBe(false);
    expect(G.units[army.id].steps).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5.6.2 (2) -1 land battle modifier
// ---------------------------------------------------------------------------

describe("5.6.2 minor battle modifier", () => {
  test("a minor army defending out of supply gives its side -1", () => {
    const G = fresh();
    G.phase = "wartime";
    G.pending = null;
    G.battle = null;
    G.war = createWarState(G, "GE", "RU", "conquest", ["warsaw"], 3);
    G.war.status = "maneuver";
    G.war.defenderMinors = ["Serbia"];
    clearAllLand(G);
    G.spaces.serbia.control = "Serbia";
    G.spaces.serbia.ally = null;
    G.spaces.saxony.control = "Saxony";
    G.spaces.saxony.ally = null;
    placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "Serbia", "minorArmy", "saxony", 2);
    const battle = beginLandBattle(G, makeCtx([3, 3]), "GE", "berlin", "saxony");
    expect(battle).not.toBeNull();
    expect(battle!.notes).toContain("brokenLocDefender");
    expect(battle!.defenderDrm).toBeLessThan(0);
    finishSupportWindows(G, makeCtx([3, 3]));
  });
});

// ---------------------------------------------------------------------------
// 5.6.2 (3) no support
// ---------------------------------------------------------------------------

describe("5.6.2 minor armies cannot support out of supply", () => {
  test("a broken-LoC minor army is removed from the support candidates", () => {
    const G = fresh();
    G.phase = "wartime";
    G.pending = null;
    G.battle = null;
    G.war = createWarState(G, "GE", "FR", "conquest", ["paris"], 3);
    G.war.status = "maneuver";
    clearAllLand(G);
    G.spaces.serbia.control = "Serbia";
    G.spaces.serbia.ally = "GE";
    G.spaces.champagne.control = "Serbia";
    G.spaces.champagne.ally = "GE";
    G.spaces.paris.control = "GE";
    G.spaces.paris.occupiedBy = "GE";
    G.spaces.picardy.control = "FR";
    placeUnit(G, "GE", "army", "paris", 2);
    placeUnit(G, "FR", "army", "picardy", 2);
    placeUnit(G, "Serbia", "minorArmy", "champagne", 2);
    expect(minorBrokenLoc(G, "Serbia", "champagne")).toBe(true);
    const battle = beginLandBattle(G, makeCtx([3, 3]), "GE", "paris", "picardy")!;
    const attackerSupport = supportCandidates(G, "GE", battle, "attacker").map((entry) => entry.space);
    expect(attackerSupport).not.toContain("champagne");
    finishSupportWindows(G, makeCtx([3, 3]));
  });
});

// ---------------------------------------------------------------------------
// 5.6 / 5.6.1 sea LoC
// ---------------------------------------------------------------------------

describe("5.6.1 minor sea LoC", () => {
  test("an enemy fleet blocks a minor army's sea trace in wartime", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = createWarState(G, "UK", "FR", "conquest", ["paris"], 3);
    G.war.status = "maneuver";
    clearAllLand(G);
    G.spaces.serbia.control = "Serbia";
    G.spaces.serbia.ally = "UK";
    for (const id of [...G.spaces["north-atlantic"].units]) removeUnit(G, id);
    placeUnit(G, "Serbia", "minorArmy", "canada", 2);

    expect(minorController(G, "Serbia")).toBe("UK");
    expect(minorHasLoc(G, "Serbia", "canada")).toBe(true);

    // 5.6: a naval box may not be traced through while it holds enemy units.
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    expect(minorHasLoc(G, "Serbia", "canada")).toBe(false);
    expect(minorBrokenLoc(G, "Serbia", "canada")).toBe(true);
  });
});
