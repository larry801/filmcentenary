/**
 * 20.3 Non-Player Power Build Step — Italy's rebuild through 22.4.
 *
 * "If Italy is unified they automatically rebuild all their units at full
 * strength and flip all reduced units to full strength.  Then conduct an
 * Italian redeployment [22.4]."
 *
 * 22.4 places one standing army in Rome and the other two next to
 * player-controlled spaces; naval units go to Naples (Piedmont when Naples is
 * not Italian controlled).  The old Naples/Piedmont/Tuscany seeding is gone.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {unifyItaly} from "./engine/greatWar";
import {initialNonPlayerBuildBox, italianRebuildPlan} from "./engine/endPhase";
import {placeUnit, removeUnit} from "./engine/effects";
import {italianRedeployPlan, landUnitsIn, navalUnitsIn} from "./engine/rules";
import {resolveEnd} from "./moves";

const makeCtx = (dieValue = 3): Ctx =>
  ({
    playerID: "0",
    random: {Die: (_sides: number) => dieValue},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "end",
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/** A real unified Italy: its spaces are Italian-controlled and 22.4 was run. */
const unified = (): ImperialElegyState => {
  const G = fresh();
  unifyItaly(G, makeCtx(), "GE");
  return G;
};

const italianArmies = (G: ImperialElegyState) =>
  Object.values(G.units).filter((unit) => unit.owner === "IT" && unit.kind === "italianArmy");

const italianUnits = (G: ImperialElegyState) =>
  Object.values(G.units).filter((unit) => unit.owner === "IT");

const armiesIn = (G: ImperialElegyState, space: string) =>
  landUnitsIn(G, space).filter((unit) => unit.owner === "IT" && unit.kind === "italianArmy");

const shipsIn = (G: ImperialElegyState, space: string) =>
  navalUnitsIn(G, space).filter((unit) => unit.owner === "IT");

const emptyBox = () => ({italianArmy: 0, squadron: 0, dreadnought: 0});

describe("20.3 the plan uses the 22.4 placement", () => {
  test("a destroyed frontier army returns to its frontier space, not Naples", () => {
    const G = unified();
    const tuscany = armiesIn(G, "tuscany")[0];
    expect(tuscany).toBeTruthy();
    removeUnit(G, tuscany.id);
    expect(G.nonPlayerBuildBox?.italy.italianArmy).toBe(1);

    const plan = italianRebuildPlan(G)!;

    expect(plan.rebuild).toEqual([{kind: "italianArmy", space: "tuscany"}]);
    expect(plan.heldBack).toEqual(emptyBox());
  });

  test("Rome receives the first rebuilt standing army when it is free", () => {
    const G = unified();
    // Lose every standing army: the 22.4 redeployment starts with Rome.
    for (const space of ["rome", "piedmont", "tuscany"]) {
      for (const unit of [...armiesIn(G, space)]) removeUnit(G, unit.id);
    }
    expect(G.nonPlayerBuildBox?.italy.italianArmy).toBe(3);

    const plan = italianRebuildPlan(G)!;

    expect(plan.rebuild.map((entry) => entry.space)).toEqual(["rome", "piedmont", "tuscany"]);
    expect(plan.heldBack).toEqual(emptyBox());
  });

  test("the naval rebuild uses Naples, or Piedmont when Naples is not Italy's", () => {
    const G = unified();
    removeUnit(G, shipsIn(G, "naples")[0].id);
    expect(italianRebuildPlan(G)!.rebuild).toEqual([{kind: "squadron", space: "naples"}]);

    // A player-controlled Naples stays with that player (22.2); 22.4's naval
    // grant then goes to Piedmont.
    const H = unified();
    H.spaces.naples.control = "FR";
    expect(italianRedeployPlan(H).naval).toBe("piedmont");
    H.nonPlayerBuildBox = initialNonPlayerBuildBox();
    H.nonPlayerBuildBox.italy = {italianArmy: 0, squadron: 1, dreadnought: 0};
    expect(italianRebuildPlan(H)!.rebuild).toEqual([{kind: "squadron", space: "piedmont"}]);
  });

  test("the plan never exceeds the printed Italian counter totals", () => {
    const G = unified();
    // A reserve army is the fourth printed Italian army counter.
    placeUnit(G, "IT", "italianArmy", null, 2);
    G.nonPlayerBuildBox = initialNonPlayerBuildBox();
    G.nonPlayerBuildBox.italy = {italianArmy: 1, squadron: 0, dreadnought: 0};

    const plan = italianRebuildPlan(G)!;

    expect(plan.rebuild).toEqual([]);
    expect(plan.heldBack).toEqual({italianArmy: 1, squadron: 0, dreadnought: 0});
    expect(italianArmies(G)).toHaveLength(4);
  });

  test("no legal 22.4 space leaves the destroyed units in the Italy build box", () => {
    const G = fresh();
    // A unified Italy without a single Italian-controlled space (hand-written
    // state): the rebuild has nowhere to redeploy.
    G.persistent.italyUnified = true;
    G.nonPlayerBuildBox = initialNonPlayerBuildBox();
    G.nonPlayerBuildBox.italy = {italianArmy: 1, squadron: 1, dreadnought: 1};

    const plan = italianRebuildPlan(G)!;

    expect(plan.rebuild).toEqual([]);
    expect(plan.heldBack).toEqual({italianArmy: 1, squadron: 1, dreadnought: 1});
  });

  test("reduced units are still flipped to full strength", () => {
    const G = unified();
    const army = italianArmies(G).find((unit) => unit.space === "rome")!;
    army.steps = 1;

    const plan = italianRebuildPlan(G)!;

    expect(plan.promote).toEqual([army.id]);
  });
});

describe("20.3 live rebuild through the end phase", () => {
  test("resolveEnd rebuilds through 22.4 and drains the Italy box", () => {
    const G = unified();
    const tuscany = armiesIn(G, "tuscany")[0];
    removeUnit(G, tuscany.id);
    const ship = shipsIn(G, "naples")[0];
    removeUnit(G, ship.id);

    resolveEnd(G, makeCtx());

    expect(armiesIn(G, "tuscany")).toHaveLength(1);
    expect(shipsIn(G, "naples")).toHaveLength(1);
    expect(G.nonPlayerBuildBox?.italy).toEqual(emptyBox());
  });

  test("a second end phase does not duplicate the rebuilt units", () => {
    const G = unified();
    removeUnit(G, armiesIn(G, "tuscany")[0].id);
    resolveEnd(G, makeCtx());
    const count = italianUnits(G).length;

    resolveEnd(G, makeCtx());

    expect(italianUnits(G)).toHaveLength(count);
    expect(italianArmies(G)).toHaveLength(3);
  });

  test("unplaceable units stay in the box across end phases", () => {
    const G = fresh();
    G.persistent.italyUnified = true;
    G.nonPlayerBuildBox = initialNonPlayerBuildBox();
    G.nonPlayerBuildBox.italy = {italianArmy: 1, squadron: 1, dreadnought: 0};

    resolveEnd(G, makeCtx());

    expect(G.nonPlayerBuildBox?.italy).toEqual({italianArmy: 1, squadron: 1, dreadnought: 0});
  });
});
