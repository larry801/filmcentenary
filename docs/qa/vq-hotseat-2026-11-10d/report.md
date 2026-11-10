# Virgin Queen 本地热座：完整对局与规则/UI 修复（第四轮）

- 日期：2026-11-10
- 基线：`205c71f` 之后的工作区
- 环境：Chromium 1440×900，`yarn start`，`http://127.0.0.1:5173`
- 入口：`/localVQ`（Campaign · 拉罗谢尔之围 · 6 人）
- 范围：从第 1 回合 Card Draw 连续推进到第 7 回合冬季结算，最终由时限胜利结束；六国逐座位操作，覆盖抽牌、外交、春季部署、行动、强制事件、响应窗口、波兰选王竞标、公历纪年法响应、冬季结算与游戏结束面板

## 1. 结论

| # | 严重度 | 类型 | 问题 | 状态 |
|---|---|---|---|---|
| R1 | 高 | 规则/设置 | 剧本书中**小写 scm/hcm = 新教面**，但数据只记录了标记形状，没有记录宗教面。伦敦、布里斯托、约克、根特、鲁昂、南特、昂布瓦兹、珀斯、奥格斯堡、法兰克福以及锦标赛的胡格诺地区开局全部被当成天主教 | 已修复 |
| R2 | 中 | 规则/设置 | Campaign 法国开局缺少 Scenario Book 的奥尔良 1 个正规军 | 已修复 |
| U1 | 高 | UI/流程 | 波兰选王（#86）的逐势力竞标没有面板；出牌势力的“结束行动轮次”仍然可用，点击后刷出 `disallowed move: endImpulse` / `player not active`，对局卡死 | 已修复 |
| U2 | 中 | UI/本地化 | 游戏结束时标题显示字面量 `vq.header.phase.` 并产生 i18n 缺键警告；结束原因显示英文 `military`；时限胜利时标题可能显示“回合 8” | 已修复 |
| U3 | 中 | UI/本地化 | 骰子提示把“天主教转化”摘要按骰面拆分，显示成 `catholicconversionsinFrance` | 已修复 |
| U4 | 中 | 本地化 | 日志中仍有 `Papal Bull: ... makes seven Catholic attempts...`、`Untimely Death: ... is removed...`、`法国: catholic在...` 等中英混排 | 已修复 |
| U5 | 低 | 本地化 | 中文日志里的场景说明仍为英文 | 已修复 |
| U6 | 低 | 热座 UI | 在 A 座位打开“跳过/结束行动轮次”确认框后切到 B 座位结束游戏，回到 A 座位时确认框仍压在结束面板上 | 已修复 |

本轮没有发现新的规则判定错误；第 7 回合的时限胜利、冬季结算、VP 与响应流程均正常。前一次试玩中出现过一次法国军事胜利（教皇诏书 → 法国赢得教宗国 → 罗马关键城市），属于规则允许的即时胜利，不是误判。

## 2. 修复明细

### R1 控制标记的宗教面

Scenario Book 的标记图例：

- `SCM/HCM`：天主教面
- `scm/hcm`：新教面

`src/virginQueen/data/scenarios.ts` 原来只把大小写转成 `controlMarker: "scm" | "hcm"`，宗教仍默认天主教。修复后为所有小写标记补上 `religion: "protestant"`：

- Campaign：根特、伦敦、布里斯托、约克、鲁昂、拉罗谢尔、南特、昂布瓦兹、珀斯、奥格斯堡、法兰克福
- Tournament：阿尔克马尔、阿姆斯特丹、布里勒、弗利辛恩、伦敦、约克、布里斯托，以及雷恩、南特、昂布瓦兹、普瓦捷、利摩日、蒙彼利埃、阿维尼翁和胡格诺的拉罗谢尔、科尼亚克、图卢兹、巴约讷、爱丁堡、珀斯、斯特灵

控制势力保持不变（小写只表示标记翻到新教面），因此法国/西班牙等关键城市基线不变；`protestantSpaceCount` 仍按剧本印刷值 18 / 30 起算。新增回归：`src/virginQueen/scenarioReligion.test.ts`。

### R2 奥尔良守军

`orleans: {units: {france: {regular: 1}}}` 已补入 Campaign 设置。相关回归测试同时确认奥尔良现在有 1 个法国正规军。

### U1 波兰选王竞标面板

- 新增 `src/virginQueen/components/board/PendingPanels/PolishElectionPanel.tsx`
- 引擎把 `pendingPolishElection.remaining[0]` 放入响应链：
  - `pendingPower`：黄色条显示“需要响应 · 法国 · 轮到你选择”
  - `responsePower`：热座标题提示正确的竞标座位
  - `canAct`：竞标期间禁止其他行动
- `actionPanel()` 在 `G.pendingPolishElection` 时整个替换为竞标面板，不再渲染“跳过/结束行动轮次”
- 面板提供“自动/手牌/财宝”下拉与“提交竞标”；非竞标座位显示“等待 X 竞标。请切换到 PX 标签页”
- 引擎侧工具（`polishElectionBidOptions` 等）移到 `src/virginQueen/polishElection.ts`，`board.tsx` 保留原导出以兼容现有测试

回归：`board.test.tsx` 新增“出价时显示竞标面板而不是结束行动轮次”，同时覆盖法国座位与非竞标座位的切换提示。

### U2 游戏结束标题与原因

- `phaseLabel("")` 直接返回空串；标题只在非空时渲染“ / 阶段”，不再显示 `vq.header.phase.`，也不再触发 i18n 缺键警告
- 结束原因通过 `gameOverReasonText()` 使用现有 `VICTORY_TEXT` 本地化：
  - `military` → 军事胜利：控制足够多的关键城市
  - `timeLimit` → 时限胜利：第 7 回合结束时分数最高
- 时限胜利由冬季结算先把 `G.year` 推到 8 再判定；标题现在用 `Math.min(G.year, G.endTurn)`，显示“回合 7”

回归：`board.test.tsx` 新增结束原因本地化、空阶段键隐藏、时限胜利年份封顶三项。

### U3 骰子提示摘要

`DiceToast` 只在全部 token 都是数字时渲染骰面；否则渲染本地化后的整句摘要。转化掷骰现在显示“天主教在 法国 的转化：[…]”，不再拼成 `catholicconversionsinFrance`。

回归：`DiceToast.test.tsx` 新增非骰面摘要用例。

### U4 日志本地化

`logText.ts` 新增/修正：

- `Papal Bull: X makes seven Catholic attempts in Y.` → `教皇诏书：X 在 Y 进行 7 次天主教转化尝试。`
- `Untimely Death: X is removed from the game.` → `英年早逝：X 移出游戏。`
- 带势力前缀的转化摘要：`法国: catholic conversions in 法国: [..]` → `法国: 天主教在 法国 的转化：[..]`
- 无前缀形式同样支持

回归：`i18n.test.ts` 新增 4 条断言。

### U5 场景说明

- `ScenarioSetup` 新增 `notesZh`
- Campaign / Tournament / Tutorial 均补齐中文说明
- `pushSetupLog("scenarioNote")` 同时保存英文与中文；`LogPanel` 在中文界面使用 `notesZh`，英文界面与导出日志继续使用英文

回归：`board.test.tsx` 断言中文面板含“场景说明：六人战役设置”且不含 `Six-player Campaign setup`；`scenarioReligion.test.ts` 断言每个剧本中英文说明数量一致。

### U6 游戏结束关闭遗留确认框

`VirginQueenBoard` 在 `ctx.gameover` 出现时清空 `confirmAction`、选牌抽屉、地图起点与运输路线，避免热座切座位后旧确认框覆盖结束面板。

## 3. 完整对局路径

1. 第 1 回合：六国依次确认抽牌；外交、春季部署；行动阶段按当前座位出牌/结束行动轮次；六国连续跳过后进入冬季。
2. 第 2 回合：重复抽牌与部署；行动阶段出现行动响应窗口，按提示切换响应座位并“允许行动”。
3. 第 3 回合：新教联盟打出强制事件“波兰选王”，面板依次要求法国、神圣罗马、西班牙竞标；三国提交后继续行动。随后教皇诏书按默认“法兰西 7 次传播”分支结算。
4. 第 4–6 回合：继续抽牌、部署、响应与行动；公历纪年法响应窗口显示“打出公历纪年法 / 不打出”。
5. 第 7 回合：Card Draw → 外交 → 春季 → 行动；行动结束后触发冬季结算和时限胜利。
6. 结束面板：`对局结束 · 胜者：P2 西班牙`，`原因: 时限胜利：第 7 回合结束时分数最高`。

对局日志中可见伦敦为“控制：英格兰 · 新教”，场景说明已全部中文。

## 4. 规则复核

- **军事胜利**：法国在教皇诏书后赢得教宗国，罗马关键城市按 24.1 标记为法国控制，法国关键城市数超过开局基线并达到 Auto Win，属于合法的即时军事胜利；不是误判。
- **开局关键城市**：小写标记只改宗教面，不改控制，法国/西班牙关键城市基线与上一轮一致。
- **新教地区轨**：仍从 18（Campaign）/30（Tournament）起算，地图宗教变化通过差值联动。
- **奥尔良**：按 Scenario Book 放置 1 个法国正规军；这也意味着奥尔良不再是无守军的叛乱目标（相关单测已改为先清空守军）。
- **波兰选王**：竞标顺序固定为法国 → 神圣罗马 → 西班牙；手牌/财宝/自动均按引擎规则结算。
- **时限胜利**：第 7 回合冬季后 `year = 8`，`checkVictory` 返回 `timeLimit`；标题显示回合 7，原因本地化。

## 5. 验证

- `./node_modules/.bin/tsc --noEmit`：通过
- `./node_modules/.bin/jest --silent`：215 suites / **1233 tests** 全部通过
- `./node_modules/.bin/playwright test e2e/hotseat.spec.ts e2e/diplomacy.spec.ts e2e/tutorial.spec.ts e2e/map.spec.ts e2e/local-smoke.spec.ts`：14 tests 全部通过
- `yarn build`：通过
- 热座实测：第 3 回合波兰选王三国竞标成功，未再出现 `endImpulse` invalid move；对局推进到第 7 回合并以时限胜利结束

## 6. 证据

- `01-polish-election.png`：第 3 回合波兰选王竞标面板；右侧伦敦详情显示“控制：英格兰 · 新教”
- `02-turn7-carddraw.png`：第 7 回合 Card Draw，六国 VP 与手牌
- `03-setup-log-zh.png`：中文场景说明与“伦敦 · 新教”
- `04-gameover.txt`：结束面板文本，含本地化的时限胜利原因
- `05-before-gameover.png`：修复前结束面板，标题为 `vq.header.phase.`，原因为 `military`

## 7. 后续建议

1. 继续用相同方式覆盖攻城、野战、海战、婚姻、天主教联盟成立与刺杀分支。
2. 新增剧本数据时，先对照 Scenario Book 的大小写标记补 `religion`；可考虑把 `controlMarker` 扩展为显式 `catholic/protestant` 面，避免再靠人工记忆。
3. 热座模式下如新增 `setActivePlayers` 的 pending 流程，必须同时加入 `pendingPower` / `responsePower` / `canAct` 与面板分支，否则会出现“当前座位仍可结束行动轮次”的同类卡死。
