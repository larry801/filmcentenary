/**
 * Rule 16.2.1 — "During an Italian war of unification or during a war of
 * liberation this option [territorial cession] must be selected by a victorious
 * attacker."
 *
 * The interactive chooser cannot offer "Finish treaties" before cession is
 * taken, and the explicit `settleLimitedWar` path rejects a settlement that
 * omits it.  German unification is not an Italian unification war and keeps the
 * ordinary optional treaty list.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  classifyVictory,
  createWarState,
  mandatoryCessionPending,
  settleLimitedWar,
  warRequiresMandatoryCession,
} from "./engine/limitedWar";
import {treatyOptionsFor} from "./engine/treatyChoice";
import {resolvePending, resolveWar} from "./moves";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: () => 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/** GE attacks AU to liberate Berlin (an original GE home taken by AU). */
const liberationWar = (G: ImperialElegyState): WarState => {
  G.phase = "wartime";
  G.activePower = "GE";
  G.pending = null;
  G.spaces.berlin.control = "AU";
  G.spaces.berlin.occupiedBy = "GE";
  G.spaces.vienna.occupiedBy = "GE";
  const war = createWarState(G, "GE", "AU", "liberation", ["berlin"], 2);
  G.war = war;
  return war;
};

describe("16.2.1 mandatory territorial cession", () => {
  test("a liberation war marks the cession as pending and restricts the primary options", () => {
    const G = fresh();
    const war = liberationWar(G);
    const victory = classifyVictory(G, war);
    expect(victory.kind).toBe("major");
    expect(victory.victor).toBe("attacker");
    expect(warRequiresMandatoryCession(war)).toBe(true);
    expect(mandatoryCessionPending(war, victory)).toBe(true);

    const entries = treatyOptionsFor(G, war, victory, {primary: true, knockout: false, loserKnockout: false});
    expect(entries.map((entry) => entry.option)).toEqual(["territorialCession"]);
  });

  test("the live chooser has no early finish and forces cession first", () => {
    const G = fresh();
    liberationWar(G);
    const ctx = makeCtx(seat("GE"));

    expect(resolveWar(G, ctx)).toBeUndefined();
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.options.map((entry) => entry.id)).toContain("territorialCession");
    expect(G.pending?.options.some((entry) => entry.id === "done")).toBe(false);
    expect(G.pending?.options.some((entry) => entry.id === "warReparations")).toBe(false);

    expect(resolvePending(G, ctx, "territorialCession")).toBeUndefined();
    expect(G.spaces.berlin.control).toBe("GE");
    // A major victory awards a second pick; once cession is applied the
    // ordinary "done" option is back.
    if (G.pending?.kind === "treatyOption") {
      expect(G.pending.options.map((entry) => entry.id)).toContain("done");
      expect(resolvePending(G, ctx, "done")).toBeUndefined();
    }
    expect(G.war).toBeNull();
    if (G.pending?.kind === "demobilizationFreeAction") {
      expect(resolvePending(G, ctx, G.pending.options[G.pending.options.length - 1].id)).toBeUndefined();
    }
  });

  test("the explicit settlement path rejects an empty cession list", () => {
    const G = fresh();
    const war = liberationWar(G);
    const victory = classifyVictory(G, war);

    const settlement = settleLimitedWar(G, victory, []);
    expect(settlement.ok).toBe(false);
    expect(settlement.issues).toContain("mandatory-cession-missing");
    expect(settlement.demobilization).toBeNull();
    // Nothing was applied: the war is still live and Berlin is still AU's.
    expect(G.war).toBe(war);
    expect(G.spaces.berlin.control).toBe("AU");
  });

  test("resolveWar with an explicit empty list refuses to settle", () => {
    const G = fresh();
    liberationWar(G);
    const ctx = makeCtx(seat("GE"));

    expect(resolveWar(G, ctx, [])).toBeUndefined();
    expect(G.war).not.toBeNull();
    expect(G.spaces.berlin.control).toBe("AU");
    expect(G.log.some((entry) => entry.key === "warSettlementIssues" && entry.args?.issues === "mandatory-cession-missing")).toBe(true);
  });

  test("the explicit settlement path accepts a cession choice", () => {
    const G = fresh();
    const war = liberationWar(G);
    const victory = classifyVictory(G, war);

    const settlement = settleLimitedWar(G, victory, [{option: "territorialCession", spaces: ["berlin"]}]);
    expect(settlement.ok).toBe(true);
    expect(settlement.treaties.map((treaty) => treaty.option)).toEqual(["territorialCession"]);
    expect(G.spaces.berlin.control).toBe("GE");
    expect(G.war).toBeNull();
  });

  test("an Italian unification war is covered, while German unification is not", () => {
    const G = fresh();
    const italian = createWarState(G, "GE", "AU", "unification", ["piedmont"], 2);
    expect(warRequiresMandatoryCession(italian)).toBe(true);

    const german = createWarState(G, "GE", "AU", "unification", ["bavaria"], 2);
    expect(warRequiresMandatoryCession(german)).toBe(false);

    const conquest = createWarState(G, "GE", "AU", "conquest", ["piedmont"], 2);
    expect(warRequiresMandatoryCession(conquest)).toBe(false);
  });
});
