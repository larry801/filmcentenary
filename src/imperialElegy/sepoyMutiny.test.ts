/**
 * A33 Sepoy Mutiny.
 *
 * "The UK player flips the Indian Stability marker to its unstable side. Place
 * 1 Sepoy rebel army and a 0 War of Independence marker in India."
 *
 * 21.1 also prints that a rebel-held space cannot be controlled and the UK
 * loses India's keys until the Sepoys are eliminated.  The handler placed the
 * rebel but never recomputed the tracks, so the key penalty only appeared at
 * the next end phase (or not at all in a short game).
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {cardDrawModifier} from "./engine/characteristics";
import {placeUnit, removeUnit} from "./engine/effects";
import {playCard} from "./moves";

const makeCtx = (playerID = "0"): Ctx => ({
  playerID,
  random: {Die: () => 3},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 3,
  phase: "action",
} as unknown as Ctx);

const seat = (power: Power): string => String(POWERS.indexOf(power));

const begin = (power: Power = "GE"): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 0;
  G.pending = null;
  G.battle = null;
  G.war = null;
  G.powers[power].flags.homeChosen = true;
  G.powers[power].hand = ["IE-A033"];
  return G;
};

describe("A33 Sepoy Mutiny", () => {
  test("the rebel immediately costs the UK India's key and card bonus", () => {
    const G = begin();
    const ctx = makeCtx(seat("GE"));
    const keysBefore = G.powers.UK.colonialKeys;
    expect(cardDrawModifier(G, "UK").sources.some((s) => s.id === "indiaStable")).toBe(true);

    playCard(G, ctx, "IE-A033", "event");

    expect(G.powers.UK.indiaStable).toBe(false);
    expect(G.spaces.india.rebellion?.minor).toBe("Sepoy");
    expect(G.spaces.india.units.some((id) => G.units[id]?.kind === "rebelArmy")).toBe(true);
    // India is the Crown Jewel: it normally counts as two colonial keys.
    expect(G.powers.UK.colonialKeys).toBe(keysBefore - 2);
    expect(cardDrawModifier(G, "UK").sources.some((s) => s.id === "indiaStable")).toBe(false);

    // Eliminating the Sepoy clears the 0 WoI marker and restores the keys.
    const rebel = G.spaces.india.units.find((id) => G.units[id]?.kind === "rebelArmy")!;
    removeUnit(G, rebel);
    expect(G.spaces.india.rebellion).toBeNull();
  });

  test("a second Sepoy Mutiny does not leave an untracked rebel", () => {
    const G = begin();
    const ctx = makeCtx(seat("GE"));
    playCard(G, ctx, "IE-A033", "event");
    const first = G.spaces.india.units.find((id) => G.units[id]?.kind === "rebelArmy")!;
    // A second copy is not printed, but a stale save can still carry one rebel
    // in the rebellion record; adding another must keep the record coherent.
    placeUnit(G, "REBEL:Sepoy", "rebelArmy", "india", 2);
    removeUnit(G, first);
    expect(G.spaces.india.rebellion).not.toBeNull();
  });
});
