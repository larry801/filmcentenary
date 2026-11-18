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
import {warCardCp} from "./engine/limitedWar";
import {BISMARCK_CARD, declareWar, pass, playCard, resolvePending} from "./moves";

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

  test("handing the impulse over drops the declaration", () => {
    const G = bismarckImpulse();
    playBismarck(G);
    // `pass` with a used impulse hands over to the next seat and clears it.
    expect(pass(G, makeCtx([], seat("GE")))).toBeUndefined();
    expect(G.powers.GE.flags.warDeclaration).toBeUndefined();
    expect(warDeclarationEntitlement(G, "GE")).toBeNull();
    expect(G.activePower).not.toBe("GE");
  });
});
