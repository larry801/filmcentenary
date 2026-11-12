/**
 * Rule 16.1.6 — chooser order for a white peace with a knockout on each side.
 *
 * "If a player lost a war but knocked out the winner's ally before the war
 * ended, the loser chooses their treaty option after the winner."  A white
 * peace with knockouts on both sides has no winner and no primary loser, and
 * the rulebook prints no order for the two mandatory knockout options.  The
 * live settlement negotiates it: the attacker proposes, the defender accepts or
 * counters, and the attacker accepts or lets the initiative order decide.
 * Declining the decision uses the initiative-order fallback so an unattended
 * war cannot stall.  Explicit `settleLimitedWar` callers keep the deterministic
 * attacker-first order.
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
  firstTreatySide,
  needsWhitePeaceOrderChoice,
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

/** GE attacks AU; the attacker knocks out FR and the defender knocks out RU. */
const buildTwoSidedKnockouts = (G: ImperialElegyState): WarState => {
  G.phase = "wartime";
  G.activePower = "GE";
  G.pending = null;
  G.spaces.bohemia.control = "AU";
  G.spaces.bohemia.occupiedBy = null;
  G.spaces.paris.occupiedBy = "GE";
  G.spaces["st-petersburg"].occupiedBy = "AU";
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

describe("16.1.6 white-peace chooser order", () => {
  test("the attacker may let the defender choose first", () => {
    const G = fresh();
    buildTwoSidedKnockouts(G);
    const ge = makeCtx(seat("GE"));
    G.flags.whitePeace = true;

    expect(resolveWar(G, ge)).toBeUndefined();
    expect(G.pending?.kind).toBe("whitePeaceOrder");
    expect(G.pending?.power).toBe("GE");
    expect(optionIds(G).sort()).toEqual(["attacker", "defender"]);
    // The war has not been settled yet: no outcome or treaty pick applied.
    expect(G.war?.status).not.toBe("victory");
    expect(G.flags.whitePeace).toBe(true);

    expect(resolvePending(G, ge, "defender")).toBeUndefined();
    // The defender must accept the proposed order; it is not the attacker's
    // unilateral choice.
    expect(G.pending?.kind).toBe("whitePeaceOrder");
    expect(G.pending?.power).toBe("AU");
    expect(G.pending?.context?.stage).toBe("respond");
    expect(G.pending?.context?.proposed).toBe("defender");
    expect(optionIds(G)).toEqual(["accept", "counter"]);
    expect(resolvePending(G, makeCtx(seat("AU")), "accept")).toBeUndefined();

    // The defender's knockout captor answers first, then the attacker's.
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("AU");
    expect(G.pending?.context?.stage).toBe("winner");
    expect(optionIds(G)).toContain("realignment#RU");
    expect(optionIds(G).some((id) => id.endsWith("#FR"))).toBe(false);

    expect(resolvePending(G, makeCtx(seat("AU")), "realignment#RU")).toBeUndefined();
    // The defender realigns RU's minor (Saxony), not the attacker's (Bavaria).
    expect(G.spaces.saxony.ally).toBe("AU");
    expect(G.spaces.bavaria.ally).toBe("FR");
    // The attacker's group follows with its own mandatory knockout option.
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.context?.stage).toBe("loser");
    expect(optionIds(G)).toContain("warReparations#FR");

    const frBefore = G.powers.FR.cardMarkers;
    expect(resolvePending(G, ge, "warReparations#FR")).toBeUndefined();
    expect(G.powers.FR.cardMarkers).toBe(frBefore - 1);
    expect(G.powers.GE.cardMarkers).toBe(1);
    expect(G.war).toBeNull();
    expect(G.wars.at(-1)?.treaties.sort()).toEqual(["realignment", "warReparations"]);
    finishSettlement(G, ge);
  });

  test("the defender may counter, and the attacker then accepts or lets initiative decide", () => {
    const G = fresh();
    const war = buildTwoSidedKnockouts(G);
    // Give the defender the initiative so the unresolved fallback is not the
    // attacker by accident.
    war.initiative = ["AU", "GE"];
    const ge = makeCtx(seat("GE"));
    G.flags.whitePeace = true;

    resolveWar(G, ge);
    expect(G.pending?.context?.stage).toBe("propose");
    expect(resolvePending(G, ge, "attacker")).toBeUndefined();
    // The defender rejects the attacker-first proposal and counters.
    expect(G.pending?.power).toBe("AU");
    expect(resolvePending(G, makeCtx(seat("AU")), "counter")).toBeUndefined();
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.context?.stage).toBe("confirm");
    expect(G.pending?.context?.proposed).toBe("defender");

    // Rejecting the counter falls back to initiative order (AU/defender first)
    // rather than letting either player impose the order.
    expect(resolvePending(G, ge, "decline")).toBeUndefined();
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("AU");
    expect(G.pending?.context?.stage).toBe("winner");
    finishSettlement(G, makeCtx(seat("GE")));
  });

  test("the attacker may accept the defender's counter", () => {
    const G = fresh();
    buildTwoSidedKnockouts(G);
    const ge = makeCtx(seat("GE"));
    G.flags.whitePeace = true;

    resolveWar(G, ge);
    expect(resolvePending(G, ge, "attacker")).toBeUndefined();
    expect(resolvePending(G, makeCtx(seat("AU")), "counter")).toBeUndefined();
    expect(resolvePending(G, ge, "accept")).toBeUndefined();
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("AU");
    expect(G.pending?.context?.stage).toBe("winner");
    finishSettlement(G, makeCtx(seat("GE")));
  });

  test("declining the order decision keeps the deterministic attacker-first fallback", () => {
    const G = fresh();
    buildTwoSidedKnockouts(G);
    const ge = makeCtx(seat("GE"));
    G.flags.whitePeace = true;

    resolveWar(G, ge);
    expect(G.pending?.kind).toBe("whitePeaceOrder");
    expect(declinePending(G, ge)).toBeUndefined();

    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.context?.stage).toBe("winner");
    expect(optionIds(G)).toContain("realignment#FR");
    expect(resolvePending(G, ge, "realignment#FR")).toBeUndefined();
    expect(G.pending?.power).toBe("AU");
    expect(G.pending?.context?.stage).toBe("loser");
    expect(optionIds(G)).toContain("warReparations#RU");
    expect(resolvePending(G, makeCtx(seat("AU")), "warReparations#RU")).toBeUndefined();
    expect(G.war).toBeNull();
    finishSettlement(G, ge);
  });

  test("only the order chooser may answer, and only its two printed options", () => {
    const G = fresh();
    buildTwoSidedKnockouts(G);
    const ge = makeCtx(seat("GE"));
    G.flags.whitePeace = true;
    resolveWar(G, ge);

    expect(resolvePending(G, makeCtx(seat("AU")), "attacker")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx(seat("FR")), "defender")).toBe(INVALID_MOVE);
    // Neither an unrelated id nor a treaty option consumes the decision.
    expect(resolvePending(G, ge, "neutral")).toBe(INVALID_MOVE);
    expect(resolvePending(G, ge, "realignment#FR")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("whitePeaceOrder");
    expect(G.pending?.power).toBe("GE");
  });

  test("the order decision is private to the attacker's seat", () => {
    const G = fresh();
    buildTwoSidedKnockouts(G);
    const ge = makeCtx(seat("GE"));
    G.flags.whitePeace = true;
    resolveWar(G, ge);
    expect(G.pending?.kind).toBe("whitePeaceOrder");

    const own = redactForView(G, seat("GE"), ge);
    expect(own.pending?.options.map((entry) => entry.id).sort()).toEqual(["attacker", "defender"]);
    expect(own.pending?.context?.victory).toBeDefined();

    const other = redactForView(G, seat("AU"), ge);
    expect(other.pending?.options).toEqual([]);
    expect(other.pending?.context).toEqual({});
    expect(other.pending?.promptArgs).toEqual({});
  });

  test("the chosen first side swaps the pick counts and chooser groups", () => {
    const G = fresh();
    const war = buildTwoSidedKnockouts(G);
    const victory = classifyVictory(G, war, {whitePeace: true});
    expect(needsWhitePeaceOrderChoice(victory)).toBe(true);
    expect(firstTreatySide(victory)).toBe("attacker");
    expect(treatyPickCounts(victory)).toEqual({primary: 0, knockout: 1, loserKnockout: 1});
    expect(treatyChooserGroups(war, victory).map((group) => `${group.power}:${group.side}`)).toEqual([
      "GE:attacker",
      "AU:defender",
    ]);

    const defenderFirst = {...victory, firstSide: "defender" as const};
    expect(firstTreatySide(defenderFirst)).toBe("defender");
    expect(treatyPickCounts(defenderFirst)).toEqual({primary: 0, knockout: 1, loserKnockout: 1});
    expect(treatyChooserGroups(war, defenderFirst).map((group) => `${group.power}:${group.side}`)).toEqual([
      "AU:defender",
      "GE:attacker",
    ]);
  });

  test("a one-sided knockout white peace needs no order decision", () => {
    const G = fresh();
    buildTwoSidedKnockouts(G);
    // Only the attacker knocked an ally out; the defender's capture is undone.
    G.spaces["st-petersburg"].occupiedBy = null;
    const ge = makeCtx(seat("GE"));
    G.flags.whitePeace = true;

    const victory = classifyVictory(G, G.war!, {whitePeace: true});
    expect(needsWhitePeaceOrderChoice(victory)).toBe(false);

    expect(resolveWar(G, ge)).toBeUndefined();
    // The single captor's mandatory pick opens directly (16.1.6).
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("GE");
    expect(optionIds(G)).toContain("realignment");
  });

  test("explicit settleLimitedWar keeps applying the attacker's choices first", () => {
    const G = fresh();
    const war = buildTwoSidedKnockouts(G);
    const victory = classifyVictory(G, war, {whitePeace: true});
    expect(firstTreatySide(victory)).toBe("attacker");
    // The caller lists the defender's choice first; the engine still applies
    // the attacker's first so the once-per-option rule is honoured.
    const settlement = settleLimitedWar(G, victory, [
      {option: "warReparations", target: "RU"},
      {option: "realignment", minor: "Bavaria", target: "FR"},
    ]);
    expect(settlement.ok).toBe(true);
    expect(settlement.treaties.map((treaty) => treaty.target)).toEqual(["FR", "RU"]);
    expect(G.spaces.bavaria.ally).toBe("GE");
    expect(G.powers.FR.cardMarkers).toBe(0);
    expect(G.powers.RU.cardMarkers).toBe(-1);
    expect(G.powers.AU.cardMarkers).toBe(1);
  });
});
