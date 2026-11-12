/**
 * Rule 14.0 — player allies must consent to a call to war.
 *
 * The old `callWarAlly` joined the ally immediately.  These tests pin the
 * live consent flow: the call opens a private `warAllyConsent` decision for
 * the called ally, accepting joins exactly as before, and refusing (or
 * declining) applies the printed 14.0 penalties and blocks a second call.
 */

import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, POWERS, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {CARDS} from "./constant/cards.data";
import {warBudgetCardId} from "./engine/limitedWar";
import {cardById} from "./engine/deck";
import {ImperialElegyGameDef} from "./game";
import {
  callWarAlly,
  chooseWarAim,
  declareWar,
  declinePending,
  resolvePending,
} from "./moves";

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

const seat = (power: Power): string => String(POWERS.indexOf(power));

const EVENT_CARD = CARDS.actions.find((card) => card.type === "event")!.id;

/** GE declares a legal war on AU and RU shares GE's alliance box. */
const atWar = (G: ImperialElegyState, box: ImperialElegyState["powers"][Power]["alliance"] = "taCommitted"): void => {
  const ctx = makeCtx("0");
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 4;
  expect(declareWar(G, ctx, "AU", "conquest", ["bohemia"], 2)).toBeUndefined();
  expect(chooseWarAim(G, ctx, "conquest")).toBeUndefined();
  G.powers.GE.alliance = box;
  G.powers.RU.alliance = box;
  G.powers.RU.hand = [EVENT_CARD];
};

const pendingView = (G: ImperialElegyState, playerID: string | null) =>
  ImperialElegyGameDef.playerView!(G, makeCtx(playerID), playerID) as unknown as ImperialElegyState;

describe("14.0 ally-call consent", () => {
  test("the call opens a private accept/refuse decision for the ally", () => {
    const G = fresh();
    atWar(G);
    const caller = makeCtx("0");

    expect(callWarAlly(G, caller, "RU")).toBeUndefined();

    expect(G.pending?.kind).toBe("warAllyConsent");
    expect(G.pending?.power).toBe("RU");
    expect(G.pending?.options.map((option) => option.id)).toEqual(["accept", "refuse"]);
    expect(G.pending?.context).toMatchObject({caller: "GE", ally: "RU", side: "attacker"});
    // Nothing has joined and no card has been spent yet.
    expect(G.war!.attackerAllies).toEqual([]);
    expect(G.powers.RU.hand).toEqual([EVENT_CARD]);
    expect(G.discard).not.toContain(EVENT_CARD);

    // Privacy: only the deciding seat sees the options/context.
    const callerView = pendingView(G, seat("GE"));
    expect(callerView.pending?.options).toEqual([]);
    expect(callerView.pending?.context).toEqual({});
    const allyView = pendingView(G, seat("RU"));
    expect(allyView.pending?.options.map((option) => option.id)).toEqual(["accept", "refuse"]);
    expect(allyView.pending?.context?.caller).toBe("GE");
    const spectatorView = pendingView(G, null);
    expect(spectatorView.pending?.options).toEqual([]);
    expect(spectatorView.pending?.context).toEqual({});
  });

  test("accepting joins, funds and discards the ally's card", () => {
    const G = fresh();
    atWar(G);
    const cardCp = cardById(EVENT_CARD).cp;
    expect(callWarAlly(G, makeCtx("0"), "RU")).toBeUndefined();

    expect(resolvePending(G, makeCtx(seat("RU")), "accept")).toBeUndefined();

    expect(G.pending).toBeNull();
    expect(G.war!.attackerAllies).toEqual(["RU"]);
    expect(G.war!.budgets.RU).toBe(cardCp + G.powers.RU.industry);
    expect(G.powers.RU.hand).not.toContain(EVENT_CARD);
    expect(G.discard).toContain(EVENT_CARD);
    expect(G.war!.refusedAllies ?? []).toEqual([]);

    // The caller may continue the war flow: another eligible ally can be
    // called now that the first decision has closed.
    G.powers.FR.alliance = "taCommitted";
    G.powers.FR.hand = [EVENT_CARD];
    expect(callWarAlly(G, makeCtx("0"), "FR")).toBeUndefined();
    expect(G.pending?.power).toBe("FR");
    expect(G.pending?.kind).toBe("warAllyConsent");
  });

  test("refusing in a committed box costs 1 stability and gives 10 neutral MPIT influence", () => {
    const G = fresh();
    atWar(G, "taCommitted");
    const before = G.powers.RU.stability;
    expect(callWarAlly(G, makeCtx("0"), "RU")).toBeUndefined();

    expect(resolvePending(G, makeCtx(seat("RU")), "refuse")).toBeUndefined();

    expect(G.pending).toBeNull();
    expect(G.war!.attackerAllies).toEqual([]);
    expect(G.powers.RU.stability).toBe(before - 1);
    expect(G.powers.RU.mpit.neutral).toBe(11);
    expect(G.war!.refusedAllies).toEqual(["RU"]);
    expect(G.powers.RU.hand).toEqual([EVENT_CARD]);
    expect(G.discard).not.toContain(EVENT_CARD);
    expect(G.log.some((entry) => entry.key === "allyRefusedWar")).toBe(true);
  });

  test("refusing in an aligned box gives 5 neutral influence and no stability loss", () => {
    const G = fresh();
    atWar(G, "taAligned");
    const before = G.powers.RU.stability;
    expect(callWarAlly(G, makeCtx("0"), "RU")).toBeUndefined();

    expect(resolvePending(G, makeCtx(seat("RU")), "refuse")).toBeUndefined();

    expect(G.powers.RU.stability).toBe(before);
    expect(G.powers.RU.mpit.neutral).toBe(6);
    expect(G.war!.refusedAllies).toEqual(["RU"]);
  });

  test("declinePending counts as a refusal", () => {
    const G = fresh();
    atWar(G, "taCommitted");
    const before = G.powers.RU.stability;
    expect(callWarAlly(G, makeCtx("0"), "RU")).toBeUndefined();

    expect(declinePending(G, makeCtx(seat("RU")))).toBeUndefined();

    expect(G.pending).toBeNull();
    expect(G.powers.RU.stability).toBe(before - 1);
    expect(G.powers.RU.mpit.neutral).toBe(11);
    expect(G.war!.refusedAllies).toEqual(["RU"]);
  });

  test("a refused ally cannot be called twice in the same war", () => {
    const G = fresh();
    atWar(G, "taCommitted");
    expect(callWarAlly(G, makeCtx("0"), "RU")).toBeUndefined();
    expect(resolvePending(G, makeCtx(seat("RU")), "refuse")).toBeUndefined();

    expect(callWarAlly(G, makeCtx("0"), "RU")).toBe(INVALID_MOVE);
    expect(G.pending).toBeNull();
    expect(G.war!.attackerAllies).toEqual([]);
  });

  test("only the deciding seat may answer and only the caller may call", () => {
    const G = fresh();
    atWar(G, "taCommitted");
    expect(callWarAlly(G, makeCtx("0"), "RU")).toBeUndefined();

    // GE (the caller) cannot answer its own call to RU.
    expect(resolvePending(G, makeCtx(seat("GE")), "accept")).toBe(INVALID_MOVE);
    expect(declinePending(G, makeCtx(seat("GE")))).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("warAllyConsent");

    // A second call while the first is unanswered is rejected.
    G.powers.FR.alliance = "taCommitted";
    G.powers.FR.hand = [EVENT_CARD];
    expect(callWarAlly(G, makeCtx("0"), "FR")).toBe(INVALID_MOVE);
    expect(G.pending?.power).toBe("RU");

    // The ally then accepts and the war flow continues.
    expect(resolvePending(G, makeCtx(seat("RU")), "accept")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.war!.attackerAllies).toEqual(["RU"]);
  });

  test("eligibility is unchanged: an ally without a playable card cannot be called", () => {
    const G = fresh();
    atWar(G, "taCommitted");
    // Response, combat and mandatory cards cannot fund a war budget.
    G.powers.RU.hand = ["IE-A023", "IE-A043", "IE-A017"];

    expect(callWarAlly(G, makeCtx("0"), "RU")).toBe(INVALID_MOVE);
    expect(G.pending).toBeNull();
    expect(G.war!.attackerAllies).toEqual([]);
    expect(G.powers.RU.hand).toEqual(["IE-A023", "IE-A043", "IE-A017"]);
  });

  test("the consent decision survives the caller losing the active seat", () => {
    const G = fresh();
    atWar(G, "taCommitted");
    expect(callWarAlly(G, makeCtx("0"), "RU")).toBeUndefined();

    // The caller's impulse ends, but the ally can still answer later.
    G.activePower = "RU";
    expect(resolvePending(G, makeCtx(seat("RU")), "accept")).toBeUndefined();
    expect(G.war!.attackerAllies).toEqual(["RU"]);
    expect(G.pending).toBeNull();
  });

  test("the joining card is read from the live hand when the ally answers", () => {
    const G = fresh();
    atWar(G, "taCommitted");
    const cardId = warBudgetCardId(G, "RU");
    expect(cardId).toBe(EVENT_CARD);
    expect(callWarAlly(G, makeCtx("0"), "RU")).toBeUndefined();

    // The ally loses the card before answering; the join must be rejected and
    // must not silently spend a different card.
    G.powers.RU.hand = [];
    expect(resolvePending(G, makeCtx(seat("RU")), "accept")).toBe(INVALID_MOVE);
    expect(G.war!.attackerAllies).toEqual([]);
    expect(G.pending?.kind).toBe("warAllyConsent");
  });
});
