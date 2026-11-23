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
import {CAMPAIGN_SETUP} from "./constant/setup";
import {placeUnit} from "./engine/effects";
import {cardsToDraw, computePowerProjection, flashpointController, hasOtAutonomyLandLoc, recomputeTracks, refreshPowerProjection} from "./engine/rules";
import {auAction, constructFleet, playCard} from "./moves";

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
  test("campaign projection follows the port formula on every printed power", () => {
    const G = fresh();
    expect(Object.fromEntries(POWERS.map((power) => [power, computePowerProjection(G, power)])))
      .toEqual(CAMPAIGN_SETUP.powerProjection);
    // France's three points are North Atlantic, Western Mediterranean and the
    // South Atlantic anchor on Algeria; the printed FR 3 and the rule formula
    // agree, so the setup display and the first end-phase recompute cannot
    // disagree (and RU stays level with FR instead of dominating alone).
    expect(CAMPAIGN_SETUP.powerProjection.FR).toBe(3);
    expect(SPACES["hong-kong"].type).toBe("navalBase");
  });
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

const isolated = (power: Power, spaces: string[], ships = 6): ImperialElegyState => {
  const G = fresh();
  G.units = {};
  for (const state of Object.values(G.spaces)) {
    state.units = [];
    state.control = null;
    state.ally = null;
  }
  for (const space of spaces) G.spaces[space].control = power;
  for (let i = 0; i < ships; i += 1) placeUnit(G, power, "squadron", "north-atlantic", 1);
  return G;
};

describe("3.3.1 printed port formula and rewards", () => {
  test("many ordinary ports in a single box still score one", () => {
    const G = isolated("FR", ["picardy", "brittany", "aquitaine"]);
    expect(computePowerProjection(G, "FR")).toBe(1);
  });

  test("a naval base alone scores one, adding an ordinary port raises that box to two", () => {
    const G = isolated("FR", ["malta"]);
    expect(computePowerProjection(G, "FR")).toBe(1);
    G.spaces.provence.control = "FR";
    expect(computePowerProjection(G, "FR")).toBe(2);
  });

  test("only the best three European boxes contribute", () => {
    const G = isolated("UK", ["london", "riga", "provence", "rhodes", "syria"]);
    // North Atlantic 1, Baltic 1, West Med 1, East Med 2: choose 2+1+1.
    expect(computePowerProjection(G, "UK")).toBe(4);
  });

  test("allied minor naval units count toward the cap, including reduced ships", () => {
    const G = isolated("GE", ["picardy", "provence", "india"], 1);
    expect(computePowerProjection(G, "GE")).toBe(2);
    G.spaces.denmark.control = "Denmark";
    G.spaces.denmark.ally = "GE";
    placeUnit(G, "Denmark", "squadron", "denmark", 1);
    expect(computePowerProjection(G, "GE")).toBe(3);
    G.spaces.denmark.ally = "FR";
    expect(computePowerProjection(G, "GE")).toBe(2);
  });

  test("Egypt's Indian Ocean port only contributes after Suez is built", () => {
    const G = isolated("GE", ["egypt"]);
    expect(computePowerProjection(G, "GE")).toBe(1);
    G.persistent.suezCanal = true;
    expect(computePowerProjection(G, "GE")).toBe(2);
  });

  test("rebel-held ports cannot project power", () => {
    const G = isolated("FR", ["provence"]);
    placeUnit(G, "REBEL:French", "rebelArmy", "provence", 1);
    expect(computePowerProjection(G, "FR")).toBe(0);
  });

  test.each([
    {values: [8, 8, 3, 0, 0, 0], winners: ["GE", "UK"]},
    {values: [8, 8, 8, 0, 0, 0], winners: []},
    {values: [8, 3, 3, 0, 0, 0], winners: ["GE"]},
    {values: [0, 0, 0, 0, 0, 0], winners: []},
  ])("PP ties $values award domination to $winners", ({values, winners}) => {
    const G = fresh();
    POWERS.forEach((power, index) => { G.powers[power].flags.powerProjection = values[index]; });
    expect(flashpointController(G, "powerProjection")).toEqual(winners);
  });

  test("dominating PP gives no inherent card bonus", () => {
    const G = isolated("FR", ["provence"]);
    refreshPowerProjection(G);
    const before = cardsToDraw(G, "FR");
    G.powers.FR.flags.powerProjection = 0;
    expect(cardsToDraw(G, "FR")).toBe(before);
  });

  test("A028 grants actual +1 card markers using current PP and the UK's double threshold", () => {
    const G = isolated("UK", ["london", "india"], 2);
    G.spaces.provence.control = "FR";
    placeUnit(G, "FR", "squadron", "provence", 1);
    startAction(G, "GE", 0);
    G.powers.GE.hand = ["IE-A028"];
    // Deliberately stale cached values: the event must compute the current board.
    for (const power of POWERS) G.powers[power].flags.powerProjection = 99;
    expect(playCard(G, makeCtx("0"), "IE-A028", "event")).toBeUndefined();
    expect(G.powers.UK.cardMarkers).toBe(1);
    expect(G.powers.FR.cardMarkers).toBe(1);
    expect(G.powers.GE.cardMarkers).toBe(0);
    G.spaces.india.control = null; // UK 1, FR 1: UK no longer doubles FR.
    // 12.0 allows one card per impulse, so the second resolution needs a fresh
    // impulse: clear the spent-impulse flag rather than pretending a seat can
    // play two cards back to back.
    G.cpRemaining = 0;
    delete G.powers.GE.flags.actionCpSpentThisImpulse;
    G.powers.GE.hand = ["IE-A028"];
    expect(playCard(G, makeCtx("0"), "IE-A028", "event")).toBeUndefined();
    expect(G.powers.UK.cardMarkers).toBe(1);
    expect(G.powers.FR.cardMarkers).toBe(2);
  });
});

describe("33.6 Local Autonomy: Tunisia and Tripoli and power projection", () => {
  test("their ports do not count without a land line of communication", () => {
    const G = fresh();
    otFleet(G);
    // Eastern Mediterranean 2 (ordinary ports + Rhodes), Black Sea 1, Indian Ocean 1, Western
    // Mediterranean 1 (Benghazi only: Tunisia/Tripoli are excluded).
    expect(computePowerProjection(G, "OT")).toBe(5);

    // Ceding the two autonomous keys changes nothing while there is no land LoC.
    G.spaces.tripoli.control = "Egypt";
    G.spaces.tunisia.control = "Egypt";
    expect(computePowerProjection(G, "OT")).toBe(5);
  });

  test("they count once linked by land, without stacking ordinary ports in the same box", () => {
    const G = fresh();
    otFleet(G);
    // Egypt under Ottoman control is the printed land route (33.6).  Egypt's
    // own Western Mediterranean port would mask the two keys inside the
    // per-box cap, so narrow that port for this test only: the Ottomans then
    // reach the box through Benghazi, Tripoli and Tunisia.
    G.spaces.egypt.control = "OT";
    G.spaces["great-sand-sea"].control = "OT";
    const egypt = SPACES.egypt;
    const ports = egypt.ports;
    try {
      egypt.ports = ["indian-ocean"];
      expect(hasOtAutonomyLandLoc(G, "tripoli")).toBe(true);
      // East 2 + Black Sea 1 + West 1 + Indian 1. Extra ordinary ports
      // cannot raise West to 2 without a naval base (3.3.1).
      expect(computePowerProjection(G, "OT")).toBe(5);

      G.spaces.tripoli.control = "Egypt";
      G.spaces.tunisia.control = "Egypt";
      expect(computePowerProjection(G, "OT")).toBe(5);
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
