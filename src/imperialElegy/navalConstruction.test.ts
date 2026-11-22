/**
 * 12.4 Construct Fleets: "Newly built fleets must be placed in a controlled,
 * territorial home key on the main map with a port."
 *
 * The old gate accepted any home key with a port, which let a player build
 * squadrons in Canada, India, South Africa or Australia — colonial home keys on
 * the Africa/Asia/North America submaps, not territorial keys on the main map.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {constructFleet} from "./moves";
import {hasOtAutonomyLandLoc} from "./engine/rules";

const makeCtx = (power: Power, cp = 20): Ctx => ({
  playerID: String(POWERS.indexOf(power)),
  random: {Die: () => 3, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
} as unknown as Ctx);

const game = (power: Power = "UK", cp = 20): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx(power));
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  G.pending = null;
  G.battle = null;
  G.war = null;
  return G;
};

describe("12.4 fleet construction is main-map territorial home keys only", () => {
  test("a territorial home port accepts a squadron", () => {
    const G = game("UK");
    expect(constructFleet(G, makeCtx("UK"), "london", "squadron")).toBeUndefined();
    expect(G.cpRemaining).toBe(18);
  });

  test("colonial home keys on a submap are refused", () => {
    for (const space of ["canada", "india", "south-africa", "australia-new-zealand"]) {
      const G = game("UK");
      expect(constructFleet(G, makeCtx("UK"), space, "squadron")).toBe(INVALID_MOVE);
      expect(G.cpRemaining).toBe(20);
    }
  });

  test("Tripoli needs Local Autonomy's land LoC before it counts as a territorial home key", () => {
    const G = game("OT", 20);
    // At campaign setup Egypt is an independent minor, so Tripoli/Tunisia only
    // connect to each other and neither counts as a key yet (33.6).
    expect(hasOtAutonomyLandLoc(G, "tripoli")).toBe(false);
    expect(constructFleet(G, makeCtx("OT"), "tripoli", "squadron")).toBe(INVALID_MOVE);
    // A land route to another Ottoman key makes them territorial keys, and the
    // printed fleet action then applies.
    G.spaces.egypt.control = "OT";
    // Benghazi-Egypt is a sea edge; the overland route crosses the Great Sand
    // Sea, which must therefore be Ottoman-controlled too.
    G.spaces["great-sand-sea"].control = "OT";
    expect(hasOtAutonomyLandLoc(G, "tripoli")).toBe(true);
    expect(constructFleet(G, makeCtx("OT"), "tripoli", "squadron")).toBeUndefined();
    expect(G.cpRemaining).toBe(18);
  });

  test("a non-port home key is still refused", () => {
    const G = game("FR");
    // Paris is a French home key with no printed port.
    expect(constructFleet(G, makeCtx("FR"), "paris", "squadron")).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(20);
  });

  test("another power's home port is refused", () => {
    const G = game("UK");
    expect(constructFleet(G, makeCtx("UK"), "prussia", "squadron")).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(20);
  });
});
