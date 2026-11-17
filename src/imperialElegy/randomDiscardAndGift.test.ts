/**
 * Two "draw one card at random" moves, not "pick a card" moves:
 *
 *  - the optional prep discard for +1 stability, and
 *  - the diplomacy gift of one card to another power.
 *
 * Both used to accept a specific card from the client, which turns a random
 * draw into a free choice: a player could dump the worst card and keep the
 * good one, or push a chosen card onto an ally.  The move now resolves the
 * card from `ctx.random`, so its arguments cannot name a card at all.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {cardById} from "./engine/deck";
import {discardForStability, giveCard} from "./moves";

const seat = (power: Power): string => String(POWERS.indexOf(power));

/**
 * `Die(sides)` is 1-based, so a face of `n` selects index `n - 1`.  `faced`
 * repeats its last value once the list runs out.
 */
const makeCtx = (faces: number[] = [], power: Power = "GE"): Ctx => {
  let index = 0;
  return {
    playerID: seat(power),
    random: {
      Die: (sides: number) => Math.min(sides, faces[Math.min(index++, faces.length - 1)] ?? 1),
    },
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 2,
    phase: "prep",
  } as unknown as Ctx;
};

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/** A deliberate hand so the index each test selects is unambiguous. */
const FIXED_HAND = ["IE-A018", "IE-A019", "IE-A020"];

describe("prep discard for stability is a random draw", () => {
  test("the die selects the discarded card, not the caller", () => {
    const G = fresh();
    G.phase = "prep";
    G.activePower = "GE";
    G.powers.GE.stability = 2;
    G.powers.GE.hand = [...FIXED_HAND];
    const before = G.powers.GE.stability;

    // Face 2 selects hand index 1.
    expect(discardForStability(G, makeCtx([2]))).toBeUndefined();

    expect(G.powers.GE.hand).toEqual([FIXED_HAND[0], FIXED_HAND[2]]);
    expect(G.powers.GE.hand).not.toContain(FIXED_HAND[1]);
    expect(G.powers.GE.stability).toBe(before + 1);
    expect(G.powers.GE.flags.prepStability).toBe(true);
    expect(G.log.find((entry) => entry.key === "prepStabilityDiscard")?.args?.card).toBe(FIXED_HAND[1]);
  });

  test("a different die face discards a different card", () => {
    const G = fresh();
    G.phase = "prep";
    G.powers.GE.hand = [...FIXED_HAND];

    expect(discardForStability(G, makeCtx([3]))).toBeUndefined();
    expect(G.powers.GE.hand).toEqual([FIXED_HAND[0], FIXED_HAND[1]]);
  });

  test("mandatory events and home cards are never drawn", () => {
    const G = fresh();
    G.phase = "prep";
    // The mandatory card sits first; an unclamped draw would take it.
    const mandatory = G.powers.GE.hand.find((id) => cardById(id).type === "mandatory")!;
    const home = G.powers.GE.homeCards[0];
    G.powers.GE.hand = [mandatory, home, "IE-A019"];

    expect(discardForStability(G, makeCtx([1]))).toBeUndefined();
    expect(G.powers.GE.hand).toContain(mandatory);
    expect(G.powers.GE.hand).toContain(home);
    expect(G.powers.GE.hand).not.toContain("IE-A019");
  });

  test("only one discard is allowed per prep phase", () => {
    const G = fresh();
    G.phase = "prep";
    G.powers.GE.hand = [...FIXED_HAND];
    expect(discardForStability(G, makeCtx([1]))).toBeUndefined();
    expect(discardForStability(G, makeCtx([1]))).toBe(INVALID_MOVE);
  });

  test("with no eligible card the move is refused instead of crashing", () => {
    const G = fresh();
    G.phase = "prep";
    G.powers.GE.hand = [G.powers.GE.homeCards[0]];
    expect(discardForStability(G, makeCtx([1]))).toBe(INVALID_MOVE);
    expect(G.powers.GE.flags.prepStability).toBeFalsy();
  });

  test("outside the prep phase the move is refused", () => {
    const G = fresh();
    G.phase = "action";
    G.powers.GE.hand = [...FIXED_HAND];
    expect(discardForStability(G, makeCtx([1]))).toBe(INVALID_MOVE);
  });
});

describe("the diplomacy gift is a random draw", () => {
  const diplomacy = (): ImperialElegyState => {
    const G = fresh();
    G.phase = "diplomacy";
    G.activePower = "GE";
    G.powers.GE.hand = [...FIXED_HAND];
    return G;
  };

  test("the die selects the gifted card, not the caller", () => {
    const G = diplomacy();
    const ctx = makeCtx([2]);

    expect(giveCard(G, ctx, "FR")).toBeUndefined();

    expect(G.powers.GE.hand).toEqual([FIXED_HAND[0], FIXED_HAND[2]]);
    expect(G.powers.FR.hand).toContain(FIXED_HAND[1]);
    expect(G.log.find((entry) => entry.key === "cardGiven")?.args).toMatchObject({
      card: FIXED_HAND[1],
      target: "FR",
    });
  });

  test("home cards are never gifted", () => {
    const G = diplomacy();
    const home = G.powers.GE.homeCards[0];
    G.powers.GE.hand = [home, "IE-A019"];

    expect(giveCard(G, makeCtx([1]), "FR")).toBeUndefined();
    expect(G.powers.FR.hand).not.toContain(home);
    expect(G.powers.FR.hand).toContain("IE-A019");
    expect(G.powers.GE.hand).toContain(home);
  });

  test("a power cannot give to itself", () => {
    const G = diplomacy();
    expect(giveCard(G, makeCtx([1]), "GE")).toBe(INVALID_MOVE);
    expect(G.powers.GE.hand).toEqual(FIXED_HAND);
  });

  test("an empty hand has nothing to give", () => {
    const G = diplomacy();
    G.powers.GE.hand = [];
    expect(giveCard(G, makeCtx([1]), "FR")).toBe(INVALID_MOVE);
  });

  test("gifts are diplomacy-only", () => {
    const G = diplomacy();
    G.phase = "action";
    expect(giveCard(G, makeCtx([1]), "FR")).toBe(INVALID_MOVE);
    expect(G.powers.GE.hand).toEqual(FIXED_HAND);
  });
});
