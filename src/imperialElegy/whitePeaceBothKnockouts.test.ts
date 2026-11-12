/**
 * Rule 16.1.6 — a white peace with knockouts on both sides.
 *
 * "Regardless of the war's outcome, an ally knockout still occurs."  When the
 * primary war is a white peace but both sides knocked out an ally, there is no
 * winner and no primary loser: both sides still impose one mandatory treaty
 * option, each answered by the power that made the knockout.  The rulebook
 * prints no order for the two sides, so the live settlement negotiates it
 * (proposal, response, counter; 16.1.6) and falls back to the initiative order
 * for explicit/unattended play.
 * Only the knockout picks are offered; no primary-outcome option is awarded.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  classifyVictory,
  createWarState,
  settleLimitedWar,
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
 * GE attacks AU; neither side achieves a war aim (white peace).  The attacker
 * knocks out FR (AU's ally), the defender knocks out RU (GE's ally).
 */
const buildWhitePeace = (G: ImperialElegyState): WarState => {
  G.phase = "wartime";
  G.activePower = "GE";
  G.pending = null;
  G.spaces.bohemia.control = "AU";
  G.spaces.bohemia.occupiedBy = null;
  // GE knocks out FR and occupies Paris (a reparation requirement).
  G.spaces.paris.occupiedBy = "GE";
  // AU knocks out RU and occupies St Petersburg.
  G.spaces["st-petersburg"].occupiedBy = "AU";
  // One minor ally per knocked-out player, so realignment is legal for each.
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

describe("16.1.6 white peace with knockouts on both sides", () => {
  test("classification keeps both sides' picks without naming a winner", () => {
    const G = fresh();
    const war = buildWhitePeace(G);
    const victory = classifyVictory(G, war, {whitePeace: true});

    expect(victory.kind).toBe("allyKnockout");
    expect(victory.primary).toBe("whitePeace");
    expect(victory.victor).toBeNull();
    expect(victory.winner).toBeNull();
    expect(victory.loser).toBeNull();
    expect(victory.treatyOptions).toBe(0);
    expect(victory.allyKnockoutTreatyOptions).toBe(1);
    expect(victory.loserTreatyOptions).toBe(1);
    expect(victory.totalTreatyOptions).toBe(1);
    expect(treatyPickCounts(victory)).toEqual({primary: 0, knockout: 1, loserKnockout: 1});
    expect(victory.notes).toContain("allyKnockout:bothSides:initiativeFirst");

    const groups = treatyChooserGroups(war, victory);
    expect(groups).toEqual([
      {power: "GE", side: "attacker", primary: 0, targets: ["FR"]},
      {power: "AU", side: "defender", primary: 0, targets: ["RU"]},
    ]);
  });

  test("the live sequence asks the attacker's captor first, then the defender's", () => {
    const G = fresh();
    buildWhitePeace(G);
    const ctx = makeCtx(seat("GE"));
    G.flags.whitePeace = true;

    expect(resolveWar(G, ctx)).toBeUndefined();
    // 16.1.6: no printed chooser order, so the attacker picks the order first.
    expect(G.pending?.kind).toBe("whitePeaceOrder");
    expect(G.pending?.power).toBe("GE");
    expect(optionIds(G).sort()).toEqual(["attacker", "defender"]);
    expect(resolvePending(G, ctx, "attacker")).toBeUndefined();
    // The defender must agree to the proposed order.
    expect(G.pending?.kind).toBe("whitePeaceOrder");
    expect(G.pending?.power).toBe("AU");
    expect(G.pending?.context?.stage).toBe("respond");
    expect(resolvePending(G, makeCtx(seat("AU")), "accept")).toBeUndefined();
    // No primary victory: only knockout entries, and the mandatory pick has no
    // early "done".
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.context?.stage).toBe("winner");
    expect(G.pending?.context?.remainingPrimary).toBe(0);
    expect(G.pending?.context?.remainingKnockout).toBe(1);
    expect(G.pending?.context?.remainingLoserKnockout).toBe(1);
    expect(optionIds(G)).not.toContain("done");
    for (const option of G.pending?.options ?? []) {
      expect(["knockout"]).toContain(option.data?.pick);
    }

    expect(resolvePending(G, ctx, "realignment#FR")).toBeUndefined();
    expect(G.spaces.bavaria.ally).toBe("GE");
    // The defender's knockout is still mandatory.
    expect(G.pending?.power).toBe("AU");
    expect(G.pending?.context?.stage).toBe("loser");
    expect(optionIds(G)).toContain("warReparations#RU");
    expect(optionIds(G)).not.toContain("done");
    for (const option of G.pending?.options ?? []) {
      expect(["loserKnockout"]).toContain(option.data?.pick);
    }

    const ruBefore = G.powers.RU.cardMarkers;
    expect(resolvePending(G, makeCtx(seat("AU")), "warReparations#RU")).toBeUndefined();
    expect(G.powers.RU.cardMarkers).toBe(ruBefore - 1);
    expect(G.powers.AU.cardMarkers).toBe(1);
    expect(G.war).toBeNull();
    // A white peace exchanges one-turn truces.
    expect(G.wars.at(-1)).toMatchObject({victor: null, truceTurns: 1});
    expect(G.wars.at(-1)?.treaties.sort()).toEqual(["realignment", "warReparations"]);
    finishSettlement(G, makeCtx(seat("GE")));
  });

  test("the wrong seat cannot answer either side's knockout option", () => {
    const G = fresh();
    buildWhitePeace(G);
    const ge = makeCtx(seat("GE"));
    G.flags.whitePeace = true;
    resolveWar(G, ge);
    // The attacker's own order decision is private to it too.
    expect(G.pending?.kind).toBe("whitePeaceOrder");
    expect(resolvePending(G, makeCtx(seat("AU")), "attacker")).toBe(INVALID_MOVE);
    expect(resolvePending(G, ge, "attacker")).toBeUndefined();
    // Only the defender may answer the response stage.
    expect(G.pending?.power).toBe("AU");
    expect(resolvePending(G, ge, "accept")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx(seat("FR")), "accept")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx(seat("AU")), "accept")).toBeUndefined();
    expect(G.pending?.power).toBe("GE");
    expect(resolvePending(G, makeCtx(seat("AU")), "realignment#FR")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx(seat("FR")), "realignment#FR")).toBe(INVALID_MOVE);
    expect(G.pending?.power).toBe("GE");
  });

  test("explicit settleLimitedWar supports both sides' knockout choices", () => {
    const G = fresh();
    const war = buildWhitePeace(G);
    // Knockouts are historical from the live board even before `resolveWar`.
    const victory = classifyVictory(G, war, {whitePeace: true});
    // The caller lists the losing side's choice first; the engine must apply
    // the attacker's choice first so the once-per-option rule is honoured.
    const settlement = settleLimitedWar(G, victory, [
      {option: "warReparations", target: "RU"},
      {option: "realignment", minor: "Bavaria", target: "FR"},
    ]);

    expect(settlement.ok).toBe(true);
    expect(settlement.treaties.map((treaty) => treaty.target)).toEqual(["FR", "RU"]);
    expect(settlement.treaties.every((treaty) => treaty.applied)).toBe(true);
    expect(G.spaces.bavaria.ally).toBe("GE");
    // The attacker re-aligned Bavaria (no marker) and the defender took
    // reparations from RU (AU +1, RU -1).
    expect(G.powers.FR.cardMarkers).toBe(0);
    expect(G.powers.RU.cardMarkers).toBe(-1);
    expect(G.powers.AU.cardMarkers).toBe(1);
    expect(G.war).toBeNull();
    expect(G.wars.at(-1)).toMatchObject({victor: null, truceTurns: 1});
  });

  test("a knockout with no legal option left settles instead of deadlocking", () => {
    const G = fresh();
    const war = buildWhitePeace(G);
    // Every treaty option is already spent in this war.
    war.treaties = ["territorialCession", "realignment", "warReparations", "righteousDefense", "colonialCession"];
    const victory = classifyVictory(G, war, {whitePeace: true});
    expect(treatyPickCounts(victory)).toEqual({primary: 0, knockout: 1, loserKnockout: 1});

    G.flags.whitePeace = true;
    expect(resolveWar(G, makeCtx(seat("GE")))).toBeUndefined();
    expect(G.war).toBeNull();
    expect(G.wars.at(-1)).toMatchObject({victor: null, truceTurns: 1});
    // The war settled; only the 17.0 free actions remain.
    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    finishSettlement(G, makeCtx(seat("GE")));
  });
});
