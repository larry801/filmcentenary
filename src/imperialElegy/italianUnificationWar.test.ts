/**
 * Rule 13.2.1 — Italian wars of unification (printed p. 29, errata p. 29).
 *
 * "Any player with a diplomacy or ally marker with either Sardinia-Piedmont or
 * the Kingdom of the Two Sicilies may declare a war for Italian unification.
 * First, the attacking player must declare which Italian state they will give
 * any conquered land to … then the attacking player gains an alliance with
 * that power if they do not already have one.  Players target up to two
 * adjacent spaces that contain Italian nationality.  … If the attacking player
 * wins the war they must choose the territorial cession treaty option.
 * Additionally, if the attacking player wins, roll for Italian unification."
 *
 * The same file pins the other half of errata 13.4.4: the player that aids the
 * Qing in a war of conquest gains a +1 card marker regardless of the outcome,
 * including when Qing already had a player ally (the 13.4 defender).
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {declareWar, resolvePending, resolveWar} from "./moves";

const makeCtx = (dice: number | number[] = 3, playerID = "0"): Ctx => {
  const values = Array.isArray(dice) ? dice : [dice];
  let index = 0;
  return {
    playerID,
    random: {
      Die: () => values[Math.min(index++, values.length - 1)] ?? 3,
      Number: () => 1,
      Shuffle: (items: unknown[]) => items,
    },
    events: {
      setActivePlayers: () => undefined,
      setPhase: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());
const seat = (power: Power): string => String(POWERS.indexOf(power));

const beginAction = (G: ImperialElegyState, active: Power, cp = 12): void => {
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
  G.pending = null;
  G.war = null;
};

describe("13.2.1 Italian war of unification", () => {
  test("a player without an Italian marker cannot declare one", () => {
    const G = fresh();
    beginAction(G, "RU");
    expect(
      declareWar(G, makeCtx([1, 1], seat("RU")), "AU", "unification", ["lombardy"], 2, {
        italianBeneficiary: "Sardinia-Piedmont",
      }),
    ).toBe(INVALID_MOVE);
    expect(G.war).toBeNull();
  });

  test("a diplomacy marker with Sardinia-Piedmont opens the declaration and grants the alliance", () => {
    const G = fresh();
    beginAction(G, "FR");
    // Piedmont is S-P's home and still under its control; a diplomacy marker
    // is enough (13.2.1 says "diplomacy or ally marker").
    G.spaces.piedmont.diplomacy = "FR";

    expect(
      declareWar(G, makeCtx([1, 1], seat("FR")), "AU", "unification", ["lombardy"], 2, {
        italianBeneficiary: "Sardinia-Piedmont",
      }),
    ).toBeUndefined();
    expect(G.war?.italianBeneficiary).toBe("Sardinia-Piedmont");
    // "the attacking player gains an alliance with that power if they do not
    // already have one": the diplomacy marker is replaced by the ally marker.
    expect(G.spaces.piedmont.ally).toBe("FR");
    expect(G.spaces.piedmont.diplomacy).toBeNull();
  });

  test("the beneficiary must be Sardinia-Piedmont or the Two Sicilies", () => {
    const G = fresh();
    beginAction(G, "FR");
    G.spaces.piedmont.diplomacy = "FR";
    expect(
      declareWar(G, makeCtx([1, 1], seat("FR")), "AU", "unification", ["lombardy"], 2, {
        italianBeneficiary: "Tuscany",
      }),
    ).toBe(INVALID_MOVE);
    expect(G.war).toBeNull();
  });

  test("two targets must be adjacent Italian-nationality spaces", () => {
    const G = fresh();
    beginAction(G, "FR");
    G.spaces.piedmont.diplomacy = "FR";
    // Lombardy and Tuscany are adjacent.  Naples is not adjacent to Lombardy.
    G.spaces.lombardy.control = "AU";
    G.spaces.tuscany.control = "AU";
    G.spaces.naples.control = "AU";
    const ctx = makeCtx([1, 1], seat("FR"));
    expect(
      declareWar(G, ctx, "AU", "unification", ["lombardy", "naples"], 2, {
        italianBeneficiary: "Sardinia-Piedmont",
      }),
    ).toBe(INVALID_MOVE);
    expect(
      declareWar(G, ctx, "AU", "unification", ["lombardy", "tuscany"], 2, {
        italianBeneficiary: "Sardinia-Piedmont",
      }),
    ).toBeUndefined();
    expect(G.war?.objectives).toEqual(["lombardy", "tuscany"]);
  });

  test("a win must cede the objectives to the named Italian state", () => {
    const G = fresh();
    beginAction(G, "FR");
    G.spaces.piedmont.diplomacy = "FR";
    expect(
      declareWar(G, makeCtx([1, 1], seat("FR")), "AU", "unification", ["lombardy"], 2, {
        italianBeneficiary: "Sardinia-Piedmont",
      }),
    ).toBeUndefined();
    const war = G.war!;
    // The attacker controls the objective but the loser still owns it (13.3).
    G.spaces.lombardy.control = "AU";
    G.spaces.lombardy.occupiedBy = "FR";
    G.phase = "wartime";
    war.status = "victory";

    expect(
      resolveWar(G, makeCtx([1], seat("FR")), [{option: "territorialCession", spaces: ["lombardy"]}]),
    ).toBeUndefined();
    // A failed unification roll leaves the cession in S-P's hands.
    expect(G.spaces.lombardy.control).toBe("Sardinia-Piedmont");
    expect(G.spaces.lombardy.ally).toBe("FR");
    expect(G.persistent.italyUnified).toBeFalsy();
    expect(G.flags.italyUnificationMpitCp).toBeUndefined();
    expect(G.flags.italianUnificationRolledTurn).toBe(G.turn);
  });

  test("a successful roll unifies Italy and grants the 2 free MPIT CP", () => {
    const G = fresh();
    beginAction(G, "GE");
    G.spaces.piedmont.diplomacy = "GE";
    expect(
      declareWar(G, makeCtx([1, 1], seat("GE")), "AU", "unification", ["lombardy"], 2, {
        italianBeneficiary: "Sardinia-Piedmont",
      }),
    ).toBeUndefined();
    const war = G.war!;
    G.spaces.lombardy.control = "AU";
    G.spaces.lombardy.occupiedBy = "GE";
    G.phase = "wartime";
    war.status = "victory";

    expect(
      resolveWar(G, makeCtx([6], seat("GE")), [{option: "territorialCession", spaces: ["lombardy"]}]),
    ).toBeUndefined();
    expect(G.persistent.italyUnified).toBe(true);
    expect(G.flags.italyUnificationMpitCp).toBe(2);
    expect(G.flags.italyUnificationMpitCpPower).toBe("GE");
    expect(G.spaces.lombardy.control).toBe("IT");
  });
});

describe("13.4.4 errata: the aider of Qing China", () => {
  test("an existing player ally who joins the war gains the +1 card marker", () => {
    const G = fresh();
    beginAction(G, "GE");
    // Qing already has a player ally: 13.4 turns the declaration into a war on
    // the UK, and the UK's 13.4.1 answer is to fight for Qing.
    G.spaces.shanghai.ally = "UK";
    const before = G.powers.UK.cardMarkers;
    expect(
      declareWar(G, makeCtx([1, 1], seat("GE")), {minor: "Qing China"}, "conquest", ["shanghai"], 2),
    ).toBeUndefined();
    expect(G.pending?.kind).toBe("minorAbandon");
    expect(resolvePending(G, makeCtx(3, seat("UK")), "join")).toBeUndefined();
    expect(G.powers.UK.cardMarkers).toBe(before + 1);
    expect(
      G.log.some((entry) => entry.key === "qingAidCardMarker" && entry.args?.minor === "Qing China"),
    ).toBe(true);
  });

  test("an ally who abandons Qing does not gain the marker", () => {
    const G = fresh();
    beginAction(G, "GE");
    G.spaces.shanghai.ally = "UK";
    const before = G.powers.UK.cardMarkers;
    expect(
      declareWar(G, makeCtx([1, 1], seat("GE")), {minor: "Qing China"}, "conquest", ["shanghai"], 2),
    ).toBeUndefined();
    expect(resolvePending(G, makeCtx(3, seat("UK")), "abandon")).toBeUndefined();
    expect(G.powers.UK.cardMarkers).toBe(before);
  });
});
