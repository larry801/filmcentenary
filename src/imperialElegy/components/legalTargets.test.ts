/**
 * The map's legal-move rings (components/legalTargets).
 *
 * The module mirrors the engine's own predicates instead of guessing at "a
 * friendly neighbour", so the tests pin the contract it promises: the origin is
 * never offered, every offered id is a real board space of the right kind, and
 * the intents/style the map draws agree with the rules the engine applies.
 */
import type {Ctx} from "boardgame.io";

import {SPACES, isNavalBox, portBoxes} from "../constant/spaces";
import {friendlySpace} from "../engine/rules";
import {setupImperialElegy} from "../engine/setup";
import type {ImperialElegyState, Power, SpaceId, Unit} from "../types";
import {
  destinationIsFriendly,
  intentStyle,
  legalUnitTargets,
  type UnitIntent,
} from "./legalTargets";

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
} as unknown as Ctx;

/** A campaign mid-impulse: Germany has three CP left and the action phase is open. */
const game = (): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 3;
  return G;
};

const unitIn = (G: ImperialElegyState, space: SpaceId, pick: (unit: Unit) => boolean): Unit => {
  const id = (G.spaces[space]?.units ?? []).find((unitId) => {
    const unit = G.units[unitId];
    return unit !== undefined && pick(unit);
  });
  expect(id).toBeDefined();
  return G.units[id as string];
};

/** The full-strength German army printed in Berlin. */
const berlinArmy = (G: ImperialElegyState): Unit =>
  unitIn(G, "berlin", (unit) => unit.owner === "GE" && unit.kind === "army" && unit.naval !== true);

/** A real fleet from the printed setup: the UK squadron in London (a port). */
const londonSquadron = (G: ImperialElegyState): Unit =>
  unitIn(G, "london", (unit) => unit.owner === "UK" && unit.naval === true);

const landMap = (G: ImperialElegyState, power: Power = "GE"): Map<SpaceId, UnitIntent[]> =>
  legalUnitTargets({G, power, unit: berlinArmy(G), phase: G.phase});

describe("legalUnitTargets", () => {
  test("a campaign land unit is offered real, non-naval spaces, never its own origin", () => {
    const G = game();
    const unit = berlinArmy(G);
    const targets = landMap(G);

    // The army is not boxed in: the whole Reich is a redeployment away.
    expect(targets.size).toBeGreaterThan(0);
    expect(targets.has(unit.space as SpaceId)).toBe(false);

    for (const id of targets.keys()) {
      expect(SPACES[id]).toBeDefined();
      expect(G.spaces[id]).toBeDefined();
      expect(isNavalBox(id)).toBe(false);
    }

    // 12.15: a redeployment must end in a space the player holds — controlled,
    // or uncontrolled with the player's influence.
    for (const id of targets.keys()) {
      const state = G.spaces[id];
      expect(state.control === "GE" || (state.control === null && state.influence === "GE")).toBe(true);
    }

    // Concrete neighbours, so the filter is not just "everything on the map".
    expect(targets.has("prussia")).toBe(true);
    expect(targets.has("paris")).toBe(false);
  });

  test("a campaign land unit only ever gets the redeploy intent, and its rings are moves", () => {
    const G = game();
    const targets = landMap(G);
    expect(targets.size).toBeGreaterThan(0);

    for (const intents of targets.values()) {
      expect(intents).toEqual(["redeploy"]);
      expect(intentStyle(intents)).toBe("move");
    }
  });

  test("the ring style follows the intent list the Great War ladder produces", () => {
    expect(intentStyle(["redeploy"])).toBe("move");
    expect(intentStyle(["gwMarch"])).toBe("move");
    expect(intentStyle(["gwRail"])).toBe("rail");
    expect(intentStyle(["gwMarch", "gwRail"])).toBe("choice");
    expect(intentStyle(["gwRail", "gwMarch"])).toBe("choice");
    expect(intentStyle([])).toBe("move");
  });

  test("destinationIsFriendly is the engine's own friendlySpace for the same inputs", () => {
    const G = game();
    const targets = landMap(G);

    for (const id of targets.keys()) {
      expect(destinationIsFriendly(G, id, "GE")).toBe(friendlySpace(G, id, "GE"));
    }

    // Every redeployment destination is friendly by construction (12.15), and
    // the wrapper agrees on spaces outside the map too: Berlin is German-held,
    // Paris is not.
    for (const id of targets.keys()) expect(destinationIsFriendly(G, id, "GE")).toBe(true);
    expect(destinationIsFriendly(G, "berlin", "GE")).toBe(true);
    expect(destinationIsFriendly(G, "paris", "GE")).toBe(false);
    expect(destinationIsFriendly(G, "paris", "FR")).toBe(true);
  });

  test("a naval unit uses the naval plan: water and ports only, never its own port", () => {
    const G = game();
    const unit = londonSquadron(G);
    const targets = legalUnitTargets({G, power: "UK", unit, phase: G.phase});

    expect(targets.size).toBeGreaterThan(0);
    expect(targets.has(unit.space as SpaceId)).toBe(false);

    for (const [id, intents] of targets) {
      expect(SPACES[id]).toBeDefined();
      expect(isNavalBox(id) || portBoxes(id).length > 0).toBe(true);
      expect(intents).toEqual(["redeploy"]);
      expect(intentStyle(intents)).toBe("move");
    }

    // The fleet reaches open water but cannot sail to an inland key.
    expect([...targets.keys()].some((id) => isNavalBox(id))).toBe(true);
    expect(targets.has("berlin")).toBe(false);
    expect(targets.has("london")).toBe(false);
  });

  test("a unit still in the holding box has no legal target", () => {
    const G = game();
    const holding = Object.values(G.units).find((unit) => unit.kind === "reserveArmy" && unit.space === null);
    expect(holding).toBeDefined();
    expect(legalUnitTargets({G, power: "GE", unit: holding as Unit, phase: G.phase}).size).toBe(0);
  });
});
