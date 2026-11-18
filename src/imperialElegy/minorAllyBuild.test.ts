/**
 * 12.2 / 12.4 as amended by the March 2026 errata, plus the 12.8 benefit.
 *
 *   "Players may use recruitment actions to build land units for their minor
 *   power allies.  Such units must be built in a home space of the respective
 *   minor power."
 *   "Players may use construct fleet actions to build naval units for their
 *   minor power allies.  Such units must be built in a home space with a port
 *   of the respective minor power."
 *
 * The helper `minorBuildDecision` is the single gate read by the move and the
 * Orders panel.  The 4.2 counter rows remain the cap: Greece prints 2 armies
 * and 2 squadrons, so it can gain its second army through this action, while
 * Bavaria prints 1 and is already at its limit.
 */
import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {buildForMinor} from "./moves";
import {minorBuildDecision, buildableMinorAllies} from "./engine/characteristics";
import {POWERS} from "./types";

const ctxFor = (power: Power): Ctx =>
  ({
    playerID: String(POWERS.indexOf(power)),
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

/** A campaign state with GE allied to Greece, which holds its home key. */
const alliedGame = (power: Power = "GE", cp = 4): ImperialElegyState => {
  const G = setupImperialElegy(ctxFor(power));
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  G.pending = null;
  G.battle = null;
  G.war = null;
  G.spaces.greece.control = "Greece";
  G.spaces.greece.ally = "GE";
  return G;
};

const minorUnits = (G: ImperialElegyState, minor: string, kind: string) =>
  Object.values(G.units).filter((unit) => unit.owner === minor && unit.kind === kind);

describe("12.2/12.4 minor-ally builds", () => {
  test("GE may raise a Greek army in Greece for 1 CP per step", () => {
    const G = alliedGame();
    const ctx = ctxFor("GE");
    // Greece starts reduced; make it full so the build must take a new counter.
    minorUnits(G, "Greece", "minorArmy")[0].steps = 2;
    expect(minorUnits(G, "Greece", "minorArmy").length).toBe(1);
    const decision = minorBuildDecision(G, "GE", "Greece", "army", "greece", 1);
    expect(decision.allowed).toBe(true);
    expect(decision.cost).toBe(1);

    expect(buildForMinor(G, ctx, "Greece", "army", "greece", 1)).toBeUndefined();
    expect(minorUnits(G, "Greece", "minorArmy").length).toBe(2);
    expect(G.cpRemaining).toBe(3);
  });

  test("an existing reduced minor army is flipped for 1 CP instead of a second counter", () => {
    const G = alliedGame();
    const ctx = ctxFor("GE");
    const army = minorUnits(G, "Greece", "minorArmy")[0];
    expect(army).toBeTruthy();
    expect(army.steps).toBe(1);
    const before = minorUnits(G, "Greece", "minorArmy").length;

    const decision = minorBuildDecision(G, "GE", "Greece", "army", "greece", 2);
    expect(decision.cost).toBe(1);
    expect(buildForMinor(G, ctx, "Greece", "army", "greece", 2)).toBeUndefined();
    expect(minorUnits(G, "Greece", "minorArmy").length).toBe(before);
    expect(army.steps).toBe(2);
  });

  test("a build outside the minor's home space is refused and costs nothing", () => {
    const G = alliedGame();
    const ctx = ctxFor("GE");
    const decision = minorBuildDecision(G, "GE", "Greece", "army", "berlin", 1);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.some((reason) => reason.includes("home space"))).toBe(true);
    expect(buildForMinor(G, ctx, "Greece", "army", "berlin", 1)).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(4);
  });

  test("a power not allied to the minor cannot build for it (12.8)", () => {
    const G = alliedGame();
    const ctx = ctxFor("FR");
    G.activePower = "FR";
    G.cpRemaining = 4;
    const decision = minorBuildDecision(G, "FR", "Greece", "army", "greece", 1);
    expect(decision.allowed).toBe(false);
    expect(buildForMinor(G, ctx, "Greece", "army", "greece", 1)).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(4);
  });

  test("the 4.2 counter row caps a minor's armies", () => {
    const G = alliedGame();
    const ctx = ctxFor("GE");
    minorUnits(G, "Greece", "minorArmy")[0].steps = 2;
    // Greece prints 2 armies and fields 1, so one build is legal.
    expect(minorBuildDecision(G, "GE", "Greece", "army", "greece", 1).allowed).toBe(true);
    expect(buildForMinor(G, ctx, "Greece", "army", "greece", 1)).toBeUndefined();
    expect(minorUnits(G, "Greece", "minorArmy").length).toBe(2);
    // The second counter exhausts the printed row.
    const third = minorBuildDecision(G, "GE", "Greece", "army", "greece", 1);
    expect(third.allowed).toBe(false);
    expect(third.reasons.some((reason) => reason.includes("counter"))).toBe(true);
    expect(buildForMinor(G, ctx, "Greece", "army", "greece", 1)).toBe(INVALID_MOVE);
  });

  test("12.4: a fleet needs the minor's home space with a port", () => {
    const G = alliedGame();
    // Greece has a port and a printed squadron row of 2.
    const decision = minorBuildDecision(G, "GE", "Greece", "squadron", "greece");
    expect(decision.allowed).toBe(true);
    expect(decision.cost).toBe(2);
    expect(buildForMinor(G, ctxFor("GE"), "Greece", "squadron", "greece")).toBeUndefined();
    expect(minorUnits(G, "Greece", "squadron").length).toBe(1);
    // A landlocked minor has nowhere to put one.
    G.spaces.bavaria.control = "Bavaria";
    G.spaces.bavaria.ally = "GE";
    expect(minorBuildDecision(G, "GE", "Bavaria", "squadron", "bavaria").allowed).toBe(false);
  });

  test("12.4: a minor with no printed dreadnought counter cannot build one", () => {
    const G = alliedGame();
    // Every printed minor row has 0 dreadnoughts, so the counter mix forbids it
    // whether or not the Dreadnought event has been played.
    expect(minorBuildDecision(G, "GE", "Greece", "dreadnought", "greece").allowed).toBe(false);
    G.persistent.dreadnoughts = true;
    expect(minorBuildDecision(G, "GE", "Greece", "dreadnought", "greece").allowed).toBe(false);
  });

  test("only the allied minors of the viewer are buildable", () => {
    const G = alliedGame();
    const allies = buildableMinorAllies(G, "GE");
    expect(allies).toContain("Greece");
    expect(allies).not.toContain("Belgium");
    expect(buildableMinorAllies(G, "FR")).not.toContain("Greece");
  });
});
