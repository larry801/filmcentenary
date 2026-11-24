/**
 * Rules 15.6 / 16.1.6 — a unified Italy knocked out of a limited war.
 *
 * "Occupying the capital of a player who is not a primary belligerent
 * immediately knocks that player out of the war and grants the occupying player
 * a special treaty option during the victory step (see 16.1.6).  Italy can be
 * knocked out of a war if Rome is occupied, but minor powers are never knocked
 * out of a war."  Italy is a non-player major, so it never appears in
 * `war.knockedOut`; the captor still chooses one ordinary 16.2 option, which
 * can only be imposed on Italy.  These tests pin the live chooser and the
 * option restrictions that replace the former automatic "Rome goes to the
 * occupier" settlement.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  canApplyTreaty,
  classifyVictory,
  createWarState,
  recordWarKnockoutCapture,
  settleLimitedWar,
} from "./engine/limitedWar";
import {treatyOptionsFor, treatyPickCounts} from "./engine/treatyChoice";
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
    phase: "wartime",
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const italyState = (): ImperialElegyState => {
  const G = fresh();
  G.units = {};
  for (const state of Object.values(G.spaces)) state.units = [];
  G.persistent.italyUnified = true;
  G.flags.italyUnified = true;
  for (const space of ["piedmont", "lombardy", "tuscany", "naples", "rome"]) {
    G.spaces[space].control = "IT";
    G.spaces[space].occupiedBy = null;
    G.spaces[space].ally = null;
  }
  return G;
};

/**
 * GE attacks UK; Italy is the defender's non-player major ally and GE occupies
 * Rome, so the knockout is made by the attacking side (captor GE).
 */
const geAttacksUkWithItaly = (G: ImperialElegyState): WarState => {
  G.spaces.rome.occupiedBy = "GE";
  const war = createWarState(G, "GE", "UK", "conquest", ["london"], 2);
  war.status = "maneuver";
  war.initiative = ["GE", "UK", "FR"];
  war.defenderAllies = ["FR"];
  war.defenderMinors = ["Italy"];
  war.budgets.GE = 2;
  war.budgets.UK = 2;
  war.passed = ["GE", "UK", "FR"];
  G.war = war;
  G.phase = "wartime";
  G.activePower = "GE";
  G.pending = null;
  return war;
};

const optionIds = (G: ImperialElegyState): string[] => (G.pending?.options ?? []).map((entry) => entry.id);

describe("15.6 / 16.1.6 Italy is a knockout target, not an automatic cession", () => {
  test("classification counts one Italy pick and keeps Rome Italian until chosen", () => {
    const G = italyState();
    const war = geAttacksUkWithItaly(G);
    expect(recordWarKnockoutCapture(G, "rome", "GE")).toBeNull();

    const victory = classifyVictory(G, war);
    expect(victory.primary).toBe("whitePeace");
    expect(victory.kind).toBe("allyKnockout");
    expect(victory.italyKnockout).toMatchObject({power: "Italy", by: "attacker", captor: "GE"});
    expect(victory.winner).toBe("GE");
    expect(victory.loser).toBeNull();
    expect(victory.allyKnockoutTreatyOptions).toBe(1);
    expect(victory.totalTreatyOptions).toBe(1);
    expect(treatyPickCounts(victory)).toEqual({primary: 0, knockout: 1, loserKnockout: 0});
    expect(victory.notes).toContain("allyKnockout:Italy:attacker");
    // The old settlement ceded Rome immediately; classification must not.
    expect(G.spaces.rome.control).toBe("IT");
  });

  test("the live chooser offers territorial cession against Italy and requires the answer", () => {
    const G = italyState();
    const war = geAttacksUkWithItaly(G);
    recordWarKnockoutCapture(G, "rome", "GE");
    const ctx = makeCtx("0");

    expect(resolveWar(G, ctx)).toBeUndefined();
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.context?.stage).toBe("winner");
    expect(optionIds(G)).toContain("territorialCession#Italy");
    // 16.1.6's special option is mandatory.
    expect(optionIds(G)).not.toContain("done");
    expect(G.spaces.rome.control).toBe("IT");
    expect(G.log.some((entry) => entry.key === "italyKnockoutCession")).toBe(false);

    expect(resolvePending(G, ctx, "territorialCession#Italy")).toBeUndefined();
    expect(G.spaces.rome.control).toBe("GE");
    expect(G.log.some((entry) => entry.key === "italyKnockoutCession")).toBe(true);
  });

  test("only the captor's side and only the occupied Italian key are legal", () => {
    const G = italyState();
    const war = geAttacksUkWithItaly(G);
    recordWarKnockoutCapture(G, "rome", "GE");
    const victory = classifyVictory(G, war);

    expect(canApplyTreaty(G, war, victory, {option: "territorialCession", spaces: ["rome"], target: "Italy"}).ok)
      .toBe(true);
    // A war objective that Italy does not control is not a knockout cession.
    expect(canApplyTreaty(G, war, victory, {option: "territorialCession", spaces: ["brittany"], target: "Italy"}).ok)
      .toBe(false);
    // Italy is a non-player major: no reparations or colonial cession.
    expect(canApplyTreaty(G, war, victory, {option: "warReparations", target: "Italy"}).ok).toBe(false);
    expect(canApplyTreaty(G, war, victory, {option: "colonialCession", space: "rome", target: "Italy"}).ok)
      .toBe(false);
  });

  test("the full entry list contains the Italy pick and excludes player-only options", () => {
    const G = italyState();
    const war = geAttacksUkWithItaly(G);
    recordWarKnockoutCapture(G, "rome", "GE");
    const victory = classifyVictory(G, war);
    const entries = treatyOptionsFor(G, war, victory);

    const italy = entries.find((entry) => entry.id === "territorialCession#Italy");
    expect(italy).toMatchObject({pick: "knockout", target: "Italy", chooser: "GE"});
    expect(entries.some((entry) => entry.target === "Italy" && entry.option === "warReparations")).toBe(false);
    expect(entries.some((entry) => entry.target === "Italy" && entry.option === "colonialCession")).toBe(false);
  });

  test("a direct settlement with no Italy choice leaves Rome occupied", () => {
    const G = italyState();
    const war = geAttacksUkWithItaly(G);
    recordWarKnockoutCapture(G, "rome", "GE");
    const victory = classifyVictory(G, war);

    const settlement = settleLimitedWar(G, victory, []);
    expect(settlement.ok).toBe(true);
    expect(G.spaces.rome.control).toBe("IT");
    expect(G.log.some((entry) => entry.key === "italyKnockoutCession")).toBe(false);
  });

  test("Italy's pick is still chosen after the winner when the loser made the knockout", () => {
    const G = italyState();
    // UK attacks GE; Italy is UK's minor ally, but GE takes Rome.
    G.spaces.rome.occupiedBy = "GE";
    const war = createWarState(G, "UK", "GE", "conquest", ["brittany"], 2);
    war.status = "maneuver";
    war.initiative = ["UK", "FR", "GE"];
    war.attackerAllies = ["FR"];
    war.attackerMinors = ["Italy"];
    war.budgets.UK = 2;
    war.passed = ["UK", "FR", "GE"];
    G.war = war;
    G.phase = "wartime";
    G.activePower = "GE";
    G.pending = null;
    recordWarKnockoutCapture(G, "rome", "GE");

    const victory = classifyVictory(G, war);
    expect(victory.italyKnockout).toMatchObject({by: "defender", captor: "GE"});
    // Primary is UK's normal victory; the defender GE owes its Italy pick after
    // the winner's stage (16.1.6's "loser chooses after the winner").
    expect(victory.victor).toBe("attacker");
    expect(victory.loserTreatyOptions).toBe(1);

    const ctx = makeCtx("0");
    expect(resolveWar(G, ctx)).toBeUndefined();
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.context?.stage).toBe("loser");
    expect(optionIds(G)).toContain("territorialCession#Italy");
    expect(resolvePending(G, ctx, "territorialCession#Italy")).toBeUndefined();
    expect(G.spaces.rome.control).toBe("GE");
  });
});
