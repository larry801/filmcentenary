# Virgin Queen 本地热座：规则与 UI 复查（第二轮）

- 日期：2026-11-10
- 基线：`206fdb9` 之后的工作区
- 环境：Chromium 1440×900，`http://127.0.0.1:5173`
- 入口：`/localVQ`（Campaign · 拉罗谢尔之围 · 6 人）
- 范围：Card Draw → 外交 → 春季部署 → 行动阶段，六国逐座位操作；对照 `docs/VQ_RULES_EXTRACTION.md`

## 1. 结论

| # | 严重度 | 类型 | 问题 | 状态 |
|---|---|---|---|---|
| R1 | 高 | 规则 | 西班牙与新教联盟被 `canDeclareWar` 永久禁止宣战；议和后无法再宣战 | 已修复 |
| U1 | 高 | UI/反馈 | 外交“宣战/议和/结盟”按钮只按 `atWar` 禁用，非法时点击无反应，控制台 `invalid move` | 已修复 |
| U2 | 中 | 热座 UX | 外交/春季空闲座位没有“等待/切换标签页”提示；春季面板会对非当前玩家喊话 | 已修复 |
| U3 | 中 | 本地化 | 船长能力在中文界面显示英文；规则判断用英文字符串前缀 | 已修复 |
| U4 | 中 | 稳定性 | 试玩中出现一次 `Cannot read properties of undefined (reading 'zh')` | 已加固，待复现 |
| U5 | 低 | UI | pass 阻断只显示第一条原因 | 已修复 |
| U6 | 低 | UI | 非当前玩家的“目标强国”下拉仍可操作 | 已修复 |
| U7 | 低 | UI/反馈 | 赠送卡牌/宝藏/雇佣兵在达到上限、奥斯曼送雇佣兵等情况下仍可点，静默失败 | 已修复 |
| U8 | 中 | UI 回归 | 出牌后“结束行动轮次”仍被行政评级/本国牌禁用 | 已修复 |

## 2. 修复明细

### R1 西新宣战

- `src/virginQueen/util.ts`：删除 `canDeclareWar` 中 Spain ↔ Protestant 的禁止分支。
- 规则依据：9.2 只禁止二者**结盟**；9.4 的宣战限制不含该组合；`WAR_COST["protestant-spain"] = 2` 也说明本应可宣战。
- 回归：`src/virginQueen/declarationOfWar.test.ts`（西→新、新→西、议和后再次宣战、结盟仍禁止）。

### U1 外交按钮合法性与原因

- 新增 `src/virginQueen/diplomacyPolicy.ts`：`diplomacyActionState()` 返回宣战/议和/结盟的 `{ok, reason}`，与引擎使用同一套谓词（`atWar`、`allied`、`canDeclareWar`、`warCost`、`canAffordWarCost`、西英永不可议和、西新永不可结盟、西英 DOW≤3、法国双边限制、天主教联盟封锁）。
- `board.tsx`：按钮按状态禁用，`Tooltip` 显示原因，按钮下方用 `role="status"` 列出当前目标的关键原因。
- 实测：西班牙选中“新教联盟”时“宣战”可用、点击成功；“结盟”禁用并显示“西班牙与新教联盟永远不能结盟”；西英开战后“议和/结盟”禁用并显示“西班牙与英格兰永远不能议和”。控制台无 `invalid move`。
- e2e：`e2e/diplomacy.spec.ts`。

### U2 热座等待提示

- `board.tsx` 新增 `hotseatWaitHint()`：任意阶段 `!myTurn` 时输出“等待 {当前强国} 行动。请切换到 P{n} 标签页”。
- 覆盖 Card Draw、外交、春季、行动四个面板；外交目标下拉在非当前玩家时禁用。
- 实测：外交/春季空闲座位均显示提示，当前玩家面板不显示。

### U3 船长文本本地化

- `data/types.ts` 的 `SeaCaptain` 增加 `bonusZh`、`expeditionCost`、`freeColonist`。
- `data/seaCaptains.ts` 补齐 13 名船长的中文说明；亨斯莱因 `expeditionCost: 2`，维尔加尼翁/洛多尼耶/罗利 `freeColonist: true`。
- `moves.ts` 与 `board.tsx` 不再用 `bonus.startsWith(...)` 判断规则，改用结构化字段；界面按语言渲染 `bonusZh`。
- 实测中文界面显示“穆拉特·雷斯：永不因航行检定死亡……”，不再出现英文。

### U4 本地化查找加固

- `powerName` / `powerShortName` / `minorName` / `areaName` / `hreReligiousPreferenceName` / `powerLabel` 遇到未知 id 时回退为原值，不再抛 `reading 'zh'`。
- 回归：`declarationOfWar.test.ts` 中未知强国 id 的断言。
- 说明：上一轮观测到的异常未能稳定复现；本次已消除该类崩溃面，若再次出现需保留控制台堆栈继续定位。

### U5 pass 原因

- `moves.ts` 新增 `passBlockReasons()`（`passBlock()` 仍返回第一条，保持引擎与旧测试兼容）。
- `board.tsx` 列出全部原因，例如“请先打出本国牌：大维齐尔 · 手牌 8 张超过行政评级 2，请先出牌”。

### U6/U7 其他外交按钮

- 目标下拉 `disabled={!myTurn}`。
- 新增 `giftState()`：赠送卡牌/宝藏/雇佣兵按战争状态、每目标 2/2/4 上限、单向回赠、奥斯曼不能送雇佣兵、奥斯曼/HRE 不能收、HRE 雇佣兵市场来源等条件禁用并给原因。
- 实测奥斯曼向英格兰赠送雇佣兵按钮禁用，并显示“奥斯曼不能赠送雇佣兵”。

## 3. 复核通过（本轮未发现问题）

- `pass` / `endImpulse` 共用限制（Home 牌、强制事件、行政评级），两个按钮同时禁用并给出原因。
- 强制事件不能当 CP 打出；打出后获得 2 CP。
- 宣战费用：England→Spain 5、Ottoman→Spain 2、HRE→Spain 1；England-Spain 最低 1。
- 礼物上限 2 卡 / 2 宝藏 / 4 雇佣兵；奥斯曼不能给雇佣兵；奥斯曼与 HRE 不能收。
- 西英永不可议和；西英 DOW≤3 不可结盟；西新不可结盟；法国不可同时与西/新结盟。
- 春季：海军将领归国选港、HRE 秘密倾向 + 保留一张本国牌、苏莱曼保留两张。
- 卡牌类型标签（本国牌/事件牌/强制事件牌/响应牌/战斗牌）正确。

## 4. 完整跑完第 1 回合

用脚本按六国逐座位操作，从 Card Draw 一直推进到 **第 2 回合 Card Draw**，验证冬季结算正常触发。

- 行动阶段：各国因手牌超过行政评级/本国牌未打出，逐一以 CP 打出卡牌，随后结束行动轮次；六国连续跳过后自动进入冬季。
- 日志按 `回合 1 · 冬季结算` 单独分组，包含：
  - `冬季结束，第 2 回合开始。`
  - `法国 获得 1 点巴黎 VP。`
  - `伊丽莎白一世仍未结婚：英格兰获得 1 点童贞女王分（1/5）。`
  - 不再具有结婚资格的王室列表
  - `神圣罗马帝国 冬季补员：…`（留待下一外交阶段选择）
  - 奥斯曼/神圣罗马的冬季撤退记录
- 第 2 回合 VP：西班牙 17 / 奥斯曼 11 / 法国 10 / 神圣罗马 8 / 英格兰 7 / 新教 1，与巴黎 VP、童贞女王 VP 增量一致。
- 控制台 0 条 `invalid move`、0 条 pageerror。

### 本轮额外修复

跑完整回合时发现并修复了一个 UI 回归：

- 出牌后 `结束行动轮次` 被“手牌超过行政评级/本国牌未打出”继续禁用，导致玩家出牌后无法结束行动轮次。
- 修复：`endImpulseBlocked` 仅在 **未出牌** 且存在 pass 限制时为真；出牌后仍可正常结束（规则 11）。
- 回归测试：`board.test.tsx` 新增“出牌后即使手里仍有本国牌也可结束行动轮次”。

## 5. 验证

- `tsc --noEmit`：通过。
- `jest --silent`：213 suites / 1223 tests 全部通过（含新增 `declarationOfWar.test.ts` 9 项）。
- `playwright test e2e/diplomacy.spec.ts e2e/hotseat.spec.ts e2e/tutorial.spec.ts e2e/map.spec.ts e2e/local-smoke.spec.ts`：14 tests 全部通过。
- `vite build`：通过（仅既有大体积 chunk 提示）。

## 6. 证据

- `01-diplomacy-idle-hint.png`：外交阶段空闲座位显示“等待 奥斯曼帝国 行动。请切换到 P1 标签页”，目标下拉禁用。
- `02-diplomacy-spain-protestant.png`：西班牙选中新教联盟，“宣战”可用、“结盟”禁用，并显示原因。
- `03-action-pass-reasons.png`：行动阶段同时列出 Home 牌与行政评级两条 pass 阻断原因。
- `04-turn1-end.png`：第 1 回合结束、进入第 2 回合 Card Draw 的顶栏与 VP。
- `05-turn2-carddraw-log.png`：第 2 回合 Card Draw 与展开的“回合 1 · 冬季结算”日志。

## 7. 后续建议

1. 继续用同样方式覆盖攻城、野战、海战、婚姻、天主教联盟成立、刺杀与冬季结算的 UI 路径。
2. 若再次出现 `reading 'zh'`，保留完整堆栈并补充到本报告。
3. 目前外交原因文案是中英双语手写；新增规则限制时同步更新 `diplomacyPolicy.ts`、`zh_CN.ts`/`en.ts` 与 `e2e/diplomacy.spec.ts`。
