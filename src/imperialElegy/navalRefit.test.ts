/**
 * 12.4 Construct Fleets: "Refit Naval Unit - 1 CP".
 *
 * "Refitting a naval unit refers to flipping it from its reduced side to its
 * full strength side. Naval units cannot refit if they are in a naval box; they
 * may only refit if they are in a friendly port."
 *
 * 15.2 prints that no refit action is available during a limited war, and the
 * Great War has its own 27.5.4 action (`gwRefitFleet`), so this path is the
 * action phase only.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {refitNavalUnit} from "./moves";

const makeCtx = (power: Power, cp = 20): Ctx => ({
  playerID: String(POWERS.indexOf(power)),
  random: {Die: () => 3, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
} as unknown as Ctx);

const game = (power: Power = "FR", cp = 20): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx(power));
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  G.pending = null;
  G.battle = null;
  G.war = null;
  return G;
};

const reducedFleet = (G: ImperialElegyState, power: Power, space: string): string => {
  const unit = placeUnit(G, power, "squadron", space as never, 1);
  return unit.id;
};

describe("12.4 refit a naval unit in a friendly port", () => {
  test("flips a reduced squadron to full strength for 1 CP", () => {
    const G = game("FR");
    const id = reducedFleet(G, "FR", "provence");
    expect(refitNavalUnit(G, makeCtx("FR"), id)).toBeUndefined();
    expect(G.units[id].steps).toBe(2);
    expect(G.cpRemaining).toBe(19);
  });

  test("a dreadnought refits the same way", () => {
    const G = game("UK");
    const id = placeUnit(G, "UK", "dreadnought", "london", 1).id;
    expect(refitNavalUnit(G, makeCtx("UK"), id)).toBeUndefined();
    expect(G.units[id].steps).toBe(2);
  });

  test("a full-strength unit is refused and no CP is spent", () => {
    const G = game("FR");
    const id = placeUnit(G, "FR", "squadron", "provence", 2).id;
    expect(refitNavalUnit(G, makeCtx("FR"), id)).toBe(INVALID_MOVE);
    expect(G.units[id].steps).toBe(2);
    expect(G.cpRemaining).toBe(20);
  });

  test("a fleet in a naval box cannot refit", () => {
    const G = game("FR");
    const id = reducedFleet(G, "FR", "north-atlantic");
    expect(refitNavalUnit(G, makeCtx("FR"), id)).toBe(INVALID_MOVE);
    expect(G.units[id].steps).toBe(1);
    expect(G.cpRemaining).toBe(20);
  });

  test("an enemy port is not a friendly port", () => {
    const G = game("FR");
    // London is a British port; France is not allied to the UK at setup.
    const id = reducedFleet(G, "FR", "london");
    expect(refitNavalUnit(G, makeCtx("FR"), id)).toBe(INVALID_MOVE);
    expect(G.units[id].steps).toBe(1);
  });

  test("another player's fleet cannot be refitted", () => {
    const G = game("FR");
    const id = reducedFleet(G, "UK", "london");
    expect(refitNavalUnit(G, makeCtx("FR"), id)).toBe(INVALID_MOVE);
  });

  test("a land unit is not a fleet", () => {
    const G = game("FR");
    const id = placeUnit(G, "FR", "army", "paris", 1).id;
    expect(refitNavalUnit(G, makeCtx("FR"), id)).toBe(INVALID_MOVE);
  });

  test("no CP means no refit", () => {
    const G = game("FR", 0);
    const id = reducedFleet(G, "FR", "provence");
    expect(refitNavalUnit(G, makeCtx("FR", 0), id)).toBe(INVALID_MOVE);
    expect(G.units[id].steps).toBe(1);
  });

  test("15.2 refuses a refit during a limited war", () => {
    const G = game("FR");
    G.phase = "wartime";
    const id = reducedFleet(G, "FR", "provence");
    expect(refitNavalUnit(G, makeCtx("FR"), id)).toBe(INVALID_MOVE);
    expect(G.units[id].steps).toBe(1);
  });

  test("the move is registered on the boardgame.io game", () => {
    // A live engine move must be reachable, not just exported.
    const {ImperialElegyGameDef} = require("./game");
    expect(typeof ImperialElegyGameDef.moves.refitNavalUnit).toBe("function");
  });
});
