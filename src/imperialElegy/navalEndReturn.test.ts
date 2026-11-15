/** 20.4: all sea-borne units return, with capacity and owner-chosen nearest ports. */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {navalReturnPlan} from "./engine/endPhase";
import {continueEndPhase, resolveEnd, resolvePending} from "./moves";

const ctxFor = (power: Power = "FR"): Ctx => ({
  playerID: String(POWERS.indexOf(power)), random: {Die: () => 3},
  events: {setPhase: jest.fn(), setActivePlayers: jest.fn(), endTurn: jest.fn(), endGame: jest.fn()},
}) as unknown as Ctx;

const empty = (): ImperialElegyState => {
  const G = setupImperialElegy(ctxFor());
  G.units = {};
  G.turn = 2;
  for (const state of Object.values(G.spaces)) state.units = [];
  for (const power of POWERS) { G.powers[power].reserves = []; G.powers[power].mpit = {te: 0, ta: 0, neutral: 0}; }
  return G;
};

test("planning reserves the four-ship port capacity across every returning ship", () => {
  const G = empty();
  const ships = Array.from({length: 6}, () => placeUnit(G, "FR", "squadron", "north-atlantic", 2).id);
  const before = JSON.stringify(G);
  const plan = navalReturnPlan(G);
  expect(JSON.stringify(G)).toBe(before);
  const counts = new Map<string, number>();
  for (const entry of plan) if (entry.to) counts.set(entry.to, (counts.get(entry.to) ?? 0) + 1);
  expect([...counts.values()].every((count) => count <= 4)).toBe(true);
  expect(counts.size).toBe(2);
  resolveEnd(G, ctxFor());
  expect(ships.every((id) => G.units[id]?.space !== "north-atlantic")).toBe(true);
  for (const state of Object.values(G.spaces)) {
    expect(state.units.filter((id) => G.units[id]?.naval).length).toBeLessThanOrEqual(4);
  }
});

test("reserve armies and attached corps return together, respecting army capacity", () => {
  const G = empty();
  const army = placeUnit(G, "GE", "reserveArmy", "baltic-sea", 2);
  const corps = placeUnit(G, "GE", "eliteCorps", "baltic-sea", 1, {attachedTo: army.id});
  for (let i = 0; i < 3; i += 1) placeUnit(G, "GE", "army", "pomerania", 2);
  const plan = navalReturnPlan(G);
  expect(plan).toHaveLength(1);
  expect(plan[0]).toMatchObject({unitId: army.id, unitIds: [army.id, corps.id], to: "prussia"});
  resolveEnd(G, ctxFor("GE"));
  expect(G.units[army.id].space).toBe("prussia");
  expect(G.units[corps.id].space).toBe("prussia");
  expect(G.units[corps.id].attachedTo).toBe(army.id);
});

test.each(["eliteColonialEf", "zouave"] as const)("%s at sea is not forgotten by the return step", (kind) => {
  const G = empty();
  const unit = placeUnit(G, "FR", kind, "western-mediterranean", 1);
  expect(navalReturnPlan(G).find((entry) => entry.unitId === unit.id)?.to).not.toBeNull();
  resolveEnd(G, ctxFor());
  expect(G.units[unit.id].space).not.toBe("western-mediterranean");
});

test("armies cannot return to a naval base, but an expeditionary force can", () => {
  const G = empty();
  for (const state of Object.values(G.spaces)) if (state.control === "GE") state.control = "AU";
  G.spaces.rhodes.control = "GE";
  const army = placeUnit(G, "GE", "army", "eastern-mediterranean", 2);
  const ef = placeUnit(G, "GE", "expeditionary", "eastern-mediterranean", 1);
  const plan = navalReturnPlan(G);
  expect(plan.find((entry) => entry.unitId === army.id)?.to).toBeNull();
  expect(plan.find((entry) => entry.unitId === ef.id)?.to).toBe("rhodes");
});

test("the player chooses among equally-near ports and can resume from a save", () => {
  let G = empty();
  const ship = placeUnit(G, "FR", "squadron", "north-atlantic", 1);
  G.phase = "end";
  G.endPhase = {step: 3};
  continueEndPhase(G, ctxFor());
  expect(G.pending?.context).toMatchObject({special: "endPhaseNavalReturn", unitId: ship.id});
  expect(G.pending?.power).toBe("FR");
  expect(G.pending?.options.map((option) => option.id)).toEqual(expect.arrayContaining(["brittany", "aquitaine", "picardy"]));
  expect(G.pending?.options.map((option) => option.id)).not.toContain("provence");
  expect(resolvePending(G, ctxFor("GE"), "picardy")).toBe(INVALID_MOVE);
  G = JSON.parse(JSON.stringify(G));
  expect(resolvePending(G, ctxFor(), "picardy")).toBeUndefined();
  expect(G.units[ship.id]).toMatchObject({space: "picardy", steps: 1});
  expect(G.turn).toBe(3);
  expect(G.endPhase).toBeUndefined();
  expect(G.log.filter((entry) => entry.key === "navalReturnToPort")).toHaveLength(1);
});

test("a port filled since the decision opened cannot be selected", () => {
  const G = empty();
  placeUnit(G, "FR", "squadron", "north-atlantic", 2);
  G.phase = "end";
  G.endPhase = {step: 3};
  continueEndPhase(G, ctxFor());
  for (let i = 0; i < 4; i += 1) placeUnit(G, "FR", "squadron", "picardy", 2);
  const before = JSON.stringify(G);
  expect(resolvePending(G, ctxFor(), "picardy")).toBe(INVALID_MOVE);
  expect(JSON.stringify(G)).toBe(before);
});

test("the next returning ship sees the capacity consumed by the player's actual choice", () => {
  const G = empty();
  for (let i = 0; i < 3; i += 1) placeUnit(G, "FR", "squadron", "brittany", 2);
  const first = placeUnit(G, "FR", "squadron", "north-atlantic", 2);
  const second = placeUnit(G, "FR", "squadron", "north-atlantic", 2);
  G.phase = "end";
  G.endPhase = {step: 3};
  continueEndPhase(G, ctxFor());
  expect(resolvePending(G, ctxFor(), "brittany")).toBeUndefined();
  expect(G.units[first.id].space).toBe("brittany");
  expect(G.pending?.context?.unitId).toBe(second.id);
  expect(G.pending?.options.map((option) => option.id)).not.toContain("brittany");
  expect(resolvePending(G, ctxFor(), "picardy")).toBeUndefined();
  expect(G.units[second.id].space).toBe("picardy");
  expect(G.spaces.brittany.units.filter((id) => G.units[id]?.naval)).toHaveLength(4);
});

test("enemy occupation blocks a port even after the garrison has left", () => {
  const G = empty();
  G.spaces.aquitaine.occupiedBy = "GE";
  const ship = placeUnit(G, "FR", "squadron", "north-atlantic", 2);
  const plan = navalReturnPlan(G).find((entry) => entry.unitId === ship.id)!;
  expect(plan.destinations).not.toContain("aquitaine");
  expect(plan.destinations).toContain("picardy");
});
