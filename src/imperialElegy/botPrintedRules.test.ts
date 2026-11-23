/**
 * Rule 34's printed bot decisions that were still deterministic/rolled:
 * 34.3.2 auto-pacification, 34.4.1's declaration-strength guard, 34.4.7's EC
 * differential, 34.4.8's self-only treaty options and 34.5's Impulsive Ruler.
 */
import type {Ctx} from "boardgame.io";
import type {BattleState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {decision, openDecision, option} from "./engine/pending";
import {botDecision, botPendingMove, withinDeclarationStrength} from "./engine/bot";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 2,
      Shuffle: (items: unknown[]) => items,
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

const actionImpulse = (G: ImperialElegyState, power: Power): void => {
  G.phase = "action";
  G.activePower = power;
  G.pending = null;
  G.pendingStack = [];
  G.cpRemaining = 0;
  G.wtt = 1;
  G.powers[power].hand = [];
  G.powers[power].selectedHomeCard = null;
};

describe("34.3.2 automatic bot pacification", () => {
  test("a priority-2 roll of 1–4 spends 1 CP to pacify first", () => {
    const G = fresh();
    actionImpulse(G, "AU");
    G.cpRemaining = 1;
    const space = "bosnia-herzegovina";
    G.units = {};
    for (const state of Object.values(G.spaces)) state.units = [];
    G.spaces[space].control = "AU";
    G.spaces[space].pacificationMarker = true;
    G.spaces[space].pacification = 2;
    placeUnit(G, "AU", "army", space, 2);
    // 2d6 with a constant 2 -> priority-2 row 4 (auto-pacify band).
    const move = botDecision(G, makeCtx([2], seat("AU")), "AU");
    expect(move.move).toBe("pacify");
    expect(move.args?.[0]).toBe(space);
  });
});

describe("34.4.1 declaration-strength guard", () => {
  test("a target with ≥4 more army steps is excluded", () => {
    const G = fresh();
    G.units = {};
    for (const space of Object.values(G.spaces)) space.units = [];
    placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "Bavaria", "minorArmy", "bavaria", 2);
    placeUnit(G, "Bavaria", "minorArmy", "bavaria", 2);
    placeUnit(G, "Bavaria", "minorArmy", "bavaria", 2);
    // GE: 2 steps; Bavaria: 6 steps -> 4 more, refused (6 - 2 = 4).
    expect(withinDeclarationStrength(G, "GE", "Bavaria")).toBe(false);
    // Reduce Bavaria to 5 steps -> 3 more, allowed.
    const bavarian = Object.values(G.units).find((unit) => unit.owner === "Bavaria")!;
    bavarian.steps = 1;
    expect(withinDeclarationStrength(G, "GE", "Bavaria")).toBe(true);
  });
});

describe("34.4.7 EC differential", () => {
  const elitePending = (G: ImperialElegyState, attack: number, defence: number): void => {
    G.battle = {attackDrmTotal: attack, defenceDrmTotal: defence, mainAttack: [], mainDefense: []} as unknown as BattleState;
    openDecision(G, makeCtx(), decision(
      "combatElite",
      "GE",
      "Commit an elite unit?",
      [option("commit", "Commit"), option("decline", "Decline")],
      {eliteSide: "attacker", battle: true},
    ));
  };

  test("commits between −2 and +2, declines outside it", () => {
    const inside = fresh();
    elitePending(inside, 0, -2);
    expect(botPendingMove(inside, "GE", makeCtx([1]))).toEqual({move: "resolvePending", args: ["commit"]});

    const ahead = fresh();
    elitePending(ahead, 3, 0);
    expect(botPendingMove(ahead, "GE", makeCtx([1]))).toEqual({move: "resolvePending", args: ["decline"]});

    const behind = fresh();
    elitePending(behind, 0, 3);
    expect(botPendingMove(behind, "GE", makeCtx([1]))).toEqual({move: "resolvePending", args: ["decline"]});
  });
});

describe("34.4.8 treaty options", () => {
  test("never allocates to another player; always keeps it for itself", () => {
    const G = fresh();
    G.pending = null;
    openDecision(G, makeCtx(), decision(
      "treatyOption",
      "GE",
      "Choose a treaty option",
      [option("territorial@ALLY", "Give France land"), option("done", "Finish")],
      {options: [{id: "territorial@ALLY", beneficiary: "FR"}, {id: "done"}]},
    ));
    expect(botPendingMove(G, "GE", makeCtx([1]))).toEqual({move: "resolvePending", args: ["done"]});
  });
});

describe("34.5 Impulsive Ruler", () => {
  test("a bot plays A105 for CP, never for its event", () => {
    const G = fresh();
    actionImpulse(G, "AU");
    G.powers.AU.hand = ["IE-A105"];
    G.pending = null;
    const move = botDecision(G, makeCtx([1], seat("AU")), "AU");
    expect(move).toEqual({move: "playCard", args: ["IE-A105", "cp"]});
  });
});
