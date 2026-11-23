# Imperial Elegy — 剧本 / Scenarios

**来源 / Source:** `IE_playbook.pdf` pp. 3–10 与 `IE_rule.pdf` 的相关章节。
**代码位置 / Code:** `src/imperialElegy/constant/scenarios/` (数据) 与
`src/imperialElegy/engine/scenario.ts` + `engine/scenarioSetup.ts` (规则)。

规则书印刷了 **8 个可玩的剧本设定**，外加一个胜利条件修正（Scenario 4）。
本文件逐条记录每个剧本的印刷内容、它在代码中的表达方式，以及它们的验证方式。

---

## 1. 剧本一览 / The scenario list

| id | 印刷剧本 / Printed scenario | 回合 / Turns | 首次出现的规则差异 |
| --- | --- | --- | --- |
| `campaign` | Scenario 1 — Campaign and Tutorial (p. 3) | 1–7 | 基准剧本；一切默认值 |
| `tutorial1850` | 1850 Tutorial (p. 3) | 1–2 | 不计 VP；不抽 NG |
| `s1870` | Scenario 2 — 1870 (p. 4) | 3–6 | 普法战争；NG 在 3/5 回合抽；GE 只抽 2 张 |
| `s1880` | Scenario 3 — 1880 (p. 5) | 4–7 | 柏林会议；OT 每回合多 1 张；NG 在 4/6 回合抽 |
| `gwTutorial` | Historical Great War (p. 7) | GW 回合 0 | 直接从大战开始；印刷的先手顺序 |
| `altGw1` | Alternate GW 1 (p. 8) | GW 回合 0 | 各国控制列表 + 建设点 |
| `altGw2` | Alternate GW 2 — Independent Poland (p. 9) | GW 回合 0 | 独立波兰；波兰与 AU 结盟并向 RU 开战 |
| `altGw3` | Alternate GW 3 — Colonial War (p. 10) | GW 回合 0 | 殖民地战争阵营 |
| — | Scenario 4 — No GW (p. 7) | 任意 | `setupData.noGw`：同盟 VP 决胜 |

Scenario 4 不是独立设定：印刷原文是
"Set up whichever scenario you wish to play and modify the victory
conditions as follows." 因此它以 `noGw` 开关叠加在任意前 7 个剧本之上。

### 代码结构 / Code layout

```
src/imperialElegy/constant/scenarios/
  ids.ts          SCENARIO_IDS / ScenarioId / isScenarioId（无 import，避免循环）
  types.ts        ScenarioDef 及所有印刷条目的类型
  campaign.ts     Scenario 1 + 1850 教学（index.ts 里派生）
  s1870.ts        Scenario 2
  s1880.ts        Scenario 3
  gwTutorial.ts   Historical Great War
  altGw.ts        Alternate GW 1–3
  index.ts        SCENARIOS 注册表、scenarioById、scenarioOf

src/imperialElegy/engine/
  scenario.ts        各剧本不同的**规则**（回合窗口、NG 抽取、No-GW 决胜、
                     GW 教学的三条特殊规则、建设点）
  scenarioSetup.ts   印刷的**开局后步骤**（普法战争认输、AU 目标牌堆编辑、
                     IMP 标记）
```

`constant/setup.ts` 保留历史导出（`CAMPAIGN_SETUP`、`SetupUnit`、
`START_BUILD_BOX`、`MINOR_POWER_HOMES`、`createEmptyPowerState`），它们现在
从剧本数据派生，所以引擎其余部分无需改动。

---

## 2. 引擎如何按剧本分支 / How the engine branches per scenario

只有**一个**开关点：`engine/scenario.ts` 里的纯函数。`moves.ts`、`game.ts`、
`victory.ts` 从不直接比较 `G.scenario === "…"`（唯一例外是
`scenarioSetup.ts` 里判定普法战争是否存在的 `hasFrancoPrussianWar`）。

| 规则 | 印刷出处 | 实现 | 之前的行为 |
| --- | --- | --- | --- |
| 回合窗口 | 2.2.1 "At the end of turn 7 (or the end of the scenario)" | `campaignWindow` / `isFinalTurn` | 硬编码 `>= 7` |
| 结束原因 | 同上 | `finishScenario` 用 `endOfTurn${lastTurn}` | 硬编码 `endOfTurn7` |
| NG 抽取回合 | 2.4 / 20.11 | `drawsNgsThisTurn` / `ngDrawTurns` | 硬编码 `[1,3,5]` |
| NG 抽取张数 | "GE only draws 2 NGs" | `ngDrawCount` 读 `special.ngDrawCount` | 硬编码 3 |
| 开局 NG | 20.11 Play Note（1870/1880 起始 1 张） | `special.startingGoalDraw` | 无 |
| OT 多抽 1 张 | 1880 Special Rules | `extraPrepCards` | 无 |
| 铁血政策 | 33.1（仅战役） | `hasBloodAndIron` | 总是开启 |
| No-GW 决胜 | Scenario 4 | `noGwVictory` | 无 |
| GW 起始回合 | pp. 7–10 | `startingGwTurn` | 无 |
| 建设点 | p. 8 步骤 2 | `buildPointsRemaining` / `spendBuildPoint` | 无 |
| AU/塞尔维亚 | p. 7 Special Rules | `applyAuSerbiaClause` | 无 |
| OT 冬季加入 | p. 7 Special Rules | `applyOttomanWinterJoin` | 无 |
| UK 两栖限制 | p. 7 Special Rules | `blocksUkAmphibiousPort` | 无 |
| 印刷停战 | 1880 "1 turn FR Truce" | `scenarioTruceTurns` + 20.7 递减 | 无 |
| IMP 标记 | 1870/1880 | `independentMinorMarkers` | 无 |
| 目标牌堆编辑 | 1870/1880 AU | `applyGoalDeckEdits` / `resolveGoalChoice` | 无 |

---

## 3. 逐剧本记录 / Per-scenario record

### 3.1 Scenario 1 — Campaign（`campaign`）

印刷：p. 3，7 回合，1850s–1910s。所有玩家从中立框开始；WTT 0；电厂投射
UK 8 / FR 2 / RU 3（FR 印刷值为 3，但按 3.3.1 港口公式为 2）；结束阶段建造框 = Tuscany、Serbia、Bosnia、Bulgaria、
Romania。

代码：`SCENARIOS.campaign`。`data.test.ts` / `mapValidation.test.ts` /
`setup.test.ts` 仍逐项锁定这些数量，并与模组的 `campaign-setup.vsav` 交叉
验证（`campaign-setup.json`）。

**1850 教学（`tutorial1850`）** 与战役共用同一份 setup，只改两条：
`lastTurn: 2` 和 `countVp: false`（"Do not count VPs at the end of the
tutorial scenario."）。结束时 `G.result.reason === "tutorialNoVp"`，
`winners` 为空。

### 3.2 Scenario 2 — 1870（`s1870`）

印刷：p. 4，4 回合，turns 3–6。WTT 1；苏伊士运河已通航；意大利已统一；
移除 8 张牌；结束阶段建造框 Bulgaria/Serbia/Bosnia。

**分步骤实现：**

1. **显示值**：`powers` 记录印刷的 Stability/Industry/Manpower/关键区。
   RU 带 `autoIndustry: true`（印刷 "industry autocomplete marker"），
   AU 带 `citizenship: ["Hungarians"]`。
2. **单位/要塞/标记**：62 个单位、4 个要塞（含 India 的 `indian: true` 要塞）、
   ally markers（GE → Bavaria/Saxony，RU → Romania）、influence、Pac 值。
3. **移除卡牌**：`removedCards` 按印刷英文名列出，`engine/setup.ts` 把它们
   放入 `G.removed`，因此永不再进入牌堆。
4. **NG**：开局抽 3 张留 1（GE 抽 2）；结束阶段在 turn 3、5 抽
   （`special.ngDrawTurns`），GE 的结束阶段抽牌也是 2 张
   （`special.ngDrawCount`）。
5. **AU 目标牌堆编辑**：`goalDeck: [{power: "AU", add: "NG-31",
   removeOneOf: ["NG-29","NG-30"]}]`。`goalsForPower("AU", "s1870")` 把
   第九张目标卡纳入牌池，`applyGoalDeckEdits` 把它放进牌堆，二选一由
   `scenarioGoalChoice` pending 交给 AU。
6. **普法战争**（可选，turns 3 的准备阶段之前）：`special.francoPrussianWar`。
   FR 通过 `francoPrussianConcession` pending 回答；选"认输"时
   `applyFrancoPrussianConcession` 逐条执行印刷的 6 步：
   1. GE 取得 Alsace-Lorraine/Bavaria/Saxony，消灭 Saxon+Bavarian 军队与
      两个 GE EC，1 个 GE 常备军降级，记录 GE 关键区 10，+1 卡标记，
      GE–FR 停战 2 回合；
   2. FR 在 Alsace-Lorraine 的单位被推离，消灭 2 个常备军 + 1 个 EC，
      记录 FR 关键区 8，−1 卡标记；
   3. 同盟轨道：GE → Triple Alliance (uncommitted)，FR → committed TE；
   4. 记录 turn-4 的 −1 卡标记；
   5. 首回合 GE 不选本土牌、FR 少抽 1 张；
   6. 跳过 GE 的第一个行动轮（行动阶段由 UK 开启）。
7. **IMP**：`independentMinorMarkers` 记 Egypt/Great Sand Sea/Sinai。

### 3.3 Scenario 3 — 1880（`s1880`）

印刷：p. 5，4 回合，turns 4–7。WTT 1；GE 已统一；同盟轨道 GE = committed
TA、FR = committed TE；移除 12 张牌；结束阶段建造框 Egypt/Bosnia。

与 1870 的差异：

- `ngDrawTurns: [4, 6]`（"instead of turns 3 and 5"）；
- `berlinConference: true`：开局"set aside five random action cards and the
  Berlin Conference mandatory event. Shuffle the six cards and place them on
  the top of the deck."`engine/setup.ts` 从牌堆抽 5 张随机牌，与 A074 洗匀
  后压到牌堆顶；
- `extraPrepCards: {OT: 1}`：每个准备阶段 OT 多抽 1 张；
- 印刷停战：GE–FR、RU–OT 各 1 回合（`truces`），由 `truceRivals` 读取并阻止
  宣战/参战，20.7 每回合递减；
- FR 是第三共和国（`government: "thirdRepublic"`）：印刷未明说，但本剧本的
  移除牌表把巴黎公社与 1860 年代改革视为既成事实，且第二帝国会给 FR 多 1 点
  大战预算。

### 3.4 Scenario 4 — No GW（`noGw`）

印刷：p. 7。若大战未爆发，正常结算；若爆发，则按同盟总 VP 决胜：

- 总 VP 高的一方获胜；**平局则所有玩家都输**（`winners: []`）；
- 同盟间差值即"胜利差"；若有中立玩家，把最高中立 VP 与该差值比较，
  中立更高（或相等，印刷 "In the case of a tie the neutral player(s) wins"）
  则中立获胜。

代码：`setupData.noGw` → `G.noGw` → `finishScenario` 走 `noGwVictory`。
`engine/scenario.ts#noGwVictory` 是纯函数，便于逐条对照印刷文字测试。

### 3.5 Historical Great War（`gwTutorial`）

印刷：p. 7。"Start this scenario with the Maneuver Step of GW turn 0. The
setup takes into account the Outbreak Step of the GW, including the National
Will Step and the UK Rapid Deployment national characteristic."

`engine/greatWar.ts#beginScenarioGw` 在 `setup` 阶段构造 `G.gw`：

- `turn: 0`，`outbreakDone`/`nationalWillDone` 均为 `true`（印刷的 setup 已经
  包含这两步，不允许重跑）；
- 印刷先手顺序 `["GE","RU","AU","FR","bonus","UK"]`，`bonusImpulses: ["OT"]`；
- 同盟：TE = FR/UK/RU，TA = GE/AU，中立 = OT（Italy 不在同盟列表中）；
- 常驻事件：Machine Guns、Hydraulic Recoil；运河：Suez、Kiel；
- `ukBonusArmies: 2`（I Want You）；OT 获得 3 个 Jihad 标记；
- 三条特殊规则（`gwSpecial`）：
  1. AU 若在 GW 回合 0 未对 Serbia 发动陆战，失去 1 点稳定度
     （`applyAuSerbiaClause`，由 `combat.ts` 在 GW 回合 0 记录每场陆战，
     `resolveGwWinter` 检查）；
  2. UK 不得对含有 GE 海军单位的 GE 本土港口两栖登陆
     （`blocksUkAmphibiousPort`，在 `amphibiousAssaultCheck` 里拒绝）；
  3. OT 在 GW 回合 0 的冬季步骤加入 Triple Alliance
     （`applyOttomanWinterJoin`）。

`firstTurn`/`lastTurn` 都是 7（剧本接在战役第 7 回合之后），`wtt: 4`
（25.7 在大战开始后把 WTT 降到 4）。

### 3.6 Alternate GW 1–3（`altGw1` / `altGw2` / `altGw3`）

印刷：pp. 8–10。共同流程（p. 8）：

1. **Initial Control**：取得所有明列空间的控制；
2. **Build Points**：稳定度/工业从战役起始值开始，每点建设点提升其中之一；
3. **Taking Control of Uncontrolled Spaces**：按回合顺序取得可追溯 LoC 的
   无人关键区（UK 每次 2 个）；
4. **Set Manpower**：按控制的关键区；
5. **Placing Units**：秘密写下起始单位位置（每格最多 2 个军队，每名玩家最多
   2 个海军单位放在同一子地图）。

代码把 1、2、5 的印刷数据写成数据（`altGw.control` / `allHomeSpaces` /
`uncontrolledKeys` / `buildPoints` / `units`），第 3 步是可玩的选择，第 4 步
由 `recomputeTracks` 负责。

- 第 2 步是 `gwBuildPoint` pending：每点只能提升稳定度或工业之一
  （`spendBuildPoint`），进行到用完为止。
- 第 5 步的"秘密写位置"由 `placeAltGwInventory` 以确定性默认值实现：后备军
  进后备框，陆军填首都与本土关键区（每格 2 个），海军进首都港口；超出
  "每格 2 个"的印刷数量继续填首都并记入 `G.flags.altGwOverstacked`，绝不丢
  印刷单位。
- 印刷的 British/Indian 与 Turkish/Arab 区分用 `units[].flags` 保留（UK 的
  N 个 Indian 陆军带 `indian: true`，OT 的 1 个 Arab 陆军带 `arab: true`）。
- Italy 是统一但没有玩家席位的强国，其印刷单位用 `italianArmy` 计数器放置。

**Scenario 2 的独立波兰**：`independentPoland: true`，
`minorControl` 把 Poland/Western Ukraine/Belorussia 交给 Poland，
`startingWars` 记录"波兰与 AU 结盟并向 RU 开战"。

**Victory**（p. 8）："the team that wins the GW wins the game, all other
players lose." 由既有的 `endGreatWar` 处理。

---

## 3.7 Great War 剧本核查修复 / Great-War scenario audit fixes (2026-11-23)

对 `IE_playbook.pdf` pp. 7–10 与 `IE_rule.pdf` 24.0–32.6 逐条复核后修复：

| 问题 | 印刷依据 | 修复 |
| --- | --- | --- |
| GW 剧本在真实对局中从未进入大战：boardgame.io 固定从 `prep` 开始，`prepBegin` 又把 `G.phase` 写回 `prep`，GW 规划步骤从未执行（预算是 0、没有 GW 手牌） | p. 7 "Start this scenario with the Maneuver Step of GW turn 0" | `game.ts#prepBegin` 检测到 GW 剧本后直接交给 `gwPlanning`（`beginGwTurn` 只在开局 build-point 决策全部答完后执行） |
| `Hanover` 不是港口，印刷的 "3 dreadnoughts, 1 squadron" 无法出港 | 3.2.7 锚标；p. 7 Hanover 舰队 | `spaces.ts` 给 Hanover `ports: ["north-atlantic"]` 与海路连接 |
| 历史大战的 Alsace-Lorraine 是法国控制，却放了 GE 军和 2 级要塞 | p. 7 GE "Alsace Lorraine: 1 army, level 2 fort"，FR 列表不含该地 | `gwTutorial.ts` 增加 GE 控制标记 |
| 架空大战 3（GE 中立）先手顺序错成 FR 的同盟 | 25.7 "If the GE player is neutral the alliance with the UK always goes first" | `greatWar.ts#beginScenarioGw` 按 25.7 选先手同盟，并按 25.7.1 放置 bonus 槽 |
| 架空大战 build point 决策永远不会出现（只挂在 `finishPrep` 上，而 GW 剧本没有 prep 阶段） | p. 8 步骤 2 | 开局即开 `gwBuildPoint` 决策，逐点打开，最后一点答完后才开始 `beginGwTurn`（预算按提升后的工业计算） |
| 步骤 3 "取得无人关键区"、步骤 4 "按关键区设置人力" 未实现 | p. 8 步骤 3–4 | `scenario.ts#applyAltGwUncontrolledSpaces` 按 GW 顺序/英国每次 2 个/LoC 作出确定性合法默认；随后 `recomputeTracks` 从最终棋盘导出人力与关键区 |
| 架空大战 2/3 的意大利单位被丢到 Aden/Afghanistan 等无人区（`placeAltGwInventory` 以 `power=null` 调用时把所有 `home===null` 的无人区当成"本土"） | p. 9–10 "Italy: Unified … Units: …" | 意大利按 22.4 部署顺序落位（罗马/边境陆军、那不勒斯或皮埃蒙特舰队），并在运行时写入 `italyUnified` |
| 海军/陆军落位违反 4 条印刷上限：港口容量 4、每空间 2 个 setup 陆军、每玩家每 submap 最多 2 个海军 | p. 8 步骤 5 | `placeAltGwInventory` 重新实现：资本/本土关键区有序填充、遵守 `landStackingLimit`/`PORT_NAVAL_LIMIT`/每 submap 2 舰 |
| 印刷的小国同盟（AU–Papal States、AU–Poland）与波黑/波兰战争状态未生效 | p. 8 "Alliance with Papal States"；p. 9 "Poland begins the scenario at war and allied with AU" | 数据改为 `allyMarkers`（既有 setup 路径），并记录 `startingWar:RU:Poland` |
| 波兰 reserve army 成了无主计数器，不在 22.5(1) 的波兰预备军框 | p. 9 "1 reserve army"；22.5(1) | `setup.ts` 把它登记进 `G.nonPlayerBuildBox.poland.reserveArmies`，强度为 reduced |
| 历史大战的 UK Rapid Deployment 被重复发放 | p. 7 "The setup takes into account … the UK Rapid Deployment national characteristic" | 该剧本发放后立即标记 `spent`；架空剧本页未提及，UK 保留免费行动 |
| 架空剧本的胜利条件被 31.0 的中立 VP 比较覆盖 | p. 8 "the team that wins the GW wins the game, all other players lose" | `scenario.ts#altGwVictoryOnly`；`endGreatWar` 在该类剧本中不再让中立玩家抢走胜利 |
| 25.6 的 EC 生成后不在任何 reserve 框（不可见、不可部署）；25.6.2 未清 pacification 标记 | 25.6 / 25.6.1 / 25.6.2 | EC 进入 reserve 列表（UK 依 25.6.1 attach 到地图上的一支陆军）；outbreak 的 National Will Step 结束时清空 pacification 与 GoE/Boers 标记 |

**仍然存在（已记录，非本次修复）**

1. GW 中没有两栖登陆：`amphibiousAssaultCheck` 只接受 action/wartime，GW 的陆战也要求陆地→陆地，因此 p. 7 的英国两栖限制规则无法触发。这是 15.2.1/19.10 在 GW 下的整体缺口。
2. 25.5 的 NG 补抽仍是确定性选择（保留最高印刷 VP），25.6 的 track boost 仍是固定顺序——两者都需要可中断的 Outbreak 决策。
3. 25.7 的"同盟自行决定顺序"仍未提供选择界面；剧本先手按印刷顺序/25.7 默认值。
4. 2.2.2 的"赢得 GW 的同盟获得 4 − GW 回合数的奖励 VP"未计入战役 GW 的最终比分。

## 4. 已知边界 / Known boundaries

这些是**记录在案的印刷边界**，不是未实现的机制：

1. **`Fiji`** 在 GW 教学的 UK 控制列表中，但地图上没有该空间；其余九个
   空间都已转录（`notes` 中记录）。
2. **"Mediterranean"** 在 GW 教学里没有指明海域；按 Malta 所在的海域采用
   西地中海。
3. **位置秘密选择**：Alternate GW 的第 5 步印刷为"秘密写下"，引擎以确定性
   默认值代替（见上）。这是**自动回退**，不是缺失。
4. **第 3 步"取得无人关键区"** 在数据中记录数量，实际的逐个选择由玩家在
   开局阶段完成；引擎不代替玩家决定。
5. **普法战争分支的 turn-4 −1 卡标记** 记录在 `G.flags` 并以测试锁定；
   它影响的是"第 4 回合 FR 的抽牌数"，而该分支同时也有 `-1 card marker`
   这一全局效果（`G.powers.FR.cardMarkers -= 1`）。
6. **`G.persistent` 的 IMP 标记**（`impMarker:<space>`）
   只在这两个剧本里写入；战役用 `controlOverrides` 表达同一事实，因此不写
   persistent 标记（`legacySaveDefaults.test.ts` 锁定"迁移不播种一次性标记"）。

---

## 5. 验证 / Evidence

### 单元测试

```sh
./node_modules/.bin/jest src/imperialElegy/scenarioData.test.ts
# 94 passed
```

`scenarioData.test.ts` 逐项锁定：

- 8 个剧本都已注册，`ScenarioDef` 完整（名称、回合窗口、每个强国的起始值）；
- 每个剧本用到的空间 id 都真实存在于 `spaces.ts`（无拼写错误的空间）；
- `removedCards` 命名的每张牌都真的存在于卡牌数据里；
- 每个剧本都能通过 `setupImperialElegy` 建立合法开局：印刷单位数量、
  移除牌、建造框；
- 回合窗口取代硬编码的 7（战役 7、教学 2、1870/1880 各 4）；
- NG 抽取回合与张数（战役 1/3/5、1870 3/5、1880 4/6、教学无）；
- 1870/1880 的 AU 目标牌堆编辑与 `scenarioGoalChoice` 解决；
- Scenario 4 只改胜利条件、不改棋盘；
- 普法战争 6 步逐条断言 + 幂等 + 只在 1870 存在；
- 印刷停战（1880 两对）生效、战役无停战；
- IMP 标记逐空间；
- 建设点：发放数量、每次只提升一项、不可透支；
- GW 教学：GW 回合 0、印刷先手顺序、bonus 给 OT、同盟、常驻事件、运河、
  Outbreak/National Will 已完成、GW 回合 0 无战壕；
- 三个 Alternate：同盟、印刷单位全部落位、British/Indian 与 Turkish/Arab
  标记、统一意大利的意大利军计数器；
- GW 教学三条特殊规则各自生效、各自幂等、且只在该剧本存在；
- 未知道具 id 回退到战役；每个剧本定义 JSON 可序列化。

### 端到端

```sh
./node_modules/.bin/jest src/imperialElegy/scenarioPlaythrough.test.ts
# 8 suites passed（每个剧本 1 个）
```

`scenarioPlaythrough.test.ts` 用与 `campaign.test.ts` 相同的真实
boardgame.io master（6 个 seat 各自一个 Client）把**每个剧本**打到印刷的
结束回合：

- 断言 `G.result` 非空；
- 结束原因必须是该剧本自己的 `endOfTurn<lastTurn>`、教学的
  `tutorialNoVp`、自动胜利、或大战/No-GW 的结束原因之一；
- 有 VP 的剧本必须产生获胜者，教学必须**不**产生获胜者。

`Local()` 的 boardgame.io 实现创建对局时硬编码 `setupData: undefined`
（React client 也没有 setup-data 入口），所以热座版把剧本放进传给 Client 的
游戏定义的 `setup`（`components/local.tsx#hotseatGame`），在线大厅则走
`setupData`。测试用同样的技术注入剧本。

### 全仓库

```sh
./node_modules/.bin/jest
# 543 suites, 5471 tests passed
```

---

## 6. 如何新增一个剧本 / Adding a scenario

1. 在 `constant/scenarios/` 新建一个模块，导出 `ScenarioDef`。所有数量照抄
   印刷页，不要从相邻剧本推断。
2. 在 `ids.ts` 的 `SCENARIO_IDS` 加入 id（`ScenarioId` 由它派生）。
3. 在 `index.ts` 的 `SCENARIOS` 注册。
4. 如果剧本有印刷的**新规则**（不是新数据），在 `engine/scenario.ts` 加一个
   纯函数并在唯一调用点接上；如果它涉及玩家选择，在
   `engine/scenarioSetup.ts` 加步骤并在 `moves.ts#openSetupDecisions` 里
   排队。
5. 在 `scenarioData.test.ts` 加断言（新剧本会自动被 `test.each(SCENARIO_IDS)`
   覆盖基础一致性检查）；在 `scenarioPlaythrough.test.ts` 无需改动，它也会
   自动覆盖。
6. 更新本文件与 `RULES_COVERAGE.md` / `IMPLEMENTATION_STATUS.md` 里
   "Alternate scenarios … remain deferred" 的表述。
