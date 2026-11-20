/**
 * The battle result dialog must show the part the table asked for: both
 * sides' damage, side by side, inside the same popup that announces the
 * winner.  It is a dismissible report, so it has a close control and does not
 * trap the reader like a required decision.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import type {BattleReport} from "../types";
import {BattleResultModal} from "./BattleResultModal";
import {ieT} from "./i18n";

const report = (over: Partial<BattleReport> = {}): BattleReport => ({
  id: "battle-1-42-land-saxony",
  kind: "land",
  from: "berlin",
  to: "saxony",
  attacker: "GE",
  defender: "FR",
  winner: "attacker",
  decisive: false,
  attackerRoll: 4,
  defenderRoll: 4,
  differential: 0,
  attackerDrm: 1,
  defenderDrm: 0,
  attackerLosses: 1,
  defenderLosses: 2,
  attackerUnits: [{unitId: "u-ge-1", owner: "GE", kind: "army", steps: 1, eliminated: false}],
  defenderUnits: [
    {unitId: "u-fr-1", owner: "FR", kind: "army", steps: 1, eliminated: true},
    {unitId: "u-fr-2", owner: "FR", kind: "squadron", steps: 1, eliminated: false},
  ],
  mines: 0,
  trench: false,
  noRetreat: false,
  turn: 1,
  ...over,
});

const render = (over: Partial<BattleReport> = {}, open = true): string =>
  renderToStaticMarkup(React.createElement(BattleResultModal, {
    report: report(over),
    open,
    locale: "zh_CN",
    t: ieT(),
    onClose: () => undefined,
  }));

describe("the battle result dialog", () => {
  test("is a dismissible dialog and names the winner", () => {
    const html = render();
    expect(html).toContain('data-testid="ie-battle-result-modal"');
    expect(html).toContain('data-testid="ie-battle-result-backdrop"');
    expect(html).toContain('data-dismissible="true"');
    expect(html).toContain('data-testid="ie-battle-result-close"');
    expect(html).toContain('data-testid="ie-battle-result-dismiss"');
    expect(html).toContain("战斗结果");
    expect(html).toContain("胜方");
    expect(html).toContain("柏林");
    expect(html).toContain("萨克森");
  });

  test("carries both sides' damage inside the popup", () => {
    const html = render();
    expect(html).toContain('data-testid="ie-battle-result-damage"');
    expect(html).toContain("承受伤害");
    expect(html).toContain('data-testid="ie-battle-result-attacker"');
    expect(html).toContain('data-testid="ie-battle-result-defender"');
    expect(html).toContain('data-testid="ie-battle-result-attacker-losses"');
    expect(html).toContain('data-testid="ie-battle-result-defender-losses"');
    // 1 attacker step, 2 defender steps, and the casualty split by unit.
    expect(html).toMatch(/ie-battle-result-attacker-losses[^>]*>1</);
    expect(html).toMatch(/ie-battle-result-defender-losses[^>]*>2</);
    expect(html).toContain("军团（受损）");
    expect(html).toContain("军团（被消灭）");
    expect(html).toContain("分舰队（受损）");
  });

  test("also reports a pre-dice result with no rolls", () => {
    const html = render({attackerRoll: undefined, defenderRoll: undefined, differential: undefined, decisive: true});
    expect(html).toContain("未掷骰");
    expect(html).toContain("决定性胜利");
  });

  test("lists mines, trenches and the retreat destination when they apply", () => {
    const html = render({mines: 2, trench: true, retreatTo: "bavaria"});
    expect(html).toContain("水雷命中");
    expect(html).toContain("堑壕战");
    expect(html).toContain("撤退至");
  });

  test("names every dice modifier instead of only the two totals", () => {
    const html = render({
      drmSources: {
        attacker: [
          {key: "stability", side: "attacker", drm: -1, detail: {value: 1}},
          {key: "forcePointEdge", side: "attacker", drm: 2, detail: {count: 2}},
        ],
        defender: [
          {key: "brokenLoc", side: "defender", drm: -1, detail: {space: "bavaria"}},
        ],
      },
      attackerDrm: 1,
      defenderDrm: -1,
    });
    expect(html).toContain('data-testid="ie-battle-result-drms"');
    expect(html).toContain("掷骰修正来源");
    expect(html).toContain('data-testid="ie-battle-result-drm-attacker"');
    expect(html).toContain('data-testid="ie-battle-result-drm-defender"');
    // Each clause is printed with its own signed value.
    expect(html).toContain("稳定度轨道");
    expect(html).toContain("兵力点优势");
    expect(html).toContain("补给线中断");
    expect(html).toContain("巴伐利亚");
    expect(html).toContain("+2");
    expect(html).toContain("-1");
  });

  test("a report without a breakdown still prints both totals", () => {
    const html = render({drmSources: undefined});
    expect(html).toContain('data-testid="ie-battle-result-drms"');
    expect(html).toContain("没有记录修正来源");
    // The totals row is untouched.
    expect(html).toContain("DRM");
  });

  test("does not mount while closed", () => {
    expect(render({}, false)).toBe("");
  });
});
