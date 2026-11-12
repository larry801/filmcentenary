/**
 * 33.2 UK characteristics — Maintaining the Status Quo.
 *
 * "If the UK is the primary belligerent and the defender in a war (including
 * after playing Balance of Power), it can ask allied players **and neutral
 * players** to join the war during the alliance step."  Rule 8.1.1's exception
 * is what makes the neutral invitation legal; rule 8.4 still caps the alliance
 * the joining neutral enters, and rule 8.2 gives it a legal alliance box.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {allianceMembers} from "./engine/alliance";
import {belligerentsOf, createWarState} from "./engine/limitedWar";
import {CARDS} from "./constant/cards.data";
import {callWarAlly, chooseWarAim, declareWar, resolvePending} from "./moves";

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

const EVENT_CARD = CARDS.actions.find((card) => card.type === "event")!.id;

const beginAction = (G: ImperialElegyState, active: Power = "GE", cp = 4): void => {
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
  G.pending = null;
  G.war = null;
};

const lastLog = (G: ImperialElegyState, key: string) =>
  [...G.log].reverse().find((entry) => entry.key === key);

/** GE declares a legal conquest war on the UK and the war aim is announced. */
const warOnUk = (G: ImperialElegyState): void => {
  beginAction(G);
  expect(declareWar(G, makeCtx([], seat("GE")), "UK", "conquest", ["scotland"], 2)).toBeUndefined();
  expect(chooseWarAim(G, makeCtx([], seat("GE")), "conquest")).toBeUndefined();
  expect(G.war?.defender).toBe("UK");
  expect(G.war?.status).toBe("alliance");
};

/** The UK's defender shift away from a TA attacker is already applied. */
const warOnUkWithTaAttacker = (G: ImperialElegyState): void => {
  G.powers.GE.alliance = "taCommitted";
  warOnUk(G);
  expect(G.powers.UK.alliance).toBe("teAligned");
};

// ---------------------------------------------------------------------------
// The neutral invitation
// ---------------------------------------------------------------------------

describe("the UK defender may invite neutral players", () => {
  test("a neutral accepts and joins on the UK's side with a legal alliance box", () => {
    const G = fresh();
    warOnUkWithTaAttacker(G);
    G.powers.FR.hand = [EVENT_CARD];
    const cardCp = CARDS.actions.find((card) => card.id === EVENT_CARD)!.cp;

    expect(callWarAlly(G, makeCtx([], seat("UK")), "FR")).toBeUndefined();
    expect(G.pending?.kind).toBe("warAllyConsent");
    expect(G.pending?.power).toBe("FR");
    // Rule 8.2's direction away from the attacker is determined here, so there
    // is exactly one accept option.
    expect(G.pending?.options.map((entry) => entry.id)).toEqual(["accept", "refuse"]);
    expect(lastLog(G, "allyCalledToWar")?.args).toMatchObject({ally: "FR", statusQuo: true});

    expect(resolvePending(G, makeCtx([], seat("FR")), "accept")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.war?.defenderAllies).toContain("FR");
    expect(belligerentsOf(G.war!)).toContain("FR");
    expect(G.war?.budgets.FR).toBe(cardCp + G.powers.FR.industry + 1); // +1 Second French Empire
    expect(G.powers.FR.hand).not.toContain(EVENT_CARD);
    expect(G.discard).toContain(EVENT_CARD);
    // The joining neutral receives a legal alliance-box membership via 8.2.
    expect(G.powers.FR.alliance).toBe("teAligned");
    expect(allianceMembers(G, "te")).toEqual(expect.arrayContaining(["UK", "FR"]));
    expect(lastLog(G, "allianceShifted")?.args).toMatchObject({to: "teAligned", statusQuo: true});
  });

  test("both chits neutral: the invited neutral chooses the box", () => {
    const G = fresh();
    warOnUk(G);
    // A neutral UK: Balance of Power's "does not cause the UK to shift" case.
    expect(G.powers.UK.alliance).toBe("neutral");
    G.powers.FR.hand = [EVENT_CARD];

    expect(callWarAlly(G, makeCtx([], seat("UK")), "FR")).toBeUndefined();
    expect(G.pending?.options.map((entry) => entry.id)).toEqual(["accept:te", "accept:ta", "refuse"]);

    expect(resolvePending(G, makeCtx([], seat("FR")), "accept:ta")).toBeUndefined();
    expect(G.powers.FR.alliance).toBe("taAligned");
    expect(G.war?.defenderAllies).toContain("FR");
  });

  test("a refusal takes the printed 14.0 consequences and is remembered", () => {
    const G = fresh();
    warOnUkWithTaAttacker(G);
    G.powers.FR.hand = [EVENT_CARD];

    expect(callWarAlly(G, makeCtx([], seat("UK")), "FR")).toBeUndefined();
    expect(resolvePending(G, makeCtx([], seat("FR")), "refuse")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.war?.defenderAllies).toEqual([]);
    expect(G.war?.refusedAllies).toEqual(["FR"]);
    expect(G.powers.FR.alliance).toBe("neutral");
    // A neutral box has no printed refusal penalty.
    expect(lastLog(G, "allyRefusedWar")?.args).toMatchObject({neutralInfluence: 0, stability: 0});
    // Asked once only.
    expect(callWarAlly(G, makeCtx([], seat("UK")), "FR")).toBe(INVALID_MOVE);
  });

  test("an invited neutral without a playable event card is refused", () => {
    const G = fresh();
    warOnUkWithTaAttacker(G);
    G.powers.FR.hand = ["IE-A023", "IE-A043", "IE-A017"];
    expect(callWarAlly(G, makeCtx([], seat("UK")), "FR")).toBe(INVALID_MOVE);
    expect(G.pending).toBeNull();
    expect(G.war?.defenderAllies).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Rule 8.4 cap
// ---------------------------------------------------------------------------

describe("the three-player maximum still applies to an invited neutral", () => {
  test("a full alliance refuses the neutral invitation", () => {
    const G = fresh();
    warOnUkWithTaAttacker(G);
    // The UK's Entente now holds three player powers.
    G.powers.FR.alliance = "teAligned";
    G.powers.RU.alliance = "teAligned";
    expect(allianceMembers(G, "te")).toHaveLength(3);

    G.powers.OT.hand = [EVENT_CARD];
    expect(callWarAlly(G, makeCtx([], seat("UK")), "OT")).toBe(INVALID_MOVE);
    expect(G.pending).toBeNull();
    expect(G.war?.defenderAllies).toEqual([]);
    expect(G.powers.OT.alliance).toBe("neutral");
  });

  test("with room, the same invitation is legal", () => {
    const G = fresh();
    warOnUkWithTaAttacker(G);
    G.powers.FR.alliance = "teAligned";
    G.powers.OT.hand = [EVENT_CARD];
    expect(callWarAlly(G, makeCtx([], seat("UK")), "OT")).toBeUndefined();
    expect(G.pending?.power).toBe("OT");
  });
});

// ---------------------------------------------------------------------------
// Rejections
// ---------------------------------------------------------------------------

describe("Maintaining the Status Quo is a UK-defender-only exception", () => {
  test("a non-UK defender cannot invite a neutral", () => {
    const G = fresh();
    beginAction(G);
    expect(declareWar(G, makeCtx([], seat("GE")), "FR", "conquest", ["alsace-lorraine", "algeria"], 2)).toBeUndefined();
    expect(chooseWarAim(G, makeCtx([], seat("GE")), "conquest")).toBeUndefined();
    G.powers.OT.hand = [EVENT_CARD];

    expect(callWarAlly(G, makeCtx([], seat("FR")), "OT")).toBe(INVALID_MOVE);
    expect(G.pending).toBeNull();
  });

  test("a UK that is not the defender (attacker) cannot invite a neutral", () => {
    const G = fresh();
    beginAction(G, "UK");
    expect(declareWar(G, makeCtx([], seat("UK")), "GE", "conquest", ["silesia"], 2)).toBeUndefined();
    expect(chooseWarAim(G, makeCtx([], seat("UK")), "conquest")).toBeUndefined();
    G.powers.FR.hand = [EVENT_CARD];

    expect(callWarAlly(G, makeCtx([], seat("UK")), "FR")).toBe(INVALID_MOVE);
    expect(G.pending).toBeNull();
  });

  test("the invitation is only open during the alliance step", () => {
    const G = fresh();
    G.powers.GE.alliance = "taCommitted";
    beginAction(G);
    // War aim not yet announced: the war is still in the war-aim step (13.0).
    expect(declareWar(G, makeCtx([], seat("GE")), "UK", "conquest", ["scotland"], 2)).toBeUndefined();
    expect(G.war?.status).toBe("warAim");
    G.powers.FR.hand = [EVENT_CARD];
    expect(callWarAlly(G, makeCtx([], seat("UK")), "FR")).toBe(INVALID_MOVE);
    expect(G.pending).toBeNull();
  });

  test("the normal 14.0 ally call still works for the UK defender", () => {
    const G = fresh();
    warOnUkWithTaAttacker(G);
    G.powers.FR.alliance = "teAligned";
    G.powers.FR.hand = [EVENT_CARD];

    expect(callWarAlly(G, makeCtx([], seat("UK")), "FR")).toBeUndefined();
    expect(G.pending?.options.map((entry) => entry.id)).toEqual(["accept", "refuse"]);
    expect(lastLog(G, "allyCalledToWar")?.args).toMatchObject({statusQuo: false});
    expect(resolvePending(G, makeCtx([], seat("FR")), "accept")).toBeUndefined();
    expect(G.war?.defenderAllies).toContain("FR");
  });

  test("a hand-built war with no declared defender shift records nothing extra", () => {
    const G = fresh();
    G.powers.GE.alliance = "taCommitted";
    G.phase = "wartime";
    G.war = createWarState(G, "GE", "UK", "conquest", ["scotland"], 2);
    G.war.status = "alliance";
    G.powers.FR.hand = [EVENT_CARD];
    // The UK is the defender and the alliance step is live, so the neutral
    // invitation is legal even without a `declareWar` shift record.
    expect(callWarAlly(G, makeCtx([], seat("UK")), "FR")).toBeUndefined();
    expect(G.pending?.power).toBe("FR");
  });
});
