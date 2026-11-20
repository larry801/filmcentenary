/**
 * Rules found by playing a local hotseat campaign.
 *
 * Every case below was reproduced on the live board first (a seeded campaign
 * driven through the real moves, and the `/localIE` hotseat), and each one is a
 * printed clause the engine did not enforce:
 *
 *  1. **12.11's once-per-impulse retry.**  A failed pacification set a
 *     `pacified_<space>` flag that nothing cleared, so one bad roll locked the
 *     space for the rest of the match.  The rulebook says "if the attempt fails
 *     you must wait until a future impulse to roll again in that space".
 *  2. **12.11's land-unit requirement.**  "Players must have a land unit in a
 *     space to pacify it" was never checked, so a seat could pacify a space its
 *     armies had not reached.
 *  3. **12.12.1's rebel gate.**  "If a rebel army occupies a space with a
 *     pacification marker, it must first be eliminated in a land battle before
 *     a pacification roll can be attempted."
 *  4. **12.11's marker lifecycle.**  A unit entering an uncontrolled space
 *     places the printed 0 (or 2 in a naval base) marker, and the marker goes
 *     away when the last land unit leaves.  Neither half ran.
 *  5. **12.12's rebuildable fort.**  A `fort_<space>` flag was never cleared,
 *     so a fort that 20.2 degraded away could never be rebuilt there.
 *  6. **15.2 / 27.5's action lists.**  Every 12.1 peacetime action — recruit,
 *     fleet, EF, influence, diplomacy, minor alliance, pacification, fort,
 *     MPIT — was accepted during a limited war and during the Great War, all on
 *     the war budget, although 15.2 says "players cannot perform recruitment or
 *     refit actions in wartime" and prints a six-item action list.
 */
jest.mock("./components/imperial-elegy.css", () => ({}));

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {beginImpulseUpkeep} from "./engine/rules";
import {phaseActionAllowed} from "./engine/phaseActions";
import {pacificationProblem} from "./engine/pacification";
import * as moves from "./moves";
import {spaceActions, type SpaceActionsInput} from "./components/actionAvailability";

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

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const beginAction = (G: ImperialElegyState, active: Power = "GE", cp = 8): void => {
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
  G.pending = null;
  G.battle = null;
  G.war = null;
  G.powers[active].flags.homeChosen = true;
};

const beginWar = (G: ImperialElegyState, active: Power = "GE", budget = 8): void => {
  G.phase = "wartime";
  G.activePower = active;
  G.pending = null;
  G.battle = null;
  G.powers[active].flags.homeChosen = true;
  G.war = {
    defender: "AU",
    attacker: active,
    aim: "conquest",
    objectives: [],
    status: "maneuver",
    budgets: {[active]: budget},
    passed: [],
    initiative: [],
    attackerAllies: [],
    defenderAllies: [],
    attackerMinors: [],
    defenderMinors: [],
  } as never;
};

const beginGreatWar = (G: ImperialElegyState, active: Power = "GE", budget = 8): void => {
  G.phase = "gwManeuver";
  G.activePower = active;
  G.pending = null;
  G.battle = null;
  G.powers[active].flags.homeChosen = true;
  G.powers[active].gwBudget = budget;
  G.gw = {
    active: true,
    turn: 1,
    te: [active],
    ta: [],
    order: [],
    neutralEntryDone: true,
  } as never;
};

/** Strip the acting power's units out of a space (a force that walked away). */
const clearLandUnits = (G: ImperialElegyState, space: string): void => {
  for (const unitId of [...G.spaces[space].units]) {
    const unit = G.units[unitId];
    if (!unit || unit.naval === true) continue;
    G.spaces[space].units = G.spaces[space].units.filter((id) => id !== unitId);
    unit.space = null;
  }
};

// ---------------------------------------------------------------------------
// 12.11 — the pacification action's own rules
// ---------------------------------------------------------------------------

describe("12.11 pacification", () => {
  test("a failed attempt is retryable in a later impulse", () => {
    const G = fresh();
    beginAction(G, "GE");
    G.spaces.saxony.control = null;
    G.spaces.saxony.influence = "GE";
    G.spaces.saxony.pacification = 0;
    clearLandUnits(G, "saxony");
    placeUnit(G, "GE", "army", "saxony", 2);

    // 2+2 = 4 against a 0 marker: the printed failure.
    expect(moves.pacify(G, makeCtx([2, 2], seat("GE")), "saxony")).toBeUndefined();
    expect(G.spaces.saxony.pacification).toBe(1);

    // Same impulse: 12.11's "once per space, per impulse" refuses it.
    expect(moves.pacify(G, makeCtx([6, 6], seat("GE")), "saxony")).toBe(INVALID_MOVE);
    expect(G.spaces.saxony.control).toBeNull();

    // Impulse boundary (the engine's own upkeep pass clears the attempt flag)
    // then a fresh CP budget: the printed retry is legal and this one succeeds.
    G.cpRemaining = 8;
    delete G.powers.GE.flags["pacifiedThisImpulse:saxony"];
    expect(moves.pacify(G, makeCtx([6, 6], seat("GE")), "saxony")).toBeUndefined();
    expect(G.spaces.saxony.control).toBe("GE");
  });

  test("the permanent flag from an old save is dropped, not honoured", () => {
    const G = fresh();
    beginAction(G, "GE");
    G.spaces.saxony.control = null;
    G.spaces.saxony.influence = "GE";
    clearLandUnits(G, "saxony");
    placeUnit(G, "GE", "army", "saxony", 2);
    // A save written before the fix: the old once-per-game flag is still set.
    G.powers.GE.flags["pacified_saxony"] = true;

    beginImpulseUpkeep(G, makeCtx(), "GE");
    expect(moves.pacify(G, makeCtx([6, 6], seat("GE")), "saxony")).toBeUndefined();
    expect(G.spaces.saxony.control).toBe("GE");
  });

  test("a land unit must be in the space", () => {
    const G = fresh();
    beginAction(G, "GE");
    G.spaces.saxony.control = null;
    G.spaces.saxony.influence = "GE";
    clearLandUnits(G, "saxony");

    expect(pacificationProblem(G, "GE", "saxony")).toBe("no-land-unit");
    expect(moves.pacify(G, makeCtx([6, 6], seat("GE")), "saxony")).toBe(INVALID_MOVE);
    expect(G.spaces.saxony.control).toBeNull();

    // A unit of another power does not satisfy it either.
    placeUnit(G, "AU", "army", "saxony", 2);
    expect(moves.pacify(G, makeCtx([6, 6], seat("GE")), "saxony")).toBe(INVALID_MOVE);

    placeUnit(G, "GE", "army", "saxony", 2);
    expect(moves.pacify(G, makeCtx([6, 6], seat("GE")), "saxony")).toBeUndefined();
    expect(G.spaces.saxony.control).toBe("GE");
  });

  test("12.12.1: a rebel army blocks the roll until it is beaten", () => {
    const G = fresh();
    beginAction(G, "GE");
    G.spaces.saxony.control = null;
    G.spaces.saxony.influence = "GE";
    placeUnit(G, "GE", "army", "saxony", 2);
    const rebel = placeUnit(G, "REBEL:Poland", "rebelArmy", "saxony", 2);

    expect(pacificationProblem(G, "GE", "saxony")).toBe("rebel-present");
    expect(moves.pacify(G, makeCtx([6, 6], seat("GE")), "saxony")).toBe(INVALID_MOVE);
    expect(G.spaces.saxony.control).toBeNull();

    // Eliminating the rebel re-opens the action.
    G.spaces.saxony.units = G.spaces.saxony.units.filter((id) => id !== rebel.id);
    delete G.units[rebel.id];
    expect(moves.pacify(G, makeCtx([6, 6], seat("GE")), "saxony")).toBeUndefined();
    expect(G.spaces.saxony.control).toBe("GE");
  });

  test("a successful pacification still replaces the influence marker", () => {
    const G = fresh();
    beginAction(G, "FR");
    G.spaces["west-africa"].influence = "FR";
    G.spaces["west-africa"].pacification = 0;
    placeUnit(G, "FR", "army", "west-africa", 2);

    expect(moves.pacify(G, makeCtx([5, 5], seat("FR")), "west-africa")).toBeUndefined();
    expect(G.spaces["west-africa"].control).toBe("FR");
    expect(G.spaces["west-africa"].influence).toBeNull();
  });
});

describe("12.11 pacification-marker lifecycle", () => {
  test("entering an uncontrolled space places the printed 0 marker", () => {
    const G = fresh();
    beginAction(G, "GE");
    G.spaces.saxony.control = null;
    G.spaces.saxony.pacification = 0;
    clearLandUnits(G, "saxony");
    placeUnit(G, "GE", "army", "saxony", 2);

    beginImpulseUpkeep(G, makeCtx(), "GE");
    expect(G.spaces.saxony.pacification).toBe(0);
  });

  test("entering an uncontrolled naval base places a 2 marker instead", () => {
    const G = fresh();
    beginAction(G, "UK");
    // Malta is a printed naval base; make it flagless for the test.
    G.spaces.malta.control = null;
    G.spaces.malta.pacification = 0;
    clearLandUnits(G, "malta");
    placeUnit(G, "UK", "army", "malta", 2);

    beginImpulseUpkeep(G, makeCtx(), "UK");
    expect(G.spaces.malta.pacification).toBe(2);
  });

  test("the marker is removed when the last land unit leaves", () => {
    const G = fresh();
    beginAction(G, "GE");
    G.spaces.saxony.control = null;
    G.spaces.saxony.pacification = 3;
    clearLandUnits(G, "saxony");

    beginImpulseUpkeep(G, makeCtx(), "GE");
    expect(G.spaces.saxony.pacification).toBe(0);
  });

  test("a controlled space's event marker is left alone", () => {
    const G = fresh();
    beginAction(G, "GE");
    // Algeria begins the campaign with a 0 pacification marker and is
    // FR-controlled: 12.11's event marker, with its own key-reduction rule.
    expect(G.spaces.algeria.control).toBe("FR");
    G.spaces.algeria.pacification = 2;
    beginImpulseUpkeep(G, makeCtx(), "GE");
    expect(G.spaces.algeria.pacification).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 12.12 — a fort can be rebuilt once 20.2 has degraded it away
// ---------------------------------------------------------------------------

describe("12.12 an obsolete fort can be rebuilt", () => {
  test("after 20.2 removes a level 1 fort the space accepts a new one", () => {
    const G = fresh();
    beginAction(G, "GE", 8);
    expect(moves.buildFort(G, makeCtx([], seat("GE")), "berlin", 1)).toBeUndefined();
    expect(G.spaces.berlin.fort).toEqual({power: "GE", level: 1});

    // 20.2: "Players degrade all forts on the map by one level, this also
    // removes level one forts."
    G.spaces.berlin.fort = null;

    expect(moves.buildFort(G, makeCtx([], seat("GE")), "berlin", 1)).toBeUndefined();
    expect(G.spaces.berlin.fort).toEqual({power: "GE", level: 1});
  });

  test("the printed limits still apply: one fort per space and three per player", () => {
    const G = fresh();
    beginAction(G, "GE", 20);
    G.spaces.berlin.fort = {power: "GE", level: 1};
    // A second fort in the same space is the 1 CP upgrade, never a new fort.
    expect(moves.buildFort(G, makeCtx([], seat("GE")), "berlin", 2)).toBe(INVALID_MOVE);

    // Three forts is the cap.
    G.spaces.vienna.fort = {power: "GE", level: 1};
    G.spaces.silesia.fort = {power: "GE", level: 1};
    G.powers.GE.flags.homeChosen = true;
    expect(moves.buildFort(G, makeCtx([], seat("GE")), "westphalia", 1)).toBe(INVALID_MOVE);
  });
});

// ---------------------------------------------------------------------------
// 15.2 / 27.5 — the action list changes with the phase
// ---------------------------------------------------------------------------

describe("15.2 wartime action list", () => {
  const attempts: {label: string; move: (G: ImperialElegyState) => unknown}[] = [
    {label: "recruit", move: (G) => moves.recruit(G, makeCtx([], seat("FR")), "paris", "army", 1)},
    {label: "construct fleet", move: (G) => moves.constructFleet(G, makeCtx([], seat("UK")), "london", "squadron")},
    {label: "expeditionary force", move: (G) => moves.buildEf(G, makeCtx([], seat("GE")), "berlin")},
    {label: "place influence", move: (G) => moves.placeInfluence(G, makeCtx([], seat("GE")), "saxony")},
    {label: "place diplomacy", move: (G) => moves.placeDiplomacy(G, makeCtx([], seat("GE")), "bavaria")},
    {label: "remove influence", move: (G) => moves.removeInfluence(G, makeCtx([], seat("FR")), "west-africa")},
    {label: "minor alliance", move: (G) => moves.minorAlliance(G, makeCtx([], seat("FR")), "piedmont")},
    {label: "pacify", move: (G) => moves.pacify(G, makeCtx([6, 6], seat("FR")), "west-africa")},
    {label: "fort", move: (G) => moves.buildFort(G, makeCtx([], seat("GE")), "berlin", 1)},
    {label: "MPIT", move: (G) => moves.placeMpit(G, makeCtx([], seat("GE")), "UK", "te")},
  ];

  test.each(attempts)("$label is refused during a limited war", ({move}) => {
    const G = fresh();
    beginWar(G, "GE", 10);
    // Give every attempt a legal board so only 15.2 can refuse it.
    G.spaces.saxony.control = null;
    G.spaces.bavaria.diplomacy = null;
    placeUnit(G, "GE", "army", "saxony", 2);

    expect(move(G)).toBe(INVALID_MOVE);
  });

  test.each(attempts)("$label is refused during the Great War", ({move}) => {
    const G = fresh();
    beginGreatWar(G, "GE", 10);
    G.spaces.saxony.control = null;
    placeUnit(G, "GE", "army", "saxony", 2);

    expect(move(G)).toBe(INVALID_MOVE);
  });

  test("the same actions are legal in the action phase", () => {
    // The gate is phase-scoped, not a blanket refusal of the moves.
    const G = fresh();
    beginAction(G, "GE", 10);
    G.spaces.saxony.control = null;
    G.spaces.saxony.influence = "GE";
    placeUnit(G, "GE", "army", "saxony", 2);
    expect(moves.pacify(G, makeCtx([6, 6], seat("GE")), "saxony")).toBeUndefined();
    G.cpRemaining = 10;
    expect(moves.placeMpit(G, makeCtx([], seat("GE")), "UK", "te")).toBeUndefined();
  });

  test("15.2's own actions stay legal in wartime", () => {
    const G = fresh();
    beginWar(G, "GE", 10);
    expect(phaseActionAllowed(G, "landBattle")).toBe(true);
    expect(phaseActionAllowed(G, "march")).toBe(true);
    expect(phaseActionAllowed(G, "rail")).toBe(true);
    expect(phaseActionAllowed(G, "deployReserves")).toBe(true);
    expect(phaseActionAllowed(G, "navalMovement")).toBe(true);
  });

  test("27.5 keeps the GW-only actions in the Great War and nowhere else", () => {
    const gw = fresh();
    beginGreatWar(gw, "GE", 10);
    for (const family of ["gwRefit", "gwRefitFleet", "gwDraft", "gwEliteCorps"] as const) {
      expect(phaseActionAllowed(gw, family)).toBe(true);
    }
    // The asterisked actions are 27.5's own; 12.1 does not print them.
    const peace = fresh();
    beginAction(peace, "GE", 10);
    for (const family of ["gwRefit", "gwRefitFleet", "gwDraft", "gwEliteCorps"] as const) {
      expect(phaseActionAllowed(peace, family)).toBe(false);
    }
  });

  test("the Orders panel disables the same rows with the printed reason", () => {
    const G = fresh();
    beginWar(G, "UK", 10);
    G.spaces.london.control = "UK";
    const row = (id: string) => spaceActions({
      G,
      viewer: "UK",
      space: "london" as never,
      phase: "wartime",
      selectedUnit: null,
      cp: 10,
      canAct: true,
      canActionCard: true,
      war: G.war,
      me: G.powers.UK,
      moves: moves as unknown as Record<string, (...args: any[]) => void>,
      doAction: (fn) => fn(),
      myOnMapArmies: 1,
      myForts: 0,
      myMinorAllies: 0,
      ownLandInSelected: [],
      ownNavalInSelected: [],
      potentialLandTargets: [],
      potentialNavalTargets: [],
      deployLimit: 0,
      deployFree: false,
      canDeployHere: false,
      canGwDraft: false,
      canGwDeployHere: false,
      polishArmyDecision: null,
      polishReserveDecision: null,
      gwJointNavalAllies: [],
      gwJointNavalUnitIds: () => [],
      startBattle: () => undefined,
      startNavalBattle: () => undefined,
      describeRow: (candidate: {label: string; reason?: string}) => ({label: candidate.label, reason: candidate.reason}),
      locale: "en",
    } as never).find((entry) => entry.id === id);

    const fleet = row("buildSquadron");
    expect(fleet?.enabled).toBe(false);
    expect(fleet?.reason).toMatch(/15\.2/);
  });
});
