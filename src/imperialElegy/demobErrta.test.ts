/**
 * Rule 17.0 (errata): "Displace any units that are not in friendly controlled
 * home spaces [5.7].  For the purposes of this rule, also displace units in ally
 * controlled or occupied spaces."
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {createWarState, demobilizeWar} from "./engine/limitedWar";

const makeCtx = (): Ctx => ({
  playerID: "0",
  random: {Die: () => 2, Shuffle: (items: unknown[]) => items},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "wartime",
}) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

describe("17.0 errata displacement", () => {
  test("own home stays; an ally's space displaces", () => {
    const G = fresh();
    G.phase = "wartime";
    G.pending = null;
    const war = createWarState(G, "GE", "FR", "conquest", ["alsace-lorraine"], 2);
    G.war = war;
    // Bavaria is allied to GE (an allied-controlled space, not a GE home).
    G.spaces.bavaria.control = "Bavaria";
    G.spaces.bavaria.ally = "GE";
    G.spaces.bavaria.units = [];
    const home = placeUnit(G, "GE", "army", "berlin", 2);
    const allied = placeUnit(G, "GE", "army", "bavaria", 2);
    expect(G.spaces.berlin.units).toContain(home.id);

    expect(demobilizeWar(G, war, makeCtx()).ok).toBe(true);
    // The home army stays on its controlled home space; the allied-space army
    // is displaced (nearest friendly LoC space, never left in ally territory).
    expect(G.units[home.id].space).toBe("berlin");
    expect(G.units[allied.id].space).not.toBe("bavaria");
  });
});
