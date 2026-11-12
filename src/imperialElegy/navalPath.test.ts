/**
 * Rule 12.3 — naval movement points.
 *
 * A naval movement action costs 1 CP and gives every activated naval unit one
 * NMP.  These tests cover the pure `planNavalMove` planner (multi-box paths,
 * European vs non-European cost, the Suez/Dardanelles gates, enemy boxes and
 * ports) and the live `moves.ts#navalMove` path (one-CP semantics, stack
 * selection, unit ownership).
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {planNavalMove} from "./engine/navalMovement";
import {createWarState} from "./engine/limitedWar";
import {navalMove} from "./moves";

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

const ukShipIn = (G: ImperialElegyState, space: string): string => {
  const id = Object.values(G.units).find((unit) => unit.owner === "UK" && unit.kind === "squadron" && unit.space === space)?.id;
  if (!id) throw new Error(`no UK squadron in ${space}`);
  return id;
};

// ---------------------------------------------------------------------------
// Pure planner: cost and multi-box paths
// ---------------------------------------------------------------------------

test("one NMP crosses all of European Waters in a single move", () => {
  const G = fresh();
  const plan = planNavalMove(G, "UK", "london", "eastern-mediterranean");
  expect(plan.ok).toBe(true);
  expect(plan.cost).toBe(1);
  expect(plan.path).toEqual([
    "london",
    "north-atlantic",
    "western-mediterranean",
    "eastern-mediterranean",
  ]);
});

test("entering a non-European box costs the NMP and ends the move there", () => {
  const G = fresh();
  expect(planNavalMove(G, "UK", "london", "south-atlantic")).toMatchObject({ok: true, cost: 1});
  expect(planNavalMove(G, "UK", "london", "west-africa")).toMatchObject({ok: true, cost: 1});
  // Two non-European entries cannot fit in one NMP.
  expect(planNavalMove(G, "UK", "pacific-ocean", "south-atlantic").ok).toBe(false);
  expect(planNavalMove(G, "UK", "south-atlantic", "indian-ocean")).toMatchObject({ok: true, cost: 1});
});

test("port entry is free and port exit costs the NMP", () => {
  const G = fresh();
  expect(planNavalMove(G, "UK", "north-atlantic", "london")).toMatchObject({ok: true, cost: 1, path: ["north-atlantic", "london"]});
  expect(planNavalMove(G, "UK", "london", "north-atlantic")).toMatchObject({ok: true, cost: 1});
  expect(planNavalMove(G, "UK", "london", "london")).toMatchObject({ok: true, cost: 0, path: ["london"]});
});

// ---------------------------------------------------------------------------
// Suez and the Dardanelles
// ---------------------------------------------------------------------------

test("the Suez Canal gates movement between the Eastern Mediterranean and Indian Ocean", () => {
  const G = fresh();
  expect(planNavalMove(G, "UK", "indian-ocean", "eastern-mediterranean")).toMatchObject({ok: false, reason: "suezClosed"});

  G.persistent.suezCanal = true;
  expect(planNavalMove(G, "UK", "indian-ocean", "eastern-mediterranean")).toMatchObject({ok: true, cost: 1});

  G.persistent.suezBlockedBy = "FR";
  expect(planNavalMove(G, "UK", "indian-ocean", "eastern-mediterranean")).toMatchObject({ok: false, reason: "suezBlocked"});
  expect(planNavalMove(G, "FR", "indian-ocean", "eastern-mediterranean")).toMatchObject({ok: true});
});

test("a hostile Dardanelles controller refuses Black Sea movement", () => {
  const G = fresh();
  G.spaces.dardanelles.control = "OT";
  G.war = createWarState(G, "RU", "OT", "conquest", ["macedonia"], 2);
  expect(planNavalMove(G, "RU", "black-sea", "eastern-mediterranean")).toMatchObject({ok: false, reason: "dardanellesDenied"});

  // 3.4.1: without a grant a neutral controller also closes the strait; the
  // live `dardanellesPassage` decision records the permission.
  G.war = null;
  expect(planNavalMove(G, "RU", "black-sea", "eastern-mediterranean")).toMatchObject({
    ok: false,
    reason: "dardanellesPermission",
  });
  G.dardanellesPassage = {requesting: "RU", granting: "OT", turn: G.turn};
  expect(planNavalMove(G, "RU", "black-sea", "eastern-mediterranean")).toMatchObject({ok: true, cost: 1});
});

// ---------------------------------------------------------------------------
// Enemy boxes and ports
// ---------------------------------------------------------------------------

test("an enemy-occupied box is not used as a stepping stone", () => {
  const G = fresh();
  G.war = createWarState(G, "GE", "UK", "conquest", ["london"], 2);
  placeUnit(G, "GE", "squadron", "north-atlantic", 2);

  expect(planNavalMove(G, "UK", "london", "western-mediterranean")).toMatchObject({ok: false, reason: "enemyBox"});
  // With the enemy box cleared, the same route is legal again.
  for (const unit of Object.values(G.units)) {
    if (unit.owner === "GE" && unit.space === "north-atlantic") delete G.units[unit.id];
  }
  G.spaces["north-atlantic"].units = [];
  expect(planNavalMove(G, "UK", "london", "western-mediterranean")).toMatchObject({ok: true});
});

test("an enemy-controlled port is an attack, not a move", () => {
  const G = fresh();
  G.war = createWarState(G, "GE", "UK", "conquest", ["london"], 2);
  G.spaces.malta.control = "GE";
  expect(planNavalMove(G, "UK", "london", "malta")).toMatchObject({ok: false, reason: "enemyPort"});
});

// ---------------------------------------------------------------------------
// Live move: one-CP semantics
// ---------------------------------------------------------------------------

test("a live naval move traces a multi-box path and keeps the one-CP action cost", () => {
  const G = fresh();
  const ctx = makeCtx(seat("UK"));
  G.phase = "action";
  G.activePower = "UK";
  G.cpRemaining = 2;
  G.persistent.suezCanal = true;
  const ship = ukShipIn(G, "london");

  expect(navalMove(G, ctx, [ship], "eastern-mediterranean")).toBeUndefined();
  expect(G.units[ship].space).toBe("eastern-mediterranean");
  expect(G.spaces["eastern-mediterranean"].units).toContain(ship);
  expect(G.cpRemaining).toBe(1);

  // The same unit can be activated again with another 1 CP action.
  expect(navalMove(G, ctx, [ship], "indian-ocean")).toBeUndefined();
  expect(G.units[ship].space).toBe("indian-ocean");
  expect(G.cpRemaining).toBe(0);

  // No CP left: the third activation is refused and does not move the unit.
  expect(navalMove(G, ctx, [ship], "pacific-ocean")).toBe(INVALID_MOVE);
  expect(G.units[ship].space).toBe("indian-ocean");
});

test("a naval move rejects mixed stacks, foreign units and illegal destinations", () => {
  const G = fresh();
  const ctx = makeCtx(seat("UK"));
  G.phase = "action";
  G.activePower = "UK";
  G.cpRemaining = 3;
  const londonShip = ukShipIn(G, "london");
  const scotlandShip = ukShipIn(G, "scotland");
  const frenchShip = placeUnit(G, "FR", "squadron", "london", 2);

  expect(navalMove(G, ctx, [londonShip, scotlandShip], "north-atlantic")).toBe(INVALID_MOVE);
  expect(navalMove(G, ctx, [frenchShip.id], "north-atlantic")).toBe(INVALID_MOVE);
  // London to the Pacific needs two non-European entries.
  expect(navalMove(G, ctx, [londonShip], "pacific-ocean")).toBe(INVALID_MOVE);
  expect(G.units[londonShip].space).toBe("london");
});
