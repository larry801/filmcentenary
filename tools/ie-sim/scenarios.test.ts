/**
 * Every printed scenario must actually be playable.
 *
 * `fullGame.test.ts` proves the campaign and `invariants.test.ts` the mode
 * matrix, but both start from the campaign's own 1850 setup.  This suite is the
 * only place the rest of `IE_playbook.pdf` pp. 3-10 runs: each scenario's setup
 * has to produce a legal position, the phase flow has to reach that scenario's
 * printed last turn, and the ending has to be a decisive result rather than a
 * stuck state.  The Great War scenarios open at GW turn 0, so they are proven
 * to enter the war's own sequence of play and to survive its first turn.
 *
 * It lives under `tools/` (outside `yarn test`) because one scenario is
 * hundreds of real impulses.  Run it with:
 *
 *   npx jest --testPathPatterns "tools/ie-sim/scenarios" \
 *     --testPathIgnorePatterns "/node_modules/" --runInBand
 */
import {SCENARIO_IDS, SCENARIOS} from "../../src/imperialElegy/constant/scenarios";
import {runSeededGame, SimResult} from "./harness";

jest.setTimeout(900_000);

const GW_SCENARIOS = SCENARIO_IDS.filter((id) => id.startsWith("gwTutorial") || id.startsWith("altGw"));
const PRE_WAR_SCENARIOS = SCENARIO_IDS.filter((id) => !GW_SCENARIOS.includes(id));

/** Everything except a recorded invariant break: those have their own census. */
const refusals = (result: SimResult) => result.issues.filter((issue) => issue.kind !== "invariant");

describe.each(PRE_WAR_SCENARIOS)("scenario autoplay — %s", (id) => {
  const def = SCENARIOS[id];
  test("plays to a decisive result", () => {
    const result = runSeededGame({seed: `scenario-autoplay-${id}`, scenario: id, maxSteps: 4000});
    expect(result.steps).toBeGreaterThan(0);
    if (!result.finished) {
      throw new Error(
        `${id} did not finish: turn=${result.turn} phase=${result.phase} steps=${result.steps} gw=${result.gw} `
        + `first refusal=${JSON.stringify(refusals(result)[0] ?? null)}`,
      );
    }
    const reason = result.result?.reason;
    const acceptable = reason !== undefined && (
      reason === `endOfTurn${def.lastTurn}`
      || reason === "tutorialNoVp"
      || reason.startsWith("autoVictory:")
      || reason.startsWith("greatWar:")
      || reason.startsWith("gwTurnLimit:")
      || reason.startsWith("noGw:")
    );
    if (!acceptable) throw new Error(`${id}: unexpected end reason ${String(reason)}`);
    // A competitive scenario names winners; the tutorial deliberately names none.
    if (def.special.countVp) expect(result.result?.winners.length).toBeGreaterThan(0);
    else expect(result.result?.winners).toEqual([]);
    expect(refusals(result)).toEqual([]);
  });
});

describe.each(GW_SCENARIOS)("GW scenario autoplay — %s", (id) => {
  test("starts in the Great War and plays its first GW turn", () => {
    const result = runSeededGame({
      seed: `scenario-autoplay-${id}`,
      scenario: id,
      maxSteps: 2000,
      stop: (G) => G.gw?.active === true && G.gw.turn >= 1,
    });
    const gw = result.finalState.gw;
    // The opening planning step really began the war: the GW turn-0 budgets
    // were set, the GW cards dealt and the printed order is standing.
    expect(result.events[0]?.phase).toBe("gwPlanning");
    expect(gw?.active).toBe(true);
    expect(gw?.outbreakDone).toBe(true);
    expect(gw?.nationalWillDone).toBe(true);
    expect(gw?.order.length ?? 0).toBeGreaterThan(0);
    expect(gw?.turn ?? 0).toBeGreaterThanOrEqual(1);
    // At least one maneuver step and one winter step were visited.
    expect(result.events.some((event) => event.phase === "gwManeuver")).toBe(true);
    expect(result.events.some((event) => event.phase === "gwWinter")).toBe(true);
    expect(refusals(result)).toEqual([]);
  });
});
