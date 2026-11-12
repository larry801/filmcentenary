/**
 * Rules 16.1.6 / 16.2 — multi-ally treaty allocation and ally-knockout target.
 *
 * Rule 16.2: "If multiple players are on the winning side, the primary
 * belligerent has the final say on who gets what during the victory step.
 * Spaces and war reparations may be awarded to any of the victorious player's
 * allies".  Rule 16.1.6: an ally-knockout treaty option "can only be imposed
 * upon the power that was knocked out of the war".
 */

import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, Power, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  applyTreaty,
  canApplyTreaty,
  classifyVictory,
  createWarState,
} from "./engine/limitedWar";
import {treatyOptionsFor} from "./engine/treatyChoice";
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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/** GE attacks AU over Bohemia; GE wins a normal or major victory. */
const buildWar = (
  G: ImperialElegyState,
  options: {major?: boolean; objectives?: string[]} = {},
): WarState => {
  const objectives = options.objectives ?? ["bohemia"];
  G.phase = "wartime";
  G.activePower = "GE";
  G.pending = null;
  G.spaces.bohemia.control = "AU";
  G.spaces.bohemia.occupiedBy = "GE";
  if (options.major) G.spaces.vienna.occupiedBy = "GE";
  const war = createWarState(G, "GE", "AU", "conquest", objectives, 2);
  G.war = war;
  return war;
};

const optionIds = (G: ImperialElegyState): string[] => G.pending!.options.map((option) => option.id);

/** Finish the settlement after the treaty chooser: skip the 17.0 free actions. */
const finishSettlement = (G: ImperialElegyState, ctx: Ctx): void => {
  if (G.pending?.kind === "demobilizationFreeAction") {
    expect(declinePending(G, ctx)).toBeUndefined();
  }
};

describe("16.2 multi-ally treaty allocation", () => {
  test("territory and reparations are offered to the primary and participating allies", () => {
    const G = fresh();
    const war = buildWar(G, {major: true});
    war.attackerAllies = ["FR"];
    war.budgets.FR = 3;
    G.spaces.canada.control = "AU";
    G.spaces.hanover.ally = "AU";
    const victory = classifyVictory(G, war);
    expect(victory.kind).toBe("major");

    const entries = treatyOptionsFor(G, war, victory);
    const ids = entries.map((entry) => entry.id);
    expect(ids).toContain("territorialCession");
    expect(ids).toContain("territorialCession@FR");
    expect(ids).toContain("warReparations");
    expect(ids).toContain("warReparations@FR");
    // Rule 16.2 only lets spaces and reparations go to allies.
    expect(ids).toContain("realignment");
    expect(ids).not.toContain("realignment@FR");
    expect(ids).toContain("colonialCession");
    expect(ids).not.toContain("colonialCession@FR");

    const allyCession = entries.find((entry) => entry.id === "territorialCession@FR")!;
    expect(allyCession.beneficiary).toBe("FR");
    expect(allyCession.beneficiaries).toEqual(["GE", "FR"]);
    expect(allyCession.requiresBeneficiary).toBe(true);
    expect(allyCession.choice).toMatchObject({option: "territorialCession", beneficiary: "FR"});
  });

  test("the live chooser applies a cession to the chosen ally", () => {
    const G = fresh();
    const war = buildWar(G, {major: true});
    war.attackerAllies = ["FR"];
    war.budgets.FR = 3;
    const ctx = makeCtx("0");

    expect(resolveWar(G, ctx)).toBeUndefined();
    expect(G.pending?.kind).toBe("treatyOption");
    expect(optionIds(G)).toEqual(expect.arrayContaining(["territorialCession", "territorialCession@FR"]));

    expect(resolvePending(G, ctx, "territorialCession@FR")).toBeUndefined();
    expect(G.spaces.bohemia.control).toBe("FR");
    expect(G.spaces.bohemia.occupiedBy).toBeNull();
    expect(G.war!.treaties).toContain("territorialCession");

    // Rule 16.2: the option is used once per war, so no beneficiary variant
    // survives into the second pick.
    expect(G.pending?.kind).toBe("treatyOption");
    expect(optionIds(G).some((id) => id.startsWith("territorialCession"))).toBe(false);

    expect(resolvePending(G, ctx, "done")).toBeUndefined();
    finishSettlement(G, ctx);
    expect(G.war).toBeNull();
  });

  test("reparations awarded to an ally move the markers to the ally", () => {
    const G = fresh();
    const war = buildWar(G, {major: true});
    war.attackerAllies = ["FR"];
    war.budgets.FR = 3;
    const ctx = makeCtx("0");

    expect(resolveWar(G, ctx)).toBeUndefined();
    const frBefore = G.powers.FR.cardMarkers;
    const auBefore = G.powers.AU.cardMarkers;
    expect(resolvePending(G, ctx, "warReparations@FR")).toBeUndefined();
    expect(G.powers.FR.cardMarkers).toBe(frBefore + 1);
    expect(G.powers.AU.cardMarkers).toBe(auBefore - 1);
    expect(G.powers.GE.cardMarkers).toBe(0);
  });

  test("invalid beneficiaries are rejected without mutating the board", () => {
    const G = fresh();
    const war = buildWar(G, {major: true});
    war.attackerAllies = ["FR"];
    G.spaces.hanover.ally = "AU";
    const victory = classifyVictory(G, war);

    const neutral = canApplyTreaty(G, war, victory, {
      option: "territorialCession",
      spaces: ["bohemia"],
      beneficiary: "RU",
    });
    expect(neutral.ok).toBe(false);
    expect(neutral.issues.map((issue) => issue.code)).toContain("beneficiary-not-victorious");

    const allyRealignment = canApplyTreaty(G, war, victory, {
      option: "realignment",
      minor: "Hanover",
      beneficiary: "FR",
    });
    expect(allyRealignment.ok).toBe(false);
    expect(allyRealignment.issues.map((issue) => issue.code)).toContain("beneficiary-must-be-primary");

    const before = JSON.stringify({bohemia: G.spaces.bohemia, treaties: war.treaties, markers: G.powers.FR.cardMarkers});
    const applied = applyTreaty(G, war, victory, {
      option: "territorialCession",
      spaces: ["bohemia"],
      beneficiary: "RU",
    });
    expect(applied.applied).toBe(false);
    expect(JSON.stringify({bohemia: G.spaces.bohemia, treaties: war.treaties, markers: G.powers.FR.cardMarkers})).toBe(before);
  });
});

describe("16.1.6 ally-knockout target chooser", () => {
  /** GE wins a normal victory while knocking FR and RU out of the war. */
  const buildKnockoutWar = (G: ImperialElegyState): WarState => {
    G.phase = "wartime";
    G.activePower = "GE";
    G.pending = null;
    G.spaces.bohemia.control = "GE";
    G.spaces.bohemia.occupiedBy = null;
    G.spaces.canada.control = "AU";
    G.spaces.hungary.occupiedBy = "GE";
    G.spaces.paris.occupiedBy = "GE";
    G.spaces["st-petersburg"].occupiedBy = "GE";
    // One minor allied to each treaty target.
    G.spaces.hanover.ally = "AU";
    G.spaces.bavaria.ally = "FR";
    G.spaces.saxony.ally = "RU";
    const war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
    war.defenderAllies = ["FR", "RU"];
    war.defenderAllies.forEach((ally) => {
      war.budgets[ally] = 3;
    });
    G.war = war;
    return war;
  };

  test("several knocked-out allies each appear as a distinct target", () => {
    const G = fresh();
    const war = buildKnockoutWar(G);
    const victory = classifyVictory(G, war);
    expect(victory.allyKnockouts.map((knockout) => knockout.power).sort()).toEqual(["FR", "RU"]);
    expect(victory.treatyOptions).toBe(1);
    expect(victory.allyKnockoutTreatyOptions).toBe(2);

    const entries = treatyOptionsFor(G, war, victory);
    const ids = entries.map((entry) => entry.id);
    expect(ids).toContain("warReparations");
    expect(ids).toContain("warReparations#FR");
    expect(ids).toContain("warReparations#RU");
    expect(ids).toContain("realignment#FR");
    expect(ids).toContain("realignment#RU");

    const frEntry = entries.find((entry) => entry.id === "warReparations#FR")!;
    expect(frEntry.pick).toBe("knockout");
    expect(frEntry.target).toBe("FR");
    expect(frEntry.knockoutTargets.sort()).toEqual(["FR", "RU"]);
    expect(frEntry.choice).toMatchObject({option: "warReparations", target: "FR"});
  });

  test("the chooser requires the knockout picks and applies them to the chosen targets", () => {
    const G = fresh();
    buildKnockoutWar(G);
    const ctx = makeCtx("0");
    expect(resolveWar(G, ctx)).toBeUndefined();
    expect(G.pending?.kind).toBe("treatyOption");
    // Mandatory knockout options mean the winner cannot simply finish.
    expect(optionIds(G)).not.toContain("done");
    expect((G.pending?.context?.knockoutTargets as string[]).sort()).toEqual(["FR", "RU"]);
    expect(G.pending?.context?.remainingKnockout).toBe(2);

    const frBefore = G.powers.FR.cardMarkers;
    expect(resolvePending(G, ctx, "warReparations#FR")).toBeUndefined();
    expect(G.powers.FR.cardMarkers).toBe(frBefore - 1);
    expect(G.powers.GE.cardMarkers).toBe(1);
    expect(G.war!.treaties).toEqual(["warReparations"]);
    // The reparations option is spent for every target, but the RU knockout
    // pick is still outstanding.
    expect(optionIds(G).some((id) => id.startsWith("warReparations"))).toBe(false);
    expect(optionIds(G)).not.toContain("done");
    expect(G.pending?.context?.remainingKnockout).toBe(1);

    expect(resolvePending(G, ctx, "realignment#RU")).toBeUndefined();
    expect(G.spaces.saxony.ally).toBe("GE");
    // Only the primary pick is left, so the optional `done` is back.
    expect(G.pending?.context?.remainingKnockout).toBe(0);
    expect(optionIds(G)).toContain("done");
    expect(resolvePending(G, ctx, "done")).toBeUndefined();
    finishSettlement(G, ctx);
    expect(G.war).toBeNull();
  });

  test("a target that was not knocked out is rejected", () => {
    const G = fresh();
    const war = buildKnockoutWar(G);
    const victory = classifyVictory(G, war);
    const invalid = canApplyTreaty(G, war, victory, {
      option: "warReparations",
      target: "OT",
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.issues.map((issue) => issue.code)).toContain("not-a-target");
    const before = JSON.stringify({markers: G.powers.OT.cardMarkers, treaties: war.treaties});
    expect(applyTreaty(G, war, victory, {option: "warReparations", target: "OT"}).applied).toBe(false);
    expect(JSON.stringify({markers: G.powers.OT.cardMarkers, treaties: war.treaties})).toBe(before);
  });

  test("a knockout-only victory's single pick is a mandatory knockout option", () => {
    const G = fresh();
    G.phase = "wartime";
    G.activePower = "GE";
    G.pending = null;
    G.spaces.paris.occupiedBy = "GE";
    G.spaces.bohemia.control = "AU";
    G.spaces.bohemia.occupiedBy = null;
    const war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
    war.defenderAllies = ["FR"];
    war.budgets.FR = 3;
    G.war = war;
    const victory = classifyVictory(G, war);
    expect(victory.kind).toBe("allyKnockout");
    expect(victory.primary).toBe("whitePeace");
    expect(victory.winner).toBe("GE");
    expect(victory.loser).toBe("FR");

    const ctx = makeCtx("0");
    expect(resolveWar(G, ctx)).toBeUndefined();
    expect(G.pending?.kind).toBe("treatyOption");
    expect(optionIds(G)).not.toContain("done");
    expect(G.pending?.context?.remainingPrimary).toBe(0);
    expect(G.pending?.context?.remainingKnockout).toBe(1);
    const entry = G.pending!.options.find((option) => option.id === "warReparations")!;
    expect(entry.data).toMatchObject({pick: "knockout", target: "FR"});

    expect(resolvePending(G, ctx, "warReparations")).toBeUndefined();
    // The only knockout pick was spent, so the settlement demobilized.
    expect(G.wars[0].treaties).toContain("warReparations");
    expect(G.powers.FR.cardMarkers).toBe(-1);
    finishSettlement(G, ctx);
    expect(G.war).toBeNull();
  });
});
