/** Rule 3.3.1 industrialization bonus, including live end-phase application. */
import type {Ctx} from "boardgame.io";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {industryRollNeeded} from "./engine/economy";
import {industryRoll} from "./engine/characteristics";
import {resolveEnd} from "./moves";

const ctx = {playerID: "0", random: {Die: () => 2}, events: {setPhase: jest.fn(), setActivePlayers: jest.fn(), endTurn: jest.fn()}} as unknown as Ctx;

test("PP +1 stacks with event modifiers in both shared industry helpers", () => {
  const G = setupImperialElegy(ctx);
  for (const power of POWERS) G.powers[power].flags.powerProjection = power === "GE" ? 6 : 0;
  G.powers.GE.flags.industryDrm = 2;
  expect(industryRollNeeded(G, "GE", 1)).toBe(1);
  expect(industryRoll(G, "GE", 1)).toMatchObject({drm: 3, rollNeeded: 1, guaranteed: true});
  expect(industryRollNeeded(G, "AU", 1)).toBe(4);
});

test("a tied second place grants neither contender the industry bonus", () => {
  const G = setupImperialElegy(ctx);
  for (const power of POWERS) G.powers[power].flags.powerProjection = 0;
  G.powers.GE.flags.powerProjection = 6;
  G.powers.FR.flags.powerProjection = G.powers.RU.flags.powerProjection = 3;
  expect(industryRollNeeded(G, "GE", 2)).toBe(2);
  expect(industryRollNeeded(G, "FR", 2)).toBe(3);
  expect(industryRollNeeded(G, "RU", 2)).toBe(4);
});

test("end-phase industry uses current ports/fleets rather than a stale projection flag", () => {
  const G = setupImperialElegy(ctx);
  // UK has PP 8 and dominates; GE has no navy and does not. Both pay a 2-CP
  // card and roll 2: UK reaches 5 with PP's +1 while GE falls short.
  G.powers.GE.flags.powerProjection = 99;
  G.powers.UK.flags.powerProjection = 0;
  for (const power of ["GE", "UK"] as const) G.powers[power].industryCard = "IE-A070";
  const ge = G.powers.GE.industry;
  const uk = G.powers.UK.industry;
  resolveEnd(G, ctx);
  expect(G.powers.UK.industry).toBe(uk + 1);
  expect(G.powers.UK.autoIndustry).toBe(false);
  expect(G.powers.GE.industry).toBe(ge);
  expect(G.powers.GE.autoIndustry).toBe(true);
  expect(G.powers.UK.industryCard).toBeNull();
  expect(G.powers.GE.industryCard).toBeNull();
});
