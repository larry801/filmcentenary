/**
 * Rule 28.1.1 / 18.7 / 28.1.5 — an intra-space trench battle pushes the losing
 * side out.  When more than one legal retreat space exists the losing player
 * chooses it through the live `combatRetreat` decision; only a single legal
 * space stays deterministic.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn} from "./engine/rules";
import {finishBattle, setTrenchBattleMarker} from "./engine/combat";
import {beginGwTurn} from "./engine/greatWarFlow";
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
  order: ["GE", "FR"],
  belligerents: ["GE", "FR"],
  neutrals: ["UK", "AU", "RU", "OT"],
  te: ["FR"],
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

const trenchFixture = (): {G: ImperialElegyState; ctx: Ctx} => {
  const G = setupImperialElegy(makeCtx());
  G.gw = gwState();
  G.phase = "gwPlanning";
  const ctx = makeCtx([6, 1, 3]);
  beginGwTurn(G, ctx);
  for (const power of POWERS) {
    G.powers[power].gwCard = null;
    G.powers[power].hand = [];
  }
  G.gw.combatCardsInFront = [];
  G.flags.gwFaceupCombat = "";
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.pending = null;
  G.battle = null;
  for (const space of ["saxony", "berlin", "silesia", "bohemia", "bavaria"]) clearLand(G, space);
  return {G, ctx};
};

/**
 * A resolved same-space trench battle with two GE armies losing to two FR
 * armies.  Built directly so the dice/support/card windows cannot auto-resolve
 * it before the retreat step (the pending itself is what this suite tests).
 */
const losingAttackerBattle = (): {G: ImperialElegyState; ctx: Ctx; battleId: string} => {
  const {G, ctx} = trenchFixture();
  const ge1 = placeUnit(G, "GE", "army", "saxony", 2).id;
  const ge2 = placeUnit(G, "GE", "army", "saxony", 2).id;
  const fr = placeUnit(G, "FR", "army", "saxony", 2);
  setTrenchBattleMarker(G, "saxony", "deadlock", 1);
  G.pending = null;
  G.battle = {
    kind: "land",
    attacker: "GE",
    defender: "FR",
    from: "saxony",
    to: "saxony",
    mainAttack: [ge1, ge2],
    mainDefense: [fr.id],
    forceOwners: {attacker: ["GE", "GE"], defender: ["FR"]},
    supportAttack: [],
    supportDefense: [],
    stage: "roll",
    supportSide: "attacker",
    attackerDrm: 0,
    defenderDrm: 0,
    attackerLosses: 0,
    defenderLosses: 0,
    decisive: false,
    winner: "defender",
    trench: true,
    notes: [],
  };
  return {G, ctx, battleId: fr.id};
};

describe("28.1.1 intra-space trench retreat choice", () => {
  test("several legal spaces open a combatRetreat decision for the losing side", () => {
    const {G, ctx} = losingAttackerBattle();
    finishBattle(G, ctx);
    expect(G.battle).not.toBeNull();
    expect(G.pending?.kind).toBe("combatRetreat");
    expect(G.pending?.power).toBe("GE");
    const ids = G.pending!.options.map((option) => option.id);
    expect(ids).toEqual(expect.arrayContaining(["berlin", "silesia"]));

    // Stale or foreign answers are refused and the decision stays open.
    expect(resolvePending(G, makeCtx([], "1"), "berlin")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx([], "0"), "bavaria")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("combatRetreat");

    expect(resolvePending(G, makeCtx([], "0"), "berlin")).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.pending).toBeNull();
    expect(landUnitsIn(G, "saxony").filter((unit) => unit.owner === "GE")).toHaveLength(0);
    expect(landUnitsIn(G, "berlin").filter((unit) => unit.owner === "GE").length).toBeGreaterThan(0);
    expect(landUnitsIn(G, "silesia")).toHaveLength(0);
    expect(G.spaces.saxony.trench).toBeFalsy();
    expect(G.spaces.saxony.occupiedBy).toBe("FR");
    expect(G.log.some((entry) => entry.key === "combatRetreat" && entry.args?.to === "berlin")).toBe(true);
  });

  test("a single legal retreat space stays deterministic and opens no decision", () => {
    const {G, ctx} = losingAttackerBattle();
    // Only Berlin remains friendly for GE around Saxony.  Berlin must stay
    // GE-controlled: making the capital enemy-held would trigger 30.1's
    // capital-occupation surrender and remove the retreating force entirely.
    for (const space of ["bavaria", "silesia", "bohemia", "westphalia"]) {
      G.spaces[space].control = "FR";
      G.spaces[space].occupiedBy = "FR";
    }
    finishBattle(G, ctx);
    expect(G.pending).toBeNull();
    expect(G.battle).toBeNull();
    expect(landUnitsIn(G, "berlin").filter((unit) => unit.owner === "GE")).toHaveLength(2);
    expect(landUnitsIn(G, "saxony").filter((unit) => unit.owner === "GE")).toHaveLength(0);
  });

  test("declining the retreat choice uses the first legal space (no deadlock)", () => {
    const {G, ctx} = losingAttackerBattle();
    finishBattle(G, ctx);
    expect(G.pending?.kind).toBe("combatRetreat");
    const first = G.pending!.options[0].id;
    expect(declinePending(G, makeCtx([], "1"))).toBe(INVALID_MOVE);
    expect(declinePending(G, makeCtx([], "0"))).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(landUnitsIn(G, first).filter((unit) => unit.owner === "GE").length).toBeGreaterThan(0);
  });
});
