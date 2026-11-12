/**
 * Rule 19.4 — "However, after suffering the first two hits the attacker may
 * ignore any remaining hits if they choose to immediately retreat."
 *
 * The choice is offered after a mine roll of three or more hits, before the
 * battle dice and before any loss is applied (19.3 step 1): retreating caps the
 * mines at two and cancels the battle result, while continuing keeps every hit
 * and then rolls the battle dice.  An attacker with no retreat route
 * (the attacked-from box holds a hostile fleet) keeps the deterministic full
 * hit total, and `declinePending` takes the same "continue" default so
 * unattended play never stalls.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {navalUnitsIn} from "./engine/rules";
import {beginNavalBattle, MINE_RETREAT_HITS, resolveBattleRoll} from "./engine/combat";
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
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const warState = (attacker: Power, defender: Power): WarState => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
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

const clearNaval = (G: ImperialElegyState): void => {
  for (const unit of Object.values(G.units)) if (unit.naval) removeUnit(G, unit.id);
};

/** UK attacks FR-held Brittany (no fort) from the North Atlantic, turn 4. */
const fixture = (): {G: ImperialElegyState; ctx: Ctx; uk: string[]} => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = "UK";
  G.turnIndex = 0;
  G.passed = [];
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.cpRemaining = 6;
  G.war = warState("UK", "FR");
  G.turn = 4; // four mine dice
  for (const power of POWERS) {
    G.powers[power].hand = [];
    G.powers[power].gwCard = null;
  }
  clearNaval(G);
  G.spaces.brittany.control = "FR";
  G.spaces.brittany.fort = null;
  placeUnit(G, "FR", "squadron", "brittany", 2);
  // Hold the battle at the pre-dice card window so the test supplies the dice.
  G.powers.UK.hand = ["IE-A061"];
  const uk = [
    placeUnit(G, "UK", "squadron", "north-atlantic", 2).id,
    placeUnit(G, "UK", "squadron", "north-atlantic", 2).id,
  ];
  return {G, ctx: makeCtx([], seat("UK")), uk};
};

/** Start the battle and stop before the roll (the card window is discarded). */
const beginAndHold = (G: ImperialElegyState, ctx: Ctx) => {
  const battle = beginNavalBattle(G, ctx, "UK", "north-atlantic", "brittany");
  if (!battle) throw new Error("naval battle did not start");
  G.pending = null;
  return battle;
};

const mineLog = (G: ImperialElegyState) =>
  G.log.filter((entry) => entry.key === "mineRetreat").pop();

describe("19.4 mine retreat option", () => {
  test("three or more mine hits offer the attacker the two-hit retreat", () => {
    const {G, ctx} = fixture();
    beginAndHold(G, ctx);
    // 19.3 step 1: the four mine dice come first and all hit, so the battle
    // dice are still unrolled while the choice is open.
    resolveBattleRoll(G, makeCtx([4, 4, 4, 4, 1, 1], seat("UK")));
    expect(G.battle?.mines).toBe(4);
    expect(G.pending?.kind).toBe("mineRetreat");
    expect(G.pending?.power).toBe("UK");
    expect(G.pending?.options.map((option) => option.id)).toEqual(["continue", "retreat"]);
    // The losses are not fixed while the choice is open.
    expect(G.pending?.context?.mines).toBe(4);
  });

  test("retreating keeps only the first two hits and ends the attack", () => {
    const {G, ctx, uk} = fixture();
    beginAndHold(G, ctx);
    resolveBattleRoll(G, makeCtx([4, 4, 4, 4, 1, 1], seat("UK")));
    expect(resolvePending(G, makeCtx([], seat("UK")), "retreat")).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.pending).toBeNull();
    const entry = mineLog(G);
    expect(entry?.args?.hits).toBe(MINE_RETREAT_HITS);
    expect(entry?.args?.ignored).toBe(2);
    // The two hits are taken, then the surviving ships fall back to the box
    // they attacked from (the battle was in a port).
    expect(navalUnitsIn(G, "brittany").some((unit) => unit.owner === "UK")).toBe(false);
    const survivors = navalUnitsIn(G, "north-atlantic").filter((unit) => unit.owner === "UK");
    expect(survivors.length).toBe(1);
    expect(G.units[uk[0]] ?? G.units[uk[1]]).toBeDefined();
    // No CRT battle followed: the defender never fought.
    expect(G.log.filter((entry2) => entry2.key === "battleRoll").pop()?.args?.mines).toBeUndefined();
    expect(G.units[navalUnitsIn(G, "brittany")[0].id]?.steps).toBe(2);
  });

  test("continuing keeps every mine hit and the dice result", () => {
    const {G, ctx} = fixture();
    beginAndHold(G, ctx);
    resolveBattleRoll(G, makeCtx([4, 4, 4, 4, 1, 1], seat("UK")));
    expect(resolvePending(G, makeCtx([], seat("UK")), "continue")).toBeUndefined();
    expect(mineLog(G)).toBeUndefined();
    expect(G.log.filter((entry) => entry.key === "battleRoll").pop()?.args?.mines).toBe(4);
    // Four mine hits plus the CRT loss eliminate both UK squadrons.
    expect(navalUnitsIn(G, "north-atlantic").some((unit) => unit.owner === "UK")).toBe(false);
  });

  test("exactly two hits leave no retreat choice (nothing to ignore)", () => {
    const {G, ctx} = fixture();
    beginAndHold(G, ctx);
    // Two mine dice hit, then the battle dice (1/1).
    resolveBattleRoll(G, makeCtx([4, 4, 1, 1, 1, 1], seat("UK")));
    expect(G.log.filter((entry) => entry.key === "battleRoll").pop()?.args?.mines).toBe(2);
    expect(mineLog(G)).toBeUndefined();
    expect(G.pending?.kind).not.toBe("mineRetreat");
  });

  test("an attacker with no retreat route must take every hit", () => {
    const {G, ctx} = fixture();
    G.spaces.brittany.control = "FR";
    // A hostile fleet holds the attacked-from box, so "retreat" is impossible.
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    beginAndHold(G, ctx);
    resolveBattleRoll(G, makeCtx([4, 4, 4, 4, 1, 1], seat("UK")));
    expect(mineLog(G)).toBeUndefined();
    expect(G.pending?.kind).not.toBe("mineRetreat");
    expect(G.log.filter((entry) => entry.key === "battleRoll").pop()?.args?.mines).toBe(4);
  });

  test("only the attacking seat may answer", () => {
    const {G, ctx} = fixture();
    beginAndHold(G, ctx);
    resolveBattleRoll(G, makeCtx([4, 4, 4, 4, 1, 1], seat("UK")));
    expect(G.pending?.kind).toBe("mineRetreat");
    expect(resolvePending(G, makeCtx([], seat("FR")), "retreat")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx([], seat("FR")), "continue")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("mineRetreat");
    expect(resolvePending(G, ctx, "bogus")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("mineRetreat");
  });

  test("declining is the deterministic full-hit resolution", () => {
    const {G, ctx} = fixture();
    beginAndHold(G, ctx);
    resolveBattleRoll(G, makeCtx([4, 4, 4, 4, 1, 1], seat("UK")));
    expect(declinePending(G, makeCtx([], seat("UK")))).toBeUndefined();
    expect(mineLog(G)).toBeUndefined();
    expect(G.log.filter((entry) => entry.key === "battleRoll").pop()?.args?.mines).toBe(4);
  });

  test("the dreadnought quota applies to the two kept mine hits", () => {
    const G = setupImperialElegy(makeCtx());
    G.phase = "action";
    G.activePower = "UK";
    G.pending = null;
    G.pendingStack = [];
    G.battle = null;
    G.cpRemaining = 6;
    G.war = warState("UK", "FR");
    G.turn = 4;
    for (const power of POWERS) {
      G.powers[power].hand = [];
      G.powers[power].gwCard = null;
    }
    clearNaval(G);
    G.spaces.brittany.control = "FR";
    G.spaces.brittany.fort = null;
    placeUnit(G, "FR", "squadron", "brittany", 2);
    G.powers.UK.hand = ["IE-A061"];
    const dread = placeUnit(G, "UK", "dreadnought", "north-atlantic", 2).id;
    const squadron = placeUnit(G, "UK", "squadron", "north-atlantic", 2).id;
    const ctx = makeCtx([], seat("UK"));
    beginAndHold(G, ctx);
    resolveBattleRoll(G, makeCtx([4, 4, 4, 4, 1, 1], seat("UK")));
    expect(resolvePending(G, makeCtx([], seat("UK")), "retreat")).toBeUndefined();
    // More than half of two mine hits is two: both dreadnought steps.
    expect(G.units[dread]).toBeUndefined();
    expect(G.units[squadron]?.steps).toBe(2);
  });
});
