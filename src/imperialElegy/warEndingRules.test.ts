/** 15.5's capital-capture end and 16.1.3(2)'s blockading defensive victory. */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {createWarState, warCapitalFallen} from "./engine/limitedWar";
import {blockadeTrace, blockadedAt} from "./engine/blockade";
import {resolveWar} from "./moves";
import {botDecision} from "./engine/bot";

const makeCtx = (playerID: string | null = "0"): Ctx => ({
  playerID,
  random: {Die: () => 2, Shuffle: (items: unknown[]) => items},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "wartime",
}) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const war = (G: ImperialElegyState): ReturnType<typeof createWarState> => {
  G.phase = "wartime";
  G.pending = null;
  const state = createWarState(G, "GE", "FR", "conquest", ["alsace-lorraine"], 2);
  state.status = "maneuver";
  state.passed = ["GE", "FR"];
  G.war = state;
  return state;
};

describe("15.5 capital capture ends the maneuver step", () => {
  test("the defender's occupied capital lets the attacker settle immediately", () => {
    const G = fresh();
    const state = war(G);
    placeUnit(G, "GE", "army", "paris", 2);
    // Occupation is the engine's wartime marker (15.3), set by a capture hook
    // in a real battle; the test sets it beside the occupying unit.
    G.spaces.paris.occupiedBy = "GE";
    expect(warCapitalFallen(G, state)).toBe(true);
    expect(resolveWar(G, makeCtx(seat("GE")), [])).toBeUndefined();
    expect(G.war).toBeNull();
    expect(G.log.some((entry) => entry.key === "warEnded")).toBe(true);
  });

  test("the bot settles at once when a primary capital has fallen", () => {
    const G = fresh();
    war(G);
    placeUnit(G, "GE", "army", "paris", 2);
    G.spaces.paris.occupiedBy = "GE";
    expect(botDecision(G, makeCtx(seat("GE")), "GE")).toEqual({move: "resolveWar"});
  });
});

describe("16.1.3(2) blockading defensive victory", () => {
  test("a blockaded attacker that failed its aims gives the defender a defensive victory", () => {
    const G = fresh();
    war(G);
    // Close every non-exempt box GE can reach with the defender's fleet; the
    // attacker is then blockaded per 17.1.
    for (const box of blockadeTrace(G, "GE")) {
      if (box === "baltic-sea" || box === "black-sea") continue;
      placeUnit(G, "FR", "squadron", box, 1);
    }
    expect(blockadedAt(G, "GE")).toBe(true);
    expect(resolveWar(G, makeCtx(seat("GE")), [])).toBeUndefined();
    const ended = G.log.find((entry) => entry.key === "warEnded");
    expect(ended?.args?.victor).toBe("defender");
  });
});
