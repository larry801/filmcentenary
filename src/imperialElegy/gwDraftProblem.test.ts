/**
 * 27.5.2's draft eligibility, as the board and the move both read it.
 *
 * Reported while playing the solo Historical Great War: the Orders panel
 * offered "Draft · 1 CP" on a home key that was already at its stacking limit
 * and for a power whose army-counter pool was empty, and the engine then
 * refused the click with no reason on screen.  The move now calls
 * `gwDraftProblem`, and the action row asks it before it enables itself.
 */
import {Ctx} from "boardgame.io";
import {Power} from "./types";
import type {ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {counterRemaining} from "./engine/counters";
import {gwDraftProblem} from "./engine/greatWarFlow";

const testCtx = (power: Power): Ctx => ({
  playerID: String(["GE", "UK", "FR", "AU", "RU", "OT"].indexOf(power)),
  random: {Die: () => 1},
  events: {setActivePlayers: () => undefined, setPhase: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "gwManeuver",
} as unknown as Ctx);

const game = (power: Power = "GE"): ImperialElegyState => {
  const G = setupImperialElegy(testCtx(power));
  G.phase = "gwManeuver";
  G.pending = null;
  G.battle = null;
  G.war = null;
  return G;
};

describe("gwDraftProblem (27.5.2)", () => {
  test("a controlled home key with room, manpower and counters is legal", () => {
    const G = game("UK");
    // The UK has ten standing army counters and only three on the map at the
    // campaign setup, so a draft in its empty capital is legal.
    expect(counterRemaining(G, "UK", "army")).toBeGreaterThanOrEqual(2);
    expect(G.powers.UK.manpower).toBeGreaterThanOrEqual(1);
    expect(gwDraftProblem(G, "UK", "london")).toBeNull();
  });

  test("a home key at the stacking limit is refused with the printed reason", () => {
    const G = game("UK");
    // 5.5.1: a main-map space holds at most three armies.
    placeUnit(G, "UK", "army", "london", 2);
    placeUnit(G, "UK", "army", "london", 2);
    placeUnit(G, "UK", "army", "london", 2);
    const problem = gwDraftProblem(G, "UK", "london");
    expect(problem?.error).toBe("invalidTarget");
    expect(problem?.message).toContain("27.5.2");
  });

  test("a trench battle marker blocks a draft", () => {
    const G = game("UK");
    G.spaces.london.trench = true;
    expect(gwDraftProblem(G, "UK", "london")?.error).toBe("invalidTarget");
  });

  test("a key the power does not control is refused", () => {
    const G = game("GE");
    expect(gwDraftProblem(G, "GE", "paris")?.error).toBe("invalidTarget");
  });

  test("no manpower is its own refusal", () => {
    const G = game("UK");
    G.powers.UK.manpower = 0;
    expect(gwDraftProblem(G, "UK", "london")?.error).toBe("noManpower");
  });

  test("an exhausted army-counter pool is its own refusal (4.2)", () => {
    const G = game("GE");
    // GE's chart row is five standing army counters.  Use every leftover one
    // off the map so the home key has room but no counter can be drafted.
    for (let remaining = counterRemaining(G, "GE", "army"); remaining > 0; remaining -= 1) {
      placeUnit(G, "GE", "army", null, 2);
    }
    G.powers.GE.manpower = 5;
    expect(counterRemaining(G, "GE", "army")).toBe(0);
    const problem = gwDraftProblem(G, "GE", "berlin");
    expect(problem?.error).toBe("noCounter");
    expect(problem?.message).toContain("army counters");
  });
});
