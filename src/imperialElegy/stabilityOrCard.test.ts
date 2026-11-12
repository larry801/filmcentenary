/**
 * A17 Assassination!, A18 Socialist Musings and A56 Nationalism:
 *
 * "Choose a player.  That player must either decrease their stability by 1 or
 * discard a random card (they must decrease their stability if they cannot
 * discard a card)."
 *
 * The actor chooses the target and the victim makes the stability/discard
 * choice; A56 additionally restricts the target to a player controlling a
 * minority-nationality space, gives the actor +1 stability, and A18 rolls a
 * backfire die (on 1 the actor suffers the same effect).
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {playCard, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (sides: number) => Math.min(sides, dice[Math.min(index++, dice.length - 1)] ?? 3)},
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
const ctxFor = (power: Power, dice: number[] = []): Ctx => makeCtx(dice, seat(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const playEvent = (G: ImperialElegyState, cardId: string, power: Power = "GE", dice: number[] = []): Ctx => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 0;
  if (!G.powers[power].hand.includes(cardId)) G.powers[power].hand.push(cardId);
  const ctx = ctxFor(power, dice);
  expect(playCard(G, ctx, cardId, "event")).toBeUndefined();
  return ctx;
};

describe("stability-or-card event choices", () => {
  test("A17 lets the chosen player discard a random card instead of losing stability", () => {
    const G = fresh();
    playEvent(G, "IE-A017");
    expect(G.pending?.kind).toBe("eventTargetPower");
    expect(G.pending?.power).toBe("GE");
    const target = (G.pending!.options[0].id as Power);
    const handBefore = G.powers[target].hand.length;
    const stabilityBefore = G.powers[target].stability;
    expect(handBefore).toBeGreaterThan(0);

    expect(resolvePending(G, ctxFor("GE"), target)).toBeUndefined();
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.power).toBe(target);

    expect(resolvePending(G, ctxFor(target, [1]), "discard")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.powers[target].hand.length).toBe(handBefore - 1);
    expect(G.powers[target].stability).toBe(stabilityBefore);
  });

  test("with no card the victim must take the stability loss", () => {
    const G = fresh();
    playEvent(G, "IE-A017");
    const target = G.pending!.options[0].id as Power;
    G.powers[target].hand = [];
    const stabilityBefore = G.powers[target].stability;

    expect(resolvePending(G, ctxFor("GE"), target)).toBeUndefined();
    // No eventChoice is opened: the printed "must decrease stability" applies.
    expect(G.pending).toBeNull();
    expect(G.powers[target].stability).toBe(stabilityBefore - 1);
  });

  test("A56 gives the actor +1 stability and the victim the choice", () => {
    const G = fresh();
    const actorStability = G.powers.GE.stability;
    playEvent(G, "IE-A056");
    expect(G.pending?.kind).toBe("eventTargetPower");
    const target = G.pending!.options[0].id as Power;
    expect(target).not.toBe("GE");
    const stabilityBefore = G.powers[target].stability;

    expect(resolvePending(G, ctxFor("GE"), target)).toBeUndefined();
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.power).toBe(target);
    expect(resolvePending(G, ctxFor(target), "stability")).toBeUndefined();
    expect(G.powers[target].stability).toBe(stabilityBefore - 1);
    expect(G.powers.GE.stability).toBe(actorStability + 1);
  });

  test("A18's backfire die on 1 repeats the effect against the actor", () => {
    const G = fresh();
    playEvent(G, "IE-A018", "GE", [1]);
    const target = G.pending!.options[0].id as Power;
    expect(resolvePending(G, ctxFor("GE"), target)).toBeUndefined();
    // Target takes the stability loss; the backfire roll is 1, so the actor
    // gets the same choice.
    expect(resolvePending(G, ctxFor(target, [1]), "stability")).toBeUndefined();
    expect(G.log.some((entry) => entry.key === "stabilityOrCardBackfire" && entry.args?.roll === 1)).toBe(true);
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.power).toBe("GE");
    const actorHand = G.powers.GE.hand.length;
    expect(resolvePending(G, ctxFor("GE", [1]), "discard")).toBeUndefined();
    expect(G.powers.GE.hand.length).toBe(actorHand - 1);
  });
});
