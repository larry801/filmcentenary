# 帝国挽歌（Imperial Elegy）单人「历史大战」试玩与行动提示（2026-11-25）

日期：2026-11-25
入口：`http://127.0.0.1:5173/localIE/solo`
剧本：`历史大战 / Historical Great War`（`gwTutorial`，GW 回合 0 起，印刷先手 GE→RU→AU→FR→奖励→UK）
座位：德国（GE）、英国（UK）各一轮；其余五席为规则 34 机器人
界面：简化中文，Chromium 1680×1050
依据：`IE_rule.pdf` 的 8.0 / 19.10 / 27.1–27.6 与 `IE_playbook.pdf` p. 7 的剧本设定。本机没有这两本 PDF 的原件，规则引文取自仓库内已转录并逐条引用的
`docs/imperial-elegy/RULES_COVERAGE.md`、`docs/imperial-elegy/SCENARIOS.md`（p. 7 的原文）与卡片数据里的印刷文本；未引入任何新的推断。

## 1. 试玩范围

- 从单人入口选德国 / 历史大战 / 普通难度进入 GW 回合 0 机动步骤（与 p. 7「Start this scenario with the Maneuver Step of GW turn 0」一致）。
- 用页面操作推进：德国的大战卡（「精疲力竭」）作为事件打出、预备军部署、征召、陆战进入目标选择、停牌；随后机器人依次行动（俄国、奥匈、法国，法国打出战斗与决定性战斗卡），德国获得奖励行动轮。
- 期间抽取每一次界面状态（`ie-dock-summary`、`ie-next-step`、战局面板、空间行动列表）与浏览器控制台，用于判断「只看界面」时玩家是否知道下一步。
- 英国一轮只用于确认历史大战下英国的海军页与两栖控件是否存在。

## 2. 发现与修复

> 严重度：高＝阻断规则或让玩家无法推进；中＝规则/提示缺失或误导；低＝文案一致性。

| # | 问题 | 严重度 | 修复 |
| --- | --- | --- | --- |
| 1 | 「停牌前必须打出「精疲力竭」」只说了牌名，没说牌在「手牌区」的大战卡槽、要用它的「打出事件」按钮 | 高 | 新增每次状态下的「行动提示」两行，直接写出控件路径与实时数字（`components/actionHints.ts`，渲染为 `ie-next-step`） |
| 2 | 战局面板另有一行「战争预算: GE 0 · UK 0 · …」，读的是战役的 `warBudget`（大战中恒为 0），与上方真正的预算格子矛盾 | 中 | 删除该行；预算只由 `ie-budget-grid` 的 `gwBudget` 显示 |
| 3 | GW 机动中「势力」页的 8.0 影响力矩阵按钮仍可点击，点击只会在控制台留下 `invalid move: placeMpit`，界面无任何反应 | 中 | `MpitPanel` 增加 `lockedReason`；行动阶段之外（含战时与大战机动）改为只读并写明「影响力标记只能在行动阶段放置（8.0）」 |
| 4 | 19.10 两栖突击在 `gwManeuver` 被拒（只接受 action/wartime），因此 p. 7「The UK cannot amphibiously assault GE home spaces containing a GE naval unit(s)」这条剧本规则永远无法触发 | 高 | `amphibiousAssaultCheck` 接受 `gwManeuver`，按 27.1 记为一次 naval 预算行动；`amphibiousAssault` 在 GW 从战争预算扣 1 CP；指令面板与 `useBoardModel` 的可见/可用条件同步放开 |

### 问题 1（高）行动提示

- 现象：GW 机动中停牌按钮因「精疲力竭」被禁用，dock 只写「停牌前必须打出“精疲力竭”」；页面没有任何地方说明这张卡在手牌区的大战卡槽，也没有说明要用「打出事件」而不是 CP。玩家只看界面时只能逐个点开面板找。
- 修复：`actionHints(G, viewer, locale, t)` 按阶段给出 1–2 行具体操作，并在 `TurnPanel` 的 dock 头下方以 `ie-next-step` 显示：
  - 待决事项 → 「在上方对话框中选择一项——只有印刷给出的选项可选。」
  - GW 机动（当前行动轮）：按 `gwFinishImpulseProblem` 区分「精疲力竭 / 卡牌奖励 / 必须行动 / 行动已完成 / 可停牌」，并附战争预算数字。
  - GW 计划 / 冬季 / 战役行动阶段 / 外交阶段各有对应文案。
- 验证：`actionHints.test.ts`（10 条，覆盖预算阈值、奖励行动、精疲力竭、他人行动轮、中立行动轮、计划/冬季、待决优先级、终局）；浏览器实测 `ie-next-step` 在 GW 回合 0 德国行动轮显示「在地图上点选己方军团所在空间，再在指令面板「行动」页执行一次：行军、铁路、征召、整补或部署。／战争预算 7；预算 ≤2 才能停牌。」

### 问题 2（中）错误的「战争预算」行

- 现象：`GreatWarPanel` 在预算格子下方再打印一行 `战争预算: GE 0 · UK 0 · …`；它读 `G.powers[p].warBudget`（战役的有限战争预算），大战里恒为 0，而上方的格子显示 `gwBudget` = 7 / 4 / 4 / 6 / 5 / 3。同一屏出现两个「战争预算」，一个是错的。
- 修复：删除该行。`docs/imperial-elegy/README.md` 与 `gwControls.test.tsx` 都不依赖它。

### 问题 3（中）GW 中的影响力矩阵

- 规则依据：8.0 的影响力标记是 12.1 的和平时期行动；15.2（有限战争）与 27.5（大战）各自替代行动列表，引擎的 `phaseActionProblem` 已经拒绝 `placeMpit`。
- 现象：`MpitPanel` 的可用标志沿用 `canAct`（GW 机动里为 true），所以矩阵按钮可点；点击后引擎返回 `INVALID_MOVE`，控制台出现两条 `invalid move: placeMpit args: GE,te`，界面没有任何提示。
- 修复：`MpitPanel` 增加 `lockedReason`，`BoardLayout` 传入 `canAct && phase === "action"`；非行动阶段显示 `ie-mpit-locked` 的原因文案。

### 问题 4（高）大战中的两栖突击

- 规则依据：27.5 把海军移动列入大战行动；19.10 的两栖突击属于海军移动。p. 7 的历史大战设定专门限制英国对「含德国海军单位的德国本土港口」的两栖突击——只有大战里能两栖突击，这条规则才有意义。
- 现象：`amphibiousAssaultCheck` 只接受 `action` / `wartime`，`useBoardModel` 的 `amphibiousVisible` 同样只在这两个阶段为真；英国在 GW 中看不到两栖控件，p. 7 的限制永远不会触发（`docs/imperial-elegy/SCENARIOS.md` 原「仍然存在」第 1 条）。
- 修复：`gwManeuver` 中被接受的突击必须由当前行动席位发动、且通过 `gwActionAllowance(G, power, "naval")`（27.1：一次行动轮一个预算行动）；`amphibiousAssault` 在 GW 用 `spendGwManeuverBudget` 扣战争预算并记账，其他阶段仍用 `requireCp`。
- 验证：`amphibiousInterception.test.ts` 新增 3 条——GW 中合法并扣 1 点预算（7→4 为测试夹具的 5→4）、同一行动轮第二次突击被拒、英国突击含德国舰队的汉诺威被 `scenario-german-port` 拒绝（该分支此前无法到达）。

## 3. 已验证正常的部分

- 历史大战开局：GW 回合 0 机动、印刷先手、盟约 TE/TA/中立、意大利中立框、德国 7 点战争预算，与 `SCENARIOS.md` §3.5 一致。
- 德国首个行动轮的免费「高级参谋部」部署（33.1）不扣预算，dock 仍提示「需用 1 点战争预算执行行动」，与 27.1「完成行动≠停牌」一致。
- 「精疲力竭」作为事件打出后进入卡牌奖励流程，奖励行动不能重复同一行动、不能发动陆战（27.2），提示与引擎一致。
- 机器人行动、法国阵前战斗牌与决定性战斗、奖励行动轮均正常推进；浏览器控制台无错误（除问题 3 复现时的 `placeMpit`）。

## 4. 未覆盖 / 限制

- 本轮没有走完整个大战（冬季 29.x、计划 26.x、中立参战 29.3、投降 30.x）——自动化只能点击，无法在不看美术的情况下稳定选择战斗与冬季损失；这些路径仍由既有 `greatWar*` 套件覆盖。
- 两栖突击的界面路径只在引擎层验证：英国在 GW 回合 0 是等待席位，要等德国、俄国、奥匈、法国依次行动后才能操作。
- 本机没有 `IE_rule.pdf` / `IE_playbook.pdf` 原件，规则判断使用仓库中逐条转录并引用的印刷文本；未据此新增任何未经转录支持的规则。

## 5. 本地验证

- `npx tsc --noEmit --pretty false`：通过。
- `./node_modules/.bin/jest src/imperialElegy`：**370 suites / 4870 tests 全部通过**（含新增 `actionHints.test.ts` 10 条与 `amphibiousInterception.test.ts` 3 条）。
- `./node_modules/.bin/jest src/imperialElegy/components/board.test.tsx gwControls.test.tsx MpitPanel.test.tsx mobileDecision.test.tsx actionAvailability.test.ts`：109 条通过。
- 浏览器：单人历史大战（德国）开局、GW 机动、精疲力竭、部署、陆战目标选择、停牌后机器人连续行动，均无控制台错误；`ie-next-step`、`ie-mpit-locked`、删除的预算行均在页面上实测。
