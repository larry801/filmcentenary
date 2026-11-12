/**
 * Rule 14.2.1 / the UK Balance of Power home card.
 *
 * "Gain 1 stability.  If the defender agrees, you become the primary
 * belligerent and you enter the war on the defending side.  Use this card's CP
 * value for your CP war budget.  If you enter the war, draw a card at the end
 * of the war.  One player (your choice) that you invited (and that joined)
 * also draws a card at the end of the war.  Additionally, if intervening to
 * help the Ottomans, take control of an Ottoman naval base in the Eastern
 * Mediterranean as soon as you enter the war.  If the defender does not agree
 * draw a card.  Play when another player declares war; cannot be played in
 * response to Otto von Bismarck."
 *
 * The live intervention path is `moves.playBalanceOfPower`; the printed Option
 * B ("play as an event to gain 1 stability, draw a card") stays on the normal
 * `playCard` path and is pinned at the end.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {classifyVictory, createWarState, sidePowers} from "./engine/limitedWar";
import {CARDS} from "./constant/cards.data";
import {
  BALANCE_OF_POWER_CARD,
  BISMARCK_CARD,
  callWarAlly,
  chooseWarAim,
  declareWar,
  playBalanceOfPower,
  playCard,
  resolvePending,
  resolveWar,
} from "./moves";

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

/** Give the UK its Balance of Power home card in hand. */
const giveBalanceOfPower = (G: ImperialElegyState): void => {
  G.powers.UK.hand.push(BALANCE_OF_POWER_CARD);
};

/** GE declares a legal conquest war on FR and the alliance step opens. */
const warOnFrance = (G: ImperialElegyState, announceAim = true): void => {
  beginAction(G);
  expect(declareWar(G, makeCtx([], seat("GE")), "FR", "conquest", ["alsace-lorraine", "algeria"], 2)).toBeUndefined();
  if (announceAim) expect(chooseWarAim(G, makeCtx([], seat("GE")), "conquest")).toBeUndefined();
  giveBalanceOfPower(G);
};

const acceptBalanceOfPower = (G: ImperialElegyState): void => {
  expect(playBalanceOfPower(G, makeCtx([], seat("UK")))).toBeUndefined();
  expect(G.pending?.kind).toBe("balanceOfPower");
  expect(resolvePending(G, makeCtx([], seat("FR")), "accept")).toBeUndefined();
};

// ---------------------------------------------------------------------------
// The offer
// ---------------------------------------------------------------------------

describe("playing Balance of Power", () => {
  test("the UK gains 1 stability and the defender receives a private decision", () => {
    const G = fresh();
    warOnFrance(G);
    const stabilityBefore = G.powers.UK.stability;
    const handBefore = G.powers.UK.hand.length;

    expect(playBalanceOfPower(G, makeCtx([], seat("UK")))).toBeUndefined();

    expect(G.powers.UK.stability).toBe(stabilityBefore + 1);
    expect(G.pending?.kind).toBe("balanceOfPower");
    expect(G.pending?.power).toBe("FR");
    expect(G.pending?.options.map((option) => option.id)).toEqual(["accept", "decline"]);
    // The card is committed when the offer is made.
    expect(G.powers.UK.hand).not.toContain(BALANCE_OF_POWER_CARD);
    expect(G.powers.UK.hand.length).toBe(handBefore - 1);
    expect(lastLog(G, "balanceOfPower")?.args).toMatchObject({result: "offered", defender: "FR"});
  });

  test("the offer is only legal while the declaration window is open", () => {
    const G = fresh();
    warOnFrance(G);
    // The defender shift / maneuver step closes the window (14.2/14.3).
    G.war!.status = "maneuver";
    expect(playBalanceOfPower(G, makeCtx([], seat("UK")))).toBe(INVALID_MOVE);
    expect(G.pending).toBeNull();
  });

  test("the UK cannot answer a war it declared or one it is already in", () => {
    const G = fresh();
    beginAction(G, "UK");
    expect(declareWar(G, makeCtx([], seat("UK")), "GE", "conquest", ["silesia"], 2)).toBeUndefined();
    giveBalanceOfPower(G);
    expect(playBalanceOfPower(G, makeCtx([], seat("UK")))).toBe(INVALID_MOVE);
    expect(G.pending).toBeNull();
  });

  test("a truce with the attacker blocks the intervention", () => {
    const G = fresh();
    warOnFrance(G);
    const truce = createWarState(G, "GE", "UK", "conquest", ["scotland"], 1);
    truce.status = "done";
    truce.victor = "attacker";
    truce.truceTurns = 2;
    G.wars = [truce];
    expect(playBalanceOfPower(G, makeCtx([], seat("UK")))).toBe(INVALID_MOVE);
  });

  test("the card cannot be played in response to Otto von Bismarck", () => {
    const G = fresh();
    warOnFrance(G);
    G.war!.declarationCard = BISMARCK_CARD;
    expect(playBalanceOfPower(G, makeCtx([], seat("UK")))).toBe(INVALID_MOVE);
    expect(G.pending).toBeNull();
  });

  test("a power other than the UK has no such move", () => {
    const G = fresh();
    warOnFrance(G);
    expect(playBalanceOfPower(G, makeCtx([], seat("FR")))).toBe(INVALID_MOVE);
    expect(playBalanceOfPower(G, makeCtx([], seat("GE")))).toBe(INVALID_MOVE);
  });
});

// ---------------------------------------------------------------------------
// The defender's answer
// ---------------------------------------------------------------------------

describe("the defender's answer", () => {
  test("declining draws the UK a card and leaves the war unchanged", () => {
    const G = fresh();
    warOnFrance(G);
    const handBefore = G.powers.UK.hand.length;

    expect(playBalanceOfPower(G, makeCtx([], seat("UK")))).toBeUndefined();
    expect(resolvePending(G, makeCtx([], seat("FR")), "decline")).toBeUndefined();

    expect(G.pending).toBeNull();
    expect(G.war?.defender).toBe("FR");
    expect(G.war?.defenderAllies).toEqual([]);
    // The card was spent, then one drawn: the hand size is unchanged.
    expect(G.powers.UK.hand.length).toBe(handBefore);
    expect(G.powers.UK.hand).not.toContain(BALANCE_OF_POWER_CARD);
    expect(lastLog(G, "cardsDrawn")?.power).toBe("UK");
    expect(lastLog(G, "balanceOfPower")?.args).toMatchObject({result: "declined", defender: "FR"});
  });

  test("declinePending counts as the printed refusal", () => {
    const G = fresh();
    warOnFrance(G);
    expect(playBalanceOfPower(G, makeCtx([], seat("UK")))).toBeUndefined();
    // A seat that is not the defender cannot answer.
    expect(resolvePending(G, makeCtx([], seat("UK")), "accept")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("balanceOfPower");
  });

  test("accepting makes the UK the primary defender and enters it on that side", () => {
    const G = fresh();
    warOnFrance(G);
    const objectivesBefore = [...G.war!.objectives];

    acceptBalanceOfPower(G);

    expect(G.pending).toBeNull();
    expect(G.war?.defender).toBe("UK");
    // The original defender stays on the defending side as a secondary ally.
    expect(G.war?.defenderAllies).toEqual(["FR"]);
    expect(sidePowers(G.war!, "defender")).toEqual(["UK", "FR"]);
    // "Use this card's CP value for your CP war budget" (3 CP + industry).
    expect(G.war?.budgets.UK).toBe(3 + G.powers.UK.industry);
    // The war aim and objectives are unchanged: the UK joined the same war.
    expect(G.war?.objectives).toEqual(objectivesBefore);
    expect(G.war?.postWarDraws).toContain("UK");
    expect(G.powers.UK.flags.balanceOfPower).toBe(true);
    expect(G.powers.UK.rapidDeployment).toMatchObject({scope: "limited"});
    expect(lastLog(G, "balanceOfPower")?.args).toMatchObject({result: "accepted", defender: "FR"});
  });

  test("the accept path re-checks the live war state", () => {
    const G = fresh();
    warOnFrance(G);
    expect(playBalanceOfPower(G, makeCtx([], seat("UK")))).toBeUndefined();
    // The maneuver starts before the defender answers: the offer is void.
    G.war!.status = "maneuver";
    expect(resolvePending(G, makeCtx([], seat("FR")), "accept")).toBe(INVALID_MOVE);
  });
});

// ---------------------------------------------------------------------------
// Settlement invariants
// ---------------------------------------------------------------------------

describe("settlement after the UK becomes the primary defender", () => {
  test("occupying the UK capital ends the war and the UK draws at the end", () => {
    const G = fresh();
    warOnFrance(G);
    acceptBalanceOfPower(G);
    const ukHand = G.powers.UK.hand.length;

    // 14.1: "occupying the opposing primary belligerent's capital will
    // immediately end the war" — that capital is now London.
    G.spaces.london.occupiedBy = "GE";
    expect(resolveWar(G, makeCtx([], seat("GE")), [])).toBeUndefined();

    expect(G.war).toBeNull();
    const settled = G.wars[G.wars.length - 1];
    expect(settled.victor).toBe("attacker");
    expect(settled.truceTurns).toBe(2);
    // The Balance of Power end-of-war draw.
    expect(G.powers.UK.hand.length).toBe(ukHand + 1);
  });

  test("the old defender's capital is no longer the primary victory condition", () => {
    const G = fresh();
    warOnFrance(G);
    acceptBalanceOfPower(G);
    // GE occupies Paris: the original defender FR is now a secondary ally, so
    // this is an ally knockout, not a major victory over the primary defender.
    G.spaces.paris.occupiedBy = "GE";
    const victory = classifyVictory(G, G.war!);
    expect(victory.primary).toBe("whitePeace");
    expect(victory.kind).toBe("allyKnockout");
    expect(victory.allyKnockouts.map((knockout) => knockout.power)).toEqual(["FR"]);
  });

  test("a treaty target after the intervention is the UK, not the old defender", () => {
    const G = fresh();
    warOnFrance(G);
    acceptBalanceOfPower(G);
    // The UK loses its capital: the attacker's treaty options target the UK.
    G.spaces.london.occupiedBy = "GE";
    const victory = classifyVictory(G, G.war!);
    expect(victory.primary).toBe("major");
    expect(victory.winner).toBe("GE");
    expect(victory.loser).toBe("UK");
  });
});

// ---------------------------------------------------------------------------
// The Ottoman clause
// ---------------------------------------------------------------------------

test("intervening to help the Ottomans takes the Eastern Mediterranean base", () => {
  const G = fresh();
  beginAction(G);
  expect(declareWar(G, makeCtx([], seat("GE")), "OT", "conquest", ["syria"], 2)).toBeUndefined();
  expect(chooseWarAim(G, makeCtx([], seat("GE")), "conquest")).toBeUndefined();
  giveBalanceOfPower(G);
  expect(G.spaces.rhodes.control).toBe("OT");

  expect(playBalanceOfPower(G, makeCtx([], seat("UK")))).toBeUndefined();
  expect(resolvePending(G, makeCtx([], seat("OT")), "accept")).toBeUndefined();

  expect(G.war?.defender).toBe("UK");
  expect(G.spaces.rhodes.control).toBe("UK");
  expect(lastLog(G, "balanceOfPower")?.args).toMatchObject({result: "accepted", navalBase: "rhodes"});
});

// ---------------------------------------------------------------------------
// Maintaining the Status Quo after Balance of Power
// ---------------------------------------------------------------------------

test("after Balance of Power the UK may invoke Maintaining the Status Quo", () => {
  const G = fresh();
  warOnFrance(G);
  acceptBalanceOfPower(G);
  expect(G.war?.defender).toBe("UK");
  expect(G.war?.status).toBe("alliance");
  // The UK did not shift (14.2.1), so its own chit is still neutral.
  expect(G.powers.UK.alliance).toBe("neutral");
  G.powers.AU.hand = [EVENT_CARD];

  expect(callWarAlly(G, makeCtx([], seat("UK")), "AU")).toBeUndefined();
  expect(G.pending?.power).toBe("AU");
  expect(G.pending?.context).toMatchObject({statusQuo: true});
  // Both chits neutral: the invited neutral picks its box (8.2).
  expect(resolvePending(G, makeCtx([], seat("AU")), "accept:te")).toBeUndefined();
  expect(G.war?.defenderAllies).toEqual(expect.arrayContaining(["FR", "AU"]));
  expect(G.powers.AU.alliance).toBe("teAligned");
});

// ---------------------------------------------------------------------------
// Option B — the ordinary event play
// ---------------------------------------------------------------------------

test("Option B still gains 1 stability and draws a card", () => {
  const G = fresh();
  beginAction(G, "UK");
  G.cpRemaining = 0;
  G.powers.UK.hand = [BALANCE_OF_POWER_CARD];
  const stabilityBefore = G.powers.UK.stability;

  expect(playCard(G, makeCtx([], seat("UK")), BALANCE_OF_POWER_CARD, "event")).toBeUndefined();

  expect(G.powers.UK.stability).toBe(stabilityBefore + 1);
  expect(G.phase === "wartime").toBe(false);
  expect(G.pending).toBeNull();
  expect(G.powers.UK.flags.balanceOfPower).toBe(true);
  // The card left the hand and one card was drawn in its place.
  expect(G.powers.UK.hand).not.toContain(BALANCE_OF_POWER_CARD);
  expect(G.powers.UK.hand.length).toBe(1);
  expect(lastLog(G, "cardsDrawn")?.power).toBe("UK");
});
