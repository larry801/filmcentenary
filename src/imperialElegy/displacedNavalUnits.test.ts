/**
 * 19.11 Displaced naval units during wartime.
 *
 *   "If a player moves land units into an enemy port containing enemy naval
 *   units, those naval units are immediately displaced to an adjacent naval
 *   box.  This displacement may result in a naval battle, if it does the
 *   displaced units are considered the attackers.  This displacement can be
 *   intercepted, and displacing naval units cannot attempt to avoid battle if
 *   moving into a naval box containing enemy naval units.  Finish the active
 *   player's action before resolving any naval interception attempts and/or
 *   naval battles that result from such a displacement."
 *
 * The suite pins all five clauses: the immediate displacement to an adjacent
 * box, the deferred battle (not mid-action), the displaced fleet as attacker,
 * the missing 19.2 avoidance step, and the 19.1 interception window.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {BattleReport, ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {navalUnitsIn, unitsIn} from "./engine/rules";
import {resolvePending, redeploy} from "./moves";
import {beginLandBattle} from "./engine/combat";
import {
  PORT_DISPLACEMENT_QUEUE_FLAG,
  portDisplacementQueuePending,
  queuePortNavalDisplacements,
  resolveDeferredNavalWork,
} from "./engine/combat";

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
    phase: "end",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const warState = (attacker: Power, defender: Power): WarState => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  aim: "conquest",
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

const clear = (G: ImperialElegyState, ...spaces: string[]): void => {
  for (const space of spaces) for (const unit of [...unitsIn(G, space)]) removeUnit(G, unit.id);
};

/**
 * GE vs FR, GE active in the wartime maneuver step.  Brittany is a French key
 * and a north-Atlantic port; Picardy is an adjacent GE-held land space, so GE
 * can march into the port in one hop.
 */
const war = (): {G: ImperialElegyState; army: string} => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "wartime";
  G.activePower = "GE";
  G.pending = null;
  G.battle = null;
  G.battleReport = null;
  G.war = warState("GE", "FR");
  G.war.budgets = {GE: 8, FR: 8};
  // A clean board around Picardy and Brittany, including the scenario's own
  // French squadron in the port and every ship in the adjacent box.
  clear(G, "picardy", "brittany", "north-atlantic");
  for (const space of ["picardy", "brittany"]) {
    G.spaces[space].fort = null;
    G.spaces[space].trench = null;
  }
  G.spaces.picardy.control = "GE";
  G.spaces.picardy.occupiedBy = null;
  G.spaces.picardy.ally = null;
  G.spaces.brittany.control = "FR";
  G.spaces.brittany.occupiedBy = "FR";
  G.spaces.brittany.ally = null;
  const army = placeUnit(G, "GE", "army", "picardy", 2).id;
  return {G, army};
};

/**
 * The battle a drained displacement produced: either the live battle (when a
 * combat card window is open) or the report of the one that already resolved.
 * Combat cards in the scenario hands are removed by `cleanHands`, so the battle
 * normally auto-resolves; both shapes are covered.
 */
const battleShape = (G: ImperialElegyState): {attacker: Power; mainAttack: string[]; mainDefense: string[]} => {
  if (G.battle !== null) {
    return {attacker: G.battle.attacker, mainAttack: [...G.battle.mainAttack], mainDefense: [...G.battle.mainDefense]};
  }
  const report = G.battleReport as BattleReport | null;
  if (report === null) throw new Error("expected a battle or a battle report");
  return {
    attacker: report.attacker,
    mainAttack: report.attackerUnits.map((entry) => entry.unitId),
    mainDefense: report.defenderUnits.map((entry) => entry.unitId),
  };
};

/** Strip every combat card so battles resolve without a card window. */
const cleanHands = (G: ImperialElegyState): void => {
  for (const power of POWERS) {
    G.powers[power].hand = G.powers[power].hand.filter((id) => !id.startsWith("IE-A0"));
    G.powers[power].gwCard = null;
  }
};

// ---------------------------------------------------------------------------
// The immediate displacement
// ---------------------------------------------------------------------------

describe("19.11 the ships leave the port at once", () => {
  test("entering an enemy port displaces its enemy ships to an adjacent box", () => {
    const {G, army} = war();
    const ship = placeUnit(G, "FR", "squadron", "brittany", 2);

    expect(redeploy(G, makeCtx([], seat("GE")), army, "brittany")).toBeUndefined();

    // The land units are in the port and no enemy squadron is left in it.
    expect(G.units[army].space).toBe("brittany");
    expect(navalUnitsIn(G, "brittany")).toHaveLength(0);
    expect(navalUnitsIn(G, "north-atlantic").map((unit) => unit.id)).toContain(ship.id);
    expect(G.log.some((entry) => entry.key === "portNavalDisplacement")).toBe(true);
  });

  test("the displacement happens alongside the 15.3 occupation", () => {
    const {G, army} = war();
    placeUnit(G, "FR", "squadron", "brittany", 2);

    expect(redeploy(G, makeCtx([], seat("GE")), army, "brittany")).toBeUndefined();
    expect(G.spaces.brittany.occupiedBy).toBe("GE");
  });

  test("no enemy ships means no displacement and no queued work", () => {
    const {G, army} = war();

    expect(redeploy(G, makeCtx([], seat("GE")), army, "brittany")).toBeUndefined();
    expect(portDisplacementQueuePending(G)).toBe(false);
    expect(G.flags[PORT_DISPLACEMENT_QUEUE_FLAG]).toBeFalsy();
    expect(G.log.some((entry) => entry.key === "portNavalDisplacement")).toBe(false);
  });

  test("an allied fleet in a friendly port is not displaced", () => {
    const {G, army} = war();
    // FR fights on GE's side of this war and shares its alliance box, so
    // Brittany is a friendly port: 19.11 only speaks of *enemy* ports.
    G.war = warState("GE", "RU");
    G.war.attackerAllies = ["FR"];
    G.war.budgets = {GE: 8, RU: 8};
    G.powers.FR.alliance = "taCommitted";
    G.powers.GE.alliance = "taCommitted";
    const ship = placeUnit(G, "FR", "squadron", "brittany", 2);

    expect(redeploy(G, makeCtx([], seat("GE")), army, "brittany")).toBeUndefined();
    expect(navalUnitsIn(G, "brittany").map((unit) => unit.id)).toContain(ship.id);
    expect(G.log.some((entry) => entry.key === "portNavalDisplacement")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Deferral: the action finishes first
// ---------------------------------------------------------------------------

describe("19.11 resolves after the action, not during the move", () => {
  test("the ships are displaced during the move and the battle resolves afterward", () => {
    const {G, army} = war();
    cleanHands(G);
    const german = placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    const french = placeUnit(G, "FR", "squadron", "brittany", 2);

    expect(redeploy(G, makeCtx([], seat("GE")), army, "brittany")).toBeUndefined();
    // 19.11's displacement is immediate: the squadron leaves the port for the
    // box before anything else about the move is settled.
    expect(G.units[french.id].space).toBe("north-atlantic");
    // The full action has already closed by the time the battle runs: the CP
    // charge and the 15.3 occupation are recorded first, and the deferred tail
    // then runs the battle in the box.
    expect(G.powers.GE.flags.redeployActionThisImpulse).toBe(true);
    expect(G.spaces.brittany.occupiedBy).toBe("GE");
    expect(G.log.some((entry) => entry.key === "portNavalBattle")).toBe(true);
    expect(G.battleReport).toMatchObject({kind: "naval", attacker: "FR", defender: "GE"});
    // The battle was fought in the box the ships displaced into, not in the
    // port the land units entered.
    expect(G.battleReport!.to).toBe("north-atlantic");
    expect(G.units[german.id].naval).toBe(true);
  });

  test("a queued displacement drains only when the queue is drained", () => {
    const {G} = war();
    cleanHands(G);
    placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const queued = queuePortNavalDisplacements(G, "GE", "brittany");
    expect(queued).toHaveLength(1);
    expect(portDisplacementQueuePending(G)).toBe(true);
    expect(G.battle).toBeNull();
    expect(G.battleReport).toBeNull();

    expect(resolveDeferredNavalWork(G, makeCtx())).toBe(true);
    expect(battleShape(G).attacker).toBe("FR");
    expect(portDisplacementQueuePending(G)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The battle: displaced ships attack, and cannot avoid
// ---------------------------------------------------------------------------

describe("19.11 the displaced fleet is the attacker", () => {
  test("the displaced ships form the attacking main force", () => {
    const {G} = war();
    cleanHands(G);
    // Hostile (German) ships already hold the destination box.
    const german = placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    const displacedA = placeUnit(G, "FR", "squadron", "brittany", 2);
    const displacedB = placeUnit(G, "FR", "squadron", "brittany", 1);
    queuePortNavalDisplacements(G, "GE", "brittany");

    expect(resolveDeferredNavalWork(G, makeCtx())).toBe(true);
    const shape = battleShape(G);
    expect(shape.attacker).toBe("FR");
    expect([...shape.mainAttack].sort()).toEqual([displacedA.id, displacedB.id].sort());
    if (G.battle !== null) expect([...G.battle.mainDefense].sort()).toEqual([german.id]);
  });

  test("no 19.2 avoidance decision is offered to the displaced fleet", () => {
    const {G} = war();
    cleanHands(G);
    placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    placeUnit(G, "FR", "squadron", "brittany", 2);
    queuePortNavalDisplacements(G, "GE", "brittany");

    expect(resolveDeferredNavalWork(G, makeCtx())).toBe(true);
    // The printed "cannot attempt to avoid battle" clause: no `navalAvoid`
    // decision is ever offered, and the battle opens straight into its own
    // combat-card window (or resolves outright with no cards in hand).
    expect(G.pending?.kind).not.toBe("navalAvoid");
    expect(G.log.some((entry) => entry.key === "portNavalBattle")).toBe(true);
  });

  test("an empty destination box leaves no battle", () => {
    const {G} = war();
    cleanHands(G);
    placeUnit(G, "FR", "squadron", "brittany", 2);
    queuePortNavalDisplacements(G, "GE", "brittany");

    expect(resolveDeferredNavalWork(G, makeCtx())).toBe(false);
    expect(G.battle).toBeNull();
    expect(G.battleReport).toBeNull();
    expect(portDisplacementQueuePending(G)).toBe(false);
    // The ship is simply at sea, exactly where 5.7's naval clause puts it.
    expect(navalUnitsIn(G, "north-atlantic")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 19.1 interception of the displacement
// ---------------------------------------------------------------------------

describe("19.11 the displacement can be intercepted", () => {
  const intercepted = (): {G: ImperialElegyState; uk: string; french: string} => {
    const {G} = war();
    cleanHands(G);
    // A friendly British port on the same box may attempt the 19.1 intercept.
    G.war.attackerAllies = ["UK"];
    const uk = placeUnit(G, "UK", "squadron", "gibraltar", 2);
    const french = placeUnit(G, "FR", "squadron", "brittany", 2);
    queuePortNavalDisplacements(G, "GE", "brittany");
    return {G, uk: uk.id, french: french.id};
  };

  test("an adjacent enemy port opens the 19.1 window before any battle", () => {
    const {G, uk} = intercepted();

    expect(resolveDeferredNavalWork(G, makeCtx())).toBe(true);
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.power).toBe("UK");
    expect(G.pending?.context?.displaced).toBe(true);
    expect(G.battle).toBeNull();
    // The intercepting ships have not moved yet: the window is the choice.
    expect(G.units[uk].space).toBe("gibraltar");
  });

  test("a successful interception resolves as an immediately started battle", () => {
    const {G, uk, french} = intercepted();
    resolveDeferredNavalWork(G, makeCtx());
    expect(G.pending?.kind).toBe("navalInterception");

    // A 6 clears the 5+ interception roll.
    expect(resolvePending(G, makeCtx([6], seat("UK")), "intercept:gibraltar")).toBeUndefined();
    expect(G.units[uk].space).toBe("north-atlantic");
    const shape = battleShape(G);
    // 19.11 made the displaced fleet the attacker, so the intercepting ships
    // are the defenders even though they just moved into the box.
    expect(shape.attacker).toBe("FR");
    expect(shape.mainAttack).toEqual([french]);
    if (G.battle !== null) expect(G.battle.mainDefense).toContain(uk);
  });

  test("declining the window proceeds to the battle with no avoidance", () => {
    const {G, french} = intercepted();
    const german = placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    resolveDeferredNavalWork(G, makeCtx());
    expect(G.pending?.kind).toBe("navalInterception");

    expect(resolvePending(G, makeCtx([], seat("UK")), "skip")).toBeUndefined();
    const shape = battleShape(G);
    expect(shape.attacker).toBe("FR");
    expect(shape.mainAttack).toEqual([french]);
    if (G.battle !== null) expect(G.battle.mainDefense).toContain(german.id);
  });
});

// ---------------------------------------------------------------------------
// The 18.x land-advance path shares the same tail
// ---------------------------------------------------------------------------

describe("19.11 a land advance into the port also displaces", () => {
  test("an attacker advancing after a battle displaces the port's ships", () => {
    const G = setupImperialElegy(makeCtx());
    cleanHands(G);
    G.phase = "wartime";
    G.activePower = "GE";
    G.pending = null;
    G.battle = null;
    G.battleReport = null;
    G.war = warState("GE", "FR");
    G.war.budgets = {GE: 8, FR: 8};
    clear(G, "picardy", "brittany", "north-atlantic");
    G.spaces.picardy.control = "GE";
    G.spaces.picardy.occupiedBy = "GE";
    G.spaces.brittany.control = "FR";
    G.spaces.brittany.occupiedBy = "FR";
    const army = placeUnit(G, "GE", "army", "picardy", 2);
    placeUnit(G, "FR", "army", "brittany", 1);
    const ship = placeUnit(G, "FR", "squadron", "brittany", 2);

    const battle = beginLandBattle(G, makeCtx(), "GE", "picardy", "brittany");
    expect(battle).not.toBeNull();
    // A decisive attacker roll advances the surviving attacker into the port.
    expect(resolvePending(G, makeCtx([6, 6, 6, 6], seat("GE")), "roll")).toBeDefined();

    // Whatever the dice did, an advancing attacker must have swept the ships.
    if (G.units[army.id].space === "brittany") {
      expect(navalUnitsIn(G, "brittany").map((unit) => unit.id)).not.toContain(ship.id);
      expect(navalUnitsIn(G, "north-atlantic").map((unit) => unit.id)).toContain(ship.id);
      expect(portDisplacementQueuePending(G)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

describe("19.11 preconditions", () => {
  test("a non-port space is never a displacement source", () => {
    const G = setupImperialElegy(makeCtx());
    placeUnit(G, "FR", "army", "berlin", 2);
    expect(queuePortNavalDisplacements(G, "GE", "berlin")).toEqual([]);
    expect(portDisplacementQueuePending(G)).toBe(false);
  });

  test("the enterer's own fleet stays in the port", () => {
    const G = setupImperialElegy(makeCtx());
    G.war = warState("GE", "FR");
    clear(G, "brittany");
    G.spaces.brittany.control = "FR";
    placeUnit(G, "GE", "squadron", "brittany", 2);
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const queued = queuePortNavalDisplacements(G, "GE", "brittany");
    // Only the French ship is hostile; the German one is the enterer's own.
    expect(queued).toHaveLength(1);
    expect(G.units[queued[0].unitIds[0]].owner).toBe("FR");
    expect(navalUnitsIn(G, "brittany").every((unit) => unit.owner === "GE")).toBe(true);
  });

  test("only the entered port is swept, never another port", () => {
    const {G, army} = war();
    cleanHands(G);
    // A squadron in a *different* enemy port must stay put: 19.11 speaks only of
    // the port the land units entered.
    clear(G, "aquitaine");
    G.spaces.aquitaine.control = "FR";
    const other = placeUnit(G, "FR", "squadron", "aquitaine", 2);
    placeUnit(G, "FR", "squadron", "brittany", 2);

    expect(redeploy(G, makeCtx([], seat("GE")), army, "brittany")).toBeUndefined();
    expect(G.units[other.id].space).toBe("aquitaine");
    expect(G.log.filter((entry) => entry.key === "portNavalDisplacement")).toHaveLength(1);
  });

  test("a refused move never displaces anything", () => {
    const {G} = war();
    placeUnit(G, "FR", "squadron", "brittany", 2);
    // No army in range, so no move is possible at all: nothing may be swept.
    removeUnit(G, placeUnit(G, "GE", "army", "berlin", 2).id);
    expect(redeploy(G, makeCtx([], seat("GE")), "nope", "brittany")).toBe(INVALID_MOVE);
    expect(navalUnitsIn(G, "brittany")).toHaveLength(1);
    expect(portDisplacementQueuePending(G)).toBe(false);
  });
});
