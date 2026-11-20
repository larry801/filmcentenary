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
**Fix** 段落给出对应的实现位置与验证方式。

**2026-11-18 补齐轮次：** 当时因缺少底层机制而保留的 3 项已全部实现（分支
`feat/ie-card-limitations`）——EC/精英殖民 EF 的战斗加值（A080/A091 第二句的
挂接点）、GW-01 的严格中立标记、A100 跨多段危机保留的卡牌尾部。回归测试在
`src/imperialElegy/cardLimitations.test.ts`（14 个断言），详见 §6。
**Conclusion:** at the "does it run" level the card set is complete — every card is
implemented and `fuzz.test.ts` plays all 122 through every pending decision.

**2026-11-18 repair pass:** every defect recorded in §3 is fixed on branch
`fix/ie-card-event-defects`, with per-clause regression coverage in
`src/imperialElegy/cardEventDefects.test.ts` (45 assertions). Each section's
**Fix** paragraph names the implementation site and how it is verified.

**2026-11-18 follow-up:** the three mechanisms this pass had to leave open are
implemented on branch `feat/ie-card-limitations` — the elite-unit combat bonus
(what A080/A091's second clause hangs on), GW-01's strict neutrality marker, and
A100's card tail surviving a multi-step crisis. Regression coverage:
`src/imperialElegy/cardLimitations.test.ts` (14 assertions). See §6.

**2026-11-19 fix:** the Bismarck event could not launch the war of unification it
prints (§3.12): its `warDeclaration` flag was read by nothing and the impulse
ended with no CP. The event now leaves a declaration entitlement that
`declareWar` consumes with the card's printed CP, the Orders-panel declaration
block accepts non-player targets (the German minors a unification war actually
targets), and `war.declarationCard` records the card so Balance of Power cannot
answer it. Regression coverage: `bismarckWar.test.ts` (6) and
`components/bismarckDeclarePanel.test.tsx` (3).

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

**第二句现已在 §6.1 补齐.** 它依赖一个"战斗加值"，而 18.5 本身只规定骰子下限
与 `*`/`**` 结果。本轮新增 `engine/eliteBonus.ts`：精英单位由控制方在战斗卡窗口
之后、掷骰之前主动投入（`combatElite`）换取 +1；若对手是非叛军陆战，战斗结束后
按印刷句自动消灭。

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

**第二句与 §3.3 同源，已在 §6.1 一并补齐.**

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

**第二分支已补齐（§6）.** `GW-01` 现在同时提供“掷骰参战”与“放置严格中立标记”
两个印刷分支；标记记录在 `SpaceState.strictNeutrality`，带标记的小国不再进入候选
列表。

### 3.11 A073/A109 与 A017/A018/A056 的一致性

A017/A018/A056 共用 `choosePlayerStabilityOrCard`（先选玩家，再由该玩家选
稳定度或弃牌）。A073/A109 的卡面语义相同，此前却写成自动弃牌；本轮修复后
`A109` 走同一选择语义，`A073` 走逐人顺序链，两者都按玩家意愿结算。

### 3.12 俾斯麦事件无法发动统一战争 / the Bismarck event could not launch its war

卡面：*“Gain 1 stability. Declare a war of unification using this card's CP
value. …”* (`IE-H-GE-1`).

实测 `playCard(IE-H-GE-1, "event")`（起始稳定度 3）：稳定度 3 → 4 后**行动轮
直接结束**，`G.powers.GE.flags.warDeclaration` 被置为 `true`，但引擎里**没有
任何代码读取这个标志**，`G.cpRemaining` 又是 0，而 `declareWar` 要求 CP
（`cp < 1` 直接拒绝）。所以 GE 永远无法按卡面发动统一战争，这正是玩家报告的
“事件俾斯麦无法发动统一战争”。同一缺陷还留下一条死路径：
`engine/effects.ts` 的 `{type: "war"}` / `special: "warDeclaration"` 决策没有
任何卡牌引用，也没有 `resolvePending` 分支。

**Fix (2026-11-19).** 事件改为登记一份“宣战授权”（errata 12.17：一张牌的 CP
必须全部用于宣战，不能留下零钱）：

- `engine/rules.ts` 新增 `grantWarDeclarationEntitlement` /
  `warDeclarationEntitlement` / `clearWarDeclarationEntitlement`。授权记在原有
  的公开标志 `warDeclaration` 上，并用 `warDeclarationCard` 记住是哪张牌。
- `bismarckWar` 处理器登记授权；`playCard` 在授权仍存在时不结束行动轮；
  `finishImpulse`（交出行棋/行动轮）清除授权，所以“不宣战就直接过”仍然可行。
- `declareWar` 读取授权：**不扣 `cpRemaining`**，CP 必须等于卡牌的 3，aim
  必须是 `unification`；成功后清除授权，并把
  `war.declarationCard = IE-H-GE-1`——14.2.1 的 Balance of Power 因此不能再
  响应这次宣战（`balanceOfPower.test.ts` 原先手工设置该字段）。
- UI：`SpacePanel` 的宣战块在授权期间锁定 aim/CP 为卡面值，并接受**非玩家
  国家**作为目标（13.4），因为 GE 的统一战争目标正是丹麦、巴伐利亚等德意志
  小国；此前面板只认 `isPowerKey(control)`，小国空间根本不会出现宣战块。

回归：`src/imperialElegy/bismarckWar.test.ts`（6 个断言：事件授权、对玩家与
小国的统一战争、CP/aim 校验、交出行动轮清除授权）与
`src/imperialElegy/components/bismarckDeclarePanel.test.tsx`（3 个断言：锁定
aim/CP、`{minor}` 目标参数、无授权时的普通控件）。

卡面的“可同时指定两个不同国家”与“宣战后可禁止其他玩家参战”已按下文
§3.14 补齐；另外三张“用本牌 CP 宣战”的本国牌见 §3.13。

### 3.12.1 宣战全部收进战局面板 / declarations live in the War panel

玩家复报“俾斯麦事件之后不能统一战争”，随后进一步要求“战争操作太分散了
而且依赖点击地图，都集中到一个面板上完成”。宣战原本散在三处：Orders 面板
（必须先在地图上点中一个合法目标空间才出现）、本国牌专用的目标弹窗，以及
只有战争已开打才存在的 War 页。宣战本身并不需要地图选择——`declareWar`
的参数就是防守方、战争目标与目标空间。

**Fix (2026-11-19).**

- War 页永远存在（`components/turnPanelTab.ts` 去掉 `warVisible` 条件，
  桌面页签与手机抽屉都列出）。战前它是宣战表单，开战后是 `WarPanel` /
  `GreatWarPanel`，所有战争操作都在这一个面板里。
- 新增 `components/WarDeclarationPanel.tsx`：防守方、战争目标、目标空间、
  CP，以及 14.1 的第二国 / 主要防守方与俾斯麦禁止参战，全部在面板内选择。
  选择放在组件本地 state 并在每次渲染时按引擎结果收敛，换牌或换行动轮都
  不会留下过期的选项。
- `engine/declarationTargets.ts` 在原有 `declarationTargetCandidates` 之外
  增加 `declarationDefenders` / `declarationObjectives` /
  `declarationSecondObjectives`：面板一次只问一个问题，读的仍是
  `declareWar` 的同一套校验（13.0、13.5、13.4、`validateWarAim`），因此
  不会给出引擎会拒绝的选项；`declarationTargetCandidates` 保持只服务本国牌
  授权的旧契约。
- 删除 Orders 面板里的宣战块与“选择战争目标”提示、模型里对应的状态
  （`warAim`、`warCp`、`secondObjective`、`warTargetControl` 等），以及
  `components/WarTargetDialog.tsx` 及其测试；`actionAvailability` /
  `spaceActionModel` 里已死的 `warCp`、`onDeclareWar` 也一并移除。
- 本国牌授权生效时仍会**自动切到 War 页**（并在手机抽屉上打 `!` 徽标），
  取代原来的自动弹窗；俾斯麦端到端用例改为直接读取面板里锁定的目标与 CP。

回归：`components/warDeclarationPanel.test.tsx`（8 个断言：玩家/小国目标、
卡面锁定的目标与 CP、RU-9 与 Jihad 的目标限制、14.1 条款、普通宣战的
目标/CP、非行动轮时的说明、以及无合法目标时的提示）、`components/turnPanelTab.test.ts`
（按“War 页常驻”重写）以及 `e2e/imperial-elegy-controls.spec.ts` 的两个
端到端用例（波希米亚普通宣战、俾斯麦统一战争，全程不点地图）。

> 以下 §3.12.2 及更早的描述涉及已被本改动替换的弹窗与“先选地图再宣战”
> 流程。

### 3.12.2 宣战后没有切到战争界面 / the war screen did not open after a declaration

玩家第三次复报同一症状，这次描述更具体：“选择目标之后没有开启战争界面”。
引擎与弹窗都已正确：`declareWar` 成功，`phase` 变为 `wartime`，`G.war` 也已
建立。缺的是**切页**：`useBoardModel` 里“战争开始时把战争面板提到前面”的
effect 写的是 `railTab`，但桌面端 `TurnPanel` 只在手机上传入 `activeTab`
（底部抽屉的页签），桌面端一直用自己的内部 state，所以宣战后仍停在 Orders
页——从玩家视角看就是“什么都没发生”。

**Fix (2026-11-19).** 让两侧共用同一份“回合面板有哪几页”的定义：

- 新增 `components/turnPanelTab.ts`：`turnTabKeys`（War 页仅在 `war` 或
  `gw` 存在时出现）、`resolveTurnTab`（页签消失时回退到 Orders）、以及
  `mobileTabForTurnTab` / `turnTabForMobileTab`（抽屉的 Hand/Mat 没有对应
  页，回退到 Orders）。面板与外壳都读它，因此不会各说各话。
- `BoardLayout` 桌面端传入 `activeTab={resolveTurnTab(railTab, warVisible)}`
  并补上 `onTabChange` 写回 `railTab`，点击的页签就是模型记住的页签；手机
  端仍通过 `mobileTab` 写回。
- `useBoardModel` 的战争起始 effect 同时驱动两侧：置 `railTab = "war"` 与
  `mobileTab = "war"`，手机上还把底部抽屉抬到半高（与决策到达时的行为
  一致）。此 effect 只在战争出现的上升沿触发，玩家之后手动切回 Orders 不会
  被抢回。

回归：`components/turnPanelTab.test.ts`（4 个断言）与
`e2e/imperial-elegy-controls.spec.ts` 的两处断盲（波希米亚宣战与俾斯麦统一
战争宣战后：不再点击页签，直接断言 `ie-war` 可见且 `ie-turn-tab-war` 已是
`aria-selected="true"`）。


### 3.13 其余三张宣战本国牌的授权与目标限制 / the other three declaration home cards

卡面：

- `IE-H-FR-6` Aux Armes, Citoyens!：*“Then declare war using this card's CP
  value. If you choose a conquest war aim you may target up to two keys …”*
- `IE-H-RU-9` Russo-Turkish Wars：*“Then declare war against the Ottomans using
  this card's CP value. … If a conquest war aim is chosen, do not increase the
  WTT or decrease your stability.”*
- `IE-H-OT-12` Jihad：*“Declare war against a power that controls an OT home
  space or RU using this card's CP value (declaring war on a RU Minor power ally
  counts as declaring war on RU). Do not increase the WTT or decrease your
  stability.”*

**Fix (2026-11-19).** 三个处理器不再只置 `warDeclaration` 标志，而是与俾斯麦
一样调用 `grantWarDeclarationEntitlement` 登记“牌 + 印刷 CP”；`playCard`
因此保持行动轮打开，`declareWar` 不扣 `cpRemaining` 并校验印刷限制：

- `engine/rules.ts` 新增按卡牌索引的 `WarDeclarationPolicy`：合法 aim 列表、
  合法目标（RU-9 只能对 OT；OT-12 为 RU 或控制任意奥斯曼本土空间的国家）、
  征服目标关键区上限（Aux Armes 为 2，其余 1）、征服免 WTT/稳定度惩罚
  （RU-9、OT-12）与 13.1.2 巴尔干解放例外（RU-9）。
- 目标检查使用 13.4 解析后的防守主角：对俄国小国盟友宣战即对俄宣战，因此
  OT-12 的目标限制与该条印刷说明一致；小国目标走既有 `minorWarInfo` 门控。
- `declareWar` 的 aim 校验、`chooseWarAim` 的再次校验、拿破仑遗产决策后的
  再次校验都读取同一 policy；`finalizeWarDeclaration` 按
  `G.flags.declarationCard` 跳过 RU-9 / OT-12 的征服惩罚。
- UI：`SpacePanel` 只显示该牌允许的 aim，显示目标限制提示；选中被禁止的
  目标时宣战按钮禁用（`warTargetAllowed`），不再发出必被拒绝的 move。

回归：`src/imperialElegy/homeWarDeclarations.test.ts` 与
`src/imperialElegy/components/bismarckDeclarePanel.test.tsx` 的 RU-9 / OT-12
面板断言。Aux Armes 的双目标与“中立国可参战”见 §3.14；RU-9 的巴尔干小国
结盟与三张牌的“获胜 +1 稳定度”见 §3.15。

### 3.14 双目标宣战与参战限制 / two-power declarations and join limits

卡面：

- `IE-H-GE-1` Otto von Bismarck：*“You may target two different powers with
  this declaration of war. After declaring war you may choose to forbid other
  players from joining the war. Minor power allies may join the war as normal.”*
- `IE-H-FR-6` Aux Armes, Citoyens!：*“If you choose a conquest war aim you may
  target up to two keys and you may also target two different powers. However,
  if you do either, neutral powers can join the war against you.”*

规则书 14.1：*“It is possible for the GE and FR player, through the play of
one of their home cards, to attack two different powers. … If this occurs the
defending players determine, between the two of them, who the primary defender
is, and, if they cannot agree, the attacker decides.”*

**Fix (2026-11-19).** 两份卡面条款进入同一套宣战授权模型：

- `declareWar` 新增可选第 5 参数 `{secondTarget, primary, forbidPlayers}`。
  `WarDeclarationPolicy` 增加 `maxPowers` / `twoPowerAims` /
  `mayForbidPlayerJoins` / `neutralJoinOnDouble`：俾斯麦的双目标只用于
  unification，Aux Armes 的双目标只用于 conquest。
- 双目标宣战仍是一场战争：`WarState.defender` 是主要防守方，
  `WarState.coDefenders` 记录被同一声明攻击的第二国；第二国同时进入
  `defenderAllies`（因此先手、战斗、预算与复员都把它当作防守方交战方），
  预算按 14.3 只计其工业（它没有为参战打出卡牌）。双方各自按 8.2 远离进攻方；
  主要防守方的双方中立选择仍走既有 `chooseAllianceShift`，第二国使用
  8.6 同款的“协约国优先”确定性回退，避免两个 pending 冲突。
- 目标校验（`validateWarAim` 的 `defenders`）允许两个防守方中任一控制目标
  关键区；`chooseWarAim` 与拿破仑遗产决策后的再次校验读取同一列表。
- 俾斯麦的禁止参战在宣战时记录（`WarState.forbidPlayerJoins`），
  `allyCallEligibility` 对双方的所有玩家盟友调用返回 `forbid-join`；
  `joinWarAsMinor` 不受影响，小国盟友仍按 14.0 参战。
- **Fix (2026-11-19, follow-up)：禁止参战同样压制 13.4.2 求援。** 玩家复报
  “俾斯麦事件的统一战争没有阻止其他玩家参战”：14.0 的盟友召唤已被挡住，但
  对角色的无盟友小国宣战时，13.4.2 仍会依次询问外交标记持有者与
  Non-Player Alliance Table，被问到的玩家可以“援助”该小国并成为防守主角——
  这也是一种“其他玩家参战”。`beginSeekingAid` 现在在
  `G.flags.declarationForbid` 为真时完全跳过求援，记录
  `minorAidForbidden`，小国按 15.4.2 独自防守；`finalizeMinorAid` 也做同样的
  守卫，防止已排队的求援决定绕过条款。13.4.1 的既有玩家盟友不受影响（卡面
  Clarification 明确其仍可选择“为小国参战”）。
- Aux Armes 在“两个关键区或两个国家”时置 `WarState.allowNeutralJoin`；
  新增 `joinWarAsNeutral` move 让中立国玩家自行为防守方参战（打出一张
  event 牌作战争预算，并按 8.2 远离进攻方，仍受 8.4 三人上限约束）。
- UI：宣战块新增第二国选择、主要防守方选择与“禁止玩家盟友参战”复选框；
  战争面板显示两项参战限制，并在 `allowNeutralJoin` 时为中立座位提供参战按钮。

回归：`bismarckWar.test.ts`（13 个断言：双目标、主要防守方、禁止参战、
禁止参战压制 13.4.2 求援、既有小国盟友仍可参战、第二目标校验等）、
`homeWarDeclarations.test.ts`（19 个断言：Aux Armes 双目标、双关键区、
中立国参战与无条款时拒绝）与
`components/bismarckDeclarePanel.test.tsx`（6 个断言）。

**建模边界（仍记录为近似）：**

- 双目标声明目前只支持“第一目标为玩家”的路径；第一目标是 13.4 小国时仍走
  原有的放弃/求援流程，不能同时再指定第二国。
- 规则书把主要防守方的首要决定权给两名防守玩家；本实现把最终结果作为
  `declareWar` 的 `primary` 参数记录（默认第一目标）。UI 的选择器由进攻方
  操作，等价于 14.1“协商不成由进攻方决定”的回退，未另开防守方协商对话。
- 第二防守方作为 `defenderAllies` 参与战斗与条约分配，但其首都失守按 15.6
  的盟友击倒处理，而不是“主要防守方首都”立即终战。

### 3.15 RU-9 的巴尔干结盟与三张牌的获胜稳定度 / RU-9 alliance and win stability

卡面仍未覆盖的两句：

- `IE-H-RU-9`：*“If possible gain an alliance with a Balkan minor power with
  which you have a diplomacy marker.”*
- `IE-H-FR-6` / `IE-H-RU-9` / `IE-H-OT-12`：*“If France/Russia wins the war gain
  1 stability”*、*“Gain 1 stability if you win the war.”*

**Fix (2026-11-19).**

- RU-9 的事件处理器现在先结算结盟：候选是 `BALKAN_MINORS` 中**当前由该小国
  控制、且带有俄国 `diplomacy` 标记**的本土空间，再用 12.8 的统一门槛
  `minorAllianceProblem` 过滤（已被他国结盟、达到 5 个盟友上限等情形按
  “if possible”跳过）。候选唯一时自动结盟；多个候选时打开
  `eventTargetSpace` 选择，由俄国玩家决定，不再做确定性首选。
- 结盟走 `gainMinorAlliance`：外交标记翻成盟友标记（`diplomacy = null`,
  `ally = RU`）并写 `minorAlliance` 日志；与 `habsburgDynasty` /
  `easternOrthodoxy` 的既有写法一致。
- 三张牌的“获胜 +1 稳定度”由 `WarDeclarationPolicy.winStability` 记录，
  `applyVictoryOutcome` 在宣战方（`war.victor === "attacker"`）取得非白和
  胜利时追加 `+1`，位于 16.1 重大胜利的 `+1/-1` 之外，并写
  `warWinStability` 日志。白和（包括仅由 16.1.6 盟友击倒决定的“白和”）
  不算获胜，不加分。
- RU-9 的结盟选择是一次 pending decision，因此
  `finalizePendingCard` 与 `playCard` 一样在宣战授权仍存在时保持行动轮
  不结束（否则 `cpRemaining = 0` 会在选择结算后直接交出行动轮）。

回归：`homeWarDeclarations.test.ts`（新增 9 个断言：罗马尼亚起始标记自动
结盟、不可结盟时跳过、多候选选择并保持行动轮、三张牌各 +1、白和不加、
普通 CP 宣战只拿重大胜利的 +1）与 `components/logText.test.ts`
（`warWinStability` 的中英文句子）。

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
- **Printed response triggers** — 9.1.3 的卡面触发条件也由同一谓词把关：
  `responseTriggerBlock` 读取 `stabilityDecreased(Turn)` 与 `frLostWarTurn` 来判定
  A44/A89/A109；A67 只在已打开的 `crisis` 决策内可用（并拒绝 A105 引发的危机，
  同时恢复其“作为普通事件”模式）；A65 由 `pacify` 的 `a065` 模式提供
  （标记 −1 / 叛军恢复满编，卡牌在掷骰前结算），不再从行动轮开始时的通用响应窗口打出。
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

- **103 / 122** 有直接覆盖。
- **8** 只有 handler 级覆盖。
- **11 张零信号**（既无 id 也无 handler 提及）：

```
A014 A016 A022 A033 A042 A050 A090
H-GE-2 H-FR-6 H-OT-12 H-RU-9
```

修复前零覆盖的牌里，A080/A091（§3.3/§3.4）、A032/A073/A107/A109/A048/A045/
A052/A051/A068/GW-01/H-AU-7/H-FR-5/A029/A039/A072/A099/A083/A096/GE-1/UK-3
已全部进入新套件；A025/A037 在 2026-11-21 的分支补齐了各自的印刷空间选择与
绥靖掷骰，A097 同步补上了标记选择与 20.8 独立序列，A086 改为 12.11.2 的 11+
特殊标记。剩余 11 张是没有已知缺陷的牌，建议作为下一步补测目标；
其中 A050（掷骰三档）与 A097（WoI +1 → 独立）逻辑分支最多，优先级最高。

`fuzz.test.ts` 的“每张行动牌/本国牌/大战牌打出后不抛错且能答完 20 个决策”是
兜底网，但它只验证“不炸”，不验证数值，因此无法捕获 §3 的任何一条。

---

## 6. 已补齐的三项限制 / Previously-listed limitations, now closed

上一轮记录的三项“缺少底层机制”已全部补齐（分支 `feat/ie-card-limitations`），
回归测试在 `src/imperialElegy/cardLimitations.test.ts`（14 个断言）。

| 项 Item | 卡 Card | 补齐方式 How it was closed |
| --- | --- | --- |
| EC/精英殖民 EF 的战斗加值 | `A078` `A080` `A091` 第二句 | 新增 `engine/eliteBonus.ts`，把加值做成**玩家选择**：`combatElite` 决策在战斗卡窗口之后、掷骰之前出现，投入则 +1 BDRM；若对手是非叛军陆战，战斗结束后按印刷句自动消灭该单位 |
| 严格中立标记 | `GW-01` 第二分支 | `SpaceState.strictNeutrality` 记录标记；GW-01 现同时提供“掷骰参战”与“放置严格中立标记”两个印刷分支，带标记的小国不再出现在候选列表 |
| `A100` 第二次 WTT | `A100` | 危机是 `crisis → crisisIncident → crisisAlliance` 的多段决策，卡牌剩余文本原先只在 `conference` 结局才续跑。现改为把剩余效果挂在危机 run 上，序列结束后统一执行（爆发结局按 23.1 丢弃） |

### 6.1 EC 战斗加值的实现要点

- **为什么做成选择**：A078 印的是 "**may** provide a +1 modifier"，且只有"使用
  加值"才会触发自毁。若做成自动加值，第二句就没有触发条件。`combatElite` 这个
  pending 早已在 `types.ts`/`i18n`/`bot`/`pendingSafety` 中登记，本轮把它接上。
- **触发时机**：`afterCombatCardWindow` 之后、掷骰之前——玩家先看到可用的战斗卡，
  再决定是否花掉精英单位。
- **自毁判定在投入时记录**：`eliteBonusVsRebel` 保存"投入那一刻对手是否为叛军"。
  战斗结束时主战部队可能已被步损清空，若那时再读棋盘会误判为非叛军而放过该单位。
- **Great War 不适用**：精英殖民 EF 是战前殖民单位，GW 中没有这条加值规则；在 GW
  中询问也会打断 27.x 的自动脉冲序列，因此 `eliteBonusCandidates` 在 `gw.active`
  时返回空。
- 单位本身仍会因普通战斗损失被消灭；两种消灭在日志上可区分
  （`eliteBonusDestroyed` 仅代表印刷句触发）。

### 6.2 危机续跑的实现要点

- 剩余效果存放在 `CrisisRun.resumeEffects`，而不是只挂在第一个 `crisis` pending
  的 context 上——否则多段危机走到第二、三段时就丢失了卡牌尾部。
- `crisisResumeEffects(pending)` 从当前 pending 的 context 或 run 上取回尾部。
- **outbreak 必须丢弃**：23.1 明确"If GW breaks out the rest of the text on the
  event is ignored"，`crisisFlow.test.ts` 有专门断言守这条。

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
| `IE-A019` | Skilled Diplomats | event | 2 | `mpitChoice` | choice | yes |
| `IE-A020` | Diplomatic Incident | event | 1 | `removeAnyMinorAlliance` | choice | yes |
| `IE-A021` | National Railroad | event | 2 | `industry` | — | yes |
| `IE-A022` | New Administration | event | 2 | `newAdministration` | choice | **no** |
| `IE-A023` | New Rifles | response | 3 | `warLandDrm` | — | yes |
| `IE-A024` | New Artillery | response | 3 | `warLandDrm` | — | yes |
| `IE-A025` | Divide and Conquer | event | 2 | `divideAndConquer` | choice | yes |
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
| `IE-A044` | Paris Commune | response | 1 | `stability` + `drawReplacement`; needs France's lost-war/stability trigger | — | yes |
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
| `IE-A065` | Indian Ocean Arms Trade | response | 1 | **Decrease a pacification marker by 1/Flip a reduced rebel army to full strength** → `indianOceanArms`; `pacify(..., "marker" | "rebel")` | choice | yes |
| `IE-A066` | Damn the Torpedoes | combat | 2 | `noMines` | — | yes |
| `IE-A067` | International Conference | response | 4 | **Apply +2 DRM to the open crisis roll/Decrease the WTT by 1 as a normal event** → `internationalConference` | auto | yes |
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
| `IE-A086` | Boer Wars | event | 1 | `boerWars` | auto | yes |
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
| `IE-A097` | Diplomatic Recognition | event | 1 | `diplomaticRecognition` | choice | yes |
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
| `IE-H-GE-1` | Otto von Bismarck | event | 3 | `stability` + `bismarckWar`→`declareWar` | choice | yes |
| `IE-H-GE-2` | German General Staff | event | 3 | `germanGeneralStaff` | auto | **no** |
| `IE-H-UK-3` | Sun Never Sets | event | 3 | `stability` + `sunNeverSets` | auto | yes |
| `IE-H-UK-4` | Balance of Power | event | 3 | `balanceOfPower` | auto | handler |
| `IE-H-FR-5` | The City of Light | event | 3 | `stability` + `cityOfLightHome` | auto | yes |
| `IE-H-FR-6` | Aux Armes, Citoyens! | event | 3 | `auxArmes` | auto | yes |
| `IE-H-AU-7` | Habsburg Dynasty | event | 3 | `habsburgDynasty` | choice | yes |
| `IE-H-AU-8` | Kaiserreich | event | 3 | `kaiserreich` | auto | yes |
| `IE-H-RU-9` | Russo-Turkish Wars | event | 3 | `russoTurkishWars`→`declareWar` | choice | yes |
| `IE-H-RU-10` | God Save the Tsar | event | 3 | `godSaveTheTsar` | auto | yes |
| `IE-H-OT-11` | Modernization | event | 3 | `modernization` | choice | yes |
| `IE-H-OT-12` | Jihad | event | 3 | `jihad` + `jihadWar` | auto | yes |

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
