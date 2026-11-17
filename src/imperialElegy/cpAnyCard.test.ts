/**
 * 12.0/12.1 — every card is a CP card.
 *
 * The playbook: "All cards except Mandatory Event cards can be played for CP
 * during an impulse."  A mandatory event has no plain CP mode — the event
 * resolves first and its CP are then spent — so a CP play of one takes the
 * event path.  Response and combat cards are ordinary CP cards outside their
 * windows, and the only printed CP restriction on any face is A105 Impulsive
 * Ruler's hand-size clause.
 *
 * These tests pin both layers: the pure `cpPlayability` predicate and the live
 * `playCard` rejection, so the tray button and the move cannot drift apart.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {playCard} from "./moves";
import {canPlayForCp, cpPlayability} from "./engine/playability";
import {cardById} from "./engine/deck";
import {cpBudgetFor, spendCpFor} from "./engine/rules";

const seat = (power: Power): string => String(POWERS.indexOf(power));

const makeCtx = (power: Power = "GE", dice: number[] = []): Ctx => {
  let index = 0;
  return {
    playerID: seat(power),
    random: {
      Die: (sides: number) => Math.min(sides, dice[Math.min(index++, dice.length - 1)] ?? 1),
      Number: () => 1,
      Shuffle: (a: unknown[]) => a,
    },
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

/** A fresh campaign with `power` on the clock and an empty impulse. */
const fresh = (power: Power = "GE"): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx(power));
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 0;
  G.pending = null;
  G.battle = null;
  return G;
};

/** Put `cardId` in the power's hand and play it for CP. */
const playCp = (G: ImperialElegyState, cardId: string, power: Power = "GE"): string | void => {
  if (!G.powers[power].hand.includes(cardId)) G.powers[power].hand.push(cardId);
  return playCard(G, makeCtx(power), cardId, "cp");
};

const COMBAT_CARD = "IE-A060"; // Charge of the Light Brigade, 1 CP
const RESPONSE_CARD = "IE-A023"; // New Rifles, 3 CP
const MANDATORY_CARD = "IE-A101"; // The Black Hand, 2 CP, WTT +1

describe("cpPlayability — the printed CP clause", () => {
  test("every printed type is CP-playable, mandatory events included", () => {
    const G = fresh();
    for (const id of [COMBAT_CARD, RESPONSE_CARD, MANDATORY_CARD, "IE-A018"]) {
      expect(cpPlayability(G, "GE", id)).toEqual({ok: true});
      expect(canPlayForCp(G, "GE", id)).toBe(true);
    }
    expect(cardById(COMBAT_CARD).type).toBe("combat");
    expect(cardById(RESPONSE_CARD).type).toBe("response");
    expect(cardById(MANDATORY_CARD).type).toBe("mandatory");
  });

  test("an unknown card is refused", () => {
    expect(cpPlayability(fresh(), "GE", "IE-A999")).toEqual({ok: false, reason: "unknown-card"});
  });

  test("A105 keeps its printed three-card CP gate", () => {
    const G = fresh();
    G.powers.GE.hand = ["IE-A105", "IE-A018", "IE-A019", "IE-A020"];
    expect(cpPlayability(G, "GE", "IE-A105")).toEqual({ok: false, reason: "impulsive-ruler-hand"});

    // "3 or fewer cards in hand (including this)" — three is legal, four is not.
    G.powers.GE.hand = ["IE-A105", "IE-A018", "IE-A019"];
    expect(cpPlayability(G, "GE", "IE-A105")).toEqual({ok: true});
  });
});

describe("playCard(..., 'cp') — live rejection", () => {
  test("a combat card is spent for its printed CP and discarded", () => {
    const G = fresh();
    expect(playCp(G, COMBAT_CARD)).toBeUndefined();
    expect(G.cpRemaining).toBe(1);
    expect(G.powers.GE.hand).not.toContain(COMBAT_CARD);
    expect(G.discard).toContain(COMBAT_CARD);
    // It is a CP play, not an event: no event text ran and the log says "cp".
    const entry = G.log.find((e) => e.key === "cardPlayed" && e.args?.card === COMBAT_CARD);
    expect(entry?.args?.mode).toBe("cp");
  });

  test("a response card outside its window is spent for CP", () => {
    const G = fresh();
    expect(playCp(G, RESPONSE_CARD)).toBeUndefined();
    expect(G.cpRemaining).toBe(3);
    expect(G.discard).toContain(RESPONSE_CARD);
  });

  test("a mandatory event played for CP still resolves its event and grants its CP", () => {
    const G = fresh();
    const wtt = G.wtt;
    expect(playCp(G, MANDATORY_CARD)).toBeUndefined();
    // The printed event ("Increase the WTT by 1") ran …
    expect(G.wtt).toBe(wtt + 1);
    // … and the card's CP are banked for the impulse.
    expect(G.cpRemaining).toBe(2);
    expect(G.discard).toContain(MANDATORY_CARD);
    // The resolved text is public information, so the log line is the event one
    // (privacy keeps `mode: "cp"` card names masked).
    const entry = G.log.find((e) => e.key === "cardPlayed" && e.args?.card === MANDATORY_CARD);
    expect(entry?.args?.mode).toBe("event");
  });

  test("a mandatory event's event gates still apply to its CP play", () => {
    // A071 Urabi Revolt is optional, but this pins the shared path: a mandatory
    // event whose event is blocked must not resolve while pretending to be CP.
    const G = fresh();
    G.spaces.egypt.control = "OT";
    expect(playCp(G, "IE-A071")).toBeUndefined();
    expect(G.cpRemaining).toBe(2);
  });

  test("a blocked mandatory event is refused in both modes", () => {
    // AU-8 Kaiserreich is printed "Playable after The Dual Monarchy has been
    // played", so the CP play must not be a way around that gate.
    const G = fresh("AU");
    G.powers.AU.hand = ["IE-H-AU-8"];
    expect(playCard(G, makeCtx("AU"), "IE-H-AU-8", "event")).toBe(INVALID_MOVE);
    expect(playCard(G, makeCtx("AU"), "IE-H-AU-8", "cp")).toBe(INVALID_MOVE);
    expect(G.powers.AU.hand).toContain("IE-H-AU-8");
  });

  test("A105 is refused for CP with a crowded hand and logged", () => {
    const G = fresh();
    G.powers.GE.hand = ["IE-A105", "IE-A018", "IE-A019", "IE-A020"];
    expect(playCard(G, makeCtx("GE"), "IE-A105", "cp")).toBe(INVALID_MOVE);
    expect(G.powers.GE.hand).toContain("IE-A105");
    expect(
      G.log.find((e) => e.key === "cardCpNotPlayable" && e.args?.card === "IE-A105")?.args?.reason,
    ).toBe("impulsive-ruler-hand");
  });

  test("the CP wallet still bounds the impulse between plays", () => {
    // The point of the fix is the *card*, not the impulse: a second card cannot
    // be played while the first one's CP are still banked.
    const G = fresh();
    G.powers.GE.hand = [COMBAT_CARD, RESPONSE_CARD];
    expect(playCard(G, makeCtx("GE"), COMBAT_CARD, "cp")).toBeUndefined();
    expect(playCard(G, makeCtx("GE"), RESPONSE_CARD, "cp")).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(1);

    // Spending the wallet opens the next card, exactly as for any CP play.
    expect(spendCpFor(G, "GE", cpBudgetFor(G, "GE"))).toBe(true);
    expect(playCard(G, makeCtx("GE"), RESPONSE_CARD, "cp")).toBeUndefined();
    expect(G.cpRemaining).toBe(3);
  });
});
