/**
 * Rule 25.7 — the alliance-set Great War turn order.
 *
 * "Each alliance sets their turn order secretly ... The alliance with the GE
 * player always goes first (although GE does not have to get the first
 * impulse)."  `chooseGwOrder` lets one member of each alliance submit its
 * permutation during GW turn 0 planning; `rebuildGwOrder` folds the chosen
 * orders into the printed alternating track (25.7.1 bonus slots kept), and an
 * alliance that never submits one keeps its 4.3 seat order.
 */
import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {outbreakGreatWar} from "./engine/greatWar";
import {startGwManeuver} from "./engine/greatWarFlow";
import {chooseGwOrder} from "./moves";

const ctxFor = (power: Power): Ctx => ({
  playerID: String(POWERS.indexOf(power)),
  random: {Die: () => 3, Shuffle: (items: unknown[]) => items},
  events: {setActivePlayers: jest.fn(), setPhase: jest.fn(), endGame: jest.fn()},
  turn: 1,
}) as unknown as Ctx;

const outbreak = (
  ta: Power[] = ["GE", "AU", "RU"],
  te: Power[] = ["FR", "UK"],
): ImperialElegyState => {
  const G = setupImperialElegy(ctxFor("GE"));
  for (const power of POWERS) {
    G.powers[power].alliance = ta.includes(power) ? "taCommitted" : te.includes(power) ? "teCommitted" : "neutral";
  }
  outbreakGreatWar(G, ctxFor("GE"), "GE", "25.7 regression");
  return G;
};

const quietManeuverStart = (G: ImperialElegyState): void => {
  // Remove map upkeep decisions so the maneuver-step assertions are isolated.
  G.units = {};
  for (const space of Object.values(G.spaces)) space.units = [];
  for (const power of POWERS) {
    G.powers[power].gwBudget = 5;
    G.powers[power].gwCard = null;
    G.powers[power].flags.passedGw = false;
  }
};

describe("25.7 the alliance sets its Great War impulse order", () => {
  test("the default is GE's alliance first in seat order with the 25.7.1 bonus fill", () => {
    const G = outbreak();
    expect(G.phase).toBe("gwPlanning");
    expect(G.gw!.order).toEqual(["GE", "UK", "AU", "FR", "RU", "bonus"]);
    expect(G.gw!.bonusImpulseSide).toBe("te");
    // GE's alliance leads, but nothing has forced GE to take the first impulse
    // once an order is chosen.
    expect(G.gw!.orderChoice).toEqual({te: null, ta: null});
  });

  test("one alliance may choose any member first while the other keeps seat order", () => {
    const G = outbreak();
    expect(chooseGwOrder(G, ctxFor("AU"), "ta", ["AU", "GE", "RU"])).toBeUndefined();
    expect(G.gw!.order).toEqual(["AU", "UK", "GE", "FR", "RU", "bonus"]);

    quietManeuverStart(G);
    expect(startGwManeuver(G, ctxFor("AU")).ok).toBe(true);
    expect(G.phase).toBe("gwManeuver");
    // The first impulse of GE's alliance is now AU, not GE.
    expect(G.activePower).toBe("AU");
  });

  test("both alliances choose; GE's alliance still goes first and GE need not be first", () => {
    const G = outbreak();
    expect(chooseGwOrder(G, ctxFor("AU"), "ta", ["RU", "AU", "GE"])).toBeUndefined();
    expect(chooseGwOrder(G, ctxFor("UK"), "te", ["UK", "FR"])).toBeUndefined();
    expect(G.gw!.order).toEqual(["RU", "UK", "AU", "FR", "GE", "bonus"]);
    expect(G.gw!.order[0]).toBe("RU");
    expect(G.gw!.order.indexOf("GE")).toBeGreaterThan(0);
  });

  test("only a member of the alliance may submit, only once, and only a permutation", () => {
    const G = outbreak();
    // OT is neutral: not a member of either alliance.
    expect(chooseGwOrder(G, ctxFor("OT"), "ta", ["GE", "AU", "RU"])).toBe(INVALID_MOVE);
    // Not a permutation of the alliance's members.
    expect(chooseGwOrder(G, ctxFor("GE"), "ta", ["GE", "AU"])).toBe(INVALID_MOVE);
    expect(chooseGwOrder(G, ctxFor("GE"), "ta", ["GE", "AU", "FR"])).toBe(INVALID_MOVE);
    expect(chooseGwOrder(G, ctxFor("GE"), "ta", ["AU", "AU", "RU"])).toBe(INVALID_MOVE);
    // A valid submission lands once.
    expect(chooseGwOrder(G, ctxFor("GE"), "ta", ["AU", "GE", "RU"])).toBeUndefined();
    expect(chooseGwOrder(G, ctxFor("RU"), "ta", ["GE", "RU", "AU"])).toBe(INVALID_MOVE);
    // The other alliance may also submit its first choice.
    expect(chooseGwOrder(G, ctxFor("FR"), "te", ["FR", "UK"])).toBeUndefined();
    expect(chooseGwOrder(G, ctxFor("UK"), "te", ["FR", "UK"])).toBe(INVALID_MOVE);
    // Outside planning the choice is closed.
    G.phase = "gwManeuver";
    expect(chooseGwOrder(G, ctxFor("FR"), "te", ["UK", "FR"])).toBe(INVALID_MOVE);
  });
});
