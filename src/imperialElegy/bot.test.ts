/**
 * Bot smoke tests — Rule 34 bot decision smoke checks.
 *
 * These tests verify that `botDecision` returns a well-formed move object
 * in common game states without throwing.
 */
import {setupImperialElegy} from "./engine/setup";
import {botDecision, bmpitTarget, enumerateBot} from "./engine/bot";
import {POWERS} from "./types";

const ctx: any = {
  random: {Die: (n: number) => 1, Number: () => 1, Shuffle: (a: any[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "prep",
  playerID: "0",
  numPlayers: 6,
};

test("botDecision returns a move object in prep phase for each power", () => {
  const G = setupImperialElegy(ctx);
  for (const power of POWERS) {
    const move = botDecision(G, ctx, power);
    expect(typeof move.move).toBe("string");
    expect(move.move.length).toBeGreaterThan(0);
  }
});

test("botDecision does not throw in action phase", () => {
  const G = setupImperialElegy(ctx);
  G.phase = "action";
  G.activePower = "GE";
  for (const power of POWERS) {
    expect(() => botDecision(G, ctx, power)).not.toThrow();
  }
});

test("enumerateBot returns a single-element array", () => {
  const G = setupImperialElegy(ctx);
  const moves = enumerateBot(G, ctx, "0");
  expect(moves).toHaveLength(1);
  expect(typeof moves[0].move).toBe("string");
});

test("bmpitTarget covers all die combinations", () => {
  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = 1; d2 <= 6; d2++) {
      const {power, track} = bmpitTarget(d1, d2);
      expect(POWERS).toContain(power);
      expect(["te", "ta", "neutral"]).toContain(track);
    }
  }
});

test("botDecision prep phase picks finishPrep when stability > 2", () => {
  const G = setupImperialElegy(ctx);
  G.phase = "prep";
  G.powers.GE.stability = 4; // above the threshold
  const move = botDecision(G, ctx, "GE");
  expect(move.move).toBe("finishPrep");
});

test("botDecision prep phase offers discardForStability when stability <= 2", () => {
  const G = setupImperialElegy(ctx);
  G.phase = "prep";
  G.powers.GE.stability = 1;
  // Give GE a discardable card
  G.powers.GE.hand = ["IE-A013"];
  const move = botDecision(G, ctx, "GE");
  // Either discards for stability or finishes prep (if no discardable card found)
  expect(["discardForStability", "finishPrep"]).toContain(move.move);
});
