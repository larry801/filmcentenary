/**
 * Rule 16.1.6 — Special: Ally Knockout, second half.
 *
 * "If a player lost a war but knocked out the winner's ally before the war
 * ended, the loser chooses their treaty option after the winner."
 *
 * Both sides' knockouts are recorded on `WarState.knockedOut`; the winner's
 * picks (primary outcome plus its own ally-knockout options) come first, then
 * the losing primary is asked for its mandatory option against the winner's
 * knocked-out ally.  Each treaty option can still be chosen only once per war
 * (16.2), so the printed order matters.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  applyTreaty,
  canApplyTreaty,
  classifyVictory,
  createWarState,
  settleLimitedWar,
} from "./engine/limitedWar";
import {treatyPickCounts} from "./engine/treatyChoice";
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

/**
 * GE wins a normal victory over AU while knocking FR (AU's ally) out of the
 * war; AU in turn knocked RU (GE's ally) out before the war ended.
 */
const buildWar = (G: ImperialElegyState, options: {loserKnockout?: boolean} = {}): WarState => {
  G.phase = "wartime";
  G.activePower = "GE";
  G.pending = null;
  // GE occupies its objective -> normal victory for the attacker.
  G.spaces.bohemia.control = "GE";
  G.spaces.bohemia.occupiedBy = null;
  // The winner's ally RU is knocked out by the losing side (AU).
  if (options.loserKnockout !== false) G.spaces["st-petersburg"].occupiedBy = "AU";
  // The loser's ally FR is knocked out by the winner.
  G.spaces.paris.occupiedBy = "GE";
  // A minor ally of the loser and one of the winner's knocked-out ally.
  G.spaces.hanover.ally = "AU";
  G.spaces.bavaria.ally = "FR";
  const war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
  war.attackerAllies = ["RU"];
  war.defenderAllies = ["FR"];
  war.budgets.RU = 3;
  war.budgets.FR = 3;
  G.war = war;
  return war;
};

const optionIds = (G: ImperialElegyState): string[] => (G.pending?.options ?? []).map((entry) => entry.id);

/** Finish the settlement after the treaty chooser: skip the 17.0 free actions. */
const finishSettlement = (G: ImperialElegyState, ctx: Ctx): void => {
  if (G.pending?.kind === "demobilizationFreeAction") {
    expect(declinePending(G, ctx)).toBeUndefined();
  }
};

// ---------------------------------------------------------------------------
// Classification and validation
// ---------------------------------------------------------------------------

describe("16.1.6 both sides' knockout options", () => {
  test("each side's knockout option is counted on its own side", () => {
    const G = fresh();
    const war = buildWar(G);
    const victory = classifyVictory(G, war);

    expect(victory.primary).toBe("normal");
    expect(victory.victor).toBe("attacker");
    expect(victory.winner).toBe("GE");
    expect(victory.loser).toBe("AU");
    // The winner's own knockout of FR and the loser's knockout of RU.
    expect(victory.allyKnockouts.map((entry) => entry.power).sort()).toEqual(["FR", "RU"]);
    expect(victory.treatyOptions).toBe(1);
    expect(victory.allyKnockoutTreatyOptions).toBe(1);
    expect(victory.totalTreatyOptions).toBe(2);
    expect(victory.loserTreatyOptions).toBe(1);
    expect(treatyPickCounts(victory)).toEqual({primary: 1, knockout: 1, loserKnockout: 1});
  });

  test("the losing side may impose a treaty option on the winner's knocked-out ally", () => {
    const G = fresh();
    const war = buildWar(G);
    const victory = classifyVictory(G, war);

    const check = canApplyTreaty(G, war, victory, {option: "warReparations", target: "RU"});
    expect(check.ok).toBe(true);
    expect(check.imposingSide).toBe("defender");
    expect(check.target).toBe("RU");

    const markers = G.powers.RU.cardMarkers;
    const applied = applyTreaty(G, war, victory, {option: "warReparations", target: "RU"});
    expect(applied.applied).toBe(true);
    expect(G.powers.RU.cardMarkers).toBe(markers - 1);
    expect(G.powers.AU.cardMarkers).toBe(1);
    expect(war.treaties).toEqual(["warReparations"]);
  });

  test("a target that was not knocked out is still rejected", () => {
    const G = fresh();
    const war = buildWar(G);
    const victory = classifyVictory(G, war);
    const check = canApplyTreaty(G, war, victory, {option: "warReparations", target: "OT"});
    expect(check.ok).toBe(false);
    expect(check.issues.map((issue) => issue.code)).toContain("not-a-target");
  });

  test("no loser stage when the loser knocked out nobody", () => {
    const G = fresh();
    const war = buildWar(G, {loserKnockout: false});
    const victory = classifyVictory(G, war);
    expect(victory.loserTreatyOptions).toBe(0);
    expect(treatyPickCounts(victory)).toEqual({primary: 1, knockout: 1, loserKnockout: 0});
  });
});

// ---------------------------------------------------------------------------
// Live settlement order
// ---------------------------------------------------------------------------

describe("16.1.6 the loser chooses after the winner", () => {
  test("the winner picks first and the loser is only asked afterwards", () => {
    const G = fresh();
    const war = buildWar(G);
    const ctx = makeCtx(seat("GE"));

    expect(resolveWar(G, ctx)).toBeUndefined();
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.context?.remainingLoserKnockout).toBe(1);
    expect(G.pending?.context?.stage).toBe("winner");
    // Only the winner's own knockout target is offered at this stage.
    expect(optionIds(G)).toContain("realignment#FR");
    expect(optionIds(G).some((id) => id.endsWith("#RU"))).toBe(false);
    // The winner has a mandatory knockout pick, so it cannot finish yet.
    expect(optionIds(G)).not.toContain("done");

    // Spend the winner's own knockout option on FR's minor ally.
    expect(resolvePending(G, ctx, "realignment#FR")).toBeUndefined();
    expect(G.spaces.bavaria.ally).toBe("GE");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.context?.remainingKnockout).toBe(0);
    // Only the optional primary pick is left, so `done` is back.
    expect(optionIds(G)).toContain("done");
    // The winner stops early; its primary pick is optional.
    expect(resolvePending(G, ctx, "done")).toBeUndefined();

    // Now the losing primary (AU) is asked, with its own knockout option.
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("AU");
    expect(G.pending?.context?.stage).toBe("loser");
    expect(G.pending?.context?.remainingLoserKnockout).toBe(1);
    expect(optionIds(G)).toContain("warReparations#RU");
    // The loser's knockout option is mandatory: no early finish.
    expect(optionIds(G)).not.toContain("done");
    // Already-chosen options are not offered again (16.2 once per war).
    expect(optionIds(G).some((id) => id.startsWith("realignment"))).toBe(false);

    const ruBefore = G.powers.RU.cardMarkers;
    expect(resolvePending(G, makeCtx(seat("AU")), "warReparations#RU")).toBeUndefined();
    expect(G.powers.RU.cardMarkers).toBe(ruBefore - 1);
    expect(G.powers.AU.cardMarkers).toBe(1);

    // Both sides' options are recorded and the war is settling.
    expect(G.wars.at(-1)?.treaties.sort()).toEqual(["realignment", "warReparations"]);
    expect(G.war).toBeNull();
    finishSettlement(G, makeCtx(seat("GE")));
  });

  test("the wrong seat cannot answer the losing side's option", () => {
    const G = fresh();
    buildWar(G);
    const ctx = makeCtx(seat("GE"));
    resolveWar(G, ctx);
    resolvePending(G, ctx, "realignment#FR");
    resolvePending(G, ctx, "done");
    expect(G.pending?.power).toBe("AU");
    expect(resolvePending(G, ctx, "warReparations#RU")).toBe(INVALID_MOVE);
    // The loser's own seat can.
    expect(resolvePending(G, makeCtx(seat("AU")), "warReparations#RU")).toBeUndefined();
  });

  test("stopping the winner's picks early still leaves the loser's option", () => {
    const G = fresh();
    buildWar(G);
    const ctx = makeCtx(seat("GE"));
    resolveWar(G, ctx);
    // Spend the winner's own knockout pick first, then finish the primary
    // picks early with `done`.
    expect(resolvePending(G, ctx, "realignment#FR")).toBeUndefined();
    expect(resolvePending(G, ctx, "done")).toBeUndefined();
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("AU");
    expect(G.pending?.context?.stage).toBe("loser");
  });

  test("an explicit settlement applies the winner's choices before the loser's", () => {
    const G = fresh();
    const war = buildWar(G);
    const victory = classifyVictory(G, war);
    // The caller lists the losing side's choice first; the engine must apply
    // the winner's pick first so the once-per-option rule is honoured.
    const settlement = settleLimitedWar(G, victory, [
      {option: "warReparations", target: "RU"},
      {option: "warReparations", target: "FR"},
    ]);
    expect(G.powers.FR.cardMarkers).toBe(-1);
    expect(G.powers.RU.cardMarkers).toBe(0);
    expect(settlement.treaties[0].target).toBe("FR");
    expect(settlement.treaties[0].applied).toBe(true);
    expect(settlement.treaties[1].applied).toBe(false);
    expect(settlement.ok).toBe(false);
    expect(settlement.issues).toContain("treaty-not-applied:warReparations");
  });
});
