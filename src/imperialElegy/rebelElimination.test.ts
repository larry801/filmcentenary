/**
 * 21.0 — "If a rebel army under a WoI marker is ever eliminated, the WoI
 * marker is also removed, and the player regains control of the space."
 *
 * `rebellion.rebels` was only written when an event placed a rebel; `removeUnit`
 * never cleaned it up.  `recomputeTracks` then skipped the space forever, so the
 * controlling player never got the key (and India never got its card) back.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {recomputeTracks} from "./engine/rules";

const makeCtx = (): Ctx => ({
  playerID: "0",
  random: {Die: () => 3},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
} as unknown as Ctx);

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

describe("21.0 rebel elimination", () => {
  test("removing the last rebel removes the WoI marker and restores the key", () => {
    const G = fresh();
    G.spaces.india.control = "UK";
    G.spaces.india.rebellion = {minor: "Sepoy", step: 0, rebels: []};
    recomputeTracks(G);
    const base = G.powers.UK.colonialKeys;

    const rebel = placeUnit(G, "REBEL:Sepoy", "rebelArmy", "india", 2);
    G.spaces.india.rebellion!.rebels.push(rebel.id);
    recomputeTracks(G);
    expect(G.powers.UK.colonialKeys).toBeLessThan(base);

    removeUnit(G, rebel.id);
    expect(G.spaces.india.rebellion).toBeNull();
    expect(G.spaces.india.control).toBe("UK");
    recomputeTracks(G);
    expect(G.powers.UK.colonialKeys).toBe(base);
  });

  test("the WoI stays while another rebel army remains", () => {
    const G = fresh();
    G.spaces.india.control = "UK";
    G.spaces.india.rebellion = {minor: "Sepoy", step: 0, rebels: []};
    const first = placeUnit(G, "REBEL:Sepoy", "rebelArmy", "india", 2);
    const second = placeUnit(G, "REBEL:Sepoy", "rebelArmy", "india", 2);
    G.spaces.india.rebellion!.rebels.push(first.id, second.id);

    removeUnit(G, first.id);
    expect(G.spaces.india.rebellion).not.toBeNull();
    expect(G.spaces.india.rebellion?.rebels).toEqual([second.id]);

    removeUnit(G, second.id);
    expect(G.spaces.india.rebellion).toBeNull();
  });
});
