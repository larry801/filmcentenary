/**
 * H-FR-6 Aux Armes, Citoyens!
 *
 * The card is a printed OR: the war half — 2 reserve army steps, then the
 * CP-valued war declaration — or the retrieval half — French Intervention or
 * Papal Influence from the discard pile, playable immediately.  With nothing
 * retrievable only the war half remains, and the war half's 2 steps arrive as
 * two 1-step reserve counters, the same reading 20.1's militarism step gives
 * its one army step.
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
  test("the printed OR is a mode decision and the retrieval half takes a card", () => {
    const G = begin();
    const ctx = makeCtx(seat("FR"));
    playCard(G, ctx, "IE-H-FR-6", "event");
    expect(G.pending?.kind).toBe("eventChoice");
    expect(options(G).sort()).toEqual(["retrieve", "war"]);

    expect(resolvePending(G, ctx, "retrieve")).toBeUndefined();
    expect(G.pending?.kind).toBe("eventChoice");
    expect(options(G).sort()).toEqual(["take:IE-A046", "take:IE-A070"]);
    expect(resolvePending(G, ctx, "take:IE-A046")).toBeUndefined();
    expect(G.powers.FR.hand).toContain("IE-A046");
    expect(G.discard).not.toContain("IE-A046");
    expect(G.discard).toContain("IE-A070");
    expect(G.powers.FR.flags.auxArmesFreePlay).toBe("IE-A046");
    // The retrieval half grants no reserve steps and no declaration.
    expect(G.powers.FR.reserves).toHaveLength(0);
    expect(G.powers.FR.flags.warDeclaration).toBeUndefined();
  });

  test("the taken card can be played immediately, once", () => {
    const G = begin();
    const ctx = makeCtx(seat("FR"));
    playCard(G, ctx, "IE-H-FR-6", "event");
    expect(resolvePending(G, ctx, "retrieve")).toBeUndefined();
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

  test("the war half grants two 1-step reserve counters and the declaration", () => {
    const G = begin();
    const ctx = makeCtx(seat("FR"));
    playCard(G, ctx, "IE-H-FR-6", "event");
    expect(resolvePending(G, ctx, "war")).toBeUndefined();
    expect(G.pending).toBeNull();
    const reserves = G.powers.FR.reserves.map((id: string) => G.units[id]);
    expect(reserves).toHaveLength(2);
    for (const unit of reserves) expect(unit.steps).toBe(1);
    expect(G.powers.FR.flags.warDeclaration).toBe(true);
    expect(G.powers.FR.flags.warDeclarationCard).toBe("IE-H-FR-6");
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
