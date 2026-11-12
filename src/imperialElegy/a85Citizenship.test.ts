/**
 * A85 Hungarian Obstinacy — "Austria-Hungary cannot grant citizenship or
 * rights for the rest of the turn."
 *
 * The delivered bug was a scope mismatch: the generic `flag` effect wrote the
 * playing power's `flags.auNoCitizenship`, while every reader checked the
 * global `G.flags` slot.  A85 now carries `scope: "global"`, so the card, the
 * AU special actions and the AU card handlers all read the same typed slot.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {cardById} from "./engine/deck";
import {resolveCard} from "./engine/effects";
import {clearTurnDurationFlags} from "./engine/rules";
import {
  auCitizenshipBlocked,
  auRightsDecision,
  canGrantCitizenship,
} from "./engine/characteristics";
import {auAction, playCard, resolveEnd} from "./moves";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: (_sides: number) => 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const playA85 = (G: ImperialElegyState, by: Power): Ctx => {
  G.phase = "action";
  G.activePower = by;
  G.cpRemaining = 0;
  G.pending = null;
  G.powers[by].hand.push("IE-A085");
  const ctx = makeCtx(seat(by));
  expect(playCard(G, ctx, "IE-A085", "event")).toBeUndefined();
  return ctx;
};

describe("A85 Hungarian Obstinacy flag scope", () => {
  test("playing the card writes the global AU restriction, not the player's flag bag", () => {
    const G = fresh();

    playA85(G, "UK");

    expect(G.flags.auNoCitizenship).toBe(true);
    expect(auCitizenshipBlocked(G)).toBe(true);
    // The old bug wrote whichever power played the card.
    expect(G.powers.UK.flags.auNoCitizenship).toBeUndefined();
    expect(G.powers.AU.flags.auNoCitizenship).toBeUndefined();
  });

  test("the card is global whichever power plays it", () => {
    const G = fresh();

    playA85(G, "AU");

    expect(G.flags.auNoCitizenship).toBe(true);
    expect(G.powers.AU.flags.auNoCitizenship).toBeUndefined();
  });

  test("Reforms and Expand Citizenship are rejected while A85 is active", () => {
    const G = fresh();
    playA85(G, "UK");
    G.phase = "action";
    G.activePower = "AU";
    G.cpRemaining = 6;
    G.pending = null;
    const ctx = makeCtx(seat("AU"));

    expect(auRightsDecision(G, "Czechs").allowed).toBe(false);
    expect(auRightsDecision(G, "Czechs").reasons.join(" ")).toContain("cannot grant citizenship or rights");
    expect(auAction(G, ctx, "reforms", "Czechs")).toBe(INVALID_MOVE);
    expect(G.powers.AU.rights).toEqual([]);
    expect(G.cpRemaining).toBe(6);

    // Expand Citizenship needs rights first; give AU the right directly so the
    // only remaining blocker is A85 itself.
    G.powers.AU.rights = ["Czechs"];
    const expand = canGrantCitizenship(G, "AU", "Czechs");
    expect(expand.allowed).toBe(false);
    expect(expand.reasons.join(" ")).toContain("cannot grant citizenship or rights");
    expect(auAction(G, ctx, "expandCitizenship", "Czechs")).toBe(INVALID_MOVE);
    expect(G.powers.AU.citizenship).toEqual([]);
    expect(G.cpRemaining).toBe(6);
  });

  test("clearing the turn flag restores both AU special actions", () => {
    const G = fresh();
    playA85(G, "UK");
    G.phase = "action";
    G.activePower = "AU";
    G.cpRemaining = 6;
    G.pending = null;
    const ctx = makeCtx(seat("AU"));

    clearTurnDurationFlags(G);
    expect(auCitizenshipBlocked(G)).toBe(false);

    expect(auRightsDecision(G, "Czechs").allowed).toBe(true);
    expect(auAction(G, ctx, "reforms", "Czechs")).toBeUndefined();
    expect(G.powers.AU.rights).toContain("Czechs");
    expect(G.cpRemaining).toBe(3);

    expect(canGrantCitizenship(G, "AU", "Czechs").allowed).toBe(true);
    expect(auAction(G, ctx, "expandCitizenship", "Czechs")).toBeUndefined();
    expect(G.powers.AU.citizenship).toContain("Czechs");
  });

  test("the live end phase clears the restriction at the turn boundary", () => {
    const G = fresh();
    playA85(G, "UK");

    resolveEnd(G, makeCtx());

    expect(G.flags.auNoCitizenship).toBe(false);
    expect(auCitizenshipBlocked(G)).toBe(false);
  });
});

describe("A85 blocks the AU card handlers that grant rights/citizenship", () => {
  test("A48 Multicultural Empire does nothing while A85 is active", () => {
    const G = fresh();
    playA85(G, "UK");
    const stabilityBefore = G.powers.AU.stability;
    const ctx = makeCtx(seat("AU"));

    expect(resolveCard(G, ctx, "AU", cardById("IE-A048"))).toBe(true);

    expect(G.powers.AU.rights).toEqual([]);
    expect(G.powers.AU.citizenship).toEqual([]);
    expect(G.powers.AU.stability).toBe(stabilityBefore);
  });

  test("A95 Death of Franz Joseph records the death but grants nothing while A85 is active", () => {
    const G = fresh();
    playA85(G, "UK");
    const ctx = makeCtx(seat("AU"));

    expect(resolveCard(G, ctx, "AU", cardById("IE-A095"))).toBe(true);

    expect(G.persistent.franzJosephDead).toBe(true);
    expect(G.powers.AU.rights).toEqual([]);
    expect(G.powers.AU.citizenship).toEqual([]);
  });

  test("A103 Bosnian Crisis still annexes Bosnia but does not grant Bosnian rights", () => {
    const G = fresh();
    playA85(G, "UK");
    const ctx = makeCtx(seat("AU"));

    expect(resolveCard(G, ctx, "AU", cardById("IE-A103"))).toBe(true);

    expect(G.spaces["bosnia-herzegovina"].control).toBe("AU");
    expect(G.powers.AU.rights).not.toContain("Bosnians");
  });

  test("negative: without A85 the same A95 handler grants rights", () => {
    const G = fresh();
    const ctx = makeCtx(seat("AU"));

    expect(resolveCard(G, ctx, "AU", cardById("IE-A095"))).toBe(true);

    expect(G.persistent.franzJosephDead).toBe(true);
    expect(G.powers.AU.rights.length + G.powers.AU.citizenship.length).toBe(1);
  });
});
