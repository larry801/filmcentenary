# Virgin Queen 本地热座：将领入场时间表修复（第十轮）

- 日期：2026-11-12
- 基线：`b65c1f8` 之后的工作区（含本轮未提交修复）
- 环境：Chromium 1440×900，`yarn start`，`http://127.0.0.1:5173`
- 入口：`/localVQ` → Campaign · 拉罗谢尔之围 · 6 人
- 范围：六国逐座位完成第 1 回合 Card Draw → 外交 → 春季部署 → 行动阶段开始；对照 2024 Living Rules 8.1 / 10.4 与场景书第 34 页 Leader Entry Table 核对将领入场

## 1. 结论

| # | 严重度 | 类型 | 问题 | 状态 |
|---|---|---|---|---|
| R1 | 高 | 规则/将领入场 | 剧本未摆放的将领全部以“人员池、无入场回合”初始化，第 1 回合春季部署即全部登场：帕尔马、唐·约翰、莱斯特、亨利三世、吉斯、茹瓦约斯、拉拉·穆斯塔法、锡南帕夏、曼斯费尔德直接上图；乌鲁奇·阿里、圣克鲁斯、梅迪纳·西多尼亚、霍华德、德雷克、霍金斯要求选择母港。`data/leaders.ts` 已录入 Leader Entry Table 的 `entryTurn`，但运行时从未读取 | 已修复 |
| R2 | 高 | 规则/锦标赛设置 | Tournament（第 3 回合开局）中已陨落的德拉古特会从人员池“复活”回到奥斯曼港口；纳瓦拉（第 4 回合）、莫里斯（第 5 回合）与奥兰治第 3 回合即被放进拉罗谢尔 | 已修复 |
| R3 | 中 | 规则/新教叛乱 | 叛乱选将只看 `location === "pool"` 或“状态不存在”，忽略入场回合：第 1 回合第二次叛乱就能带入纳瓦拉；已被移出游戏（状态被删除）的新教将领会被重新创建 | 已修复 |
| R4 | 中 | 规则/指挥上限 | 由于 R1，伊斯坦布尔第 1 回合有穆罕默德 + 拉拉·穆斯塔法 + 锡南三名将领（指挥 5+5+6），奥斯曼可整体移动 10 个单位；正确应为穆罕默德单独指挥 5 | 随 R1 修复 |
| R5 | 低 | 回归覆盖 | 原有测试把错误行为写成预期（“春季必有海军将领待选港口”、“伊斯坦布尔 10 个单位可整体移动”） | 已更正并补充 |

## 2. 复现（修复前）

1. `/localVQ` → Campaign 6 人，六个席位确认抽牌、结束外交。
2. 春季部署 P1 奥斯曼：出现“海军将领归国：选择港口 · 乌卢奇·阿里”；P2 西班牙：圣克鲁斯侯爵、梅迪纳·西多尼亚公爵；P3 英格兰：埃芬厄姆的霍华德勋爵、弗朗西斯·德雷克、约翰·霍金斯。
3. 地图伦敦显示“将领: 莱斯特伯爵”（场景书 Campaign 英格兰开局没有将领，莱斯特第 2 回合入场）。

探针（`setupGame` + `arriveLeaders`）显示 Campaign 第 1 回合：

```text
AFTER lalaMustafa@istanbul sinanPasha@istanbul parma@madrid donJohn@madrid leicester@london
      guise@paris henryIII@paris joyeuse@paris mansfeld@vienna
ARRIVALS uluchAli santaCruz medinaSidonia howard drake hawkins
```

Tournament 第 3 回合：`ARRIVALS dragut …`，`navarre/orange/maurice@laRochelle`。

## 3. 修复

### R1/R2 剧本设置按 Leader Entry Table 初始化

`scenario.ts` 新增 `LEADER_ENTRY_TURN`（取自 `OFFICIAL_LEADERS.entryTurn`）与 `initialOffBoardLeader`：

```text
入场表有记录且入场回合 > 剧本首回合 → {location: "pool", returnTurn: 入场回合}
其余                                → {location: "offMap"}（不在场）
随后剧本 "Leaders Held Off-Map"（科利尼 / 奥兰治）照旧改为 pool，可经叛乱入场
```

- `arriveLeaders` 已有 `(returnTurn ?? 0) > G.year` 的跳过逻辑，因此表内将领在其回合春季自动登场（陆军到首都、海军按既有流程选择母港）。
- `offMap` 是现有的“不在场”约定（谍报刺杀、意外早逝候选已排除），`arriveLeaders` 不处理。
- 特殊入场不受影响：德拉古特陨落把乌鲁奇·阿里设为 `pool + returnTurn`；天主教同盟把吉斯从任意非地图位置放到兰斯。
- 运行时目录里没有官方依据的将领（拉拉·穆斯塔法、锡南帕夏——场景书中锡南是建筑师、梅迪纳·西多尼亚、霍华德、海军将领德雷克/霍金斯、茹瓦约斯、曼斯费尔德）一律 `offMap`。德雷克、霍金斯作为海船长（10.2，`captain-*`）的用法不变。
- 入场回合不晚于剧本首回合、但剧本没有摆放的将领视为不在场（场景书：Tournament 第 3 回合的入场将领“已列在 setup 中”）。

### R3 叛乱选将

`resolveRebellion` 只选 `location === "pool"` 且 `returnTurn <= G.year` 的新教陆军将领；状态不存在（已移出游戏）的将领不再被重新创建。

## 4. 修复后实测

- Campaign 第 1 回合春季部署：六国均无“海军将领归国”选择，伦敦不再有莱斯特（`01-spring-no-arrivals.png`）。
- HRE 选择宗教倾向与本国牌后，六国结束春季部署，进入行动阶段，控制台无错误（`02-action-phase-turn1.png`）。

## 5. 验证

- `./node_modules/.bin/tsc --noEmit`：通过
- `./node_modules/.bin/jest --silent`：**224 suites / 1340 tests** 全部通过
- 新增 `src/virginQueen/leaderEntry.test.ts`（9 项），在未修复的代码上 9 项全部失败：
  - 入场表与印刷表一致；
  - Campaign 第 1 回合无任何将领入场、无港口选择；
  - 表内将领的 `returnTurn`；第 2 回合唐·约翰到马德里、莱斯特到伦敦，第 4 回合帕尔马登场、圣克鲁斯要求选港；
  - 乌鲁奇·阿里、吉斯与无依据将领直到第 7 回合都不会自动入场；
  - Tournament 德拉古特不复活，纳瓦拉/莫里斯/帕尔马第 3 回合不在场；
  - 教学剧本同样适用；
  - 叛乱：第 1 回合科利尼可入场，第二次叛乱无人可用，第 2 回合奥兰治可用而纳瓦拉不可用；
  - 已移出游戏的科利尼不会被叛乱复活。
- 更正 `navalPortChoice.test.ts`（无待选港口时 `navalLeaderArrivals` 为 `undefined`）与 `virginQueen.test.ts`（第 1 回合无港口选择；伊斯坦布尔整体 10 单位超出穆罕默德指挥 5，改为移动 5 个正规军）。

## 6. 后续建议

1. **诺里斯缺失**：Leader Entry Table 列有诺里斯（英格兰陆军，第 4 回合），但运行时 `constant/leaders.ts` 没有该将领（缺少官方 counter 数值）。目前英格兰第 4 回合不会得到第二名将领；补上需要确认印刷的战斗/指挥值。
2. **新教将领入场选项**：规则 10.4 允许新教把到场将领留在势力卡上等待叛乱；Tournament 中奥兰治（Held Off-Map）会因新教已有首都而被自动放到拉罗谢尔。可考虑改为让新教玩家选择。
3. **无依据的将领**：建议从运行时目录彻底移除这 8 名将领（需同步清理名称表与少量测试）；本轮先保持 `offMap` 以降低改动面。
4. **Turn Track 可见性**：界面没有显示“下回合入场将领”，热座玩家无法预见唐·约翰/莱斯特何时登场；可在“列强概览”中补充。
