/**
 * The three remaining "declare war using this card's CP value" home cards.
 *
 * Errata 12.17 funds the declaration from the card rather than from impulse
 * CP.  Each card also prints its own target/aim limits:
 *
 *   FR-6 Aux Armes, Citoyens! — aims open; conquest may target two keys or
 *                               two different powers, and either choice lets
 *                               neutral powers join the defending side.
 *   RU-9 Russo-Turkish Wars   — only the Ottomans; liberation may reach
 *                               non-rebellious Balkan spaces; conquest skips
 *                               the WTT/stability penalty.
 *   OT-12 Jihad               — Russia or an Ottoman-home controller (a Russian
 *                               minor ally counts as Russia); conquest skips
 *                               the WTT/stability penalty.
 *
 * The tests drive the real event handlers through `playCard` and the real
 * `declareWar` move, matching `bismarckWar.test.ts`.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, SpaceId} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  applyVictoryOutcome,
  classifyVictory,
  createWarState,
  joinWarAsNeutral as applyNeutralJoin,
  warBudgetFor,
} from "./engine/limitedWar";
import {
  AUX_ARMES_HOME_CARD,
  JIHAD_HOME_CARD,
  RUSSO_TURKISH_WARS_HOME_CARD,
  warDeclarationEntitlement,
} from "./engine/rules";
import {declareWar, joinWarAsNeutral, playCard, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 5,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/** A power's action impulse with its home card in hand, as the board deals it. */
const homeImpulse = (power: Power, card: string): ImperialElegyState => {
  const G = fresh();
  G.phase = "action";
  G.activePower = power;
  G.turn = 5;
  G.powers[power].hand = [card];
  G.powers[power].selectedHomeCard = card;
  playCard(G, makeCtx([], seat(power)), card, "event");
  return G;
};

describe("Aux Armes, Citoyens! declaration entitlement", () => {
  test("the event grants the card's printed CP and keeps the impulse open", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "FR";
    G.turn = 5;
    G.powers.FR.hand = [AUX_ARMES_HOME_CARD];
    G.powers.FR.selectedHomeCard = AUX_ARMES_HOME_CARD;
    const reservesBefore = G.powers.FR.reserves.length;
    playCard(G, makeCtx([], seat("FR")), AUX_ARMES_HOME_CARD, "event");
    expect(G.phase).toBe("action");
    expect(G.activePower).toBe("FR");
    expect(G.cpRemaining).toBe(0);
    expect(G.powers.FR.reserves).toHaveLength(reservesBefore + 2);
    expect(warDeclarationEntitlement(G, "FR")).toEqual({
      card: AUX_ARMES_HOME_CARD,
      cp: 3,
      aim: null,
    });
  });

  test("the card's CP funds a normal declaration and stamps the card", () => {
    const G = homeImpulse("FR", AUX_ARMES_HOME_CARD);
    expect(declareWar(G, makeCtx([], seat("FR")), "GE", "conquest", ["silesia"], 3)).toBeUndefined();
    expect(G.war?.attacker).toBe("FR");
    expect(G.war?.defender).toBe("GE");
    expect(G.war?.declarationCard).toBe(AUX_ARMES_HOME_CARD);
    expect(warDeclarationEntitlement(G, "FR")).toBeNull();
  });

  test("a conquest may target two keys, unlike an ordinary declaration", () => {
    const G = homeImpulse("FR", AUX_ARMES_HOME_CARD);
    expect(declareWar(G, makeCtx([], seat("FR")), "GE", "conquest", ["silesia", "pomerania"], 3))
      .toBeUndefined();
    expect(G.war?.objectives).toEqual(["silesia", "pomerania"]);
    expect(G.war?.declarationCard).toBe(AUX_ARMES_HOME_CARD);
  });

  test("a conquest may target two different powers", () => {
    const G = homeImpulse("FR", AUX_ARMES_HOME_CARD);
    expect(declareWar(G, makeCtx([], seat("FR")), "GE", "conquest", ["silesia", "pomerania"], 3, {
      secondTarget: "AU",
    })).toBeUndefined();
    expect(G.war?.defender).toBe("GE");
    expect(G.war?.coDefenders).toEqual(["AU"]);
    expect(G.war?.defenderAllies).toContain("AU");
    // "if you do either, neutral powers can join the war against you."
    expect(G.war?.allowNeutralJoin).toBe(true);
  });

  test("two keys alone also open the war to neutral volunteers", () => {
    const G = homeImpulse("FR", AUX_ARMES_HOME_CARD);
    expect(declareWar(G, makeCtx([], seat("FR")), "GE", "conquest", ["silesia", "pomerania"], 3))
      .toBeUndefined();
    expect(G.war?.coDefenders).toBeUndefined();
    expect(G.war?.allowNeutralJoin).toBe(true);
  });

  test("a single-key, single-power conquest keeps neutral powers out", () => {
    const G = homeImpulse("FR", AUX_ARMES_HOME_CARD);
    expect(declareWar(G, makeCtx([], seat("FR")), "GE", "conquest", ["silesia"], 3)).toBeUndefined();
    expect(G.war?.allowNeutralJoin).toBeUndefined();
  });

  test("a neutral power may volunteer for the defending side", () => {
    const G = homeImpulse("FR", AUX_ARMES_HOME_CARD);
    expect(declareWar(G, makeCtx([], seat("FR")), "GE", "conquest", ["silesia", "pomerania"], 3))
      .toBeUndefined();
    G.powers.UK.hand = ["IE-H-UK-3"];
    expect(joinWarAsNeutral(G, makeCtx([], seat("UK")), "IE-H-UK-3")).toBeUndefined();
    expect(G.war?.defenderAllies).toContain("UK");
    expect(G.war?.budgets.UK).toBe(warBudgetFor(G, "UK", 3));
    expect(G.powers.UK.hand).not.toContain("IE-H-UK-3");
    expect(G.discard).toContain("IE-H-UK-3");
  });

  test("a volunteer defending a lone non-player becomes its primary", () => {
    const G = fresh();
    G.powers.UK.hand = ["IE-H-UK-3"];
    G.war = createWarState(G, "FR", "Denmark", "conquest", ["schleswig-holstein"], 3, {
      minor: {minor: "Denmark", ally: null},
    });
    G.war.allowNeutralJoin = true;
    expect(applyNeutralJoin(G, G.war, "UK", {cardId: "IE-H-UK-3"}).applied).toBe(true);
    // 13.4/13.4.2: the first player defender is the non-player's primary.
    expect(G.war.defender).toBe("UK");
    expect(G.war.minorTarget).toEqual({minor: "Denmark", ally: "UK"});
    expect(G.war.defenderAllies).not.toContain("UK");
  });

  test("a war without the clause refuses neutral volunteers", () => {
    const G = homeImpulse("FR", AUX_ARMES_HOME_CARD);
    expect(declareWar(G, makeCtx([], seat("FR")), "GE", "conquest", ["silesia"], 3)).toBeUndefined();
    G.powers.UK.hand = ["IE-H-UK-3"];
    expect(joinWarAsNeutral(G, makeCtx([], seat("UK")), "IE-H-UK-3")).toBe(INVALID_MOVE);
    expect(G.war?.defenderAllies).not.toContain("UK");
  });

  test("the declaration must still commit the full printed CP", () => {
    const G = homeImpulse("FR", AUX_ARMES_HOME_CARD);
    expect(declareWar(G, makeCtx([], seat("FR")), "GE", "conquest", ["silesia"], 1)).toBe(INVALID_MOVE);
    expect(declareWar(G, makeCtx([], seat("FR")), "GE", "conquest", ["silesia"], 2)).toBe(INVALID_MOVE);
    expect(warDeclarationEntitlement(G, "FR")).not.toBeNull();
  });
});

describe("Russo-Turkish Wars declaration entitlement", () => {
  test("the event grants the card's printed CP and keeps the impulse open", () => {
    const G = homeImpulse("RU", RUSSO_TURKISH_WARS_HOME_CARD);
    expect(G.phase).toBe("action");
    expect(G.cpRemaining).toBe(0);
    expect(warDeclarationEntitlement(G, "RU")).toEqual({
      card: RUSSO_TURKISH_WARS_HOME_CARD,
      cp: 3,
      aim: null,
    });
  });

  test("only the Ottomans are a legal target", () => {
    const G = homeImpulse("RU", RUSSO_TURKISH_WARS_HOME_CARD);
    expect(declareWar(G, makeCtx([], seat("RU")), "FR", "conquest", ["alsace-lorraine"], 3))
      .toBe(INVALID_MOVE);
    expect(G.war).toBeNull();
    // The refused declaration did not spend the entitlement.
    expect(warDeclarationEntitlement(G, "RU")).not.toBeNull();
    expect(declareWar(G, makeCtx([], seat("RU")), "OT", "conquest", ["serbia"], 3)).toBeUndefined();
    expect(G.war?.defender).toBe("OT");
    expect(G.war?.declarationCard).toBe(RUSSO_TURKISH_WARS_HOME_CARD);
  });

  test("liberation may target a non-rebellious Balkan space", () => {
    const G = homeImpulse("RU", RUSSO_TURKISH_WARS_HOME_CARD);
    // Serbia starts Ottoman-controlled and not in rebellion.  Without the
    // card's 13.1.2 exception this objective would be refused.
    expect(declareWar(G, makeCtx([], seat("RU")), "OT", "liberation", ["serbia"], 3)).toBeUndefined();
    expect(G.war?.warAim).toBe("liberation");
    expect(G.war?.objectives).toEqual(["serbia"]);
  });

  test("a conquest declaration skips the WTT and stability penalty", () => {
    const G = homeImpulse("RU", RUSSO_TURKISH_WARS_HOME_CARD);
    const wttBefore = G.wtt;
    const stabilityBefore = G.powers.RU.stability;
    expect(declareWar(G, makeCtx([], seat("RU")), "OT", "conquest", ["serbia"], 3)).toBeUndefined();
    expect(G.wtt).toBe(wttBefore);
    expect(G.powers.RU.stability).toBe(stabilityBefore);
  });

  test("a Balkan diplomacy marker becomes an alliance before the declaration", () => {
    // Romania starts with a Russian diplomacy marker (campaign setup).
    const G = homeImpulse("RU", RUSSO_TURKISH_WARS_HOME_CARD);
    expect(G.spaces.romania.ally).toBe("RU");
    expect(G.spaces.romania.diplomacy).toBeNull();
    expect(warDeclarationEntitlement(G, "RU")).not.toBeNull();
  });

  test("a marker that cannot become an alliance is skipped, not forced", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "RU";
    G.turn = 5;
    G.powers.RU.hand = [RUSSO_TURKISH_WARS_HOME_CARD];
    G.powers.RU.selectedHomeCard = RUSSO_TURKISH_WARS_HOME_CARD;
    // 12.8: another player already allied the minor.
    G.spaces.romania.ally = "AU";
    playCard(G, makeCtx([], seat("RU")), RUSSO_TURKISH_WARS_HOME_CARD, "event");
    expect(G.spaces.romania.ally).toBe("AU");
    expect(G.spaces.romania.diplomacy).toBe("RU");
    // "If possible": the declaration itself is unaffected.
    expect(warDeclarationEntitlement(G, "RU")).not.toBeNull();
  });

  test("two eligible markers open a choice and keep the declaration impulse", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "RU";
    G.turn = 5;
    G.powers.RU.hand = [RUSSO_TURKISH_WARS_HOME_CARD];
    G.powers.RU.selectedHomeCard = RUSSO_TURKISH_WARS_HOME_CARD;
    G.spaces.greece.diplomacy = "RU";
    playCard(G, makeCtx([], seat("RU")), RUSSO_TURKISH_WARS_HOME_CARD, "event");
    expect(G.pending?.kind).toBe("eventTargetSpace");
    expect(G.pending?.options.map((option) => option.id).sort()).toEqual(["greece", "romania"]);
    expect(warDeclarationEntitlement(G, "RU")).not.toBeNull();
    expect(resolvePending(G, makeCtx([], seat("RU")), "greece")).toBeUndefined();
    expect(G.spaces.greece.ally).toBe("RU");
    expect(G.spaces.greece.diplomacy).toBeNull();
    // The unchosen marker is untouched.
    expect(G.spaces.romania.ally).toBeNull();
    expect(G.spaces.romania.diplomacy).toBe("RU");
    // The card paused on a choice, so the impulse must stay open for the
    // declaration rather than ending at `cpRemaining = 0`.
    expect(G.phase).toBe("action");
    expect(G.activePower).toBe("RU");
    expect(warDeclarationEntitlement(G, "RU")).not.toBeNull();
    expect(declareWar(G, makeCtx([], seat("RU")), "OT", "conquest", ["serbia"], 3)).toBeUndefined();
  });
});

describe("Jihad declaration entitlement", () => {
  test("the event grants the card's printed CP, the markers and keeps the impulse open", () => {
    const G = homeImpulse("OT", JIHAD_HOME_CARD);
    expect(G.phase).toBe("action");
    expect(G.cpRemaining).toBe(0);
    expect(G.powers.OT.jihad).toBe(2);
    expect(warDeclarationEntitlement(G, "OT")).toEqual({
      card: JIHAD_HOME_CARD,
      cp: 3,
      aim: null,
    });
  });

  test("Russia is a legal target and a conquest skips the penalty", () => {
    const G = homeImpulse("OT", JIHAD_HOME_CARD);
    const wttBefore = G.wtt;
    const stabilityBefore = G.powers.OT.stability;
    expect(declareWar(G, makeCtx([], seat("OT")), "RU", "conquest", ["poland"], 3)).toBeUndefined();
    expect(G.war?.defender).toBe("RU");
    expect(G.war?.declarationCard).toBe(JIHAD_HOME_CARD);
    expect(G.wtt).toBe(wttBefore);
    expect(G.powers.OT.stability).toBe(stabilityBefore);
  });

  test("a power controlling an Ottoman home space is a legal target", () => {
    const G = homeImpulse("OT", JIHAD_HOME_CARD);
    // Izmir is a printed Ottoman home key; simulate a German occupation.
    G.spaces.izmir.control = "GE";
    expect(declareWar(G, makeCtx([], seat("OT")), "GE", "conquest", ["izmir"], 3)).toBeUndefined();
    expect(G.war?.defender).toBe("GE");
  });

  test("another power is not a legal target", () => {
    const G = homeImpulse("OT", JIHAD_HOME_CARD);
    expect(declareWar(G, makeCtx([], seat("OT")), "FR", "conquest", ["alsace-lorraine"], 3))
      .toBe(INVALID_MOVE);
    expect(G.war).toBeNull();
    expect(warDeclarationEntitlement(G, "OT")).not.toBeNull();
  });

  test("declaring war on a Russian minor ally counts as declaring war on Russia", () => {
    const G = homeImpulse("OT", JIHAD_HOME_CARD);
    G.spaces.romania.ally = "RU";
    expect(declareWar(G, makeCtx([], seat("OT")), {minor: "Romania"}, "conquest", ["romania"], 3))
      .toBeUndefined();
    // 13.4.1: the ally answers whether it fights or abandons the minor.
    expect(G.pending?.kind).toBe("minorAbandon");
    expect(resolvePending(G, makeCtx([], seat("RU")), "join")).toBeUndefined();
    expect(G.war?.defender).toBe("RU");
    expect(G.war?.minorTarget).toEqual({minor: "Romania", ally: "RU"});
    expect(G.war?.declarationCard).toBe(JIHAD_HOME_CARD);
  });
});

/**
 * The three cards that print a win bonus: Aux Armes ("If France wins the war
 * gain 1 stability"), Russo-Turkish Wars and Jihad ("Gain 1 stability if you
 * win the war").  The bonus is paid on top of 16.1's major-victory swing.
 */
describe("home-card win stability bonus", () => {
  const forceMajorVictory = (G: ImperialElegyState, capital: SpaceId, victor: Power): void => {
    G.spaces[capital].occupiedBy = victor;
    const victory = classifyVictory(G, G.war!);
    expect(victory.primary).toBe("major");
    expect(victory.victor).toBe("attacker");
    applyVictoryOutcome(G, G.war!, victory);
  };

  test("Aux Armes pays its printed bonus after a French major victory", () => {
    const G = homeImpulse("FR", AUX_ARMES_HOME_CARD);
    expect(declareWar(G, makeCtx([], seat("FR")), "GE", "conquest", ["silesia"], 3)).toBeUndefined();
    const before = G.powers.FR.stability;
    forceMajorVictory(G, "berlin", "FR");
    // +1 for the major victory (16.1) and +1 for the card's own clause.
    expect(G.powers.FR.stability).toBe(before + 2);
    expect(G.log.some((entry) => entry.key === "warWinStability")).toBe(true);
  });

  test("Russo-Turkish Wars pays its printed bonus after a Russian major victory", () => {
    const G = homeImpulse("RU", RUSSO_TURKISH_WARS_HOME_CARD);
    expect(declareWar(G, makeCtx([], seat("RU")), "OT", "conquest", ["serbia"], 3)).toBeUndefined();
    const before = G.powers.RU.stability;
    forceMajorVictory(G, "istanbul", "RU");
    expect(G.powers.RU.stability).toBe(before + 2);
  });

  test("Jihad pays its printed bonus after an Ottoman major victory", () => {
    const G = homeImpulse("OT", JIHAD_HOME_CARD);
    expect(declareWar(G, makeCtx([], seat("OT")), "RU", "conquest", ["poland"], 3)).toBeUndefined();
    const before = G.powers.OT.stability;
    forceMajorVictory(G, "st-petersburg", "OT");
    expect(G.powers.OT.stability).toBe(before + 2);
  });

  test("a white peace does not pay the bonus", () => {
    const G = homeImpulse("FR", AUX_ARMES_HOME_CARD);
    expect(declareWar(G, makeCtx([], seat("FR")), "GE", "conquest", ["silesia"], 3)).toBeUndefined();
    const before = G.powers.FR.stability;
    const victory = classifyVictory(G, G.war!);
    expect(victory.primary).toBe("whitePeace");
    applyVictoryOutcome(G, G.war!, victory);
    expect(G.powers.FR.stability).toBe(before);
  });

  test("a lost war pays no bonus", () => {
    const G = homeImpulse("FR", AUX_ARMES_HOME_CARD);
    expect(declareWar(G, makeCtx([], seat("FR")), "GE", "conquest", ["silesia"], 3)).toBeUndefined();
    const before = G.powers.FR.stability;
    G.spaces.paris.occupiedBy = "GE";
    const victory = classifyVictory(G, G.war!);
    expect(victory.victor).toBe("defender");
    applyVictoryOutcome(G, G.war!, victory);
    // The major-defeat -1 stands; the card's "if France wins" clause is silent.
    expect(G.powers.FR.stability).toBe(before - 1);
    expect(G.log.some((entry) => entry.key === "warWinStability")).toBe(false);
  });

  test("an ordinary CP declaration keeps only the major-victory swing", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.turn = 5;
    G.cpRemaining = 6;
    expect(declareWar(G, makeCtx([], seat("GE")), "AU", "conquest", ["bohemia"], 2)).toBeUndefined();
    const before = G.powers.GE.stability;
    forceMajorVictory(G, "vienna", "GE");
    expect(G.powers.GE.stability).toBe(before + 1);
  });
});
