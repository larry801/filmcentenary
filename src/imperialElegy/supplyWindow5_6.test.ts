/**
 * 5.6 / 5.6.2 — the printed *window* of a broken LoC.
 *
 * 5.6 opens with "if, **at any point**, an army cannot trace to a supply
 * source it has a broken LoC", and its Play Note says players "really only
 * need to check for LoCs at the start of their impulse during wartime".
 * 5.6.2 then prints three penalties: "(1) the stack suffers one step loss at
 * the start of the player's impulse, (2) they have a -1 land battle modifier,
 * and (3) they cannot provide support."
 *
 * The two time points are distinct and must stay distinct:
 *
 *  - (2) and (3) are properties of the moment of battle ("at any point"), so a
 *    LoC cut during an impulse counts for every battle and support window in
 *    the rest of that impulse;
 *  - (1) is charged **only** at the start of the owning player's next impulse,
 *    to a stack that is still out of supply then.  A LoC that an event, a
 *    treaty or an alliance shift restored before that point is not broken at
 *    the printed moment, so the stack keeps its step.
 *
 * An earlier implementation answered "is this stack out of supply right now"
 * at every read, which merged the two points: a stack cut mid-impulse paid in
 * the same impulse it was cut.  These cases pin the printed timing.  Coverage
 * for the -1 BDRM and the support prohibition lives in `brokenLoc.test.ts`.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {
  beginImpulseUpkeep,
  brokenLoc,
  hasLoc,
  impulsePenalties,
} from "./engine/rules";
import {createWarState} from "./engine/limitedWar";

const makeCtx = (): Ctx => ({
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
} as unknown as Ctx);

/** A map with no pre-placed units and nobody allied, so each case owns it. */
const blank = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.units = {};
  for (const state of Object.values(G.spaces)) {
    state.control = null;
    state.occupiedBy = null;
    state.ally = null;
    state.influence = null;
    state.homeOverride = null;
    state.keyTypeOverride = undefined;
    state.units = [];
  }
  for (const power of POWERS) G.powers[power].alliance = "neutral";
  return G;
};

const own = (G: ImperialElegyState, power: Power, ...spaces: string[]): void => {
  for (const space of spaces) G.spaces[space].control = power;
};

const war = (G: ImperialElegyState, attacker: Power = "GE", defender: Power = "FR"): void => {
  G.phase = "wartime";
  G.war = createWarState(G, attacker, defender, "conquest", [], 3);
  G.war.status = "maneuver";
  G.war.passed = [];
};

describe("5.6.2(1) step-loss timing", () => {
  test("a LoC restored before the owner's next impulse start costs no step", () => {
    const G = blank();
    own(G, "GE", "berlin", "silesia");
    own(G, "FR", "paris");
    war(G);
    // Silesia is cut off from its supplier because Austria holds the land
    // bridge the trace needs.
    own(G, "AU", "pomerania");
    const army = placeUnit(G, "GE", "army", "silesia", 2);
    expect(brokenLoc(G, "GE", "silesia")).toBe(true);

    // The corridor reopens before the German impulse begins (an event, a
    // treaty, an alliance shift).  5.6 only calls a LoC broken while the army
    // cannot trace, so nothing is broken at the printed point of step (1).
    own(G, "GE", "pomerania");
    expect(brokenLoc(G, "GE", "silesia")).toBe(false);

    expect(beginImpulseUpkeep(G, makeCtx(), "GE")).toBe(false);
    expect(G.units[army.id].steps).toBe(2);
  });

  test("a stack still out of supply at the owner's impulse start pays one step", () => {
    const G = blank();
    own(G, "GE", "berlin", "silesia");
    own(G, "FR", "paris");
    war(G);
    own(G, "AU", "pomerania");
    const army = placeUnit(G, "GE", "army", "silesia", 2);
    expect(beginImpulseUpkeep(G, makeCtx(), "GE")).toBe(false);
    expect(G.units[army.id].steps).toBe(1);
  });

  test("the penalty fires once per impulse, not once per check", () => {
    const G = blank();
    own(G, "GE", "berlin", "silesia");
    own(G, "FR", "paris");
    war(G);
    own(G, "AU", "pomerania");
    const army = placeUnit(G, "GE", "army", "silesia", 2);
    beginImpulseUpkeep(G, makeCtx(), "GE");
    beginImpulseUpkeep(G, makeCtx(), "GE");
    expect(G.units[army.id].steps).toBe(1);
  });

  test("an in-supply stack is never charged", () => {
    const G = blank();
    own(G, "GE", "berlin", "pomerania", "silesia");
    own(G, "FR", "paris");
    war(G);
    const army = placeUnit(G, "GE", "army", "silesia", 2);
    expect(hasLoc(G, "GE", "silesia")).toBe(true);
    expect(impulsePenalties(G, "GE").some((p) => p.space === "silesia")).toBe(false);
    beginImpulseUpkeep(G, makeCtx(), "GE");
    expect(G.units[army.id].steps).toBe(2);
  });

  test("a broken LoC carries its -1 and no-support penalties before the step is charged", () => {
    const G = blank();
    own(G, "GE", "berlin", "silesia");
    own(G, "FR", "paris");
    war(G);
    own(G, "AU", "pomerania");
    const army = placeUnit(G, "GE", "army", "silesia", 2);
    // 5.6 "at any point": the space is broken right away, so a battle fought
    // in this impulse already suffers 5.6.2(2)/(3) ...
    expect(brokenLoc(G, "GE", "silesia")).toBe(true);
    // ... while 5.6.2(1) waits for the start of the owner's impulse.
    expect(G.units[army.id].steps).toBe(2);
    beginImpulseUpkeep(G, makeCtx(), "GE");
    expect(G.units[army.id].steps).toBe(1);
  });
});
