/**
 * Rule 15.0: "Players can only pass if their war budget is ≤ 2."  A bot with
 * more budget must spend it on a deploy or a march/rail.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {createWarState} from "./engine/limitedWar";
import {passWarMove} from "./moves";
import {botDecision} from "./engine/bot";

const makeCtx = (playerID: string | null = "0"): Ctx => ({
  playerID,
  random: {Die: () => 2, Shuffle: (items: unknown[]) => items},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "wartime",
}) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));

const warAt = (budget: number): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "wartime";
  G.pending = null;
  G.battle = null;
  G.spaces["alsace-lorraine"].control = "FR";
  G.spaces["alsace-lorraine"].occupiedBy = null;
  const war = createWarState(G, "GE", "FR", "conquest", ["alsace-lorraine"], 2);
  war.status = "maneuver";
  war.initiative = ["GE", "FR"];
  war.budgets.GE = budget;
  war.budgets.FR = 3;
  G.war = war;
  G.activePower = "GE";
  placeUnit(G, "GE", "army", "berlin", 2);
  return G;
};

describe("15.0 passing only at war budget ≤ 2", () => {
  test("a power with more than 2 CP cannot pass", () => {
    const G = warAt(3);
    expect(passWarMove(G, makeCtx(seat("GE")))).toBe(INVALID_MOVE);
    expect(G.war!.passed).not.toContain("GE");
    expect(G.log.some((entry) => entry.key === "warPassRefused" && entry.args?.reason === "budget")).toBe(true);
  });

  test("a power at 2 CP may pass", () => {
    const G = warAt(2);
    expect(passWarMove(G, makeCtx(seat("GE")))).toBeUndefined();
    expect(G.war!.passed).toContain("GE");
  });

  test("the bot spends the budget instead of passing", () => {
    const G = warAt(3);
    const move = botDecision(G, makeCtx(seat("GE")), "GE");
    expect(move.move).not.toBe("passWarMove");
    expect(["redeploy", "deployReserves"]).toContain(move.move);
  });
});
