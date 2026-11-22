import {setupImperialElegy} from "./engine/setup";
import {outbreakGreatWar} from "./engine/greatWar";
import {redactForView} from "./engine/privacy";
import {finishGame, scoreBreakdowns, scoreGame, stabilityVp} from "./engine/victory";
import {GOALS_BY_ID} from "./constant/goals";
import {ImperialElegyState} from "./types";

const ctx: any = {
  playerID: "0",
  random: {Die: () => 3},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
};

const fresh = (): ImperialElegyState => setupImperialElegy(ctx);

test("the breakdown names each score source and matches scoreGame", () => {
  const G = fresh();
  G.powers.GE.vp = 4;
  G.powers.GE.territorialKeys = 12;
  G.powers.GE.goals = ["NG-01"];
  G.powers.FR.goals = ["NG-22"];

  const breakdown = scoreBreakdowns(G);
  const {scores, details} = scoreGame(G);
  for (const power of Object.keys(scores) as (keyof typeof scores)[]) {
    expect(breakdown[power].total).toBe(scores[power]);
    expect(breakdown[power].goals).toEqual(details[power]);
  }
  expect(breakdown.GE.bankedVp).toBe(4);
  expect(breakdown.GE.goals).toEqual([expect.objectContaining({goal: "NG-01", vp: 3})]);
  expect(breakdown.FR.goals).toEqual([expect.objectContaining({goal: "NG-22", vp: GOALS_BY_ID["NG-22"].vp})]);
  expect(breakdown.GE.stabilityVp).toBe(stabilityVp(G, "GE"));
});

test("the Great War outbreak banks named goals and the Second Rome VP", () => {
  const G = fresh();
  // 25.5 tops every player up to 3 NGs at the outbreak; empty decks keep the
  // banked lines to the one named goal this test pins.
  for (const power of Object.keys(G.powers) as (keyof typeof G.powers)[]) {
    G.powers[power].goals = [];
    G.powers[power].goalDeck = [];
  }
  G.powers.GE.goals = ["NG-01"];
  G.spaces.istanbul.control = "RU";

  outbreakGreatWar(G, ctx, "GE", "score-breakdown-test");

  expect(G.powers.GE.goals).toEqual([]);
  expect(G.powers.GE.outbreakGoalScores).toEqual([{goal: "NG-01", vp: expect.any(Number)}]);
  expect(G.powers.RU.outbreakSecondRomeVp).toBe(2);
  expect(G.result).toBeNull();

  finishGame(G, "test");
  expect(G.result?.breakdown?.GE).toMatchObject({
    bankedGoals: [{goal: "NG-01", vp: expect.any(Number)}],
  });
  expect(G.result?.breakdown?.RU).toMatchObject({bankedSecondRomeVp: 2, secondRomeVp: 2});
});

test("the final breakdown is public even though goals stay hidden during play", () => {
  const G = fresh();
  G.powers.FR.goals = ["NG-22"];
  finishGame(G, "test");

  const opponent = redactForView(G, "0"); // seat 0 is GE, so FR is private
  expect(opponent.powers.FR.goals).toEqual([]);
  expect(opponent.result?.breakdown?.FR?.goals).toEqual([
    expect.objectContaining({goal: "NG-22"}),
  ]);
  expect(opponent.result?.breakdown?.FR?.total).toBe(G.result?.breakdown?.FR?.total);
});
