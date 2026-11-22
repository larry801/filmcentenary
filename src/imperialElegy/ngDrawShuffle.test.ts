/**
 * 2.4 / 20.11 — "players will shuffle their NG deck, draw three NG cards, keep
 * one card, and return the other two to their NG deck."
 *
 * The engine drew the top three without shuffling, so the turn-5 draw was fully
 * determined by the opening deck order.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState} from "./types";
import {POWERS} from "./types";
import {goalsForPower} from "./constant/goals";
import {setupImperialElegy} from "./engine/setup";
import {resolveStartingGoal} from "./engine/scenarioSetup";
import {resolveEnd} from "./moves";

/** Every die rolls 1, so `shuffle` is deterministic. */
const makeCtx = (): Ctx =>
  ({
    playerID: "0",
    random: {Die: (_sides: number) => 1},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "end",
  }) as unknown as Ctx;

test("20.11 shuffles the NG deck before drawing", () => {
  const ctx = makeCtx();
  const G: ImperialElegyState = setupImperialElegy(ctx, {scenario: "s1870"});
  for (const power of POWERS) {
    const raw = G.powers[power].flags.startingGoalChoices;
    if (typeof raw !== "string") continue;
    resolveStartingGoal(G, power, raw.split(",").filter(Boolean)[0]);
  }
  G.pending = null;
  // A known NG deck order; the held goal is removed from the pool.
  const pool = goalsForPower("AU", "s1870")
    .map((goal) => goal.id)
    .filter((id) => !G.powers.AU.goals.includes(id));
  G.powers.AU.goalDeck = [...pool];
  G.powers.AU.flags.ngChoices = "";
  G.turn = 3;
  G.phase = "end";
  G.flags.turnEnded = 2;
  resolveEnd(G, ctx);
  // `shuffle` with every die = 1 moves the first card to the end, so the
  // top-three draw starts on pool[1] — never on the untouched pool[0].
  const drawn = String(G.powers.AU.flags.ngChoices ?? "").split(",").filter(Boolean);
  expect(drawn).toHaveLength(3);
  expect(drawn[0]).toBe(pool[1]);
  expect(drawn).not.toEqual(pool.slice(0, 3));
});
