/**
 * Rule 19.4 — "All keys that are ports inherently have mines.  During naval
 * battles in keys that are ports, the defending player will roll for mines.
 * When rolling for mines players roll dice equal to the current turn (the
 * current game turn, not the current GW turn).  All rolls of 4+ inflict one hit
 * on the attacker."
 *
 * Before this suite the engine only rolled mines in a port that also had a
 * fort.  Mines are now a property of every port key; the fort is only the 19.9
 * elimination clause.  IE-A061/IE-A066's printed "no mines" clause still
 * cancels the roll.
 */

import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {navalUnitsIn} from "./engine/rules";
import {beginNavalBattle, resolveBattleRoll} from "./engine/combat";
import {navalMove, resolvePending} from "./moves";

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

/**
 * UK (seat 1) at war with FR.  North Atlantic holds the UK fleet, Brittany (a
 * port key with no fort) holds the FR squadron.  `turn` drives the mine dice.
 */
const portBattleFixture = (dice: number[] = []): {G: ImperialElegyState; ctx: Ctx; uk: string} => {
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
  G.turn = 3; // three mine dice in the port battle
  for (const power of POWERS) {
    G.powers[power].hand = [];
    G.powers[power].gwCard = null;
  }
  clearNaval(G);
  G.spaces.brittany.control = "FR";
  G.spaces.brittany.fort = null;
  placeUnit(G, "FR", "squadron", "brittany", 2);
  const uk = placeUnit(G, "UK", "squadron", "north-atlantic", 2).id;
  return {G, ctx: makeCtx(dice, seat("UK")), uk};
};

/** Hold the battle at the pre-dice card window so the test supplies the dice. */
const holdCardWindow = (G: ImperialElegyState): void => {
  G.powers.UK.hand = ["IE-A061"];
};

describe("19.4 every port key has mines", () => {
  test("a port battle rolls mines even without a fort", () => {
    const G = setupImperialElegy(makeCtx());
    G.war = warState("UK", "FR");
    placeUnit(G, "FR", "squadron", "brittany", 2);
    placeUnit(G, "UK", "squadron", "north-atlantic", 2);
    const battle = beginNavalBattle(G, makeCtx(), "UK", "north-atlantic", "brittany");
    if (!battle) throw new Error("naval battle did not start");
    expect(G.spaces.brittany.fort).toBeNull();
    expect(battle.notes).toContain("minefield");
    expect(battle.mines).toBe(0);
  });

  test("a naval-box battle has no mines", () => {
    const G = setupImperialElegy(makeCtx());
    G.war = warState("UK", "FR");
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    placeUnit(G, "UK", "squadron", "london", 2);
    const battle = beginNavalBattle(G, makeCtx(), "UK", "london", "north-atlantic");
    if (!battle) throw new Error("naval battle did not start");
    expect(battle.notes).not.toContain("minefield");
    expect(battle.mines).toBeUndefined();
  });

  test("the defender rolls one die per current game turn and 4+ is a hit", () => {
    const {G, ctx} = portBattleFixture([4, 4, 1, 1, 1]);
    holdCardWindow(G);
    const battle = beginNavalBattle(G, ctx, "UK", "north-atlantic", "brittany");
    if (!battle) throw new Error("naval battle did not start");
    G.pending = null;
    resolveBattleRoll(G, ctx);
    // 19.3 step 1: G.turn = 3, so the first three dice (4, 4, 1) are the mine
    // roll and two of them hit.
    expect(battle.mines).toBe(2);
    expect(G.log.filter((entry) => entry.key === "battleRoll").pop()?.args?.mines).toBe(2);
  });

  test("IE-A061's no-mines mode still cancels an unfortified port's minefield", () => {
    const {G, ctx} = portBattleFixture([1, 1, 4, 4, 4]);
    holdCardWindow(G);
    const battle = beginNavalBattle(G, ctx, "UK", "north-atlantic", "brittany");
    if (!battle) throw new Error("naval battle did not start");
    expect(battle.notes).toContain("minefield");
    expect(resolvePending(G, makeCtx([], seat("UK")), "card:IE-A061:noMines")).toBeUndefined();
    // The mode is applied and the battle then resolves without any mine dice.
    expect(G.log.filter((entry) => entry.key === "battleRoll").pop()?.args?.mines).toBe(0);
  });

  test("the live naval move into an unfortified port opens a minefield battle", () => {
    const {G, ctx, uk} = portBattleFixture();
    holdCardWindow(G);
    expect(navalMove(G, ctx, [uk], "brittany")).toBeUndefined();
    // The FR defender chooses to fight; the port is adjacent to one box.
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(resolvePending(G, makeCtx([], seat("FR")), "fight")).toBeUndefined();
    expect(G.battle?.kind).toBe("naval");
    expect(G.battle?.notes).toContain("minefield");
    expect(G.units[uk].space).toBe("brittany");
    expect(navalUnitsIn(G, "brittany").some((unit) => unit.owner === "FR")).toBe(true);
  });
});
