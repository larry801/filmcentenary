/** Printed industry display limits apply to both 20.6 and event increases. */
import type {Ctx} from "boardgame.io";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {maxIndustryOf, printedMaxIndustry} from "./engine/greatWarFlow";
import {resolveEffects} from "./engine/effects";
import {resolveEnd} from "./moves";

const context = () => ({playerID: "0", random: {Die: jest.fn(() => 6)}, events: {setPhase: jest.fn(), setActivePlayers: jest.fn(), endTurn: jest.fn()}}) as unknown as Ctx;

test.each(POWERS)("%s cannot industrialize above its printed display", (power) => {
  const ctx = context();
  const G = setupImperialElegy(ctx);
  G.powers[power].industry = printedMaxIndustry(power);
  G.powers[power].industryCard = "IE-A070";
  resolveEnd(G, ctx);
  expect(G.powers[power].industry).toBe(printedMaxIndustry(power));
  expect(G.powers[power].industryCard).toBeNull();
  expect(G.powers[power].autoIndustry).toBe(false);
});

test.each(POWERS)("%s event-based industrialization obeys the same ceiling", (power) => {
  const ctx = context();
  const G = setupImperialElegy(ctx);
  G.powers[power].industry = printedMaxIndustry(power);
  resolveEffects(G, ctx, power, [{type: "industry", delta: 1}], {});
  expect(G.powers[power].industry).toBe(printedMaxIndustry(power));
});

test("a reduced maximum industry also constrains subsequent increases", () => {
  const ctx = context();
  const G = setupImperialElegy(ctx);
  G.powers.FR.maxIndustry = 4;
  G.powers.FR.industry = 4;
  resolveEffects(G, ctx, "FR", [{type: "industry", delta: 1}], {});
  expect(G.powers.FR.industry).toBe(maxIndustryOf(G, "FR"));
});

test("automatic industrialization consumes a card but does not roll its die", () => {
  const ctx = context();
  const G = setupImperialElegy(ctx);
  const Die = ctx.random!.Die as jest.Mock;
  Die.mockClear();
  G.turn = 2;
  const before = G.powers.GE.industry;
  G.powers.GE.autoIndustry = true;
  G.powers.GE.industryCard = "IE-A070";
  resolveEnd(G, ctx);
  expect(G.powers.GE.industry).toBe(before + 1);
  expect(G.powers.GE.autoIndustry).toBe(false);
  expect(G.powers.GE.industryCard).toBeNull();
  expect(Die).not.toHaveBeenCalled();
});
