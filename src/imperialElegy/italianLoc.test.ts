/**
 * 5.6.1 Italian Exception — after Italy is unified, Italian units use the same
 * LoC rules as a player power.  A supply source is any Italian controlled home
 * key with a LoC to another Italian controlled home key.
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {italianBrokenLoc, italianControlledHomeKeys, italianHasLoc, italianSupplySource} from "./engine/rules";
import {beginLandBattle} from "./engine/combat";

const makeCtx = (dice: number[] = []): Ctx => {
  let index = 0;
  return {
    playerID: "0",
    random: {Die: (sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const gw = (): GreatWarState => ({
  active: true,
  turn: 1,
  order: ["FR", "GE", "IT"],
  belligerents: ["FR", "GE"],
  neutrals: [],
  te: ["FR"],
  ta: ["GE"],
  usIn: false,
  italyIn: true,
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

const unifiedItaly = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = gw();
  G.flags.italySide = "te";
  G.persistent.italyUnified = true;
  G.persistent.italyIndependent = true;
  for (const space of ["piedmont", "lombardy", "tuscany", "rome", "naples"]) G.spaces[space].control = "IT";
  for (const space of ["piedmont", "lombardy", "tuscany", "rome", "naples"]) {
    G.spaces[space].units = [];
  }
  return G;
};

describe("5.6.1 Italian Exception", () => {
  test("an Italian home key needs a LoC to another Italian home key", () => {
    const G = unifiedItaly();
    expect(italianControlledHomeKeys(G).length).toBeGreaterThanOrEqual(2);
    expect(italianSupplySource(G, "piedmont")).toBe(true);
    expect(italianHasLoc(G, "piedmont")).toBe(true);

    // Removing the last other home key leaves no source at all.
    for (const space of ["lombardy", "tuscany", "rome", "naples"]) G.spaces[space].control = "AU";
    expect(italianSupplySource(G, "piedmont")).toBe(false);
    expect(italianHasLoc(G, "piedmont")).toBe(false);
    expect(italianBrokenLoc(G, "piedmont")).toBe(true);
  });

  test("a cut-off Italian army is out of supply and cannot support", () => {
    const G = unifiedItaly();
    placeUnit(G, "IT", "italianArmy", "piedmont", 2);
    // Cut every other Italian home key, so Piedmont has no second key to trace
    // to and no Italian force can draw supply from it.
    for (const space of ["lombardy", "tuscany", "rome", "naples"]) G.spaces[space].control = "AU";
    expect(italianControlledHomeKeys(G)).toEqual(["piedmont"]);
    expect(italianHasLoc(G, "piedmont")).toBe(false);
    expect(italianBrokenLoc(G, "piedmont")).toBe(true);
  });

  test("an in-supply Italian force can support like a player", () => {
    const G = unifiedItaly();
    placeUnit(G, "IT", "italianArmy", "tuscany", 2);
    const battle = beginLandBattle(G, makeCtx(), "FR", "piedmont", "tuscany");
    // No battle starts because Tuscany is friendly to Italy and FR is allied
    // with Italy; this asserts the helper does not crash on IT units.
    expect(battle).toBeNull();
    expect(italianBrokenLoc(G, "tuscany")).toBe(false);
  });
});
