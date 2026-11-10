# Virgin Queen 本地热座：六国军事胜利与规则/UI 修复（第六轮）

- 日期：2026-11-10
- 基线：`b2f3ebe` 之后的工作区（含上一轮未提交修复）
- 环境：Chromium 1440×900，`yarn start`，`http://127.0.0.1:5173`
- 入口：`/localVQ` → Campaign · 拉罗谢尔之围 · 6 人
- 范围：逐一验证奥斯曼、西班牙、英格兰、法国、神圣罗马、新教联盟的军事胜利；核对 2024 Living Rules 25.1、六张势力卡 Auto Win 格、Protestant Spaces Card 与 Scenario Book 的方形控制标记；修复规则数据、胜利判定时机与热座 UI

## 1. 结论

| # | 严重度 | 类型 | 问题 | 状态 |
|---|---|---|---|---|
| R1 | 高 | 规则/势力卡 | 六国 Auto Win 关键城市数全部错误：代码为奥斯曼 7、西班牙 8、英/法/神圣罗马/新教 5；印刷势力卡实际为 **奥斯曼 10、西班牙 14、英格兰 7、法国 10、神圣罗马 8、新教 5（尼德兰以外）**。军事胜利被大幅提前，法国和西班牙在开局即已达到代码阈值 | 已修复 |
| R2 | 高 | 规则/地图数据 | Scenario Book 用方形控制标记（SCM/scm）标出的 11 个关键城市被数据层当成要塞/城市：巴塞罗那、塞维利亚、马耳他、加来、鲁昂、马赛、布里斯托尔、奥格斯堡、法兰克福、雅典、阿尔及尔；另有重建地图独有的埃迪尔内被误算为关键城市。开局关键城市数与 Auto Win 进度均失真 | 已修复 |
| R3 | 高 | 规则/VP | 势力卡基础 VP 表被统一成 `[0,1,2,4,6,9,12,16,20]`；Protestant Spaces Card 的西班牙/英格兰/新教特殊 VP 也不正确。修复 R1/R2 后开局奖励 VP 出现负值（如法国 −11） | 已修复 |
| R4 | 中 | 规则/胜利时机 | 军事胜利在 Diplomacy/Spring 阶段也会由 `endIf` 立即触发；官方 25.1 规定自动胜利在 Action Phase 结算，外交阶段揭示的 Auto Win 只有仍在行动阶段开始时才成立 | 已修复 |
| R5 | 中 | 规则/事件 | `Ruler Falls Ill` 的“返回家乡要塞”只搜索 `kind === "fortress"`，遗漏所有关键城市（关键城市本身就是要塞）。R2 修正后西班牙会错误地退到直布罗陀而不是塞维利亚 | 已修复 |
| U1 | 中 | UI/热座 | 列强概览只显示“N 关键城市”，不显示 Auto Win 分母；新教还显示包含尼德兰的总关键城市数，与军事胜利实际只计尼德兰以外不一致 | 已修复 |
| U2 | 中 | UI/规则可见性 | “场景与胜利条件”没有军事胜利门槛，热座玩家无法判断距离胜利还差几城 | 已修复 |
| U3 | 低 | UI/结束面板 | 军事胜利结束面板只写“控制足够多的关键城市”，不显示实际 `N / AutoWin` | 已修复 |

修复后 Campaign 开局关键城市与 VP 全部回到 Scenario Book 的印刷值，六国军事胜利在浏览器热座中逐一触发并显示正确的结束面板。

## 2. 修复明细

### R1 Auto Win 数值

以 Vassal 4.6.0 模块中的 `powercards.jpg`（六张势力卡正面）为准，逐格核对“Cards and VP Per Key”：

| 势力 | 印刷关键城市格 | Auto Win | 旧代码 |
|---|---:|---:|---:|
| 奥斯曼 | 1–9 + Auto Win | 10 | 7 |
| 西班牙 | 1–13 + Auto Win | 14 | 8 |
| 英格兰 | 1–6 + Auto Win | 7 | 5 |
| 法国 | 1–9 + Auto Win | 10 | 5 |
| 神圣罗马 | 1–7 + Auto Win | 8 | 5 |
| 新教（尼德兰以外） | 1–4 + Auto Win | 5 | 5（正确） |

`src/virginQueen/constant/general.ts` 已更新 `autoWinKeys`。Scenario Book 的“SCM on Power Card”数量（奥斯曼 4、西班牙 3、英格兰 3、法国 2、神圣罗马 4、新教 5）与“地图上方形标记 + 卡上标记 = Auto Win”完全吻合，交叉验证了这些数值。

### R2 关键城市数据

Scenario Book 的图例明确：

- `SCM`：方形控制标记（Catholic 面）
- `scm`：方形控制标记（Protestant 面）
- `HCM/hcm`：六角形控制标记（非关键要塞/城市）

规则 2.1 又规定“Key: A key is a fortified space represented by a square”。因此凡印刷 SCM/scm 的地区都必须是关键城市。修正：

- `src/virginQueen/constant/spaces.ts`：`barcelona`、`seville`、`rouen`、`marseille`、`frankfurt`、`augsburg`、`bristol`、`athens`、`algiers` 由 `fortress/open` 改为 `key`。
- `src/virginQueen/data/spaces.ts`：`malta`、`calais` 改为 `key`。
- `edirne` 由 `key` 改为 `fortress`。官方地图/Vassal 区域表没有 Edirne，Scenario Book 也未给它 SCM；它属于重建地图的额外空间，不应计入军事胜利。

修复后 Campaign 开局关键城市：

| 势力 | 关键城市 | 开局 Auto Win 进度 |
|---|---:|---:|
| 奥斯曼 | 6 | 6 / 10 |
| 西班牙 | 11 | 11 / 14 |
| 英格兰 | 4 | 4 / 7 |
| 法国 | 8 | 8 / 10 |
| 神圣罗马 | 4 | 4 / 8 |
| 新教 | 0（尼德兰以外） | 0 / 5 |

Tournament 开局为 7 / 12 / 4 / 6 / 4 / 2（尼德兰以外），与 Scenario Book 的方形标记数量一致。

### R3 基础 VP 与特殊 VP

`vpByKeys` 按势力卡逐格重写：

- 奥斯曼：`0,1,3,5,7,9,11,13,15,17`
- 西班牙：`0..13` 每城 1 VP
- 英格兰：`0,0,2,4,6,8,10`
- 法国：`0,2,3,4,5,6,7,8,9,10`
- 神圣罗马：`0,2,4,6,8,10,12,14`
- 新教：仍由 `baseVp` 按“尼德兰内 3 VP / 外 2 VP”计算

`religiousSpecialVp` 按 2024 `VQ_PAC3` 的 “Special VP by Power” 表重写（每 5 个新教地区一档）：

- 西班牙：`7,6,5,4,3,2,1,0,0`
- 英格兰：`0,0,1,1,2,2,3,3,3`
- 新教：`0,1,2,3,4,5,6,7,7`

修复后 Campaign 开局 VP 精确回到印刷轨道，且六国 `bonusVp` 均为 0（不再用负奖励分吸收误差）：

| 势力 | 基础 | 宗教 | 奖励 | 合计 |
|---|---:|---:|---:|---:|
| 奥斯曼 | 11 | 0 | 0 | 11 |
| 西班牙 | 11 | 6 | 0 | 17 |
| 英格兰 | 6 | 0 | 0 | 6 |
| 法国 | 9 | 0 | 0 | 9 |
| 神圣罗马 | 8 | 0 | 0 | 8 |
| 新教 | 0 | 1 | 0 | 1 |

### R4 军事胜利只在 Action Phase 结算

- `checkImmediateVictory(G, phase?)`：当传入阶段且不是 `action` 时直接返回 `undefined`。
- `checkVictory(G, includeSecretHreVp?, phase?)` 透传阶段。
- `VirginQueenGameDef.endIf(G, ctx)` 传入 `ctx.phase`。

热座实测：英格兰 7 城时切到 `diplomacy` 不结束；再切到 `action` 立即返回 `{power:"england", reason:"military", winner:"2"}`。这同时覆盖了“外交阶段揭示、行动阶段仍保持则胜利”的官方例外。

### R5 Ruler Falls Ill 返回要塞

`resolveRulerFallsIll` 的候选从 `space.kind === "fortress"` 改为 `isFortifiedSpace(G, space.id)`，关键城市现已正确参与“家乡要塞”搜索。回归测试仍要求跳过被敌军占领的巴塞罗那并落到塞维利亚。

### U1–U3 军事胜利 UI

- 列强概览与“我的势力”显示 `N / AutoWin 关键城市`，并带 `title` 提示“控制 N 个关键城市且无动荡即获胜”。
- 新教进度使用 `protestantKeysOutsideNetherlands(G)`，不再用包含尼德兰的总数。
- 教学局使用 `TUTORIAL_POWER_CARDS[power].military`，与教学规则一致。
- “场景与胜利条件”新增一行：
  `军事胜利门槛（关键城市）：奥斯曼帝国 10 / 西班牙 14 / 英格兰 7 / 法国 10 / 神圣罗马 8 / 新教联盟 5；新教只计尼德兰以外的关键城市，动荡城市不计。`
- 军事胜利结束面板新增 `N / AutoWin 关键城市`，例如 `8 / 8 关键城市`。

## 3. 热座实测

在 `/localVQ` Campaign 6 人局中验证六国军事胜利。由于一局正常流程无法在合理时间内分别刷出六个不同 Auto Win，验证方式为：

1. 正常打开本地热座，确认六国抽牌、地图、列强概览与“场景与胜利条件”均正常显示。
2. 通过已加载的 boardgame.io Local master 克隆当前对局，只设置某一势力的关键城市到其 Auto Win 数量（其他关键城市归 independent），再通过真实的 `events.setPhase("action")` 进入行动阶段。
3. 由真实的 `endIf`/`checkVictory` 产生 gameover，渲染正常的结束面板；逐国重载页面重复。

这不是正常对局中的逐城攻取，但胜利判定、阶段门控、胜负归属和 UI 渲染都走产品代码；Auto Win 数值、动荡排除、新教尼德兰以外计数另有单元/流程回归覆盖。

| 势力 | 触发条件 | 结束面板 |
|---|---|---|
| 奥斯曼 | 10 / 10 | `对局结束 · 胜者：P1 奥斯曼帝国` + `10 / 10 关键城市` |
| 西班牙 | 14 / 14 | `对局结束 · 胜者：P2 西班牙` + `14 / 14 关键城市` |
| 英格兰 | 7 / 7 | `对局结束 · 胜者：P3 英格兰` + `7 / 7 关键城市` |
| 法国 | 10 / 10 | `对局结束 · 胜者：P4 法国` + `10 / 10 关键城市` |
| 神圣罗马 | 8 / 8 | `对局结束 · 胜者：P5 神圣罗马帝国` + `8 / 8 关键城市` |
| 新教 | 5 / 5（尼德兰以外） | `对局结束 · 胜者：P6 新教联盟` + `5 / 5 关键城市` |

六国结束原因均为 `军事胜利：控制足够多的关键城市`，无英文残留、无错误阶段标题。

## 4. 规则复核

- **Auto Win**：与六张印刷势力卡逐格一致；Scenario Book 的“卡上 SCM + 地图 SCM = Auto Win”交叉验证通过。
- **关键城市**：所有 Scenario Book 方形标记地区均为 `key`；雅典、阿尔及尔、马耳他等不再被当成普通要塞。
- **无敌方动荡**：`controlledKeys` 继续排除 `unrest`；新增回归“第 7 个关键城市处于动荡时英格兰不获胜”。
- **新教**：只计尼德兰以外的关键城市；阿姆斯特丹、安特卫普、布鲁塞尔即使由新教控制也不计入 5 城门槛。
- **Activated Major**：已激活的奥斯曼/神圣罗马仍不能取得军事胜利（Scenario Book p. 13 Additional Considerations 2）。
- **时机**：Diplomacy/Spring 不触发；Action 阶段触发。外交阶段获得的关键城市若在行动阶段开始仍保持，则会在行动阶段结算。
- **开局不误判**：`militaryVictoryBaseline` 仍保留；修复后没有任何势力开局即达到 Auto Win，基线只作为防御性保护。
- **VP**：基础 VP、特殊 VP 与 2024 PAC 一致；开局总 VP 回到印刷值。

## 5. 验证

- `./node_modules/.bin/tsc --noEmit`：通过
- `./node_modules/.bin/jest --silent --runInBand`：217 suites / **1254 tests** 全部通过
- `./node_modules/.bin/playwright test e2e/hotseat.spec.ts e2e/diplomacy.spec.ts e2e/tutorial.spec.ts e2e/map.spec.ts e2e/local-smoke.spec.ts`：14 tests 全部通过
- `yarn build`：通过
- 热座浏览器实测：六国军事胜利结束面板、列强概览 `N / AutoWin`、场景面板军事门槛、Diplomacy→Action 阶段门控均正常

新增回归：

- `src/virginQueen/militaryVictory.test.ts`：六国阈值、差一城不胜、动荡排除、新教尼德兰以外计数、阶段门控、Activated Major 不胜
- `src/virginQueen/religiousVp.test.ts`：2024 PAC 特殊 VP 表、Scenario Book 方形标记关键城市分类、Edirne 非关键城市

## 6. 证据

- `01-ottoman-military.jpeg`：P1 奥斯曼 10 / 10
- `02-spain-military.jpeg`：P2 西班牙 14 / 14
- `03-england-military.jpeg`：P3 英格兰 7 / 7
- `04-france-military.jpeg`：P4 法国 10 / 10
- `05-hre-military.jpeg`：P5 神圣罗马 8 / 8
- `06-protestant-military.jpeg`：P6 新教 5 / 5
- `07-military-progress.jpeg`：列强概览显示六国 `N / AutoWin` 与开局 VP
- `08-gameover.txt`：六国结束面板文本、阶段门控结果、Campaign/Tournament 开局关键城市与 VP

## 7. 后续建议

1. `drawByKeys` 仍是旧的简化表（例如英格兰 4 城时抽 5 张，而印刷势力卡为 3 张 + 统治者奖励）。本轮聚焦军事胜利未改动它，建议下一轮按势力卡逐格修正并重跑抽牌/手牌相关测试。
2. 25.1 规定同一次行动若多人同时达成自动胜利，应比较当时 VP；当前 `checkImmediateVictory` 仍按固定势力顺序返回第一个。可加入“同时胜利按 VP/标准平局规则裁决”的回归。
3. 已激活的奥斯曼/神圣罗马在列强概览中仍显示军事进度；可加“已激活，不参与军事胜利”的提示，避免误解。
