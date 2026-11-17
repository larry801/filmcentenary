import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {setupImperialElegy} from "../engine/setup";
import {redactForView} from "../engine/privacy";
import {scoreGame} from "../engine/victory";
import {GOALS_BY_ID} from "../constant/goals";
import {ScorePanel} from "./ScorePanel";

const ctx: any = {
  playerID: "0",
  random: {Die: () => 3},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
};

const game = () => {
  const G = setupImperialElegy(ctx);
  G.powers.GE.territorialKeys = 12;
  G.powers.GE.goals = ["NG-01"];
  G.powers.FR.goals = ["NG-22"];
  return G;
};

test("the live panel prints the viewer's goals and marks hidden ones", () => {
  const full = game();
  const view = redactForView(full, "0"); // GE's own goals stay private to seat 0
  const html = renderToStaticMarkup(
    <ScorePanel G={view} locale="en" viewer="GE" goalCounts={{GE: 1, FR: 1}}/>,
  );
  expect(html).toContain("Score breakdown");
  expect(html).toContain(GOALS_BY_ID["NG-01"].title);
  expect(html).not.toContain(GOALS_BY_ID["NG-22"].title);
  expect(html).toContain("1 hidden goal");
  expect(html).toContain('data-testid="ie-score-FR-hidden"');
});

test("the final panel prints every source from the stored result", () => {
  const G = game();
  const {scores, breakdown} = scoreGame(G);
  G.result = {winners: ["GE"], reason: "test", scores, breakdown};
  const view = redactForView(G, "0");
  const html = renderToStaticMarkup(
    <ScorePanel G={view} locale="zh_CN" viewer="GE" goalCounts={{GE: 1, FR: 1}}/>,
  );
  expect(html).toContain("最终得分");
  expect(html).toContain(GOALS_BY_ID["NG-22"].titleZh);
  expect(html).toContain("得分拆解");
  expect(html).toContain('data-testid="ie-score-panel"');
  expect(html).not.toContain("个未公开目标");
});
