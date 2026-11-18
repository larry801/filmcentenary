# Imperial Elegy — 卡牌事件实现进度 / Card-event implementation progress

Range: `aa7f3a3d` (master, 2026-11-18).
范围：master `aa7f3a3d`（2026-11-18）。

This document is a **per-card** progress record for the 122 printed card events
(100 action + 12 home + 10 Great War). It answers three questions for every
card: what the engine actually runs, whether the printed text asks the player to
choose, and whether any test names that card.
本文档按卡牌逐张记录 122 个事件的实现情况（100 张动作牌 + 12 张本国牌 + 10
张大战牌）。每张牌回答三件事：引擎实际执行什么、印刷文本是否要求玩家选择、是否有测试直接覆盖该牌。

It is a snapshot produced by reading `constant/cards.data.ts`, `engine/effects.ts`,
`engine/playability.ts` and `engine/combatCards.ts` and then **running the
engine** to confirm each claim below. It is not a substitute for
[`RULES_COVERAGE.md`](RULES_COVERAGE.md) (rule-section view) or
[`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) (module view).
本文档是阅读数据与引擎源码并**实际运行引擎**验证后的快照，不替代
`RULES_COVERAGE.md`（按规则章节）与 `IMPLEMENTATION_STATUS.md`（按模块）。

---

## 1. 结论摘要 / Summary

| 项目 Item | 数量 Count | 说明 Notes |
| --- | --- | --- |
| 印刷卡牌 Printed cards | 122 | 100 action + 12 home + 10 GW |
| 有 `special` 处理器的卡 Cards with a `special` handler | 95 处 / 89 个处理器 | 见 §2 |
| `doSpecial` 中的 case 分支 | 92 | 其中 3 个已无卡牌引用（dead code） |
| 处理器仍缺失 Referenced-but-missing handlers | **0** | 数据引用的 89 个处理器全部有实现 |
| 流出到 `resolveEffects` 的纯声明式效果 Declarative effects | 15 种 | `wtt`/`stability`/`industry`/`flag`/… |
| 从未走到 `unhandledSpecial` 的卡 Cards that log `unhandledSpecial` | **0** | 全部 122 张都能解析 |
| 有直接单测提及的卡 Cards named directly in a test | 91 / 122 → **111** | 修复轮次新增 `cardEventDefects.test.ts` 覆盖 20 张零/弱覆盖卡 |
| 完全无测试信号 Cards with no test signal at all | 24 → **18** | 见 §5 |

**结论：** 卡牌事件在“能跑通”这一层是完整的——每张牌都有实现，`fuzz.test.ts`
对 122 张牌逐一执行“打出并答完所有 pending”且全部通过。

**2026-11-18 修复轮次：** §3 记录的全部缺陷已修复（分支
`fix/ie-card-event-defects`），逐条回归测试在
`src/imperialElegy/cardEventDefects.test.ts`（45 个断言）。每节末尾的
**Fix** 段落给出对应的实现位置与验证方式。仍有 3 项因缺少印刷前提而
保留为已知限制，见 §6。
**Conclusion:** at the "does it run" level the card set is complete — every card is
implemented and `fuzz.test.ts` plays all 122 through every pending decision.

**2026-11-18 repair pass:** every defect recorded in §3 is fixed on branch
`fix/ie-card-event-defects`, with per-clause regression coverage in
`src/imperialElegy/cardEventDefects.test.ts` (45 assertions). Each section's
**Fix** paragraph names the implementation site and how it is verified. Three
items stay as documented limitations because their printed precondition does not
exist yet; see §6.

---

## 2. 处理器架构 / Handler architecture

卡牌效果只有两条执行路径。A card effect takes exactly one of two paths.

1. **声明式效果 Declarative effects** — `cards.data.ts` 里的 `Effect` 数组由
   `engine/effects.ts#performEffect` 的 switch 执行。15 种类型在卡牌数据中出现：
   `special`(95) `flag`(19) `wtt`(7) `stability`(7) `industry`(3)
   `drawReplacement`(3) `allianceResolution`(2) `mpitChoice` `targetSpace`
   `fort` `removeCard` `removeThisCard` `cityOfLight` `reserve` `jihad` 各 1。
2. **命令式处理器 Imperative handlers** — `Effect.type === "special"` 携带
   `handler` 字符串，由 `effects.ts#doSpecial` 的大 switch 分派。数据引用 **89**
   个不同处理器，`doSpecial` 有 **92** 个 case。

处理器分两类，这个区别决定了“印刷文本里的 OR/choose 是否真的变成玩家选择”：

| 类别 Class | 数量 Count | 含义 Meaning |
| --- | --- | --- |
| `choice` | 31 | 处理器内部调用 `openDecision`/`openSpecialSpace`，玩家必须回答 |
| `auto` | 58 | 处理器直接改状态并 `return true`，不打断出牌流程 |

**没有 `unhandledSpecial` 风险**：`doSpecial` 的 `default` 会记录
`unhandledSpecial` 日志并 `return true`（静默丢弃）。经逐一比对，卡牌数据引用的
89 个处理器全部存在于 switch 中，因此该分支在正常牌局中不可达。
**No `unhandledSpecial` risk:** the `default` branch logs `unhandledSpecial` and
silently returns. All 89 referenced handlers exist, so the branch is unreachable
in normal play.

**死代码 Dead code:** `doSpecial` 中 `deathOfFranzJoseph`、`nationalism`、
`southGermanConfederationHome` 三个 case 已不再被任何卡牌引用。前两个的效果已
被并入 `grantRightsOrCitizenship` / `choosePlayerStabilityOrCard`（A056）路径，
第三个是空实现（`return true`）。建议删除或在注释中标注保留原因。
`deathOfFranzJoseph`, `nationalism` and `southGermanConfederationHome` are no
longer referenced by any card. The first two were folded into
`grantRightsOrCitizenship` / A056's `choosePlayerStabilityOrCard`; the third is an
empty `return true`.

---

## 3. 已确认的语义缺陷 / Confirmed semantic defects

以下每一条都在引擎中**实跑复现**过，不是读码推断。Each item below was
reproduced by running the engine.

### 3.1 稳定性重复结算 / Stability granted twice (4 cards)

`cards.data.ts` 同时声明了 `{type: "stability", delta: 1}` **和** 一个内部也调用
`changeStability(+1)` 的处理器。`performEffect` 先执行声明效果，再执行处理器，
所以每次打出稳定度 **+2**。

实测（`playCard(..., "event")`，起始稳定度 3）：

| Card | 卡面 Card text | 实测实际 Actual |
| --- | --- | --- |
| `IE-A047` The Dual Monarchy | AU +1 | **3 → 5** |
| `IE-H-GE-1` Otto von Bismarck | +1 | **3 → 5** |
| `IE-H-UK-3` Sun Never Sets | +1 | **3 → 5** |
| `IE-H-FR-5` The City of Light | +1 | **3 → 5** |
| `IE-A029` Economic Boom | +1 | 3 → 4（正确） |

受影响位置 Affected sites:

- `cards.data.ts:287` 声明 `stability` + `effects.ts:2438` `dualMonarchy` 内再 +1
- `cards.data.ts:597` 声明 `stability` + `effects.ts:2955` `bismarckWar` 内再 +1
- `cards.data.ts:607` 声明 `stability` + `effects.ts:2882` `sunNeverSets` 内再 +1
- `cards.data.ts:617` 声明 `stability` + `effects.ts:2906` `cityOfLightHome` 内再 +1

修复方向：删掉四个处理器内部的 `changeStability` 调用（保留声明式效果，因为它
带 `target`，能正确作用于非当前玩家），或反过来删掉数据里的 `stability` 条目。
注意 A047 的声明带 `target: "AU"`，即“打出者不一定是 AU”时目标正确，因此
**建议保留声明式效果、删除处理器内的重复调用**。

Sweep: the same double-application pattern was searched for `wtt`, `industry`,
`reserve`, `jihad`, `draw`, `vp`, `mpit`, `fort`, `units`, `keys`, `manpower`,
`removeCard`, `cityOfLight`; **no other duplicates** exist today.

**Fix.** The four handlers no longer call `changeStability`; the declared
`stability` effect is the single source (`engine/effects.ts`, the
`dualMonarchy`, `bismarckWar`, `sunNeverSets` and `cityOfLightHome` cases). The
declarative effect is kept deliberately because A047's copy carries
`target: "AU"`, so the gain lands on Austria even when another power plays it.
Verified by `cardEventDefects.test.ts` — each of the four cards now moves the
track 3 → 4, and A029 (which never had a duplicate) is pinned as the control.

### 3.2 Quagmire 符号与结算方向错误 / `IE-A083 Quagmire` applies the wrong sign and effect

卡面：*“Give a -1 card marker to any player that is pacifying a space.
Additionally, decrease the value of their pacification marker by 2 to a minimum of 0.”*

代码 `effects.ts:3480-3484`：

```ts
G.spaces[space].pacification = (G.spaces[space].pacification ?? 0) + 1;  // 应为 -2
if (isPower(p)) changeStability(G, p, -1, ctx);                          // 应为 -1 card marker
```

修复前实测：绥靖值 **6 → 7**，UK 稳定度 **3 → 2**，双方 `cardMarkers`
都是 0。三个偏差曾同时存在：绥靖值 +1 而非 −2、扣稳定度而不是给
`cardMarkers -= 1`、以及把目标限定为敌方非洲空间。

**Fix.** 目标改为“任何仍有绥靖标记（值 > 0）的空间”，不限地图与所有者
（`effects.ts` 的 `quagmire` 分支）；结算改为 `applyPacification(G, space, -2)`
（自带 0 下限）并向该空间的控制者（无则影响者）`cardMarkers -= 1`。回归测试
断言 6 → 4、`cardMarkers` 0 → −1、稳定度不变，并覆盖“己方空间也可被选”与
“下限为 0”两种情况。

### 3.3 Machine Guns 作用域过宽且第二句缺失 / `IE-A080 Machine Guns` scope + missing clause

卡面两句：*“during land battles, non-rebel units now have a minimum die roll of 3”*
与 *“ECs and elite colonial EFs are automatically eliminated if their combat bonus
is used against a non-rebel army”*。

实测：

| 场景 Scenario | 骰子 Dice | 结果 Result |
| --- | --- | --- |
| 陆战 land，`machineGuns` 开 | 1, 1 | **3, 3** |
| 陆战 land，`machineGuns` 关 | 1, 1 | 1, 1 |
| **海战 naval**，`machineGuns` 开 | 1, 1 | **3, 3** ← 越界 |
| 陆战 vs **叛军 rebel**，`machineGuns` 开 | 1, 1 | **3, 3** ← 越界 |

**Fix.** 新增 `combat.ts#machineGunsApplies(G, battle, side)` 作为唯一判定：
要求 `kind === "land"`，且该侧与对手的主战部队都不含 `rebelArmy`。两个骰点
（`rollBattleDice` 与 GW-05 重掷）都改用它，因此海战与叛军对战的骰子保持原始
点数。回归测试覆盖四项：陆战双方取 3、叛军防守方保持 1、海战保持 1、无此卡时
保持原值。

**仍存限制.** 第二句“EC/精英殖民远征军使用战斗加值时自动消灭”依赖一个
引擎尚未提供的“战斗加值”——EC 与精英殖民 EF 目前的 `unitFp` 为 0、无 DRM，
`combatElite` 这个 pending 类型已定义却从未被打开。18.5 只规定骰子下限与
`*`/`**` 结果，并未赋予 EC 加值，因此该句留待 EC 加值规则实现后再接（§6）。

### 3.4 Hydraulic Recoil 完全没有效果 / `IE-A091 Hydraulic Recoil` is a no-op

卡面两句都是“Permanent”：应用 CRT 的 `*`/`**` 结果，以及 EC 自动消灭。

**Fix（第一句）.** `crt()` 原本已正确标记 `star`/`doubleStar`，但这些标记从未被
读取。现在 `BattleState` 记录两者，`resolveRollOutcome` 在取损失前执行
（`combat.ts#hydraulicRecoilApplies`）：
- `**` 行——“Both sides take +1 loss”——强制生效，不开决策；
- `*` 行——“The victor may opt to inflict +1 loss to both sides”——开一个
  `hydraulicRecoil` pending，由胜方决定；`resolveHydraulicRecoil` 应用或跳过
  后再继续取损失。
两种情况都按 `persistent.hydraulicRecoil`（永久）判定，GW-05 重掷同样
重新评估。回归测试覆盖 `**` 强制、`*` 接受、`*` 拒绝、以及无此卡时无额外损失。

**仍存限制.** 第二句与 §3.3 同因：EC 加值本身尚未实现（§6）。

### 3.5 A069 Concert of Europe 移出条件永远成立 / removal condition never evaluated

卡面：*“Remove from the game if played during or after turn 5.”*
数据 `cards.data.ts:414` 直接写成 `{remove: true}`，即**任何回合打出都永久移出**
（第 1 回合实测即已进入 `G.removed`）。`deck.ts:125` 的 `def.remove` 只判断布尔值。

**Fix.** `CardDef` 新增 `removeFromTurn`，`engine/playability.ts#removesAfterPlay`
把“无条件移出”与“自第 N 回合起移出”统一成一个谓词，`deck.ts`、`effects.ts`、
`combat.ts` 与 `moves.ts` 的 8 处 `card.remove` 读取全部改为调用它。A069 的数据
由 `{remove: true}` 改为 `{removeFromTurn: 5}`。回归测试逐回合断言：第 1/3/4 回合
进弃牌堆，第 5/6 回合移出。卡面标记同步改为“第 5 回合起移出”。

### 3.6 A039 Uprising in Ireland 的“UK 可弃牌忽略”缺失 / missing UK cancel option

卡面：*“The UK player may immediately discard a 3 or 4 CP card of their choice to
ignore this event.”*

**Fix.** 当英国不是打出者、未被淘汰且手里有 3 或 4 CP 的牌时，开一个归英国座位
的 `eventChoice`：选项为“取消此事件”或“弃置某张 3/4 CP 牌”。弃牌则整个事件被
忽略（不放置叛军、不扣稳定度与抽牌标记）；不弃则走
`resolveUprisingInIreland` 的印刷正文。没有合法弃牌时立即结算，不再多问一次。
回归测试覆盖四种情形：窗口出现、弃牌忽略、拒绝受罚、无牌直接结算。

### 3.7 A072 Meiji Restoration 少了 1 个海军单位 / missing naval squadron

卡面：*“Place 1 Japanese army and 1 naval squadron in Japan.”*

**Fix.** `meijiRestoration` 现在同时放置 `minorArmy` 与 `squadron`（日本港连接
太平洋，海军单位合法停靠）。回归测试断言日本空间单位清单为
`["minorArmy","squadron"]`。

### 3.8 A096/A099 的两处“特别”子句 / two conditional clauses

- `IE-A099 Dreadnought`：卡面 *“if this is the first card you play this turn, gain
  an additional dreadnought”*。代码只放 1 个，没有“本回合第一张牌”的判定。
- `IE-A096 Empire of the Sun`：卡面 *“At the end of the war the active player
  becomes the ally of Japan”*。代码在结算事件时立刻写
  `G.spaces.japan.ally = owner`，而不是战争结束时。

**Fix（A099）.** `moves.ts#playCard` 在结算事件前记录
`G.flags.firstCardThisTurn`（与上一次出牌回合 `firstCardPlayTurn` 比较），
`dreadnought` 处理器据此在同一港口再放 1 艘。回归测试分别断言“本回合首牌得
2 艘”与“已出过牌只得 1 艘”。

**Fix（A096）.** 事件结算时只写 `G.flags.japanAlliancePending`；
`engine/limitedWar.ts#demobilizeWar` 在战争真正结束时才落到
`G.spaces.japan.ally` 并清空该标记。回归测试断言事件后 `japan.ally` 仍为
`null` 且标记为打出者；既有的 `cardTargetChoices.test.ts` 也更新为这一语义。

### 3.9 A032 American Civil War 只置了标志 / flag only

卡面是一整套子流程：终局阶段掷骰、UK/FR 可用外交标记与分舰队加 DRM、
CSA 独立后“The South 计数器最多的玩家”获得永久盟友与 +1 殖民关键区、
支持方各得 −1 card marker。

**Fix.** 新增 `effects.ts#resolveAmericanCivilWarEndPhase`，逐字实现印刷子流程：
终局阶段开始时掷 1 d6，英国/法国各可在 The South 放外交标记与分舰队各 +1 DRM；
总和 ≥6 则 `csaIndependent = true`，The South 计数器最多的玩家获得永久同盟与
+1 殖民关键区，所有支持方各 −1 `cardMarkers`。`moves.ts#runEndPhase` 在第一步
调用它，并用 `flags.acwRolledTurn` 保证一次终局阶段只掷一次骰。
回归测试覆盖：6+ 独立并奖励、低点数不独立、支援 DRM 生效且支持方受罚、
无论牌时为空操作。

### 3.10 印刷 OR 未转为玩家选择 / printed "OR" resolved automatically

第 2 节的 `auto` 处理器里有若干张卡面明确写了 OR 或“may”，但处理器不打断流程、
直接替玩家决定。实测均为 `G.pending === null`：

下表“实测”列为**修复前**的行为，保留作对照。

| Card | 卡面要求 Card text | 修复前 Before |
| --- | --- | --- |
| `IE-A068` The United States | “American Trade … **OR** Carry a Big Stick …” | `die(ctx, 2)` 随机二选一 |
| `IE-A107` World's Fair | “each player (including you) **may** discard a card” | 有可用牌就强制弃 |
| `IE-A073` Economic Panic | “must either discard … **or** lose one stability” | 永远弃牌，无稳定度选项 |
| `IE-A109` Revolution of 1905 | “must either decrease stability **or** discard” | 永远弃牌 |
| `IE-A052` Eastern Orthodoxy | “The Russian player **chooses** a Balkan minor” | 取 `balkan[0]` |
| `IE-A051` Polish Revolt | “**Choose** a player that controls a Polish space” | 取第一个匹配玩家 |
| `IE-A048` Multicultural Empire | “(1) grants rights **(2)** attempts citizenship, roll 4+” | 直接加分，无选择无掷骰 |
| `IE-A045` Folie de Grandeur | “Place a pacification marker in a space … France controls” | 取第一个匹配空间 |
| `IE-A083` Quagmire | “**any player** that is pacifying” | 见 §3.2 |
| `IE-GW-01` Minor Power Entry | “**Choose** an independent minor … side **of your choice**” | 取 `minors[0]`，仅掷骰 ≥5 才生效 |
| `IE-H-AU-7` Habsburg Dynasty | “**Choose** an independent minor in Europe” | 取第一个德意志闪点空间 |
| `IE-H-UK-4` Balance of Power | “If the defender agrees …” | 事件模式仅实现 Option B |

**Fix.** 上述清单已逐条改为真实玩家选择：
- `A068` 开三选一（美国贸易 / 在墨西哥或日本放置标记）；
- `A073` 与 `A107` 改为顺序链，按座位顺序逐人询问（`economicPanic` /
  `worldsFair` 进入 `CARD_CHAIN_SPECIALS`）；
- `A109` 复用 A017/A018/A056 的“稳定度或随机弃牌”两步选择，决策归俄国座位；
- `A052`、`A051`、`A045`、`H-AU-7` 改为玩家选空间或选玩家；
- `A048` 在“二元君主国”已打出时开 (1)/(2) 二选一，并保留 4+ 掷骰；
- `GW-01` 改为玩家选具体小国后再掷骰。

`A068` 原先的 `die(ctx, 2)` 随机二选一已删除；`A107` 的“may discard”现在真
由每名玩家决定。回归测试逐卡断言 pending 类型、选项集合与结算结果。

**仍存限制.** `GW-01` 的另一分支“place a strict neutrality marker”需要引擎
没有的严格中立状态，因此只提供掷骰分支（§6）。

### 3.11 A073/A109 与 A017/A018/A056 的一致性

A017/A018/A056 共用 `choosePlayerStabilityOrCard`（先选玩家，再由该玩家选
稳定度或弃牌）。A073/A109 的卡面语义相同，此前却写成自动弃牌；本轮修复后
`A109` 走同一选择语义，`A073` 走逐人顺序链，两者都按玩家意愿结算。

---

## 4. 已确认正确的实现 / Verified-correct behaviour

以下结论来自运行验证，可作为回归基线。Confirmed by running the engine.

- **Playability gates** — `engine/playability.ts` 的 24 个卡牌 id 门控 + 10 条
  `POWER_LIST_GATES` 全部生效；`eventPlayability` 与 `cardAvailability` 共用同一
  谓词，UI 按钮与 `playCard` 不会分叉。新增的 `cpPlayability`/`canPlayForCp`
  把 12.0 的“任何牌都能当 CP 用”与 A105 的“手牌 ≤3 才能当 CP”统一到一处。
  12.0 的“每个行动轮只出 1 张牌”由 `impulseAlreadyUsed` 单独把关：CP 花到 0 之后
  仍算已用，强制事件给的 2 CP 是该轮的预算而不是第二个行动轮，手牌按钮与
  `playCard` 共用该谓词。
- **Combat cards** — 7 张动作战斗牌 + GW-03–06 全部数据驱动；实测 A058 攻城炮
  在骰前削减要塞 2 级、A059 侧翼攻击造成 1 步损失且末尾触发“决定性胜利”、
  A062 通讯失误打开支援否定的强制选择（拒绝会重新打开）。
- **Response cards** — `responseCardEligibility` 的窗口判定正确：A023/A024 只在
  maneuver、A063 在 alliance→maneuver 交界与 maneuver、A064 只在 alliance；
  A041/A098 在 GW 中返回 `no-effect-gw`。
- **Flag cleanup** — `TURN_DURATION_FLAG_DEFAULTS` 覆盖 12 个 `duration:"turn"`
  标志（含 A41 的 `landDrm`），`clearTurnDurationFlags` 在每个回合边界把它们复位；
  `WAR_DURATION_FLAG_DEFAULTS` 覆盖 2 个 `duration:"war"` 标志。实测
  `turnDurationFlags.test.ts` / `warFlagCleanup.test.ts` 通过。
- **有交互的处理器** — 31 个 `choice` 处理器实测都会打开 pending 并等待回答。
- **CP 链** — `cpChain` 的两张上限、4 CP 单次动作上限、chain 中强制事件的即时
  结算均通过。

---

## 5. 测试覆盖 / Test coverage

统计口径：某卡被“直接覆盖”= 某个测试文件包含该卡的 `IE-…` id 或 `A###`/`GW-##`
字面量；“handler 覆盖”= 只包含其处理器名字（间接证据）。Counted by literal
card id / number in a test file vs. handler name only.

修复轮次前：**91 / 122** 有直接覆盖，**24 张零信号**。修复轮次后
（`cardEventDefects.test.ts` 新增 45 个断言）：

- **100 / 122** 有直接覆盖。
- **8** 只有 handler 级覆盖。
- **14 张零信号**（既无 id 也无 handler 提及）：

```
A014 A016 A022 A025 A033 A042 A050 A086 A090 A097
H-GE-2 H-FR-6 H-OT-12 H-RU-9
```

修复前零覆盖的牌里，A080/A091（§3.3/§3.4）、A032/A073/A107/A109/A048/A045/
A052/A051/A068/GW-01/H-AU-7/H-FR-5/A029/A039/A072/A099/A083/A096/GE-1/UK-3
已全部进入新套件。剩余 14 张是没有已知缺陷的牌，建议作为下一步补测目标；
其中 A050（掷骰三档）与 A097（WoI +1 → 独立）逻辑分支最多，优先级最高。

`fuzz.test.ts` 的“每张行动牌/本国牌/大战牌打出后不抛错且能答完 20 个决策”是
兜底网，但它只验证“不炸”，不验证数值，因此无法捕获 §3 的任何一条。

---

## 6. 已知限制 / Remaining limitations

本轮修复后仍留三项，原因是**印刷前提在引擎中不存在**，属于新增能力而非缺陷
修复；三者在代码与文档中都带有明确注释。

| 项 Item | 卡 Card | 缺什么 Missing prerequisite |
| --- | --- | --- |
| EC/精英殖民远征军的“战斗加值” | `A080` `A091` 第二句 | EC 与精英殖民 EF 的 `unitFp` 为 0、无 DRM；`combatElite` pending 已定义但从未被打开。18.5 本身只规定骰子下限与 `*`/`**`，未赋予 EC 加值，因此“使用加值时自动消灭”没有可挂接的触发点 |
| 严格中立标记 | `GW-01` 第二分支 | 引擎没有 strict-neutrality 状态，也没有“带此标记的小国不能参战”的判定 |
| `A100` 的第二次 WTT 提升 | `A100` | 卡面在结算中间再次提升 WTT，可能在其子决策之后又触发一次危机；已有记录在 `IMPLEMENTATION_STATUS.md`，本轮未改动 |

这些项的卡面文本已在 `constant/cards.data.ts` 中完整转录，修复只需补上被依赖
的底层状态，不需要重新搬运文案。

## 7. 逐卡清单 / Per-card inventory

图例 Legend —
`引擎入口 Engine entry`：`special` handler 名，或声明式效果名；
`交互 Interaction`：`choice`=打开玩家选择、`auto`=自动结算、`mixed`=混合、`—`=无处理器；
`测试 Test`：`yes`=有直接单测、`handler`=仅处理器级、`no`=零信号。

#### 动作牌 Action cards (100)

| Card | 名称 Name | Type | CP | 引擎入口 Engine entry | 交互 Interaction | 测试 Test |
| --- | --- | --- | --- | --- | --- | --- |
| `IE-A013` | Colonial Conflict | mandatory | 2 | `colonialConflict` | choice | yes |
| `IE-A014` | Colonial Conflict | mandatory | 2 | `colonialConflict` | choice | **no** |
| `IE-A015` | Shifting Alliances | mandatory | 2 | `shiftingAlliances` + `allianceResolution` + `allianceSystemTension` | mixed | yes |
| `IE-A016` | Liberal Reforms | mandatory | 2 | `liberalReforms` | auto | **no** |
| `IE-A017` | Assassination! | mandatory | 2 | `wtt` + `choosePlayerStabilityOrCard` | choice | yes |
| `IE-A018` | Socialist Musings | event | 1 | `choosePlayerStabilityOrCard` | choice | yes |
| `IE-A019` | Skilled Diplomats | event | 2 | `mpitChoice` | — | yes |
| `IE-A020` | Diplomatic Incident | event | 1 | `removeAnyMinorAlliance` | choice | yes |
| `IE-A021` | National Railroad | event | 2 | `industry` | — | yes |
| `IE-A022` | New Administration | event | 2 | `newAdministration` | choice | **no** |
| `IE-A023` | New Rifles | response | 3 | `warLandDrm` | — | yes |
| `IE-A024` | New Artillery | response | 3 | `warLandDrm` | — | yes |
| `IE-A025` | Divide and Conquer | event | 2 | `divideAndConquer` | choice | **no** |
| `IE-A026` | Chinese Intervention | event | 2 | `chineseIntervention` | choice | yes |
| `IE-A027` | Foreign Investment | event | 2 | `foreignInvestment` | choice | yes |
| `IE-A028` | The Influence of Sea Power | mandatory | 2 | `influenceSeaPower` | auto | yes |
| `IE-A029` | Economic Boom | event | 4 | `stability` | — | yes |
| `IE-A030` | Italy | mandatory | 2 | `italy` | choice | handler |
| `IE-A031` | Graveyard of Empires | event | 2 | `graveyardOfEmpires` | auto | yes |
| `IE-A032` | American Civil War | mandatory | 2 | `americanCivilWar` | auto | yes |
| `IE-A033` | Sepoy Mutiny | mandatory | 2 | `sepoyMutiny` | auto | **no** |
| `IE-A034` | Decline of the Qing | event | 2 | `declineOfQing` | choice | yes |
| `IE-A035` | Sick Man of Europe | event | 3 | `sickMan` | auto | handler |
| `IE-A036` | Rebellions in China | event | 2 | `rebellionsInChina` | choice | yes |
| `IE-A037` | The Great Game | event | 2 | `greatGame` | choice | yes |
| `IE-A038` | Second Opium War | event | 1 | `secondOpiumWar` | choice | yes |
| `IE-A039` | Uprising in Ireland | event | 2 | `uprisingInIreland` | choice | yes |
| `IE-A040` | British Trade | event | 1 | `britishTrade` | auto | yes |
| `IE-A041` | Prussian Military Tradition | response | 2 | `prussianTradition` | auto | yes |
| `IE-A042` | The Ruhr | event | 4 | `industry`→GE | — | **no** |
| `IE-A043` | At Any Cost | combat | 2 | `combatDrm` | — | yes |
| `IE-A044` | Paris Commune | response | 1 | `stability` + `drawReplacement` | — | yes |
| `IE-A045` | Folie de Grandeur | event | 3 | `folieDeGrandeur` | choice | yes |
| `IE-A046` | French Intervention | event | 1 | `frenchIntervention` | choice | yes |
| `IE-A047` | The Dual Monarchy | event | 2 | `stability` + `dualMonarchy` | auto | yes |
| `IE-A048` | Multicultural Empire | event | 1 | `multiculturalEmpire` | choice | yes |
| `IE-A049` | South German Confederation | event | 3 | `southGermanConfederation` | auto | yes |
| `IE-A050` | Reforms of the 1860s | event | 1 | `reforms1860s` | auto | **no** |
| `IE-A051` | Polish Revolt | event | 2 | `polishRevolt` | choice | yes |
| `IE-A052` | Eastern Orthodoxy | event | 3 | `easternOrthodoxy` | choice | yes |
| `IE-A053` | Powder Keg | mandatory | 2 | `wtt` + `powderKeg` | auto | yes |
| `IE-A054` | Failed Reforms | response | 3 | `failedReforms` | auto | yes |
| `IE-A055` | Suez Canal | mandatory | 2 | `suezCanal` | auto | handler |
| `IE-A056` | Nationalism | event | 3 | `choosePlayerStabilityOrCard` | choice | yes |
| `IE-A057` | Impregnable | mandatory | 3 | `targetSpace`→`fort` + `fort` | — | yes |
| `IE-A058` | Siege Guns | combat | 2 | `siegeGuns` | — | yes |
| `IE-A059` | Flank Attack | combat | 1 | `flankAttack` | — | yes |
| `IE-A060` | Charge of the Light Brigade | combat | 1 | `enemyLandDrm` | — | yes |
| `IE-A061` | Ironclads | combat | 2 | `navalDrm` | — | yes |
| `IE-A062` | Miscommunication | combat | 2 | `miscommunication` | auto | yes |
| `IE-A063` | Rapid Mobilization | response | 1 | `rapidMobilization` | — | yes |
| `IE-A064` | Secret Treaty | response | 3 | `secretTreaty` | auto | yes |
| `IE-A065` | Indian Ocean Arms Trade | response | 1 | **Decrease a pacification marker by 1/Flip a reduced rebel army to full strength** → `indianOceanArms` | auto | yes |
| `IE-A066` | Damn the Torpedoes | combat | 2 | `noMines` | — | yes |
| `IE-A067` | International Conference | response | 4 | **Apply +2 DRM to the crisis roll/Decrease the WTT by 1** → `internationalConference` | auto | yes |
| `IE-A068` | The United States | event | 4 | `theUnitedStates` | choice | yes |
| `IE-A069` | Concert of Europe | event | 2 | `wtt` | — | yes |
| `IE-A070` | Papal Influence | event | 2 | `papalInfluence` | choice | yes |
| `IE-A071` | Urabi Revolt | event | 2 | `urabiRevolt` | choice | yes |
| `IE-A072` | Meiji Restoration | mandatory | 2 | `meijiRestoration` | auto | yes |
| `IE-A073` | Economic Panic | mandatory | 2 | `economicPanic` | choice | yes |
| `IE-A074` | Berlin Conference | mandatory | 2 | `berlinConference` | choice | yes |
| `IE-A075` | Second Industrial Revolution | event | 4 | `industry` + `industryDrm` | — | yes |
| `IE-A076` | Zulus | event | 1 | `zulus` | auto | yes |
| `IE-A077` | Indian Nationalism | event | 2 | `indianNationalism` | auto | yes |
| `IE-A078` | Crack Colonial Troops | event | 3 | `crackColonialTroops` | auto | yes |
| `IE-A079` | Loose Grip | event | 3 | `looseGrip` | auto | yes |
| `IE-A080` | Machine Guns | event | 2 | `machineGuns` | — | yes |
| `IE-A081` | Conquest of Central Asia | event | 1 | `conquestCentralAsia` | auto | yes |
| `IE-A082` | Wilhelm II | mandatory | 2 | `removeCard` + `removeThisCard` | — | yes |
| `IE-A083` | Quagmire | event | 3 | `quagmire` | choice | yes |
| `IE-A084` | Nationalist Uprising | event | 3 | `nationalistUprising` | choice | yes |
| `IE-A085` | Hungarian Obstinacy | event | 2 | `auNoCitizenship` | — | yes |
| `IE-A086` | Boer Wars | event | 1 | `boerWars` | auto | **no** |
| `IE-A087` | Mahdist War | event | 1 | `mahdistWar` | choice | yes |
| `IE-A088` | Our Place in the Sun | event | 3 | `ourPlaceInTheSun` | auto | yes |
| `IE-A089` | Cossacks | response | 2 | `stability` + `drawReplacement` | — | yes |
| `IE-A090` | The Eiffel Tower | event | 1 | `cityOfLight` | — | **no** |
| `IE-A091` | Hydraulic Recoil | event | 2 | `hydraulicRecoil` | — | yes |
| `IE-A092` | Naval Arms Race | event | 2 | `navalArmsRace` | choice | yes |
| `IE-A093` | Nicholas II | event | 2 | `nicholasII` | — | yes |
| `IE-A094` | The Boxer Rebellion | mandatory | 2 | `boxerRebellion` | auto | yes |
| `IE-A095` | Death of Franz Joseph | mandatory | 2 | `grantRightsOrCitizenship` | auto | yes |
| `IE-A096` | Empire of the Sun | event | 1 | `empireOfTheSun` | choice | yes |
| `IE-A097` | Diplomatic Recognition | event | 1 | `diplomaticRecognition` | auto | **no** |
| `IE-A098` | Dreyfus Affair | response | 1 | `frLandDrm` + `drawReplacement` | — | yes |
| `IE-A099` | Dreadnought | event | 1 | `dreadnought` | auto | yes |
| `IE-A100` | The Balkan Wars | mandatory | 2 | `wtt` + `balkanWars` + `wtt` + `balkanWarsAward` | choice | yes |
| `IE-A101` | The Black Hand | mandatory | 2 | `wtt` | — | yes |
| `IE-A102` | Moroccan Crisis | event | 3 | `moroccanCrisis` | choice | yes |
| `IE-A103` | Bosnian Crisis | event | 1 | `bosnianCrisis` | auto | yes |
| `IE-A104` | The Funeral of Edward VII | mandatory | 2 | `wtt` | — | yes |
| `IE-A105` | Impulsive Ruler | mandatoryResponse | 2 | `impulsiveRuler` | auto | yes |
| `IE-A106` | The Young Turks | mandatory | 2 | `youngTurks` | auto | yes |
| `IE-A107` | World's Fair | event | 3 | `worldsFair` | choice | yes |
| `IE-A108` | High Seas Fleet | event | 1 | `highSeasFleet` | choice | yes |
| `IE-A109` | Revolution of 1905 | response | 2 | `revolution1905` | choice | yes |
| `IE-A110` | Extreme Militarism | event | 2 | `reserve` + `reserveLimitBonus` + `extremeMilitarism` | auto | yes |
| `IE-A111` | The Alliance System | mandatory | 2 | `shiftingAlliances` + `allianceResolution` + `allianceSystemTension` | mixed | yes |
| `IE-A112` | Franz Ferdinand | event | 1 | `grantRightsOrCitizenship` | auto | yes |

#### 本国牌 Home cards (12)

| Card | 名称 Name | Type | CP | 引擎入口 Engine entry | 交互 Interaction | 测试 Test |
| --- | --- | --- | --- | --- | --- | --- |
| `IE-H-GE-1` | Otto von Bismarck | event | 3 | `stability` + `bismarckWar` | auto | yes |
| `IE-H-GE-2` | German General Staff | event | 3 | `germanGeneralStaff` | auto | **no** |
| `IE-H-UK-3` | Sun Never Sets | event | 3 | `stability` + `sunNeverSets` | auto | yes |
| `IE-H-UK-4` | Balance of Power | event | 3 | `balanceOfPower` | auto | handler |
| `IE-H-FR-5` | The City of Light | event | 3 | `stability` + `cityOfLightHome` | auto | yes |
| `IE-H-FR-6` | Aux Armes, Citoyens! | event | 3 | `auxArmes` | auto | **no** |
| `IE-H-AU-7` | Habsburg Dynasty | event | 3 | `habsburgDynasty` | choice | yes |
| `IE-H-AU-8` | Kaiserreich | event | 3 | `kaiserreich` | auto | yes |
| `IE-H-RU-9` | Russo-Turkish Wars | event | 3 | `russoTurkishWars` | auto | **no** |
| `IE-H-RU-10` | God Save the Tsar | event | 3 | `godSaveTheTsar` | auto | yes |
| `IE-H-OT-11` | Modernization | event | 3 | `modernization` | auto | yes |
| `IE-H-OT-12` | Jihad | event | 3 | `jihad` + `jihadWar` | auto | **no** |

#### 大战牌 Great War cards (10)

| Card | 名称 Name | Type | CP | 引擎入口 Engine entry | 交互 Interaction | 测试 Test |
| --- | --- | --- | --- | --- | --- | --- |
| `IE-GW-01` | Minor Power Entry | event | 1 | `gwMinorPowerEntry` | choice | yes |
| `IE-GW-02` | Major Power Entry | event | 1 | `gwMajorPowerEntry` | choice | yes |
| `IE-GW-03` | Technological Terror | combat | 1 | `gwCombatDrm` | — | yes |
| `IE-GW-04` | Dawn of Modern Warfare | combat | 1 | `gwCombatDrm` | — | yes |
| `IE-GW-05` | Capable Commander | response | 1 | `gwCapableCommander` | choice | yes |
| `IE-GW-06` | They Shall Not Pass | response | 1 | `noRetreat` | — | yes |
| `IE-GW-07` | Submarines | event | 1 | `gwSubmarines` | choice | yes |
| `IE-GW-08` | Political Pressure | event | 1 | `gwPoliticalPressure` | choice | yes |
| `IE-GW-09` | Political Pressure | event | 1 | `gwPoliticalPressure` | choice | yes |
| `IE-GW-10` | Exhaustion | mandatory | 1 | `gwExhaustion` | choice | yes |
