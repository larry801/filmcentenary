/**
 * 3.3.1 Power Projection / 33.6 Local Autonomy — the cached `flags.powerProjection`
 * track.
 *
 * Power projection is derived from port control and naval units, and players
 * can dominate the flashpoint at any point in a turn, so the engine stores a
 * cached value that must be refreshed whenever the board changes.  These tests
 * pin the derivation (including the Ottoman Tunisia/Tripoli land-LoC clause)
 * and the three live refresh points: the shared key recompute, a fleet build
 * and a mid-turn control change.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, Unit} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {SPACES} from "./constant/spaces";
import {placeUnit} from "./engine/effects";
import {computePowerProjection, hasOtAutonomyLandLoc, recomputeTracks, refreshPowerProjection} from "./engine/rules";
import {auAction, constructFleet} from "./moves";

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

const startAction = (G: ImperialElegyState, power: Power, cp = 6): void => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  G.pending = null;
};

/** Four Ottoman ships give a naval cap of 8, high enough to expose the port math. */
const otFleet = (G: ImperialElegyState): void => {
  const kinds: Unit["kind"][] = ["squadron", "squadron", "dreadnought", "dreadnought"];
  for (const kind of kinds) placeUnit(G, "OT", kind, "istanbul", 2);
};

describe("3.3.1 power projection is a derived, cached track", () => {
  test("refreshPowerProjection overwrites the flag with the computed value", () => {
    const G = fresh();
    otFleet(G);
    const computed = computePowerProjection(G, "OT");
    expect(computed).toBeGreaterThan(0);

    G.powers.OT.flags.powerProjection = 99;
    refreshPowerProjection(G);
    expect(G.powers.OT.flags.powerProjection).toBe(computed);

    // Idempotent: a second refresh cannot drift.
    refreshPowerProjection(G);
    expect(G.powers.OT.flags.powerProjection).toBe(computed);
  });

  test("the key recompute refreshes every power's flag", () => {
    const G = fresh();
    otFleet(G);
    for (const power of POWERS) G.powers[power].flags.powerProjection = 0;

    recomputeTracks(G);

    for (const power of POWERS) {
      expect(G.powers[power].flags.powerProjection).toBe(computePowerProjection(G, power));
    }
    expect(G.powers.OT.flags.powerProjection).toBeGreaterThan(0);
  });
});

describe("33.6 Local Autonomy: Tunisia and Tripoli and power projection", () => {
  test("their ports do not count without a land line of communication", () => {
    const G = fresh();
    otFleet(G);
    // Eastern Mediterranean 2, Black Sea 2, Indian Ocean 2, Western
    // Mediterranean 1 (Benghazi only: Tunisia/Tripoli are excluded).
    expect(computePowerProjection(G, "OT")).toBe(7);

    // Ceding the two autonomous keys changes nothing while there is no land LoC.
    G.spaces.tripoli.control = "Egypt";
    G.spaces.tunisia.control = "Egypt";
    expect(computePowerProjection(G, "OT")).toBe(7);
  });

  test("they count normally once the Ottomans have a land LoC", () => {
    const G = fresh();
    otFleet(G);
    // Egypt under Ottoman control is the printed land route (33.6).  Egypt's
    // own Western Mediterranean port would mask the two keys inside the
    // per-box cap, so narrow that port for this test only: the Ottomans then
    // reach the box through Benghazi, Tripoli and Tunisia.
    G.spaces.egypt.control = "OT";
    const egypt = SPACES.egypt;
    const ports = egypt.ports;
    try {
      egypt.ports = ["indian-ocean"];
      expect(hasOtAutonomyLandLoc(G, "tripoli")).toBe(true);
      // East 2 + Black Sea 2 + West 2 (Benghazi/Tripoli/Tunisia) + Indian 2.
      expect(computePowerProjection(G, "OT")).toBe(8);

      G.spaces.tripoli.control = "Egypt";
      G.spaces.tunisia.control = "Egypt";
      expect(computePowerProjection(G, "OT")).toBe(7);
    } finally {
      egypt.ports = ports;
    }
  });
});

describe("live refresh points", () => {
  test("constructing a fleet refreshes the naval-unit cap", () => {
    const G = fresh();
    startAction(G, "OT", 6);
    expect(G.powers.OT.flags.powerProjection).toBe(0);

    expect(constructFleet(G, makeCtx(seat("OT")), "istanbul", "squadron")).toBeUndefined();
    expect(G.powers.OT.flags.powerProjection).toBe(2);

    // A092 raises the cap so a dreadnought can be laid down.
    G.powers.OT.flags.navalLimit = true;
    expect(constructFleet(G, makeCtx(seat("OT")), "istanbul", "dreadnought")).toBeUndefined();
    expect(G.powers.OT.flags.powerProjection).toBe(4);
  });

  test("a mid-turn control change refreshes through recomputeTracks", () => {
    const G = fresh();
    // A single AU squadron gives AU a power-projection cap of 2.
    placeUnit(G, "AU", "squadron", "croatia", 2);
    G.powers.AU.flags.powerProjection = 0;

    startAction(G, "AU", 4);
    G.spaces.romania.control = "Romania";
    G.spaces.romania.ally = "AU";
    G.powers.AU.citizenship = ["Romanians"];

    // Incorporate changes control of Romania (a Black Sea port).
    expect(auAction(G, makeCtx(seat("AU")), "incorporate", "romania")).toBeUndefined();
    expect(G.spaces.romania.control).toBe("AU");
    expect(G.powers.AU.flags.powerProjection).toBe(2);
  });
});
