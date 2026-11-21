/**
 * 25.2.1 / 23.3 — a minor power's GW participation is a *drawn* event, not an
 * inherited ally marker.
 *
 * Printed:
 *  - 25.2.1 — "Minor power allies will not join the GW at this time. They will
 *    only join the GW via certain special crisis table results or the Minor
 *    Power Entry GW card."
 *  - 23.0's `**` note — those results "draw minor powers into the GW when it
 *    starts (otherwise no minor powers enter the war when it starts regardless
 *    of who is their current ally)".
 *  - 23.3.1–23.3.3 — the bordering-nation and Balkan Table results place ally
 *    markers "to determine who will control those powers during the GW", and
 *    23.3.3 adds "remember that Balkan powers can switch allies at this time".
 *
 * `SpaceState.ally` alone cannot express this: a minor allied in an earlier
 * limited war keeps its marker, and a drawn GW belligerent gets the same one.
 * The engine therefore keeps `G.flags.gwMinorBelligerents` (the home spaces of
 * minors actually drawn in), read through `gwMinorBelligerents`.
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {gwMinorBelligerents, markMinorGwBelligerent} from "./engine/greatWar";
import {createWarState} from "./engine/limitedWar";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const gwState = (): GreatWarState =>
  ({
    active: true,
    turn: 0,
    order: ["GE", "UK", "FR", "AU", "RU", "OT"],
    belligerents: ["GE", "UK", "FR", "AU", "RU", "OT"],
    neutrals: [],
    te: ["UK", "FR"],
    ta: ["GE", "AU"],
    usIn: false,
    italyIn: false,
    usStability: 3,
    usManpower: 3,
    usBudget: 4,
    italyStability: 3,
    italyManpower: 3,
    italyBudget: 2,
    trenches: {},
    lastColonialWar: null,
    victor: null,
    outbreakDone: true,
    nationalWillDone: true,
    bonusImpulses: [],
    combatCardsInFront: [],
  }) as unknown as GreatWarState;

describe("25.2.1 — pre-GW minor allies do not become GW belligerents by themselves", () => {
  test("a leftover limited-war ally marker on a minor home is not a GW belligerent", () => {
    const G = fresh();
    // A limited war left its mark: the minor is allied to GE, then the war ends.
    G.war = createWarState(G, "GE", "FR", "conquest", ["belgium"], 2);
    G.war.status = "done";
    G.spaces.belgium.ally = "GE";
    G.gw = gwState();

    expect(G.spaces.belgium.ally).toBe("GE");
    expect(gwMinorBelligerents(G)).toEqual([]);
  });

  test("a `**` crisis draw stamps the minor as a GW belligerent", () => {
    const G = fresh();
    G.gw = gwState();
    markMinorGwBelligerent(G, "serbia");
    expect(gwMinorBelligerents(G)).toEqual(["serbia"]);
    // Recording the same draw twice cannot duplicate it.
    markMinorGwBelligerent(G, "serbia");
    expect(gwMinorBelligerents(G)).toEqual(["serbia"]);
    markMinorGwBelligerent(G, "belgium");
    expect(gwMinorBelligerents(G).sort()).toEqual(["belgium", "serbia"]);
  });

  test("the drawn list is public state that survives a JSON save", () => {
    let G = fresh();
    G.gw = gwState();
    markMinorGwBelligerent(G, "greece");
    G = JSON.parse(JSON.stringify(G));
    expect(gwMinorBelligerents(G)).toEqual(["greece"]);
    // A save made before the field existed reads as "nothing drawn".
    delete G.flags.gwMinorBelligerents;
    expect(gwMinorBelligerents(G)).toEqual([]);
  });

  test("the player-side helper never marks a major power's own seat", () => {
    for (const power of POWERS) {
      const G = fresh();
      expect(gwMinorBelligerents(G)).not.toContain(power);
    }
  });
});
