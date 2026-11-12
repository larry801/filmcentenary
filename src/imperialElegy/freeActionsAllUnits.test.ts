/**
 * Rule 17.0 / 12.15 — the post-war free redeployment and free naval movement
 * actions "allow players to move all their units, not just those that
 * participated in the war".  The live pending chain re-opens after every unit,
 * accumulates the moved units into the single free-action record, never spends
 * CP, and stays optional.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {createWarState} from "./engine/limitedWar";
import {placeUnit} from "./engine/effects";
import {navalUnitsIn} from "./engine/rules";
import {declinePending, resolvePending, resolveWar} from "./moves";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: () => 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/** GE wins a major victory over AU (Vienna falls); [] settles immediately. */
const settleMajorWar = (G: ImperialElegyState, ctx: Ctx): WarState => {
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.pending = null;
  G.spaces.bohemia.occupiedBy = "GE";
  G.spaces.vienna.occupiedBy = "GE";
  const war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
  G.war = war;
  expect(resolveWar(G, ctx, [])).toBeUndefined();
  expect(G.war).toBeNull();
  return war;
};

/** Resolve one unit's free action: pick the unit option, then its destination. */
const moveOne = (G: ImperialElegyState, prefix: "redeploy" | "naval", preferred?: string): string => {
  expect(G.pending?.kind).toBe("demobilizationFreeAction");
  const option = G.pending!.options.find((entry) => entry.id.startsWith(`${prefix}:`));
  expect(option).toBeDefined();
  const unitId = String(option!.data?.unitId);
  expect(resolvePending(G, makeCtx("0"), option!.id)).toBeUndefined();
  expect(G.pending?.kind).toBe("movementDestination");
  const destinations = G.pending!.options.map((entry) => entry.id);
  const to = preferred && destinations.includes(preferred) ? preferred : destinations[0];
  expect(resolvePending(G, makeCtx("0"), to)).toBeUndefined();
  return unitId;
};

describe("17.0 free actions move all units", () => {
  test("two land units and a naval unit all move in the same free actions", () => {
    const G = fresh();
    const ctx = makeCtx("0");
    const squadron = placeUnit(G, "GE", "squadron", "pomerania", 2).id;
    const war = settleMajorWar(G, ctx);
    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    expect(G.pending?.power).toBe("GE");

    const land1 = moveOne(G, "redeploy");
    // The chain re-opens with the remaining units, so "all units" is reachable.
    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    expect(G.pending!.options.map((entry) => entry.id)).not.toContain(`redeploy:${land1}`);
    const land2 = moveOne(G, "redeploy");
    const movedNaval = moveOne(G, "naval", "baltic-sea");
    expect(movedNaval).toBe(squadron);
    expect(G.units[squadron].space).toBe("baltic-sea");
    expect(navalUnitsIn(G, "pomerania").filter((unit) => unit.owner === "GE")).toHaveLength(0);

    // Finish the chain (GE done, then AU done).
    expect(resolvePending(G, ctx, "done")).toBeUndefined();
    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    expect(G.pending?.power).toBe("AU");
    const auCtx = makeCtx("3");
    expect(resolvePending(G, auCtx, "done")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.phase).toBe("action");

    // CP was never spent.
    expect(G.cpRemaining).toBe(0);
    // One record per printed free action, each carrying every unit that moved.
    const free = war.freeActions ?? [];
    const redeploy = free.find((entry) => entry.action === "redeploy")!;
    const naval = free.find((entry) => entry.action === "naval")!;
    expect(redeploy).toBeDefined();
    expect(redeploy.unitIds).toEqual(expect.arrayContaining([land1, land2]));
    expect(redeploy.unitIds).toHaveLength(2);
    expect(redeploy.moves?.map((entry) => entry.unitId)).toEqual(expect.arrayContaining([land1, land2]));
    expect(naval).toBeDefined();
    expect(naval.unitIds).toEqual([squadron]);
    expect(naval.moves).toEqual([{unitId: squadron, from: "pomerania", to: "baltic-sea"}]);
    // Both armies actually arrived somewhere friendly.
    expect(G.units[land1].space).not.toBeNull();
    expect(G.units[land2].space).not.toBeNull();
  });

  test("an illegal free destination is rejected without moving the unit", () => {
    const G = fresh();
    const ctx = makeCtx("0");
    placeUnit(G, "GE", "squadron", "pomerania", 2);
    settleMajorWar(G, ctx);
    const option = G.pending!.options.find((entry) => entry.id.startsWith("redeploy:"))!;
    const unitId = String(option.data?.unitId);
    const from = G.units[unitId].space;
    expect(resolvePending(G, ctx, option.id)).toBeUndefined();
    expect(resolvePending(G, ctx, "pacific-ocean")).toBe(INVALID_MOVE);
    expect(G.units[unitId].space).toBe(from);
    expect(G.pending?.kind).toBe("movementDestination");
    // Declining still advances to the next entitled power, not a deadlock.
    expect(declinePending(G, ctx)).toBeUndefined();
  });

  test("the free actions stay optional: declining moves nothing", () => {
    const G = fresh();
    const ctx = makeCtx("0");
    const war = settleMajorWar(G, ctx);
    const before = Object.fromEntries(
      Object.values(G.units)
        .filter((unit) => unit.space !== null)
        .map((unit) => [unit.id, unit.space]),
    );
    expect(declinePending(G, ctx)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(war.freeActions ?? []).toEqual([]);
    for (const [id, space] of Object.entries(before)) expect(G.units[id].space).toBe(space);
  });
});
