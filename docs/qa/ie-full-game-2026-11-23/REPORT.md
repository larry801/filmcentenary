# 帝国挽歌（Imperial Elegy）· 固定种子整局测试报告

日期：2026-11-23
测试对象：`src/imperialElegy` 真实引擎（不是模拟器、不是 UI mock）
种子：`IE-FULL-2`（固定）
座位设置：六个席位全部由“玩家”控制（`G.bots = []`），对应本地热座 6 人全部手动操作；每个席位都走自己的 `playerView` 和 `pending` 决策
规则依据：`IE_rule.pdf`（未参考 playbook / errata / 实现文档）
方式：`runSeededGame` 从 1850 战役第 1 回合开始，连续运行到大战爆发，再走完大战 0–5 回合；每一步都是真实 boardgame.io reducer 的 `MAKE_MOVE`

## 1. 覆盖范围

| 阶段 | 本局实际发生 |
| --- | --- |
| 战役第 1–3 回合 | 准备、外交、行动、结束阶段；宣战、战时机动、白和、复员 |
| 第 3 回合危机 | `IE-A017` 引发 `International Conference`（未爆发，WTT 回退）；`IE-A071` 再次触发危机并爆发 |
| 大战爆发 | 第 3 回合行动阶段 `greatWarOutbreak`；TE = UK/FR/AU，TA = OT，中立 = GE/RU |
| 大战 0–5 回合 | 规划、机动、战斗、冬季；中途 GE、RU 按 29.3 加入 TA |
| 冬季 | 殖民战争、殖民地转移、殖民奖励 CP、中立国入场/免费重新部署 |
| 大战结束 | 31.0 的 GW 第 5 回合上限；无中立玩家；按稳定度判定 UK 获胜 |
| 结果 | `gwTurnLimit:stability`，UK；`issues = 0`，无非法移动/结构不变量错误 |

本次运行共 **701** 个已派发动作。事件/日志中的关键里程碑：

- `warDeclared`（战役期有限战争）
- `crisisRoll` × 2（第一次会议、第二次爆发）
- `greatWarOutbreak`
- `trenchesPlaced`（107 个关键区获得 28.1 战壕地形）
- `colonialWar`（每回合非洲/亚洲各一次）
- `gwNeutralEntry`（GE、RU 加入 TA）
- `greatWarEnded`（`turnLimit`）

## 2. 规则问题清单

| # | 规则 | 严重度 | 状态 |
| --- | --- | --- | --- |
| 1 | 32.3 / 32.4：中立非玩家大国/小国可在没有宣战的情况下被攻击，战斗日志还把攻击方记成防守方 | 高 | 未修复（已记录复现） |
| 2 | 15.4：与玩家结盟的小国单位被 `hostileOwner` 视为敌人，可被自己或盟友攻击 | 高 | 已修复 + 回归测试 |
| 3 | 28.1 / 28.1.1：大战第 1 回合把所有关键区的“战壕地形”写成“僵持”战壕战标记，战争页会列出 107 场不存在的战壕战 | 中 | 已修复 + 回归测试 |
| 4 | 测试基础设施：6 人热座外交阶段必须先由每个席位 `finishNegotiation`，原 harness 让同一席位反复 `pileHomeCard` 并被拒绝，整局在 t1 外交死锁 | 中（非规则） | 已修复 |

## 3. 问题 1（高，未修复）：32.4 的中立非玩家宣战缺失

### 规则

- **32.3**：“Players cannot attack neutral players. They can, however, attack minor and major powers (see next point).”
- **32.4**：“Players can declare war on non-player powers at any point during their impulse. When this happens a player from the opposing alliance immediately places an alliance marker in the minor power's space.”

### 现象

本局大战阶段出现 6 次 `attacker === defender` 的陆战。它们的目标都是没有玩家控制的中立非玩家：

| 攻击方 | 目标空间 | 日志中的防守方 | 目标当时的控制 |
| --- | --- | --- | --- |
| FR | Belgium | FR | Belgium（无 ally） |
| OT | Bosnia-Herzegovina | OT | Balkans（无 ally） |
| AU | Piedmont | AU | IT（意大利未参战） |
| AU | Saxony | AU | Saxony（无 ally） |
| AU | Bavaria | AU | Bavaria（无 ally） |
| AU | Bosnia-Herzegovina | AU | Balkans（无 ally） |

日志示例（`G.log`，大战第 0 回合）：

```json
{"key":"gwManeuverAction","phase":"gwManeuver","power":"FR",
 "args":{"kind":"landBattle","from":"picardy","to":"belgium",
 "battle":{"kind":"land","attacker":"FR","defender":"FR","from":"picardy","to":"belgium"}}}
```

### 原因

- `rules.ts#hostileOwner` 对没有 `minorController` 的小国仍返回 `true`；`legalLandBattleTarget` 在大战状态（`G.gw !== null`）下对所有小国返回 `true`。
- 引擎没有独立的 32.4“对非玩家宣战”动作，也没有把被宣战小国加入大战阵营的记录，因此攻击中立小国不会被拒绝。
- `combat.ts#beginLandBattle` 在防守方是“单独的非玩家”时，用 `defender = ... ?? actor` 作为记账回退；于是日志/UI 把攻击方显示成防守方，看起来像“自己打自己”。

### 影响

- 玩家可以在大战中免费攻击任何中立小国，绕过 32.4 的宣战、反对同盟获得盟友标记、以及 30.2 的非玩家投降/同盟继承流程。
- 战斗日志和战报会把“对中立小国”的战斗误报为同阵营内战，影响复盘和规则核对。

### 建议

1. 增加大战期的 32.4 宣战入口/动作，把目标小国记录为大战的非玩家交战方，并由反对同盟放置盟友标记。
2. 在未宣战前，`hostileOwner`/`legalLandBattleTarget` 不应把该小国单位视为可攻击目标。
3. `beginLandBattle` 的 `defender` 回退应保留“非玩家防守方”身份（例如 `defenderMinor`/`defenderLabel`），不要用攻击方填充。

## 4. 问题 2（高，已修复）：15.4 盟国小国单位被当成敌人

### 规则

**15.4**：“Minor powers that are allied to a player move as a part of their controlling player's march, rail, and naval movement actions.”

盟国小国的单位属于其控制玩家的友军，不能被该玩家或其盟友攻击。

### 现象

修复前的固定种子运行中出现：

```text
FR 从 London 攻击 Netherlands，日志 defender = AU
```

Netherlands 当时是 AU 的盟国小国；FR 与 AU 同属 TE，本不应发生这场战斗。根因是 `hostileOwner` 对任何非玩家 owner（包括有控制者的小国）都返回 `true`。

### 修复

`src/imperialElegy/engine/rules.ts#hostileOwner`：先解析 `minorController`；有控制者时按 `atWar(power, controller)` 判断。没有控制者的小国和叛军仍保持原有的宽松处理。

### 回归测试

新增 `src/imperialElegy/alliedMinorHostility.test.ts`（4 条）：

- 自己控制的小国不是敌人；
- 盟友控制的小国在 GW 中不是敌人；
- 敌国控制的小国是敌人且可以开战；
- 控制者不能对自己的小国发起陆战。

## 5. 问题 3（中，已修复）：28.1 战壕地形被写成 28.1.1 战壕战标记

### 规则

- **28.1**：“At the start of GW turn 1 all keys automatically contain trenches.”
- **28.1.1**：战壕战标记有三种状态（Attacker Advantage / Deadlock / Defender Advantage），由“armies attacking into a space containing trenches”后放置。

也就是说，战壕地形 ≠ 战壕战标记；没有发生战斗的关键区不应出现在“战壕战”列表里。

### 现象

修复前 `beginGwTurn` 在放置地形时同时写入：

```ts
gw.trenches[def.id] = state.trench?.status ?? gw.trenches[def.id] ?? "deadlock";
```

结果 `G.gw.trenches` 在第 1 回合就包含全部 107 个关键区，`trenchRows`（战争页的“战壕战”列表）会列出 107 行“僵持”。日志只说明 `trenchesPlaced count = 107`，并没有 107 场战壕战。

### 修复

- `src/imperialElegy/engine/greatWarFlow.ts#beginGwTurn` 和 `src/imperialElegy/engine/greatWar.ts#beginScenarioGw` 只写 `trenchLine = true`，不再写 `gw.trenches`。
- `G.gw.trenches` 只由 `setTrenchBattleMarker`（真实战斗）写入；`trenchRows` 在没有标记时保持空列表。
- 更新 `trenchCreation.test.ts` 与 `legacySaveFlows.test.ts`，并在 `trenchCreation.test.ts` 增加 `trenchRows(G) === []` 的断言。

## 6. 问题 4（中，测试基础设施）：外交谈判死锁

### 现象

真实引擎在 9.1 要求所有幸存席位先完成 `finishNegotiation`，之后才允许 `pileHomeCard`。原 harness 的 `actingSeatFor` 在外交阶段始终返回当前玩家，导致同一个席位：

1. `finishNegotiation`；
2. 立刻尝试 `pileHomeCard`；
3. 被 `negotiationConcluded` 拒绝；
4. 重复三次后判定 `stall`，整局停在第 1 回合外交。

### 修复

`tools/ie-sim/harness.ts`：在外交阶段先扫描所有 `negotiationDone === false` 的席位，按席位顺序派发 `finishNegotiation`，然后再让 bot/玩家选本土牌。与本地热座 6 人逐个点“结束谈判”的流程一致。

## 7. 已验证正常的部分

- 战役 1–3 回合的 `prep → diplomacy → action → end` 顺序；第 3 回合结束阶段进入危机。
- 23.0–23.5：`IE-A017` 掷出 `International Conference` 后 WTT 未爆，`IE-A071` 第二次危机才爆发；`greatWarOutbreak` 记录的事件、阵营、中立国与日志一致。
- 25.1 弃掉全部行动牌/本土牌；25.5 每个玩家补到 3 张 NG；25.7 战役玩家顺序与 GW 顺序。
- 29.3：GE、RU 在冬季加入 TA，先移除奖励行动标记，再按“下一个空位”加入；免费重新部署/部署预备军均产生日志。
- 29.2：每回合非洲/亚洲殖民战争、殖民地转移、殖民奖励 CP；本局 TE 控制两洲，奖励 3 CP 归 UK。
- 31.0：GW 第 5 回合结束后无中立玩家，按最高稳定度判 UK 获胜；`result.reason = gwTurnLimit:stability`，与规则一致。

## 8. 复现

```sh
# 固定种子整局（约 35 秒）
npx jest --testPathPatterns "tools/ie-sim/fullGame" \
  --testPathIgnorePatterns "/node_modules/" --runInBand

# 15.4 回归
npx jest --testPathPatterns "src/imperialElegy/alliedMinorHostility" --runInBand

# 28.1 回归
npx jest --testPathPatterns "src/imperialElegy/trenchCreation" --runInBand
```

测试文件：`tools/ie-sim/fullGame.test.ts`。种子固定为 `IE-FULL-2`，两次运行得到同一 `steps`/reason/winners/scores（本机实测 701 步）。

## 9. 限制

- 本局为覆盖大战主线，开启 `war` 与 `aggressive`，但没有开 `navy`/`amphibious`；海战与两栖登陆仍由 `tools/ie-sim/navy.test.ts`、`amph.test.ts` 单独覆盖。把它们并入整局会引入 harness 的军舰/登陆启发式拒绝，掩盖规则问题，因此没有混入本报告。
- 问题 1 的完整修复需要新增 32.4 的大战宣战子系统（非玩家交战方列表、反对同盟盟友标记、30.2 继承），本次只记录并给出复现，没有做半成品实现。
