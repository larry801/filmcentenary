import {GW_STEPS, phaseAnchor, phaseSteps, WAR_STEPS} from "./phaseSteps";
import {endPhaseOrder} from "../engine/economy";

describe("phaseSteps", () => {
  test("the campaign turn is Prep → Diplomacy → Action → End", () => {
    const prep = phaseSteps({phase: "prep"});
    expect(prep.map((step) => step.key)).toEqual(["prep", "diplomacy", "action", "end"]);
    expect(prep.filter((step) => step.current).map((step) => step.key)).toEqual(["prep"]);

    const action = phaseSteps({phase: "action"});
    expect(action.find((step) => step.current)?.key).toBe("action");
    expect(action.find((step) => step.key === "action")?.anchor).toBe("rules:action");
  });

  test("a limited war replaces the Action step with the war.status ladder", () => {
    const steps = phaseSteps({
      phase: "wartime",
      war: {status: "maneuver"} as never,
    });
    const keys = steps.map((step) => step.key);
    expect(keys).toContain("war:maneuver");
    expect(keys).not.toContain("action");
    expect(keys).not.toContain("end");
    expect(steps.filter((step) => step.current).map((step) => step.key)).toEqual(["war:maneuver"]);
    // The ladder's own order, not an invented one.
    expect(WAR_STEPS.map((step) => `war:${step.status}`)).toEqual(
      steps.filter((step) => step.kind === "war").map((step) => step.key),
    );
  });

  test("the end phase expands to the engine's endPhaseOrder", () => {
    const steps = phaseSteps({phase: "end", endPhase: {step: 1} as never});
    const endSteps = steps.filter((step) => step.kind === "endStep");
    expect(endSteps.map((step) => step.key)).toEqual(endPhaseOrder().map((entry) => `end:${entry.rule}`));
    expect(endSteps.filter((step) => step.current)).toHaveLength(1);
    expect(steps.find((step) => step.current)?.key).toBe(`end:${endPhaseOrder()[1].rule}`);
    // The four campaign steps stay above the ladder.
    expect(steps.slice(0, 4).map((step) => step.key)).toEqual(["prep", "diplomacy", "action", "end"]);
  });

  test("the Great War replaces the campaign turn with Planning → Maneuver → Winter", () => {
    for (const [index, current] of [[0, "gw:planning"], [1, "gw:maneuver"], [2, "gw:winter"]] as const) {
      const steps = phaseSteps({phase: GW_STEPS[index].phase});
      // The printed ladder's order and the stable key spelling, not the raw phase names.
      expect(steps.map((step) => step.key)).toEqual(["gw:planning", "gw:maneuver", "gw:winter"]);
      expect(steps.every((step) => step.kind === "gw")).toBe(true);
      expect(steps.filter((step) => step.current).map((step) => step.key)).toEqual([current]);
    }
  });

  test("the outbreak is its own step before the GW ladder", () => {
    const steps = phaseSteps({phase: "gwOutbreak", gw: {active: true} as never});
    expect(steps[0]).toMatchObject({key: "outbreak", current: true, anchor: "chart:crisis"});
    expect(steps.slice(1).every((step) => step.kind === "gw")).toBe(true);
  });

  test("game over is a single current step", () => {
    expect(phaseSteps({phase: "gameOver"})).toHaveLength(1);
    expect(phaseSteps({phase: "gameOver"})[0].current).toBe(true);
  });

  test("every step prints the rulebook section it belongs to", () => {
    // The printed headings: 2.1 (campaign), 12.17.2 (wartime SoP) and 24.1
    // (GW SoP).  The sequence list shows these numbers, so a sub-rule number
    // (13.2, 27.3, …) reads as the wrong rule and contradicts the rulebook.
    const rules = (steps: readonly {rule?: string}[]): string[] => steps.map((step) => step.rule ?? "");
    expect(rules(phaseSteps({phase: "prep"}))).toEqual(["10.0", "11.0", "12.0", "20.0"]);
    expect(rules(phaseSteps({phase: "wartime", war: {status: "warAim"} as never}))).toEqual(
      ["10.0", "11.0", "13.0", "14.0", "14.2", "14.3", "15.0", "16.0", "17.0"],
    );
    expect(rules(phaseSteps({phase: "gwPlanning"}))).toEqual(["26.0", "27.0", "29.0"]);
    expect(rules(phaseSteps({phase: "gwOutbreak", gw: {active: true} as never})).slice(0, 1)).toEqual(["25.0"]);
  });

  test("phaseAnchor names the current step's printed reference", () => {
    expect(phaseAnchor({phase: "prep"})).toBe("rules:prep");
    expect(phaseAnchor({phase: "action"})).toBe("rules:action");
    expect(phaseAnchor({phase: "gameOver"})).toBe("rules:victory");
  });
});
