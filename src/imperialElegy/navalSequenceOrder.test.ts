/**
 * Rule 19.3 — "Follow these steps to resolve a naval battle
 *   1. Check for Mines! ... 2. Calculate the BDRM ... 3. Each side rolls a die".
 *
 * The 19.4 mine dice are therefore rolled *before* the battle dice.  The
 * engine used to roll them after the CRT, which changed which random values the
 * two steps consumed (and rolled battle dice even for an attacker who then
 * retreated after two mine hits).  These tests pin the printed order, the
 * pre-dice retreat choice, and IE-A061's "no mines" cancellation.
 */

import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {beginNavalBattle, MINE_RETREAT_HITS, resolveBattleRoll} from "./engine/combat";
import {navalUnitsIn} from "./engine/rules";
import {resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "1"): Ctx => {
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
 * UK attacks FR-held Brittany (an unfortified port) from the North Atlantic.
 * `turn` sets the number of 19.4 mine dice.
 */
const fixture = (turn: number): {G: ImperialElegyState; ctx: Ctx} => {
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
  G.turn = turn;
  for (const power of POWERS) {
    G.powers[power].hand = [];
    G.powers[power].gwCard = null;
  }
  clearNaval(G);
  G.spaces.brittany.control = "FR";
  G.spaces.brittany.fort = null;
  placeUnit(G, "FR", "squadron", "brittany", 2);
  placeUnit(G, "UK", "squadron", "north-atlantic", 2);
  G.powers.UK.hand = ["IE-A061"];
  return {G, ctx: makeCtx([], seat("UK"))};
};

/** Start the battle and release the pre-dice card window. */
const beginAndHold = (G: ImperialElegyState, ctx: Ctx) => {
  const battle = beginNavalBattle(G, ctx, "UK", "north-atlantic", "brittany");
  if (!battle) throw new Error("naval battle did not start");
  G.pending = null;
  return battle;
};

const battleRollLog = (G: ImperialElegyState) =>
  G.log.filter((entry) => entry.key === "battleRoll").pop();

describe("19.3 naval battle sequence", () => {
  test("mine dice are consumed before the battle dice", () => {
    const {G, ctx} = fixture(3);
    const battle = beginAndHold(G, ctx);
    // Three mine dice (4, 6, 1 -> two hits), then the battle dice (5 and 2).
    resolveBattleRoll(G, makeCtx([4, 6, 1, 5, 2], seat("UK")));
    expect(battle.mines).toBe(2);
    expect(battle.attackerRoll).toBe(5);
    expect(battle.defenderRoll).toBe(2);
    const roll = battleRollLog(G);
    expect(roll?.args?.mines).toBe(2);
    expect(roll?.args?.attackerRoll).toBe(5);
    expect(roll?.args?.defenderRoll).toBe(2);
  });

  test("a three-hit mine roll offers the 19.4 retreat before any battle die", () => {
    const {G, ctx} = fixture(4);
    const battle = beginAndHold(G, ctx);
    // Four mine dice, all hits; the battle dice (6 and 1) must stay unrolled.
    resolveBattleRoll(G, makeCtx([4, 4, 4, 4, 6, 1], seat("UK")));
    expect(G.pending?.kind).toBe("mineRetreat");
    expect(G.pending?.options.map((entry) => entry.id)).toEqual(["continue", "retreat"]);
    expect(battle.mines).toBe(4);
    expect(battle.attackerRoll).toBeUndefined();
    expect(battle.defenderRoll).toBeUndefined();
    expect(battleRollLog(G)).toBeUndefined();

    // Continuing rolls the battle dice now and keeps every mine hit.
    expect(resolvePending(G, makeCtx([6, 1], seat("UK")), "continue")).toBeUndefined();
    expect(battle.attackerRoll).toBe(6);
    expect(battle.defenderRoll).toBe(1);
    const roll = battleRollLog(G);
    expect(roll?.args?.mines).toBe(4);
    expect(roll?.args?.attackerRoll).toBe(6);
  });

  test("retreating after two mine hits rolls no battle dice at all", () => {
    const {G, ctx} = fixture(4);
    const battle = beginAndHold(G, ctx);
    resolveBattleRoll(G, makeCtx([4, 4, 4, 4, 6, 1], seat("UK")));
    expect(G.pending?.kind).toBe("mineRetreat");
    expect(resolvePending(G, makeCtx([], seat("UK")), "retreat")).toBeUndefined();
    expect(G.battle).toBeNull();
    // The defender never rolled: no CRT result was produced.
    expect(battleRollLog(G)).toBeUndefined();
    const mine = G.log.filter((entry) => entry.key === "mineRetreat").pop();
    expect(mine?.args?.hits).toBe(MINE_RETREAT_HITS);
    expect(mine?.args?.ignored).toBe(2);
    expect(navalUnitsIn(G, "brittany").some((unit) => unit.owner === "UK")).toBe(false);
  });

  test("IE-A061's no-mines mode cancels the mine dice before either side rolls", () => {
    const {G, ctx} = fixture(4);
    // Keep the pre-dice card window open so A061 can be played.
    expect(beginNavalBattle(G, ctx, "UK", "north-atlantic", "brittany")).not.toBeNull();
    expect(G.pending?.kind).toBe("combatCard");
    // A061: the card window resolves straight into the roll with no mine dice,
    // so the two dice supplied are the battle dice.
    expect(resolvePending(G, makeCtx([5, 2], seat("UK")), "card:IE-A061:noMines")).toBeUndefined();
    const roll = battleRollLog(G);
    expect(roll?.args?.mines).toBe(0);
    expect(roll?.args?.attackerRoll).toBe(5);
    expect(roll?.args?.defenderRoll).toBe(2);
  });
});
