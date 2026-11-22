/**
 * UK home card #3 "Sun Never Sets".
 *
 * The printed card is a choice between its naval half and its India half.  The
 * handler used to resolve both at once (and always place a London squadron), so
 * the UK could never choose.  These tests pin the two branches, the free ship
 * type choice and the two restricted 2 CP grants.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {freeGrantCp, navalUnitsIn} from "./engine/rules";
import {placeUnit, removeUnit} from "./engine/effects";
import {buildEf, constructFleet, navalMove, playCard, recruit, resolvePending} from "./moves";

const makeCtx = (playerID: string | null = "1"): Ctx =>
  ({
    playerID,
    random: {Die: () => 3},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));

const clearUnits = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

/** UK's action impulse with Sun Never Sets in hand and no ordinary CP. */
const uk = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx(seat("UK")));
  G.phase = "action";
  G.activePower = "UK";
  G.pending = null;
  G.battle = null;
  G.war = null;
  G.cpRemaining = 0;
  G.powers.UK.flags.actionCpSpentThisImpulse = false;
  G.powers.UK.hand = ["IE-H-UK-3"];
  G.powers.UK.selectedHomeCard = "IE-H-UK-3";
  return G;
};

const playSun = (G: ImperialElegyState): void => {
  expect(playCard(G, makeCtx(seat("UK")), "IE-H-UK-3", "event")).toBeUndefined();
};

const answer = (G: ImperialElegyState, optionId: string): void => {
  expect(resolvePending(G, makeCtx(seat("UK")), optionId)).toBeUndefined();
};

describe("UK-3 Sun Never Sets chooses one half", () => {
  test("the event asks naval or India instead of resolving both", () => {
    const G = uk();
    playSun(G);
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.context?.special).toBe("sunNeverSets");
    expect(G.pending?.options.map((option) => option.id)).toEqual(["naval", "india"]);
    // Nothing has resolved yet, so neither half happened.
    expect(G.powers.UK.flags.freeOperationCp).toBeUndefined();
    expect(G.powers.UK.flags.freeIndianCp).toBeUndefined();
    expect(G.spaces.india.fort).toBeNull();
  });

  test("the India half flips the marker, places the fort and grants only the Indian 2 CP", () => {
    const G = uk();
    G.powers.UK.indiaStable = false;
    const shipsBefore = navalUnitsIn(G, "london").length;
    playSun(G);
    answer(G, "india");
    expect(G.powers.UK.indiaStable).toBe(true);
    expect(G.spaces.india.fort).toMatchObject({power: "UK", level: 1, indian: true});
    expect(freeGrantCp(G, "UK", "freeIndianCp")).toBe(2);
    expect(G.powers.UK.flags.freeOperationCp).toBeUndefined();
    // The naval half was not taken.
    expect(navalUnitsIn(G, "london")).toHaveLength(shipsBefore);
  });

  test("the India half upgrades an existing level-1 Indian fort", () => {
    const G = uk();
    G.spaces.india.fort = {power: "UK", level: 1, indian: true};
    playSun(G);
    answer(G, "india");
    expect(G.spaces.india.fort).toMatchObject({power: "UK", level: 2, indian: true});
  });

  test("the naval half builds a ship and grants only the operation 2 CP", () => {
    const G = uk();
    clearUnits(G, "london");
    const stableBefore = G.powers.UK.indiaStable;
    playSun(G);
    answer(G, "naval");
    // Only a squadron is legal at setup (Dreadnought has not been played).
    expect(navalUnitsIn(G, "london")).toHaveLength(1);
    expect(navalUnitsIn(G, "london")[0].kind).toBe("squadron");
    expect(G.powers.UK.flags.freeOperationCp).toBe(2);
    expect(G.powers.UK.flags.freeIndianCp).toBeUndefined();
    // The India half was not taken.
    expect(G.spaces.india.fort).toBeNull();
    expect(G.powers.UK.indiaStable).toBe(stableBefore);
  });

  test("the naval half offers the printed squadron-or-dreadnought choice when both are legal", () => {
    const G = uk();
    clearUnits(G, "london");
    G.persistent.dreadnoughts = true;
    playSun(G);
    answer(G, "naval");
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.context?.stage).toBe("fleet");
    expect(G.pending?.options.map((option) => option.id)).toEqual(["squadron", "dreadnought"]);
    answer(G, "dreadnought");
    expect(navalUnitsIn(G, "london")).toHaveLength(1);
    expect(navalUnitsIn(G, "london")[0].kind).toBe("dreadnought");
    expect(G.powers.UK.flags.freeOperationCp).toBe(2);
  });
});

describe("the two Sun Never Sets grants are restricted", () => {
  test("the Indian grant pays for an Indian army step", () => {
    const G = uk();
    // The Indian army cap is already full at setup, so pin the refit path: a
    // reduced Indian army adds no counter and is a legal 1 CP step.
    const indian = Object.values(G.units).find(
      (unit) => unit.owner === "UK" && unit.flags?.indian === true && unit.space === "india",
    );
    expect(indian).toBeDefined();
    indian!.steps = 1;
    G.powers.UK.flags.freeIndianCp = 2;
    expect(recruit(G, makeCtx(seat("UK")), "india", "army", 1)).toBeUndefined();
    expect(freeGrantCp(G, "UK", "freeIndianCp")).toBe(1);
    expect(G.cpRemaining).toBe(0);
  });

  test("the Indian grant pays for an EF built in India or Bengal", () => {
    const G = uk();
    G.powers.UK.flags.freeIndianCp = 2;
    expect(buildEf(G, makeCtx(seat("UK")), "india")).toBeUndefined();
    expect(freeGrantCp(G, "UK", "freeIndianCp")).toBe(0);
  });

  test("the Indian grant never pays for a British army or a fleet", () => {
    const G = uk();
    G.powers.UK.flags.freeIndianCp = 2;
    G.spaces.london.control = "UK";
    expect(recruit(G, makeCtx(seat("UK")), "london", "army", 1)).toBe(INVALID_MOVE);
    expect(constructFleet(G, makeCtx(seat("UK")), "london", "squadron")).toBe(INVALID_MOVE);
    expect(freeGrantCp(G, "UK", "freeIndianCp")).toBe(2);
  });

  test("the operation grant pays for naval movement and an EF, but not a fleet", () => {
    const G = uk();
    G.powers.UK.flags.freeOperationCp = 2;
    const ship = placeUnit(G, "UK", "squadron", "london", 2);
    expect(navalMove(G, makeCtx(seat("UK")), [ship.id], "north-atlantic")).toBeUndefined();
    expect(freeGrantCp(G, "UK", "freeOperationCp")).toBe(1);
    expect(buildEf(G, makeCtx(seat("UK")), "london")).toBe(INVALID_MOVE);
    G.powers.UK.flags.freeOperationCp = 2;
    expect(constructFleet(G, makeCtx(seat("UK")), "london", "squadron")).toBe(INVALID_MOVE);
    expect(freeGrantCp(G, "UK", "freeOperationCp")).toBe(2);
  });
});
