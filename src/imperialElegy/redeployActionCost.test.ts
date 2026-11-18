/**
 * 12.15: "1 CP. Enables a player to move **all** their land units an unlimited
 * distance by land."
 *
 * The action is priced per action, not per unit.  This suite pins that price:
 * the first unit moved in an impulse pays the CP and every later unit moved in
 * the same impulse rides the same action for free, while the next impulse pays
 * again.  It also covers the whole-stack form (`redeploy` accepts several unit
 * ids), because moving an army group in one click is the point of the rule.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {landUnitsIn} from "./engine/rules";
import {redeploy} from "./moves";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: () => 3, Number: () => 1, Shuffle: (a: unknown[]) => a},
    events: {
      setActivePlayers: () => undefined,
      setPhase: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (cp = 6): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = cp;
  G.pending = null;
  G.battle = null;
  G.war = null;
  // A land corridor Berlin -> Saxony -> Bavaria that GE controls throughout.
  G.spaces.berlin.control = "GE";
  G.spaces.saxony.control = "GE";
  G.spaces.bavaria.control = "GE";
  return G;
};

const ctx = (): Ctx => makeCtx(seat("GE"));

describe("12.15 the action is paid once per impulse", () => {
  test("three separate moves cost 1 CP in total", () => {
    const G = fresh(6);
    const a = placeUnit(G, "GE", "army", "berlin", 2);
    const b = placeUnit(G, "GE", "army", "saxony", 2);
    const c = placeUnit(G, "GE", "army", "bavaria", 2);
    const before = G.cpRemaining;
    expect(redeploy(G, ctx(), a.id, "saxony")).toBeUndefined();
    expect(G.cpRemaining).toBe(before - 1);
    // The action is open: the rest of it is free.
    expect(redeploy(G, ctx(), b.id, "bavaria")).toBeUndefined();
    expect(redeploy(G, ctx(), c.id, "berlin")).toBeUndefined();
    expect(G.cpRemaining).toBe(before - 1);
  });

  test("a new impulse pays the CP again", () => {
    const G = fresh(6);
    const a = placeUnit(G, "GE", "army", "berlin", 2);
    const b = placeUnit(G, "GE", "army", "saxony", 2);
    expect(redeploy(G, ctx(), a.id, "saxony")).toBeUndefined();
    expect(G.cpRemaining).toBe(5);
    // The impulse passes (the flags `clearActionImpulseSpend` owns) and the
    // next redeployment is a new action with its own price.
    delete G.powers.GE.flags.redeployActionThisImpulse;
    expect(redeploy(G, ctx(), b.id, "bavaria")).toBeUndefined();
    expect(G.cpRemaining).toBe(4);
  });

  test("with no CP the first unit is refused and nothing opens", () => {
    const G = fresh(0);
    const a = placeUnit(G, "GE", "army", "berlin", 2);
    expect(redeploy(G, ctx(), a.id, "saxony")).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(0);
    expect(G.powers.GE.flags.redeployActionThisImpulse).toBeUndefined();
    expect(landUnitsIn(G, "berlin").map((unit) => unit.id)).toContain(a.id);
  });

  test("a refused move does not open the action", () => {
    const G = fresh(6);
    const army = placeUnit(G, "GE", "army", "berlin", 2);
    // Uncontrolled, uninfluenced destination: the engine refuses it.
    G.spaces.bavaria.control = null;
    expect(redeploy(G, ctx(), army.id, "bavaria")).toBe(INVALID_MOVE);
    // The CP was still spent to open the action, so a legal second attempt is
    // free rather than charging twice for one action.
    const afterRefusal = G.cpRemaining;
    G.spaces.bavaria.control = "GE";
    expect(redeploy(G, ctx(), army.id, "bavaria")).toBeUndefined();
    expect(G.cpRemaining).toBe(afterRefusal);
  });
});

describe("12.15 a whole stack moves in one click", () => {
  test("every unit of the array moves for the same single CP", () => {
    const G = fresh(6);
    const garrison = landUnitsIn(G, "berlin").map((unit) => unit.id);
    const a = placeUnit(G, "GE", "army", "berlin", 2);
    const b = placeUnit(G, "GE", "army", "berlin", 2);
    const before = G.cpRemaining;
    expect(redeploy(G, ctx(), [a.id, b.id], "saxony")).toBeUndefined();
    expect(G.cpRemaining).toBe(before - 1);
    const arrived = landUnitsIn(G, "saxony").map((unit) => unit.id);
    expect(arrived).toContain(a.id);
    expect(arrived).toContain(b.id);
    // Only the two units that were named left; the opening garrison stayed.
    expect(landUnitsIn(G, "berlin").map((unit) => unit.id)).toEqual(garrison);
  });

  test("a unit that cannot make the move is left behind, the rest still move", () => {
    const G = fresh(6);
    const garrison = landUnitsIn(G, "berlin").map((unit) => unit.id);
    const mover = placeUnit(G, "GE", "army", "berlin", 2);
    // 15.2.3: a reserve army deployed this impulse cannot move at all.
    const locked = placeUnit(G, "GE", "reserveArmy", "berlin", 2);
    locked.flags = {...(locked.flags ?? {}), deployedThisImpulse: true};
    expect(redeploy(G, ctx(), [mover.id, locked.id], "saxony")).toBeUndefined();
    // The legal unit arrived; the locked one is still in Berlin with the
    // garrison.  (Saxony has its own opening garrison, so assert membership.)
    const arrived = landUnitsIn(G, "saxony").map((unit) => unit.id);
    expect(arrived).toContain(mover.id);
    expect(arrived).not.toContain(locked.id);
    expect(landUnitsIn(G, "berlin").map((unit) => unit.id)).toEqual([...garrison, locked.id]);
  });

  test("an all-refused array changes nothing", () => {
    const G = fresh(6);
    const garrison = landUnitsIn(G, "berlin").map((unit) => unit.id);
    const a = placeUnit(G, "GE", "army", "berlin", 2);
    G.spaces.bavaria.control = null;
    expect(redeploy(G, ctx(), [a.id], "bavaria")).toBe(INVALID_MOVE);
    expect(landUnitsIn(G, "berlin").map((unit) => unit.id)).toEqual([...garrison, a.id]);
  });

  test("the Great War still moves one unit per maneuver", () => {
    const G = fresh(6);
    const a = placeUnit(G, "GE", "army", "berlin", 2);
    const b = placeUnit(G, "GE", "army", "berlin", 2);
    G.phase = "gwManeuver";
    // 12.15 is an action-phase rule; a GW march/rail is one maneuver
    // (27.5), so the array form is not a way to move two armies free.
    expect(redeploy(G, ctx(), [a.id, b.id], "saxony")).toBe(INVALID_MOVE);
  });
});
