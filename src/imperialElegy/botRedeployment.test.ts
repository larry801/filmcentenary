/**
 * 34.4.5 Free Bot Redeployment (March 2026 errata):
 *
 *   "At the beginning of the maneuver step of a war, or the GW, bots receive a
 *   free redeployment action based on their difficulty:
 *     Easy: redeploy 1 army
 *     Normal: redeploy 1/2 of all their armies
 *     Hard: redeploy all armies
 *   Treat this action as if it were taken during peacetime, in other words the
 *   bot's units can only move through spaces they control."
 *
 * The engine's destination rule is deterministic (34.2 leaves it open): an army
 * moves to a strictly closer controlled land space on the way to the nearest
 * enemy.  These tests pin the per-difficulty counts, the controlled-only path
 * rule, the bot-seat filter, and the per-step stamp.
 */

import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {
  botFreeRedeployment,
  botRedeployCount,
  gwBotPowers,
  warBotPowers,
} from "./engine/botRedeployment";

const makeCtx = (): Ctx =>
  ({
    playerID: "0",
    random: {Die: () => 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const war = (): WarState => ({
  attacker: "GE",
  defender: "RU",
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: [],
  status: "alliance",
  budgets: {},
  initiative: [],
  treaties: [],
  victor: null,
  truceTurns: 0,
  passed: [],
  startedTurn: 1,
});

/**
 * A bare board: no units, RU at war with GE, one GE army standing in Poland.
 * From Poland the land distances are Poland 0, Belorussia/Riga/West Ukraine 1,
 * Smolensk/Novgorod/Kiev 2, Moscow/Orel 3.
 */
const base = (difficulty: "easy" | "normal" | "hard" = "normal"): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  for (const id of Object.keys(G.units)) removeUnit(G, id);
  G.bots = ["RU"];
  G.botDifficulty = difficulty;
  G.war = war();
  placeUnit(G, "GE", "army", "poland", 1);
  return G;
};

const army = (G: ImperialElegyState, space: string): string =>
  placeUnit(G, "RU", "army", space as never, 1).id;

describe("34.1/34.4.5 bot redeployment count", () => {
  it("Easy redeploys 1 army", () => {
    expect(botRedeployCount("easy", 5)).toBe(1);
    expect(botRedeployCount("easy", 1)).toBe(1);
  });

  it("Normal redeploys half, rounded up", () => {
    expect(botRedeployCount("normal", 5)).toBe(3);
    expect(botRedeployCount("normal", 4)).toBe(2);
    expect(botRedeployCount("normal", 1)).toBe(1);
  });

  it("Hard redeploys every army", () => {
    expect(botRedeployCount("hard", 5)).toBe(5);
    expect(botRedeployCount("hard", 2)).toBe(2);
  });

  it("no armies means no redeployment", () => {
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      expect(botRedeployCount(difficulty, 0)).toBe(0);
    }
  });
});

describe("34.4.5 bot free redeployment", () => {
  it("moves an army toward the nearest enemy along controlled land", () => {
    const G = base();
    const unit = army(G, "moscow");
    const moved = botFreeRedeployment(G, makeCtx(), ["RU"], "war:1:GE:RU");
    expect(moved).toBe(1);
    // A redeployment has unlimited land range (12.15), so the army may go as far
    // as the closest controlled space: Belorussia, next to Poland.
    expect(G.units[unit].space).toBe("belorussia");
    expect(G.spaces.moscow.units).not.toContain(unit);
    expect(G.spaces.belorussia.units).toContain(unit);
  });

  it("Easy moves exactly one of the bot's armies", () => {
    const G = base("easy");
    army(G, "novgorod");
    army(G, "moscow");
    army(G, "orel");
    expect(botFreeRedeployment(G, makeCtx(), ["RU"], "war:1:GE:RU")).toBe(1);
  });

  it("Normal moves half the bot's armies, rounded up", () => {
    const G = base("normal");
    army(G, "novgorod");
    army(G, "moscow");
    army(G, "orel");
    expect(botFreeRedeployment(G, makeCtx(), ["RU"], "war:1:GE:RU")).toBe(2);
  });

  it("Hard moves every army", () => {
    const G = base("hard");
    army(G, "novgorod");
    army(G, "moscow");
    army(G, "orel");
    expect(botFreeRedeployment(G, makeCtx(), ["RU"], "war:1:GE:RU")).toBe(3);
  });

  it("moves through controlled spaces on the way", () => {
    const G = base("hard");
    const unit = army(G, "moscow");
    for (const space of Object.keys(G.spaces)) G.spaces[space].control = null;
    G.spaces.moscow.control = "RU";
    G.spaces.smolensk.control = "RU";
    G.spaces.belorussia.control = "RU";
    expect(botFreeRedeployment(G, makeCtx(), ["RU"], "war:1:GE:RU")).toBe(1);
    expect(G.units[unit].space).toBe("belorussia");
  });

  it("cannot move through a space the bot does not control", () => {
    const G = base("hard");
    const unit = army(G, "moscow");
    for (const space of Object.keys(G.spaces)) G.spaces[space].control = null;
    G.spaces.moscow.control = "RU";
    // Belorussia is the closest space, but Smolensk — the only route there — is
    // not controlled, so the peacetime redeployment may not pass.
    G.spaces.belorussia.control = "RU";
    expect(botFreeRedeployment(G, makeCtx(), ["RU"], "war:1:GE:RU")).toBe(0);
    expect(G.units[unit].space).toBe("moscow");
  });

  it("leaves non-bot seats alone", () => {
    const G = base("hard");
    G.bots = [];
    const unit = army(G, "moscow");
    expect(botFreeRedeployment(G, makeCtx(), ["RU"], "war:1:GE:RU")).toBe(0);
    expect(G.units[unit].space).toBe("moscow");
  });

  it("only runs once per maneuver step", () => {
    const G = base("hard");
    army(G, "moscow");
    expect(botFreeRedeployment(G, makeCtx(), ["RU"], "war:1:GE:RU")).toBe(1);
    expect(botFreeRedeployment(G, makeCtx(), ["RU"], "war:1:GE:RU")).toBe(0);
  });

  it("skips powers that are not belligerents", () => {
    const G = base("hard");
    const unit = army(G, "moscow");
    // RU is a bot but not in the passed belligerent list.
    expect(botFreeRedeployment(G, makeCtx(), ["GE"], "war:1:GE:RU")).toBe(0);
    expect(G.units[unit].space).toBe("moscow");
  });
});

describe("34.4.5 belligerent lists", () => {
  it("warBotPowers lists both sides without duplicates", () => {
    const G = base();
    G.war = {...war(), attackerAllies: ["AU"], defenderAllies: ["UK", "AU"]};
    expect(warBotPowers(G)).toEqual(["GE", "AU", "RU", "UK"]);
  });

  it("gwBotPowers lists the GW sides", () => {
    const G = base();
    G.gw = {
      active: true,
      te: ["FR", "RU"],
      ta: ["GE"],
    } as ImperialElegyState["gw"];
    expect(gwBotPowers(G)).toEqual(["FR", "RU", "GE"]);
  });
});
