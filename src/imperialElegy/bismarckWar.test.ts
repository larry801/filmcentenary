/**
 * GE home card #1 "Otto von Bismarck" — the printed event:
 *
 * "Gain 1 stability.  Declare a war of unification using this card's CP value.
 *  You may target two different powers with this declaration. …"
 *
 * The event used to set a dead `warDeclaration` flag and end the impulse, so
 * the German player could never launch the war the card prints (reported as
 * "事件俾斯麦无法发动统一战争").  The event now leaves a declaration
 * entitlement: `declareWar` spends the card's printed CP (errata 12.17) and
 * only accepts a war of unification, and the impulse stays open until the seat
 * declares or hands it over.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {BISMARCK_HOME_CARD, warDeclarationEntitlement} from "./engine/rules";
import {allyCallEligibility, warBudgetFor, warCardCp} from "./engine/limitedWar";
import {BISMARCK_CARD, declareWar, declinePending, pass, passWarMove, playCard, resolvePending, startWarManeuver} from "./moves";

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
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/** GE's action impulse with Bismarck in hand, as the live board deals it. */
const bismarckImpulse = (): ImperialElegyState => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.turn = 5;
  G.powers.GE.hand = [BISMARCK_HOME_CARD];
  G.powers.GE.selectedHomeCard = BISMARCK_HOME_CARD;
  return G;
};

const playBismarck = (G: ImperialElegyState): void => {
  playCard(G, makeCtx([], seat("GE")), BISMARCK_HOME_CARD, "event");
};

describe("Otto von Bismarck's war of unification", () => {
  test("the event grants the declaration and keeps the impulse open", () => {
    const G = bismarckImpulse();
    const stabilityBefore = G.powers.GE.stability;
    playBismarck(G);
    // The card's own printed "+1 stability" is applied exactly once.
    expect(G.powers.GE.stability).toBe(stabilityBefore + 1);
    expect(G.phase).toBe("action");
    expect(G.activePower).toBe("GE");
    expect(G.cpRemaining).toBe(0);
    expect(G.powers.GE.flags.warDeclaration).toBe(true);
    expect(warDeclarationEntitlement(G, "GE")).toEqual({
      card: BISMARCK_HOME_CARD,
      cp: 3,
      aim: "unification",
    });
  });

  test("the card's printed CP funds a war of unification", () => {
    const G = bismarckImpulse();
    playBismarck(G);
    // Alsace-Lorraine: French-controlled, German nationality — a legal
    // unification objective against a player power.
    expect(declareWar(G, makeCtx([], seat("GE")), "FR", "unification", ["alsace-lorraine"], 3))
      .toBeUndefined();
    expect(G.war).not.toBeNull();
    expect(G.war!.attacker).toBe("GE");
    expect(G.war!.defender).toBe("FR");
    expect(G.war!.warAim).toBe("unification");
    expect(G.war!.objectives).toEqual(["alsace-lorraine"]);
    // 14.3: the budget is the card CP plus the power's industry, so read
    // the card CP back out of it (3), not the raw budget (4).
    expect(warCardCp(G, G.war!, "GE")).toBe(3);
    // The entitlement is spent, and the declaration carries the card so the
    // UK's Balance of Power cannot answer it (14.2.1).
    expect(G.powers.GE.flags.warDeclaration).toBeUndefined();
    expect(G.powers.GE.flags.warDeclarationCard).toBeUndefined();
    expect(G.war!.declarationCard).toBe(BISMARCK_CARD);
    expect(G.phase).toBe("wartime");
  });

  test("a war of unification can be declared on a minor power", () => {
    const G = bismarckImpulse();
    playBismarck(G);
    // Schleswig-Holstein is Danish-controlled and contains Germans; the
    // declaration opens the 13.4.2 aid search against Denmark.
    expect(declareWar(G, makeCtx([2, 1], seat("GE")), {minor: "Denmark"}, "unification", ["schleswig-holstein"], 3))
      .toBeUndefined();
    expect(G.powers.GE.flags.warDeclaration).toBeUndefined();
    expect(G.pending).not.toBeNull();
    // Decline every offered aid: the declaration then proceeds unopposed.
    let guard = 0;
    while (G.pending !== null && guard++ < 10) {
      const pending = G.pending;
      const option = pending.kind === "minorAbandon" ? "abandon" : "decline";
      expect(resolvePending(G, makeCtx([2, 1], seat(pending.power)), option)).toBeUndefined();
    }
    expect(G.war).not.toBeNull();
    expect(G.war!.attacker).toBe("GE");
    expect(G.war!.warAim).toBe("unification");
    expect(G.war!.objectives).toEqual(["schleswig-holstein"]);
    expect(G.war!.declarationCard).toBe(BISMARCK_CARD);
  });

  test("the declaration must commit the card's full CP value", () => {
    const G = bismarckImpulse();
    playBismarck(G);
    expect(declareWar(G, makeCtx([], seat("GE")), "FR", "unification", ["alsace-lorraine"], 1)).toBe(INVALID_MOVE);
    expect(declareWar(G, makeCtx([], seat("GE")), "FR", "unification", ["alsace-lorraine"], 2)).toBe(INVALID_MOVE);
    // The entitlement survives a refused declaration, so the player can retry.
    expect(warDeclarationEntitlement(G, "GE")).not.toBeNull();
    expect(G.war).toBeNull();
  });

  test("the Bismarck event only declares a war of unification", () => {
    const G = bismarckImpulse();
    playBismarck(G);
    expect(declareWar(G, makeCtx([], seat("GE")), "FR", "conquest", ["alsace-lorraine"], 3)).toBe(INVALID_MOVE);
    expect(declareWar(G, makeCtx([], seat("GE")), "FR", "liberation", ["alsace-lorraine"], 3)).toBe(INVALID_MOVE);
    expect(G.war).toBeNull();
  });

  test("the card may name two different powers in one declaration", () => {
    const G = bismarckImpulse();
    playBismarck(G);
    // FR is the first target; AU is the second power of the same declaration.
    expect(declareWar(G, makeCtx([], seat("GE")), "FR", "unification", ["alsace-lorraine"], 3, {
      secondTarget: "AU",
    })).toBeUndefined();
    expect(G.war!.defender).toBe("FR");
    expect(G.war!.coDefenders).toEqual(["AU"]);
    // 14.1: the second power is a defending belligerent, not a volunteer.
    expect(G.war!.defenderAllies).toContain("AU");
    expect(G.war!.budgets.AU).toBe(warBudgetFor(G, "AU", 0));
    expect(G.war!.declarationCard).toBe(BISMARCK_CARD);
  });

  test("the defenders' chosen primary may be the second power", () => {
    const G = bismarckImpulse();
    playBismarck(G);
    expect(declareWar(G, makeCtx([], seat("GE")), "FR", "unification", ["alsace-lorraine"], 3, {
      secondTarget: "AU",
      primary: "AU",
    })).toBeUndefined();
    expect(G.war!.defender).toBe("AU");
    expect(G.war!.coDefenders).toEqual(["FR"]);
    expect(G.war!.budgets.FR).toBe(warBudgetFor(G, "FR", 0));
  });

  test("the attacker may forbid other players from joining the war", () => {
    const G = bismarckImpulse();
    playBismarck(G);
    expect(declareWar(G, makeCtx([], seat("GE")), "FR", "unification", ["alsace-lorraine"], 3, {
      forbidPlayers: true,
    })).toBeUndefined();
    expect(G.war!.forbidPlayerJoins).toBe(true);
    const call = allyCallEligibility(G, G.war, "GE", "AU");
    expect(call.ok).toBe(false);
    expect(call.reason).toBe("forbid-join");
  });

  test("errata 13.4.5: an unaligned minor auto-allies the player of the other targeted minor", () => {
    const G = bismarckImpulse();
    playBismarck(G);
    // Hanover is allied to AU; Denmark is unaligned.
    G.spaces.hanover.ally = "AU";
    G.spaces.hanover.diplomacy = null;
    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Hanover"}, "unification", ["hanover"], 3, {
      secondTarget: {minor: "Denmark"},
      primary: {minor: "Hanover"},
    })).toBeUndefined();
    // 13.4.1's abandon-minor choice comes first; the errata's auto-alliance is
    // applied when the declaration finalizes.
    if (G.pending?.kind === "minorAbandon") {
      const join = G.pending.options.find((option) => option.id === "join") ?? G.pending.options[0];
      expect(resolvePending(G, makeCtx([], seat("AU")), join.id)).toBeUndefined();
    }
    expect(G.spaces.denmark.ally).toBe("AU");
  });

  test("the join ban also stops the 13.4.2 aid search on a minor", () => {
    const G = bismarckImpulse();
    playBismarck(G);
    // Schleswig-Holstein is Danish-controlled and has no player ally, so the
    // ordinary declaration would immediately let Denmark seek aid (13.4.2).
    // Bismarck's clause forbids other players from joining, so no seat may be
    // invited and the minor must defend alone (15.4.2).
    expect(declareWar(G, makeCtx([2, 1], seat("GE")), {minor: "Denmark"}, "unification", ["schleswig-holstein"], 3, {
      forbidPlayers: true,
    })).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.war).not.toBeNull();
    expect(G.war!.defender).toBe("Denmark");
    expect(G.war!.forbidPlayerJoins).toBe(true);
  });

  test("the aid decision cannot join once the ban is recorded", () => {
    const G = bismarckImpulse();
    playBismarck(G);
    // The ban normally skips the aid search entirely.  Simulate a decision
    // opened before the ban (e.g. from a save): answering "aid" must be
    // refused, so a queued seat cannot bypass the clause.
    expect(declareWar(G, makeCtx([2, 1], seat("GE")), {minor: "Denmark"}, "unification", ["schleswig-holstein"], 3))
      .toBeUndefined();
    expect(G.pending?.kind).toBe("minorAid");
    G.flags.declarationForbid = true;
    expect(resolvePending(G, makeCtx([2, 1], seat(G.pending!.power)), "aid")).toBe(INVALID_MOVE);
  });

  test("the ban does not stop an existing minor ally from fighting for it", () => {
    const G = bismarckImpulse();
    // The card's Clarification: declaring war on a minor power with a player
    // ally still counts as declaring war on that player, and that defender may
    // still aid its minor power ally (13.4.1).
    G.spaces["schleswig-holstein"].ally = "FR";
    playBismarck(G);
    expect(declareWar(G, makeCtx([2, 1], seat("GE")), {minor: "Denmark"}, "unification", ["schleswig-holstein"], 3, {
      forbidPlayers: true,
    })).toBeUndefined();
    expect(G.pending?.kind).toBe("minorAbandon");
    expect(G.pending?.power).toBe("FR");
    expect(resolvePending(G, makeCtx([2, 1], seat("FR")), "join")).toBeUndefined();
    expect(G.war!.defender).toBe("FR");
    expect(G.war!.forbidPlayerJoins).toBe(true);
  });

  test("the second power must be different from the first", () => {
    const G = bismarckImpulse();
    playBismarck(G);
    expect(declareWar(G, makeCtx([], seat("GE")), "FR", "unification", ["alsace-lorraine"], 3, {
      secondTarget: "FR",
    })).toBe(INVALID_MOVE);
    expect(G.war).toBeNull();
  });

  test("handing the impulse over drops the declaration", () => {
    const G = bismarckImpulse();
    playBismarck(G);
    // `pass` with a used impulse hands over to the next seat and clears it.
    expect(pass(G, makeCtx([], seat("GE")))).toBeUndefined();
    expect(G.powers.GE.flags.warDeclaration).toBeUndefined();
    expect(warDeclarationEntitlement(G, "GE")).toBeNull();
    expect(G.activePower).not.toBe("GE");
  });

  test("a white peace after Bismarck resumed the action phase with the next seat, not GE", () => {
    // Reported as "德国bot在事件俾斯麦之后打出了另一张牌": the white-peace
    // settlement handed the action phase back to the attacker, so the GE bot
    // could immediately play a second card (South German Confederation) in the
    // same turn before the UK ever acted.
    const G = bismarckImpulse();
    playBismarck(G);
    expect(declareWar(G, makeCtx([], seat("GE")), "FR", "unification", ["alsace-lorraine"], 3)).toBeUndefined();
    expect(startWarManeuver(G, makeCtx([], seat("GE")))).toBeUndefined();
    let guard = 0;
    while (G.war !== null && guard++ < 10) {
      const power = G.activePower;
      expect(passWarMove(G, makeCtx([], seat(power)))).toBeUndefined();
    }
    expect(G.war).toBeNull();
    expect(G.wars[0]?.victor).toBeNull();
    while (G.pending !== null && guard++ < 20) {
      expect(declinePending(G, makeCtx([], seat(G.pending.power)))).toBeUndefined();
    }
    expect(G.pending).toBeNull();
    expect(G.phase).toBe("action");
    // 4.3: the attacker's impulse was spent on the declaration, so play resumes
    // with the next seat in printed order (UK), never the attacker again.
    expect(G.activePower).toBe("UK");
  });
});
