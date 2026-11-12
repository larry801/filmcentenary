/**
 * Rule 29.3 / 15.2.3 — a neutral's free deploy-reserves action places reserve
 * armies with the typed "deployed this impulse" marker; the marker is cleared
 * when the next impulse starts, so the army cannot move in the impulse it was
 * placed.
 */

import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {addReserve, placeUnit} from "./engine/effects";
import {landUnitsIn} from "./engine/rules";
import {resolveGwWinter, startGwManeuver} from "./engine/greatWarFlow";
import {resolvePending} from "./moves";

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

const gwState = (overrides: Partial<GreatWarState> = {}): GreatWarState => ({
  active: true,
  turn: 2,
  order: ["GE", "FR"],
  belligerents: ["GE", "FR"],
  neutrals: ["OT"],
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
  ...overrides,
});

/** Winter fixture where OT is the only neutral and has one reserve army. */
const neutralWinter = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = gwState();
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.powers.OT.alliance = "neutral";
  G.phase = "gwWinter";
  placeUnit(G, "FR", "expeditionary", "sudan", 1);
  addReserve(G, "OT", 1);
  return G;
};

const joinAndDeploy = (G: ImperialElegyState): {unitIds: string[]; space: string} => {
  const ctx = makeCtx();
  const res = resolveGwWinter(G, ctx);
  expect(res.ok).toBe(true);
  if (!res.ok) throw new Error(res.message);
  expect(G.pending?.kind).toBe("gwNeutralEntry");
  const ot = {...makeCtx(), playerID: "5"};
  expect(resolvePending(G, ot, "join:te")).toBeUndefined();
  expect(G.pending?.kind).toBe("gwNeutralAction");
  expect(resolvePending(G, ot, "deploy")).toBeUndefined();
  expect(G.pending?.kind).toBe("gwNeutralDeploy");
  const space = G.pending!.options.find((option) => option.id !== "skip")!.id;
  const before = new Set(landUnitsIn(G, space).map((unit) => unit.id));
  expect(resolvePending(G, ot, space)).toBeUndefined();
  const placed = landUnitsIn(G, space)
    .map((unit) => unit.id)
    .filter((id) => !before.has(id) && G.units[id].owner === "OT");
  return {unitIds: placed, space};
};

describe("29.3 neutral free deploy marker", () => {
  test("deployed reserve armies carry the typed marker and cannot move that impulse", () => {
    const G = neutralWinter();
    const {unitIds} = joinAndDeploy(G);
    expect(unitIds.length).toBeGreaterThan(0);
    for (const id of unitIds) {
      expect(G.units[id].flags?.deployedThisImpulse).toBe(true);
    }
  });

  test("the marker is cleared when the next impulse starts", () => {
    const G = neutralWinter();
    const {unitIds} = joinAndDeploy(G);
    const ot = {...makeCtx(), playerID: "5"};
    expect(resolvePending(G, ot, "done")).toBeUndefined();
    expect(G.phase).toBe("gwPlanning");
    expect(G.pending).toBeNull();
    for (const id of unitIds) expect(G.units[id].flags?.deployedThisImpulse).toBe(true);

    const res = startGwManeuver(G, makeCtx());
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    for (const id of unitIds) expect(G.units[id].flags?.deployedThisImpulse).not.toBe(true);
  });

  test("skipping the free deploy sets no marker", () => {
    const G = neutralWinter();
    const ctx = makeCtx();
    expect(resolveGwWinter(G, ctx).ok).toBe(true);
    const ot = {...makeCtx(), playerID: "5"};
    expect(resolvePending(G, ot, "join:te")).toBeUndefined();
    expect(resolvePending(G, ot, "deploy")).toBeUndefined();
    expect(G.pending?.kind).toBe("gwNeutralDeploy");
    expect(resolvePending(G, ot, "skip")).toBeUndefined();
    for (const unit of Object.values(G.units)) {
      expect(unit.flags?.deployedThisImpulse).not.toBe(true);
    }
  });
});
