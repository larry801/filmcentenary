/**
 * H-FR-6 Aux Armes, Citoyens!
 *
 * "Take either French Intervention or Papal Influence from the discard pile;
 * you may play it immediately."  The handler only granted the reserve steps and
 * the war declaration, leaving both cards in the discard.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {playCard, resolvePending} from "./moves";

const makeCtx = (playerID = "0"): Ctx => ({
  playerID,
  random: {Die: () => 3},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 3,
  phase: "action",
} as unknown as Ctx);

const seat = (power: Power): string => String(POWERS.indexOf(power));

const begin = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = "FR";
  G.cpRemaining = 0;
  G.pending = null;
  G.battle = null;
  G.war = null;
  G.powers.FR.flags.homeChosen = true;
  G.powers.FR.hand = ["IE-H-FR-6"];
  G.discard.push("IE-A046", "IE-A070");
  return G;
};

const options = (G: ImperialElegyState): string[] => G.pending?.options.map((o) => o.id) ?? [];

describe("H-FR-6 Aux Armes", () => {
  test("the player takes one of the two printed cards from the discard", () => {
    const G = begin();
    const ctx = makeCtx(seat("FR"));
    playCard(G, ctx, "IE-H-FR-6", "event");
    expect(G.pending?.kind).toBe("eventChoice");
    expect(options(G).sort()).toEqual(["take:IE-A046", "take:IE-A070"]);

    expect(resolvePending(G, ctx, "take:IE-A046")).toBeUndefined();
    expect(G.powers.FR.hand).toContain("IE-A046");
    expect(G.discard).not.toContain("IE-A046");
    expect(G.discard).toContain("IE-A070");
    expect(G.powers.FR.flags.auxArmesFreePlay).toBe("IE-A046");
  });

  test("the taken card can be played immediately, once", () => {
    const G = begin();
    const ctx = makeCtx(seat("FR"));
    playCard(G, ctx, "IE-H-FR-6", "event");
    expect(resolvePending(G, ctx, "take:IE-A046")).toBeUndefined();

    // The home card is already this impulse's card; Aux Armes grants the
    // printed immediate play for the taken card only.
    expect(playCard(G, makeCtx(seat("FR")), "IE-A046", "event")).toBeUndefined();
    expect(G.powers.FR.flags.auxArmesFreePlay).toBeUndefined();
    // French Intervention opened its own target-space decision.
    expect(G.pending?.kind).toBe("eventTargetSpace");

    // Without the marker, a second play is refused again.
    G.pending = null;
    expect(playCard(G, makeCtx(seat("FR")), "IE-A070", "event")).toBe(INVALID_MOVE);
  });

  test("with neither card in the discard the event still grants the declaration", () => {
    const G = begin();
    G.discard = G.discard.filter((id) => id !== "IE-A046" && id !== "IE-A070");
    const ctx = makeCtx(seat("FR"));
    playCard(G, ctx, "IE-H-FR-6", "event");
    expect(G.pending).toBeNull();
    expect(G.powers.FR.flags.auxArmesFreePlay).toBeUndefined();
  });
});
