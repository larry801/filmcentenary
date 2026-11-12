/**
 * 12.15 Redeployment is an unlimited-distance move, not a teleport: the path
 * must run by land through spaces the player controls (or uncontrolled spaces
 * where the player has influence) and must end in such a space.  This pins the
 * shared path helper and the live `redeploy` move.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {landUnitsIn, redeployLandPath} from "./engine/rules";
import {neighboursOf} from "./constant/spaces";
import {redeploy} from "./moves";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: () => 3, Number: () => 1, Shuffle: (a: unknown[]) => a},
    events: {
      setActivePlayers: () => undefined,
      setPhase: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 6;
  G.pending = null;
  G.battle = null;
  G.war = null;
  return G;
};

describe("12.15 redeployment land path", () => {
  test("an adjacent controlled space is reachable", () => {
    const G = fresh();
    G.spaces.berlin.control = "GE";
    G.spaces.pomerania.control = "GE";
    expect(neighboursOf("berlin")).toContain("pomerania");
    expect(redeployLandPath(G, "GE", "berlin", "pomerania")).toBe(true);
  });

  test("a destination that is not controlled or influenced is refused", () => {
    const G = fresh();
    G.spaces.berlin.control = "GE";
    G.spaces.pomerania.control = null;
    G.spaces.pomerania.influence = null;
    expect(redeployLandPath(G, "GE", "berlin", "pomerania")).toBe(false);
  });

  test("an uncontrolled space with the player's influence is a legal destination", () => {
    const G = fresh();
    G.spaces.berlin.control = "GE";
    G.spaces.pomerania.control = null;
    G.spaces.pomerania.influence = "GE";
    expect(redeployLandPath(G, "GE", "berlin", "pomerania")).toBe(true);
  });

  test("a multi-hop route is blocked when every intermediate space is enemy-controlled", () => {
    const G = fresh();
    // Berlin and Silesia are not adjacent, so the route needs an intermediate.
    expect(neighboursOf("berlin")).not.toContain("silesia");
    for (const id of Object.keys(G.spaces)) {
      if (id === "berlin" || id === "silesia") continue;
      G.spaces[id].control = "FR";
      G.spaces[id].influence = null;
    }
    G.spaces.berlin.control = "GE";
    G.spaces.silesia.control = "GE";
    expect(redeployLandPath(G, "GE", "berlin", "silesia")).toBe(false);
    // Saxony is the bridge: holding it restores the route.
    G.spaces.saxony.control = "GE";
    expect(redeployLandPath(G, "GE", "berlin", "silesia")).toBe(true);
  });

  test("the live peacetime redeploy refuses an unheld destination", () => {
    const G = fresh();
    G.spaces.berlin.control = "GE";
    G.spaces.pomerania.control = null;
    G.spaces.pomerania.influence = null;
    const army = placeUnit(G, "GE", "army", "berlin", 2);
    const ctx = makeCtx(seat("GE"));
    expect(redeploy(G, ctx, army.id, "pomerania")).toBe("INVALID_MOVE");
    expect(G.units[army.id].space).toBe("berlin");
    // The same move is legal once the destination is held.
    G.spaces.pomerania.control = "GE";
    expect(redeploy(G, ctx, army.id, "pomerania")).toBeUndefined();
    expect(G.units[army.id].space).toBe("pomerania");
    expect(landUnitsIn(G, "pomerania").some((unit) => unit.id === army.id)).toBe(true);
  });
});
