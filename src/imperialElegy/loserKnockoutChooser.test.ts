/**
 * Rule 16.1.6 — who chooses the losing side's knockout treaty option.
 *
 * "If a player lost a war but knocked out the winner's ally before the war
 * ended, the loser chooses their treaty option after the winner."  The power
 * that actually made the knockout is recorded on `war.knockedOut[].captor`, and
 * the losing side's stage is answered by that power — not automatically by the
 * losing primary.  A knockout made by an ally of the losing primary therefore
 * gives that ally its own mandatory `treatyOption` decision after the winner's
 * picks; the winner keeps the final say over its own side's knockouts (16.2).
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {redactForView} from "./engine/privacy";
import {
  classifyVictory,
  createWarState,
  recordWarKnockoutCapture,
  recordWarKnockouts,
} from "./engine/limitedWar";
import {treatyChooserGroups, treatyPickCounts} from "./engine/treatyChoice";
import {declinePending, resolvePending, resolveWar} from "./moves";

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
const optionIds = (G: ImperialElegyState): string[] => (G.pending?.options ?? []).map((entry) => entry.id);

const finishSettlement = (G: ImperialElegyState, ctx: Ctx): void => {
  if (G.pending?.kind === "demobilizationFreeAction") {
    expect(declinePending(G, ctx)).toBeUndefined();
  }
};

/**
 * GE wins a normal victory over AU.  AU's ally FR knocks out GE's ally RU
 * (`captor` FR); GE knocks out AU's ally FR (captor GE).
 */
const buildWar = (
  G: ImperialElegyState,
  options: {winnerCaptor?: Power} = {},
): WarState => {
  G.phase = "wartime";
  G.activePower = "GE";
  G.pending = null;
  G.spaces.bohemia.control = "GE";
  G.spaces.bohemia.occupiedBy = null;
  // RU (the winner's ally) falls to FR, an ally of the losing primary AU.
  G.spaces["st-petersburg"].occupiedBy = "FR";
  // FR (the loser's ally) falls to the winner's side.
  G.spaces.paris.occupiedBy = options.winnerCaptor ?? "GE";
  // One minor ally per treaty target.
  G.spaces.hanover.ally = "AU";
  G.spaces.bavaria.ally = "FR";
  G.spaces.saxony.ally = "RU";
  const war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
  war.attackerAllies = ["RU"];
  war.defenderAllies = ["FR"];
  war.budgets.RU = 3;
  war.budgets.FR = 3;
  G.war = war;
  return war;
};

describe("16.1.6 knockout captor records", () => {
  test("the safety net records the ally that actually occupied the capital", () => {
    const G = fresh();
    buildWar(G);
    recordWarKnockouts(G);
    const victory = classifyVictory(G, G.war!);
    const ru = victory.allyKnockouts.find((knockout) => knockout.power === "RU")!;
    const fr = victory.allyKnockouts.find((knockout) => knockout.power === "FR")!;
    expect(ru).toMatchObject({by: "defender", occupier: "AU", captor: "FR"});
    expect(fr).toMatchObject({by: "attacker", occupier: "GE", captor: "GE"});
    expect(G.war!.knockedOut?.find((record) => record.power === "RU")?.captor).toBe("FR");
  });

  test("the capture hook stores the capturing ally, not the side primary", () => {
    const G = fresh();
    const war = buildWar(G);
    // GE's ally RU takes the FR capital: the knockout belongs to RU.
    G.spaces.paris.control = "FR";
    G.spaces.paris.occupiedBy = "RU";
    expect(recordWarKnockoutCapture(G, "paris", "RU")).toMatchObject({
      power: "FR",
      by: "attacker",
      occupier: "GE",
      captor: "RU",
    });
    expect(war.knockedOut?.find((record) => record.power === "FR")?.captor).toBe("RU");
  });

  test("a pre-captor save falls back to the live occupier", () => {
    const G = fresh();
    const war = buildWar(G);
    // Simulate an old save: a record with no `captor` field.
    war.knockedOut = [{power: "RU", by: "defender", occupier: "AU", capital: "st-petersburg", turn: 1}];
    const victory = classifyVictory(G, war);
    expect(victory.allyKnockouts.find((knockout) => knockout.power === "RU")?.captor).toBe("FR");
  });
});

describe("16.1.6 losing-side chooser", () => {
  test("the captor group, not the losing primary, answers the loser stage", () => {
    const G = fresh();
    const war = buildWar(G);
    const victory = classifyVictory(G, war);
    const counts = treatyPickCounts(victory);
    expect(counts).toEqual({primary: 1, knockout: 1, loserKnockout: 1});
    const groups = treatyChooserGroups(war, victory);
    expect(groups.map((group) => `${group.power}:${group.side}`)).toEqual(["GE:attacker", "FR:defender"]);
    expect(groups[1].targets).toEqual(["RU"]);
  });

  test("the winner picks first, then the losing ally who made the knockout", () => {
    const G = fresh();
    buildWar(G);
    const ctx = makeCtx(seat("GE"));

    expect(resolveWar(G, ctx)).toBeUndefined();
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.context?.stage).toBe("winner");
    expect(optionIds(G)).toContain("realignment#FR");
    expect(optionIds(G).some((id) => id.endsWith("#RU"))).toBe(false);

    // Spend the winner's own knockout pick, then finish its optional primary
    // pick early.
    expect(resolvePending(G, ctx, "realignment#FR")).toBeUndefined();
    expect(G.spaces.bavaria.ally).toBe("GE");
    expect(resolvePending(G, ctx, "done")).toBeUndefined();

    // The loser stage belongs to FR (the power that knocked RU out), not to
    // the losing primary AU.
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("FR");
    expect(G.pending?.context?.stage).toBe("loser");
    expect(optionIds(G)).toContain("warReparations#RU");
    expect(optionIds(G)).not.toContain("done");
  });

  test("only the knockout captor may answer the loser stage", () => {
    const G = fresh();
    buildWar(G);
    const ge = makeCtx(seat("GE"));
    resolveWar(G, ge);
    resolvePending(G, ge, "realignment#FR");
    resolvePending(G, ge, "done");
    expect(G.pending?.power).toBe("FR");

    // The losing primary AU and the winner cannot answer it.
    expect(resolvePending(G, makeCtx(seat("AU")), "warReparations#RU")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx(seat("GE")), "warReparations#RU")).toBe(INVALID_MOVE);
    expect(G.pending?.power).toBe("FR");

    const ruBefore = G.powers.RU.cardMarkers;
    expect(resolvePending(G, makeCtx(seat("FR")), "warReparations#RU")).toBeUndefined();
    expect(G.powers.RU.cardMarkers).toBe(ruBefore - 1);
    // The reparation goes to FR's side primary (AU) by default.
    expect(G.powers.AU.cardMarkers).toBe(1);
    expect(G.war).toBeNull();
    finishSettlement(G, makeCtx(seat("GE")));
  });

  test("the losing ally's chooser is private to that ally", () => {
    const G = fresh();
    buildWar(G);
    const ge = makeCtx(seat("GE"));
    resolveWar(G, ge);
    resolvePending(G, ge, "realignment#FR");
    resolvePending(G, ge, "done");
    expect(G.pending?.power).toBe("FR");

    // The losing primary cannot see the ally's options or context.
    const auView = redactForView(G, seat("AU"));
    expect(auView.pending?.kind).toBe("treatyOption");
    expect(auView.pending?.power).toBe("FR");
    expect(auView.pending?.options).toEqual([]);
    expect(auView.pending?.context).toEqual({});
    // The deciding ally keeps them.
    const frView = redactForView(G, seat("FR"));
    expect(frView.pending?.options.map((entry) => entry.id)).toContain("warReparations#RU");
    expect(frView.pending?.context?.stage).toBe("loser");
  });

  test("the winner primary still answers for its own side when an ally made the knockout", () => {
    const G = fresh();
    buildWar(G, {winnerCaptor: "RU"});
    const victory = classifyVictory(G, G.war!);
    expect(victory.allyKnockouts.find((knockout) => knockout.power === "FR")?.captor).toBe("RU");
    const groups = treatyChooserGroups(G.war!, victory);
    // 16.2: "the primary belligerent has the final say" over its own side.
    expect(groups[0]).toMatchObject({power: "GE", side: "attacker", targets: ["FR"]});

    expect(resolveWar(G, makeCtx(seat("GE")))).toBeUndefined();
    expect(G.pending?.power).toBe("GE");
  });
});
