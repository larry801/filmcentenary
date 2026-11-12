/**
 * 15.3 "Occupied vs Controlled" — persistence of the occupation marker.
 *
 * "An occupied space does not need to contain a land unit to remain occupied."
 * The marker therefore stays after the occupying land units leave; it only ends
 * when another player solely occupies the space (the new marker replaces it) or
 * when the space becomes control-backed for that sole occupant (the redundant
 * marker is cleared).  Naval units never occupy and never end an occupation.
 *
 * These tests pin the pure helper and the live Great War march path.
 */

import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {recordOccupation} from "./engine/rules";
import {performGwManeuver} from "./engine/greatWarFlow";

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

const warState = (attacker: Power, defender: Power): WarState => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: [],
  status: "maneuver",
  budgets: {},
  initiative: [],
  treaties: [],
  victor: null,
  truceTurns: 2,
  passed: [],
  startedTurn: 1,
} as unknown as WarState);

const resetSpace = (G: ImperialElegyState, space: string): void => {
  const state = G.spaces[space];
  state.units = [];
  state.control = null;
  state.ally = null;
  state.influence = null;
  state.diplomacy = null;
  state.occupiedBy = null;
};

const gwFixture = (): ImperialElegyState => {
  const G = fresh();
  G.gw = {
    active: true,
    turn: 1,
    order: ["GE", "FR"],
    belligerents: ["GE", "FR"],
    neutrals: [],
    te: ["FR"],
    ta: ["GE"],
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
  } as GreatWarState;
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.powers.GE.gwBudget = 8;
  G.powers.FR.gwBudget = 8;
  return G;
};

// ---------------------------------------------------------------------------
// The pure 15.3 helper
// ---------------------------------------------------------------------------

describe("15.3 occupation persistence", () => {
  test("an empty occupied space keeps its marker indefinitely", () => {
    const G = fresh();
    G.war = warState("FR", "GE");
    resetSpace(G, "westphalia");
    G.spaces.westphalia.control = "GE";
    G.spaces.westphalia.occupiedBy = "FR";

    for (let i = 0; i < 3; i += 1) {
      expect(recordOccupation(G, "westphalia").changed).toBe(false);
      expect(G.spaces.westphalia.occupiedBy).toBe("FR");
    }
    // The formal control marker is never overwritten by occupation (15.3).
    expect(G.spaces.westphalia.control).toBe("GE");
  });

  test("another player's sole occupation replaces the marker", () => {
    const G = fresh();
    G.war = warState("FR", "GE");
    resetSpace(G, "westphalia");
    G.spaces.westphalia.occupiedBy = "FR";
    placeUnit(G, "AU", "army", "westphalia", 2);

    expect(recordOccupation(G, "westphalia")).toMatchObject({before: "FR", after: "AU", changed: true});
    expect(G.spaces.westphalia.occupiedBy).toBe("AU");
  });

  test("the controller marching back in clears the stale enemy marker", () => {
    const G = fresh();
    G.war = warState("GE", "FR");
    resetSpace(G, "saxony");
    G.spaces.saxony.control = "GE";
    G.spaces.saxony.occupiedBy = "FR";
    placeUnit(G, "GE", "army", "saxony", 2);

    const change = recordOccupation(G, "saxony");
    expect(change).toMatchObject({before: "FR", after: null, changed: true, cleared: true});
    expect(G.spaces.saxony.occupiedBy).toBeNull();
  });

  test("a naval unit alone neither occupies nor ends an occupation", () => {
    const G = fresh();
    G.war = warState("FR", "GE");
    resetSpace(G, "brittany");
    G.spaces.brittany.control = "FR";
    G.spaces.brittany.occupiedBy = "GE";
    placeUnit(G, "GE", "squadron", "brittany", 2);

    expect(recordOccupation(G, "brittany").changed).toBe(false);
    expect(G.spaces.brittany.occupiedBy).toBe("GE");
  });

  test("a control-backed space still gets no redundant marker", () => {
    const G = fresh();
    G.war = warState("FR", "GE");
    resetSpace(G, "westphalia");
    G.spaces.westphalia.control = "FR";
    placeUnit(G, "FR", "army", "westphalia", 2);

    expect(recordOccupation(G, "westphalia").changed).toBe(false);
    expect(G.spaces.westphalia.occupiedBy).toBeNull();
  });

  test("a contested space keeps the existing marker for the battle to resolve", () => {
    const G = fresh();
    G.war = warState("FR", "GE");
    resetSpace(G, "westphalia");
    G.spaces.westphalia.occupiedBy = "FR";
    placeUnit(G, "FR", "army", "westphalia", 2);
    placeUnit(G, "GE", "army", "westphalia", 2);

    expect(recordOccupation(G, "westphalia").changed).toBe(false);
    expect(G.spaces.westphalia.occupiedBy).toBe("FR");
  });
});

// ---------------------------------------------------------------------------
// Live GW march
// ---------------------------------------------------------------------------

describe("15.3 live GW march persistence", () => {
  test("a free march into former territory keeps its marker after marching onward", () => {
    const G = gwFixture();
    resetSpace(G, "alsace-lorraine");
    resetSpace(G, "westphalia");
    resetSpace(G, "hanover");
    G.spaces["alsace-lorraine"].control = "FR";
    G.spaces.westphalia.control = "GE";
    G.spaces.hanover.control = "FR";
    // 30.1: GE is eliminated, so its formal control remains as former territory
    // that FR may march into (and occupy under 15.3) without a battle.
    G.powers.GE.eliminated = true;
    G.gw!.belligerents = ["FR"];
    G.gw!.ta = [];
    const army = placeUnit(G, "FR", "army", "alsace-lorraine", 2).id;
    G.activePower = "FR";

    const into = performGwManeuver(G, makeCtx(seat("FR")), {
      kind: "march",
      power: "FR",
      unitId: army,
      to: "westphalia",
    });
    expect(into.ok).toBe(true);
    if (!into.ok) throw new Error(into.message);
    expect(G.spaces.westphalia.occupiedBy).toBe("FR");

    // Marching onward (FR-controlled Hanover) must not clear Westphalia.
    const onward = performGwManeuver(G, makeCtx(seat("FR")), {
      kind: "march",
      power: "FR",
      unitId: army,
      to: "hanover",
    });
    expect(onward.ok).toBe(true);
    if (!onward.ok) throw new Error(onward.message);
    expect(G.units[army].space).toBe("hanover");
    expect(G.spaces.westphalia.occupiedBy).toBe("FR");
    expect(G.spaces.hanover.occupiedBy).toBeNull();
  });

  test("the controller marching back into its own space clears the stale marker", () => {
    const G = gwFixture();
    resetSpace(G, "saxony");
    resetSpace(G, "berlin");
    G.spaces.saxony.control = "GE";
    G.spaces.berlin.control = "GE";
    // The FR occupation left behind by an earlier advance (the pure tests cover
    // how a battle/march writes it; this test drives the clearing live).
    G.spaces.saxony.occupiedBy = "FR";
    const army = placeUnit(G, "GE", "army", "berlin", 2).id;
    G.activePower = "GE";

    const back = performGwManeuver(G, makeCtx(seat("GE")), {
      kind: "march",
      power: "GE",
      unitId: army,
      to: "saxony",
    });
    expect(back.ok).toBe(true);
    if (!back.ok) throw new Error(back.message);
    expect(G.units[army].space).toBe("saxony");
    expect(G.spaces.saxony.occupiedBy).toBeNull();
    // 15.3: the formal control marker never moves during the war.
    expect(G.spaces.saxony.control).toBe("GE");
  });

  test("a rail move away leaves its occupation marker behind", () => {
    const G = gwFixture();
    resetSpace(G, "alsace-lorraine");
    resetSpace(G, "westphalia");
    G.spaces["alsace-lorraine"].control = "FR";
    G.spaces.westphalia.control = null;
    G.spaces.westphalia.influence = "FR";
    G.activePower = "FR";
    const army = placeUnit(G, "FR", "army", "alsace-lorraine", 2).id;

    const out = performGwManeuver(G, makeCtx(seat("FR")), {
      kind: "rail",
      power: "FR",
      unitId: army,
      to: "westphalia",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error(out.message);
    expect(G.spaces.westphalia.occupiedBy).toBe("FR");

    const home = performGwManeuver(G, makeCtx(seat("FR")), {
      kind: "rail",
      power: "FR",
      unitId: army,
      to: "alsace-lorraine",
    });
    expect(home.ok).toBe(true);
    if (!home.ok) throw new Error(home.message);
    expect(G.spaces.westphalia.occupiedBy).toBe("FR");
  });
});
