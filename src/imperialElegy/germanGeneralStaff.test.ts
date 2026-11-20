/**
 * H-GE-2 German General Staff.
 *
 * "Gain 1 stability. Take any response or combat card from the discard pile; it
 * cannot be played this impulse. OR gain 1 stability and two elite corps."
 *
 * The handler always took the first eligible discard card and never offered the
 * two-elite-corps option.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {ALL_CARDS} from "./engine/deck";
import {placeUnit} from "./engine/effects";
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
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.pending = null;
  G.battle = null;
  G.war = null;
  G.powers.GE.flags.homeChosen = true;
  G.powers.GE.hand = ["IE-H-GE-2"];
  return G;
};

const options = (G: ImperialElegyState): string[] => G.pending?.options.map((o) => o.id) ?? [];

describe("H-GE-2 German General Staff", () => {
  test("offers the printed OR instead of taking the first discard card", () => {
    const G = begin();
    const response = ALL_CARDS.find((c) => c.type === "response")!;
    G.discard.push(response.id);
    const ctx = makeCtx(seat("GE"));

    playCard(G, ctx, "IE-H-GE-2", "event");
    expect(G.pending?.kind).toBe("eventChoice");
    expect(options(G)).toEqual(expect.arrayContaining(["card", "ec"]));
    expect(G.powers.GE.hand).not.toContain(response.id);
    expect(G.powers.GE.stability).toBe(4);
  });

  test("the card option lets the player pick which discard card to take", () => {
    const G = begin();
    const a = ALL_CARDS.find((c) => c.type === "response")!;
    const b = ALL_CARDS.find((c) => c.type === "combat")!;
    G.discard.push(a.id, b.id);
    const ctx = makeCtx(seat("GE"));

    playCard(G, ctx, "IE-H-GE-2", "event");
    expect(resolvePending(G, ctx, "card")).toBeUndefined();
    expect(G.pending?.kind).toBe("eventChoice");
    expect(options(G)).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(resolvePending(G, ctx, b.id)).toBeUndefined();

    expect(G.powers.GE.hand).toContain(b.id);
    expect(G.discard).not.toContain(b.id);
    expect(G.powers.GE.stability).toBe(4);
  });

  test("the EC option places two elite corps with an army", () => {
    const G = begin();
    G.spaces.berlin.control = "GE";
    placeUnit(G, "GE", "army", "berlin", 2);
    const before = Object.values(G.units).filter((u) => u.owner === "GE" && u.kind === "eliteCorps" && u.space === "berlin").length;
    const response = ALL_CARDS.find((c) => c.type === "response")!;
    G.discard.push(response.id);
    const ctx = makeCtx(seat("GE"));

    playCard(G, ctx, "IE-H-GE-2", "event");
    expect(resolvePending(G, ctx, "ec")).toBeUndefined();
    expect(Object.values(G.units).filter((u) => u.owner === "GE" && u.kind === "eliteCorps" && u.space === "berlin")).toHaveLength(before + 2);
    expect(G.powers.GE.stability).toBe(4);
  });
});
