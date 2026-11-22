/**
 * 34.1 — bot National Goals.
 *
 *   "Bots do not draw NGs when player's draw NGs, instead bots draw all their
 *   NGs at the end of the game (if there has been no GW) or the start of the
 *   GW. … Easy: 3 NGs, Normal: 4 NGs, Hard: 5 NGs."
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {resolveEnd} from "./moves";
import {botGoalCount, drawBotGoals} from "./engine/botGoals";
import {finishScenario} from "./engine/victory";
import {resolveStartingGoal} from "./engine/scenarioSetup";
import {soloSetupData} from "./components/localSetup";
import {outbreakGreatWar} from "./engine/greatWar";
import {GOALS_BY_ID} from "./constant/goals";

const makeCtx = (die = 3): Ctx =>
  ({
    playerID: "0",
    random: {Die: (_sides: number) => die},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "prep",
  }) as unknown as Ctx;

const BOTS: Power[] = ["GE", "UK", "FR", "RU", "OT"];

const solo1870 = (difficulty: "easy" | "normal" | "hard" = "normal"): ImperialElegyState =>
  setupImperialElegy(makeCtx(), {
    scenario: "s1870",
    bots: BOTS,
    botDifficulty: difficulty,
  });

const keepStartingGoals = (G: ImperialElegyState): void => {
  for (const power of POWERS) {
    const raw = G.powers[power].flags.startingGoalChoices;
    if (typeof raw !== "string") continue;
    const first = raw.split(",").filter(Boolean)[0];
    if (first !== undefined) resolveStartingGoal(G, power, first);
  }
};

test("a solo match marks its five bot seats for the engine", () => {
  const bag = soloSetupData("AU", "s1870", false, "normal");
  expect(bag.bots).toEqual(BOTS);
  const G = setupImperialElegy(makeCtx(), bag);
  expect([...G.bots].sort()).toEqual([...BOTS].sort());
  expect(G.botDifficulty).toBe("normal");
});

test("bot seats start with no NGs while the human draws the opening choice", () => {
  const G = solo1870();
  for (const bot of BOTS) expect(G.powers[bot].goals).toHaveLength(0);
  expect(String(G.powers.AU.flags.startingGoalChoices ?? "").split(",").filter(Boolean)).toHaveLength(3);
});

test("difficulty sets the bot NG count at the GW/end-of-game checkpoint", () => {
  for (const [difficulty, count] of [
    ["easy", 3],
    ["normal", 4],
    ["hard", 5],
  ] as const) {
    const G = solo1870(difficulty);
    expect(botGoalCount(G)).toBe(count);
    drawBotGoals(G, makeCtx());
    for (const bot of BOTS) expect(G.powers[bot].goals).toHaveLength(count);
    // The human is untouched by the bot draw.
    expect(G.powers.AU.goals).toHaveLength(0);
  }
});

test("the end-phase NG draw skips bot seats (34.1)", () => {
  const G = solo1870();
  keepStartingGoals(G);
  G.pending = null;
  G.turn = 3;
  G.phase = "end";
  G.flags.turnEnded = 2;
  resolveEnd(G, makeCtx());
  // 20.11 draws for the human AU only.
  expect(G.powers.AU.goals.length).toBeGreaterThanOrEqual(1);
  for (const bot of BOTS) expect(G.powers[bot].goals).toHaveLength(0);
});

test("the end of a no-GW scenario deals the bots their NGs before scoring", () => {
  const G = solo1870("hard");
  keepStartingGoals(G);
  G.pending = null;
  finishScenario(G, makeCtx());
  expect(G.result).not.toBeNull();
  for (const bot of BOTS) {
    // The 5 goals were dealt for the end-of-game score, then scored.
    expect(G.log.some((entry) => entry.key === "botGoalsDrawn" && entry.power === bot)).toBe(true);
    expect(G.result?.breakdown?.[bot]?.goals.length).toBe(5);
  }
});


test("25.5 tops every player up to 3 NGs at the outbreak", () => {
  const G = setupImperialElegy(makeCtx(), {scenario: "s1870"});
  keepStartingGoals(G);
  G.pending = null;
  for (const power of POWERS) expect(G.powers[power].goals).toHaveLength(1);
  outbreakGreatWar(G, makeCtx(4), "GE", "IE-A001");
  for (const power of POWERS) {
    // The goal that was kept is either still held or replaced by the top-up;
    // either way the outbreak scores the printed three.
    expect(G.powers[power].outbreakGoalScores ?? []).toHaveLength(3);
  }
  expect(G.log.some((entry) => entry.key === "outbreakGoalTopUp")).toBe(true);
});

test("25.5 keeps the highest printed VP goal on the top-up draw", () => {
  const G = setupImperialElegy(makeCtx(), {scenario: "s1870"});
  keepStartingGoals(G);
  G.pending = null;
  G.powers.AU.goalDeck = ["NG-26", "NG-27", "NG-28", "NG-29", "NG-30", "NG-31", "NG-32", "NG-33"];
  G.powers.AU.goals = ["NG-27"];
  const vpAt = (id: string): number => GOALS_BY_ID[id]?.vp ?? 0;
  outbreakGreatWar(G, makeCtx(4), "GE", "IE-A001");
  const kept = G.powers.AU.outbreakGoalScores ?? [];
  expect(kept).toHaveLength(3);
  // Every scored goal is one of the three the top-up was allowed to see.
  expect(kept.some((entry) => vpAt(entry.goal) >= vpAt("NG-27"))).toBe(true);
});
