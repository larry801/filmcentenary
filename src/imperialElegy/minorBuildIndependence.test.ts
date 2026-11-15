/** 20.3: independent minors only, one automatic army, Poland's exception. */
import type {Ctx} from "boardgame.io";
import {setupImperialElegy} from "./engine/setup";
import {nonPlayerBuildPlan} from "./engine/endPhase";
import {placeUnit, registerPolishIndependence} from "./engine/effects";
import {resolveEnd} from "./moves";

const ctx = {playerID: "0", random: {Die: () => 3}, events: {setPhase: jest.fn(), setActivePlayers: jest.fn(), endTurn: jest.fn(), endGame: jest.fn()}} as unknown as Ctx;

test("Serbia's build-box reminder grants no army while its homeland is Ottoman", () => {
  const G = setupImperialElegy(ctx);
  expect(nonPlayerBuildPlan(G).some((entry) => entry.minor === "Serbia")).toBe(false);
  G.spaces.serbia.control = "Serbia";
  expect(nonPlayerBuildPlan(G).filter((entry) => entry.minor === "Serbia")).toEqual([
    {minor: "Serbia", home: "serbia", action: "placeReduced", unitId: null, space: "serbia"},
  ]);
  resolveEnd(G, ctx);
  const armies = Object.values(G.units).filter((unit) => unit.owner === "Serbia");
  expect(armies).toHaveLength(1);
  expect(armies[0]).toMatchObject({space: "serbia", steps: 1});
});

test("a conquered minor cannot repair an army stationed elsewhere", () => {
  const G = setupImperialElegy(ctx);
  G.nonPlayerBuildBox!.minors = ["Serbia"];
  placeUnit(G, "Serbia", "minorArmy", "romania", 1);
  expect(nonPlayerBuildPlan(G)).toEqual([]);
});

test("alliance markers do not remove the independence of an allied minor", () => {
  const G = setupImperialElegy(ctx);
  G.nonPlayerBuildBox!.minors = ["Serbia"];
  G.spaces.serbia.control = "Serbia";
  G.spaces.serbia.ally = "RU";
  expect(nonPlayerBuildPlan(G)).toHaveLength(1);
});

test("permanently eliminated minors never rebuild even if a stale control marker survives", () => {
  const G = setupImperialElegy(ctx);
  G.nonPlayerBuildBox!.minors = ["Tuscany"];
  G.eliminatedMinors = ["Tuscany"];
  expect(nonPlayerBuildPlan(G)).toEqual([]);
});

test("Poland's two steps use its actual independent home when only Galicia is liberated", () => {
  const G = setupImperialElegy(ctx);
  G.spaces.galicia.control = "Poland";
  G.spaces.galicia.independentHome = {power: "Poland", nationality: "Poles"};
  registerPolishIndependence(G);
  const plan = nonPlayerBuildPlan(G).filter((entry) => entry.minor === "Poland");
  expect(plan).toHaveLength(2);
  expect(plan.every((entry) => entry.space === "galicia")).toBe(true);
  resolveEnd(G, ctx);
  const polish = Object.values(G.units).filter((unit) => unit.owner === "Poland");
  expect(polish).toHaveLength(2);
  expect(polish.every((unit) => unit.space === "galicia")).toBe(true);
  expect(G.spaces.poland.control).toBe("RU");
});

test("a second army is not deleted by the automatic one-army placement ceiling", () => {
  const G = setupImperialElegy(ctx);
  G.nonPlayerBuildBox!.minors = ["Serbia"];
  G.spaces.serbia.control = "Serbia";
  const first = placeUnit(G, "Serbia", "minorArmy", "serbia", 2);
  const second = placeUnit(G, "Serbia", "minorArmy", "serbia", 2);
  expect(nonPlayerBuildPlan(G)).toEqual([]);
  resolveEnd(G, ctx);
  expect(G.units[first.id]).toBeDefined();
  expect(G.units[second.id]).toBeDefined();
});
