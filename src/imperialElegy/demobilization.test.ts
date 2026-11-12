/**
 * Rules 17.0/17.1 — demobilisation.
 *
 * The first block pins the printed war-end steps: the 17.1 blockade check
 * (with its major-victory exception) and 5.7 displacement of units caught in
 * enemy-controlled territory.  The rest pins the live free redeployment/naval
 * prompt: it is optional, never spends CP, cannot start a battle/support, is
 * skipped when a power has no legal move, records the action on the archived
 * war and always hands the action phase back.
 */

import {Ctx} from "boardgame.io";
import {ImperialElegyState, Power, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {applyVictoryOutcome, classifyVictory, createWarState, demobilizeWar} from "./engine/limitedWar";
import {placeUnit} from "./engine/effects";
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

const demobPending = (G: ImperialElegyState) => {
  expect(G.pending?.kind).toBe("demobilizationFreeAction");
  return G.pending!;
};

describe("17.0/17.1 demobilization blockade", () => {
  test("a blockaded player gains a -1 card marker when the war ends", () => {
    const G = fresh();
    G.phase = "wartime";
    G.activePower = "FR";
    G.spaces.westphalia.control = "GE";
    G.spaces.westphalia.occupiedBy = "FR";
    const war = createWarState(G, "FR", "GE", "conquest", ["westphalia"], 2);
    G.war = war;
    // Enemy ships in the North Atlantic cut GE's only exit from the Baltic.
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    const victory = classifyVictory(G, war);
    expect(victory.kind).toBe("normal");
    const before = G.powers.GE.cardMarkers;

    applyVictoryOutcome(G, war, victory);
    expect(demobilizeWar(G, war).ok).toBe(true);

    expect(G.powers.GE.cardMarkers).toBe(before - 1);
    expect(G.log.some((entry) => entry.key === "warBlockade" && entry.power === "GE")).toBe(true);
  });

  test("units in enemy-controlled territory displace at demobilisation", () => {
    const G = fresh();
    G.phase = "wartime";
    G.activePower = "GE";
    G.spaces.bohemia.occupiedBy = "GE";
    const war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
    G.war = war;
    const victory = classifyVictory(G, war);
    expect(victory.kind).toBe("normal");
    applyVictoryOutcome(G, war, victory);

    // A GE army is sitting in AU-controlled Vienna when the war ends.
    const unit = placeUnit(G, "GE", "army", "vienna", 2);
    expect(G.units[unit.id].space).toBe("vienna");

    expect(demobilizeWar(G, war).ok).toBe(true);

    expect(G.units[unit.id].space).not.toBe("vienna");
    expect(G.spaces.vienna.units).not.toContain(unit.id);
    expect(G.log.some((entry) => entry.key === "unitDisplaced" && entry.args?.unit === unit.id)).toBe(true);
  });

  test("the major-victory winner is never blockaded", () => {
    const G = fresh();
    G.phase = "wartime";
    G.activePower = "GE";
    // Paris falls: GE wins a major victory over FR.
    G.spaces.paris.occupiedBy = "GE";
    const war = createWarState(G, "GE", "FR", "conquest", ["alsace-lorraine"], 2);
    G.war = war;
    // FR still cuts GE's Baltic exit; the exception overrides the trace.
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    const victory = classifyVictory(G, war);
    expect(victory.primary).toBe("major");
    const before = G.powers.GE.cardMarkers;

    applyVictoryOutcome(G, war, victory);
    expect(demobilizeWar(G, war).ok).toBe(true);

    expect(G.powers.GE.cardMarkers).toBe(before);
    expect(G.log.some((entry) => entry.key === "warBlockade" && entry.power === "GE")).toBe(false);
  });
});

describe("17.0 free demobilization actions", () => {
  test("the winning side is offered a free land redeploy that spends no CP and records history", () => {
    const G = fresh();
    const ctx = makeCtx("0");
    const war = settleMajorWar(G, ctx);

    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.context?.current).toMatchObject({power: "GE", side: "attacker", order: 1});
    const redeploy = demobPending(G).options.find((option) => option.id.startsWith("redeploy:"))!;
    expect(redeploy).toBeDefined();
    expect(String(redeploy.label)).toContain("Free redeploy");

    const unitId = String(redeploy.data?.unitId);
    const unit = G.units[unitId];
    const from = unit.space!;
    expect(from).not.toBeNull();

    expect(resolvePending(G, ctx, redeploy.id)).toBeUndefined();
    expect(G.pending?.kind).toBe("movementDestination");
    const destinations = G.pending!.options.map((option) => option.id);
    expect(destinations.length).toBeGreaterThan(0);
    const to = destinations[0];

    expect(resolvePending(G, ctx, to)).toBeUndefined();
    expect(G.units[unitId].space).toBe(to);
    expect(G.spaces[from].units).not.toContain(unitId);
    expect(G.spaces[to].units).toContain(unitId);
    // A free action never spends CP.
    expect(G.cpRemaining).toBe(0);

    // Recorded on the archived war.
    expect(war.freeActionEntitlements).toEqual([
      {power: "GE", side: "attacker", order: 1},
      {power: "AU", side: "defender", order: 2},
    ]);
    expect(war.freeActions).toHaveLength(1);
    expect(war.freeActions![0]).toMatchObject({
      power: "GE",
      side: "attacker",
      action: "redeploy",
      unitIds: [unitId],
      from,
      to,
    });
    expect(G.pending?.kind).toBe("demobilizationFreeAction");

    // Done/decline finishes the chain and resumes the action phase.
    expect(declinePending(G, ctx)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.phase).toBe("action");
    expect(G.activePower).toBe("GE");
  });

  test("the losing side follows the winner, and done advances the chain", () => {
    const G = fresh();
    const ctx = makeCtx("0");
    settleMajorWar(G, ctx);

    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.context?.queue).toEqual([{power: "AU", side: "defender", order: 2}]);
    expect(resolvePending(G, ctx, "done")).toBeUndefined();

    // The loser's prompt keeps the queued side/order.
    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    expect(G.pending?.power).toBe("AU");
    expect(G.pending?.context?.current).toMatchObject({power: "AU", side: "defender", order: 2});

    expect(resolvePending(G, makeCtx("3"), "done")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.phase).toBe("action");
    expect(G.activePower).toBe("GE");
  });

  test("a free naval move is offered and executed for a naval winner", () => {
    const G = fresh();
    const ctx = makeCtx("0");
    G.phase = "action";
    G.activePower = "GE";
    G.pending = null;
    // UK wins defensively by occupying Berlin: a major victory for the
    // defender, so the UK (which has squadrons) goes first.
    G.spaces.bohemia.occupiedBy = "GE";
    G.spaces.berlin.occupiedBy = "UK";
    G.war = createWarState(G, "GE", "UK", "conquest", ["malta"], 2);
    expect(resolveWar(G, ctx, [])).toBeUndefined();

    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    expect(G.pending?.power).toBe("UK");
    const naval = G.pending!.options.find((option) => option.id.startsWith("naval:"))!;
    expect(naval).toBeDefined();
    const unitId = String(naval.data?.unitId);
    const unit = G.units[unitId];
    expect(unit.naval).toBe(true);
    const from = unit.space!;

    expect(resolvePending(G, makeCtx("1"), naval.id)).toBeUndefined();
    expect(G.pending?.kind).toBe("movementDestination");
    const destinations = G.pending!.options.map((option) => option.id);
    expect(destinations.length).toBeGreaterThan(0);
    const to = destinations[0];

    expect(resolvePending(G, makeCtx("1"), to)).toBeUndefined();
    expect(G.units[unitId].space).toBe(to);
    expect(G.spaces[from].units).not.toContain(unitId);
    expect(G.spaces[to].units).toContain(unitId);
    expect(G.wars[0].freeActions?.[0]).toMatchObject({power: "UK", action: "naval", unitIds: [unitId], from, to});
  });

  test("declining the prompt skips every remaining entitled power", () => {
    const G = fresh();
    const ctx = makeCtx("0");
    settleMajorWar(G, ctx);

    expect(G.pending?.power).toBe("GE");
    expect(declinePending(G, ctx)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.phase).toBe("action");
    // No free actions were recorded.
    expect(G.wars[0].freeActions ?? []).toEqual([]);
    expect(G.log.some((entry) => entry.key === "demobilizationFreeActionsFinished")).toBe(true);
  });

  test("a power with no legal free action is skipped automatically", () => {
    const G = fresh();
    const ctx = makeCtx("0");
    // Take every power's units off the map so nobody can redeploy or sail.
    for (const unit of Object.values(G.units)) {
      if (unit.space) {
        G.spaces[unit.space].units = G.spaces[unit.space].units.filter((id) => id !== unit.id);
        unit.space = null;
      }
    }
    const war = settleMajorWar(G, ctx);

    expect(G.pending).toBeNull();
    expect(G.phase).toBe("action");
    expect(war.freeActions ?? []).toEqual([]);
    const skipped = G.log.filter((entry) => entry.key === "demobilizationFreeActionSkipped");
    expect(skipped.length).toBeGreaterThanOrEqual(2);
    expect(skipped.map((entry) => entry.power)).toEqual(expect.arrayContaining(["GE", "AU"]));
  });

  test("a redeployment destination with an enemy unit is never offered", () => {
    const G = fresh();
    const ctx = makeCtx("0");
    // A French army sits in a GE-controlled space; the free redeploy must not
    // create a battle by moving the GE army onto it.
    const mover = G.spaces.paris.units.find((id) => G.units[id]?.owner === "FR" && G.units[id]?.kind === "army");
    expect(mover).toBeDefined();
    G.spaces.paris.units = G.spaces.paris.units.filter((id) => id !== mover);
    G.spaces.berlin.units.push(mover!);
    G.units[mover!].space = "berlin";
    settleMajorWar(G, ctx);
    const geUnit = Object.keys(G.units).find(
      (id) => G.units[id].owner === "GE" && G.units[id].space === "prussia",
    );
    expect(geUnit).toBeDefined();
    const option = G.pending?.options.find((entry) => entry.id === `redeploy:${geUnit}`);
    expect(option).toBeDefined();
    expect(resolvePending(G, ctx, option!.id)).toBeUndefined();
    expect(G.pending?.options.map((entry) => entry.id)).not.toContain("berlin");
  });
});
