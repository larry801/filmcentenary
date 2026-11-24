# Virgin Queen：不变量检查 + 属性型（property-based）模拟测试

本文说明 `tools/vq-sim/` 下新增的规则不变量测试与生成式模拟测试：每条不变量对应
2024 Living Rules 的具体条款，每个用例都能用 seed 复现，失败会给出最短前缀。

## 1. 为什么在自对弈之外再加一层

`tools/vq-sim` 已有的 seed 自对弈（`harness.ts` + `sweep.test.ts`）回答的是
“引擎是否接受热座棋盘给出的这个操作”。它能抓到**被拒绝的操作**和**死锁**，
但抓不到“操作都合法、棋盘状态却违反规则”这一类问题，例如
同一张牌同时出现在两个区、某势力兵力超过印刷上限、外交战争只写了一半。

新加的两层正好补上这个缺口：

| 层 | 文件 | 回答的问题 |
| --- | --- | --- |
| 规则不变量目录 | `invariants.ts` | 每一步之后，棋盘是否仍满足规则？ |
| 生成式属性测试 | `properties.ts` + `property.test.ts` | 在大量 seed/scenario/座位数下是否始终满足？ |
| 变异测试 | `invariantMutation.test.ts` | 每一条不变量是否真的会在被破坏时报错？ |
| 待决窗口一致性 | `pendingWindow.test.ts` | `pendingDecider` 列出的窗口是否真的会阻塞操作？ |

## 2. 不变量的分层与规则出处

`INVARIANTS` 里每一条都带 `rule` 字段（规则书章节号）和 `tier`：

- **A 级（硬失败）**：棋盘自身的记账关系。违反即 bug。
- **B 级（规则审计）**：规则书写明了、但引擎状态表达比印刷规则更宽松的地方。
  这些仍然每次都跑，但只做记录（`AUDIT ...`），不判定失败——否则会把
  “引擎有意简化”的既有设计当成缺陷。

| 不变量 id | 规则 | 级别 | 检查内容 |
| --- | --- | --- | --- |
| `cards.single-copy` / `cards.known` / `cards.hand-unique` | 6.2 | A | 同一张实体牌只能在 deck / discard / removed / futureDeck / homeSetAside / 手牌 / 春季暗置区 之一；卡号必须在牌表内 |
| `cards.home-aside` | 10.5 | A | 春季暗置区只能是本势力的 Home 卡 |
| `treasures.mix` / `treasures.values` / `treasures.vp-never-discarded` | 6.3 | A | 30 枚宝藏按面值印刷配比；1 VP 宝藏不进弃牌堆；面值必须是 1–5 或特殊标记 |
| `counters.cp` / `counters.vp` / `counters.ruler` / `markers.scm` | 5 / 11 / 25.2 / 2.4 | A | CP、VP 加成、统治者修正、SCM 标记为整数且非负 |
| `influence.cap` | 24.5 | A | 每个小国影响力 0–9 |
| `units.land` / `units.naval` / `units.naval-lost` | 5.3 / 5.4 / 17.3 | A | 所有陆地/海上/损失计数为非负整数 |
| `piracy.actions` | 16.4 | A | 每势力每回合海盗行动 ≤ 3 |
| `zones.space` / `zones.sea` | 2.1 / 2.5 | A | 状态里的地区/海域必须与地图定义一一对应 |
| `leaders.location` / `leaders.single-place` / `leaders.known` | 5.1 | A | 将领的 `location` 与棋盘列出的位置一致，且只出现一次 |
| `leaders.captured` | 14 | A | 被俘将领必须有合法俘获方 |
| `leaders.kind` | 5.1 | A | 纯陆军将领不能在海上；纯海军将领不能在内陆 |
| `naval.port` / `naval.inland-port` | 16.1 / 16.7 | A | 内陆地区/内陆港（Antwerp、Rotterdam）不能有舰队 |
| `control.valid` / `religion.valid` | 2.2 / 2.3 | A | 控制者与宗教取值合法 |
| `siege.besieger` / `siege.clock` | 15 / 15.1 | A | 围城方必须是主要势力；围城起始冲动不晚于当前冲动 |
| `siege.fortified` / `siege.garrison` | 15 | B | 围城只在设防地区；城内 ≤ 4（规则同时允许解围战临时超限） |
| `diplomacy.wars` / `diplomacy.symmetry` | 9.4 | A | 战争是对称的、不重复、不对自己开战 |
| `diplomacy.allies` / `diplomacy.symmetry` / `diplomacy.war-and-ally` | 9.2 | A | 同盟对称、不重复、不与战争并存 |
| `diplomacy.minors` / `diplomacy.activated` | 24.2 / 23 | A | 小国只能被一家结盟；激活的主要势力必须有席位 |
| `piracy.zone` / `piracy.zone-cap` | 16.4 | A | 每海域每回合最多 2 家海盗；不得重复 |
| `espionage.informant` / `espionage.assassination` | 19.2 / 19.3 | A | 同一目标只能有一个情报员；刺杀每回合一次 |
| `patronage.once` | 22 | A | 同一赞助类型本回合只能使用一次；待结算赞助人不重复 |
| `turn.year` / `turn.impulse` / `turn.passes` / `turn.counters` | 7 / 11 | A | 年份在剧本区间内；连续过牌不超过座位数；回合计数为非负整数 |
| `vp.history` / `vp.derivation` | 25.2 / 25.3 | A | VP 记录合法；VP 总分等于各项之和 |
| `pending.owner` | 7 | A | 任何阻塞待决窗口的势力必须有控制席位（否则棋盘没有按钮可点） |
| `victory.reason` / `victory.power` / `victory.seat` / `victory.standard` / `victory.domination` / `victory.time-limit` / `victory.automatic` | 25 | A | `gameover` 与规则 25 的判定一致 |
| `force.land` / `force.naval` / `force.walloons` / `force.minor` | 17.1 / 17.2 / 17.3 / 24.3 | B | 陆地/海军棋子池不超印刷上限（规则 5.3 的“同一批实体棋子”模型），瓦隆 ≤ 3，小国按 24.3 |
| `religion.core-presence` | 18.1 | B | 每个宗教区至少保留一个天主教区和一个新教区 |
| `virgin-queen.cap` | 21.2 | B | 处女女王 VP 奖励不超过规则上限 |

分级原因写在 `invariants.ts` 的模块注释里：B 级中的“兵力上限”在引擎里
由多张来源（图上、境外战争卡、损失堆、小国控制）汇总，而规则书的上限
是按**实体棋子**计数的；引擎有意把它们分开记账，所以这类偏差记为审计。

## 3. 生成式（属性型）模拟

`properties.ts` 对每个 seed 生成一场完整对局，并在**每一次操作后**检查：

1. **规则不变量**：A 级失败即测试失败；B 级输出 `AUDIT ...` 供报告使用。
2. **可序列化**：`JSON.stringify → parse → stringify` 必须逐字相等。
   boardgame.io 只同步 JSON，`Map`/`Set`/`Date`/`NaN`/`Infinity`
   会让客户端与服务端分叉。
3. **`playerView` 隐私**：对观战者和每个座位各生成一次视图，验证
   - 别人的手牌、宝藏、春季暗置区为空，且只暴露数量；
   - 自己的手牌不被抹掉；
   - deck / futureDeck / discard 内容为空，只暴露数量；
   - 面朝下的宝藏池不暴露面值；
   - 任何隐藏牌号不得出现在视图的其他位置（日志、待决标记等）。
     通过谍报合法获知的手牌（`espionage.inspections`）不计为泄漏。
4. **可继续**：跑到步数预算上限是正常的，但**提前停下**（`steps` 远小于
   `maxSteps` 且没有 `gameover`）说明流程卡死，属于失败——这正是 sweep 抓的那类
   死锁。若真的结束，最终 `gameover` 必须满足规则 25（标准胜/支配胜/
   时限胜/自动胜）。
5. **确定性**：同一 seed 必须产生完全相同的操作轨迹与状态快照。

配置矩阵（每个 seed 跑 4 种）：

| label | 剧本 | 座位 | chaos | 步数预算 |
| --- | --- | --- | --- | --- |
| `campaign-6` | campaign | 6 | 0（固定策略，覆盖最少分支） | 500 |
| `campaign-4-chaos` | campaign | 4 | 0.5（探索分支） | 350 |
| `tournament-2-chaos` | tournament | 2 | 0.5（激活主要势力流程） | 350 |
| `tutorial-2` | tutorial | 2 | 0.35（教学剧本与简化规则） | 300 |

步数预算不是“必须打完”：引擎每次操作都会深拷贝状态，约 200 ms/步，
所以预算按**覆盖多个年份**来定。`sweep.test.ts` 才是要求每局必须打完的那一层。

## 4. 失败复现与收缩

自对弈是确定性的（seeded RNG + 纯 reducer），所以**第一个**违反不变量的操作
就是最短失败前缀。`shrinkFailure(config, step)` 用 `maxSteps = step + 1`
重跑，并在测试输出里确认：

```text
campaign-4-chaos/VQ-PROP-1-c4x/campaign/4p/chaos=0.5/seed32=3806833348
  step 998/1259: [rule 16.1] naval.port: naval units in inland space paris
  (reproduced with maxSteps=999, seed="VQ-PROP-1-c4x")
```

手工复现：

```ts
runSeededGame({seed: "VQ-PROP-1-c4x", numPlayers: 4, chaos: 0.5, maxSteps: 999});
```

## 5. 变异测试：证明不变量真的会报错

`invariantMutation.test.ts` 先跑 seed 自对弈拿到**真实的**中局状态
（6 人局第 2 回合、2 人局第 1 回合），再用 23 个变异各注入一个具体的规则破坏：

| 变异 | 期望触发的 id |
| --- | --- |
| 一张牌同时进 deck 与法国手牌 | `cards.single-copy` |
| deck 里塞入不存在的卡号 | `cards.known` |
| 西班牙持 12 枚面值 5 的宝藏 | `treasures.mix` |
| 面值 9 的宝藏 | `treasures.values` |
| 法国 CP = −1 | `counters.cp` |
| 威尼斯影响力 = 12 | `influence.cap` |
| 西班牙陆地单位 = −2 | `units.land` |
| 状态里多出 `atlantis` 地区 | `zones.space` |
| 状态里多出未知海域 | `zones.sea` |
| 同一将领出现在两个地区 | `leaders.single-place` |
| 将领 `location` 与棋盘不符 | `leaders.location` |
| 内陆地区出现西班牙舰队 | `naval.port` |
| 巴黎控制者 = `nobody` | `control.valid` |
| 单方面战争 | `diplomacy.symmetry` |
| 一个海域三家海盗 | `piracy.zone-cap` |
| 同一目标两名情报员 | `espionage.informant` |
| 同一赞助类型本回合两次 | `patronage.once` |
| 围城方是巴伐利亚（非主要势力） | `siege.besieger` |
| 年份 = 99 | `turn.year` |
| 连续过牌超过座位数 | `turn.passes` |
| 无席位势力的待决窗口 | `pending.owner` |
| `gameover.winner` 与胜者席位不符 | `victory.seat` |
| 西班牙舰船超过印刷池 | `force.naval` |
| 法国陆军超过印刷池 | `force.land` |

外加一个基线用例：未变异的真实中局状态必须**A 级零违反**——否则变异测试
本身就失去了意义。B 级审计允许出现在健康棋盘上（它们记录的是“引擎表示比
印刷文本宽松”的地方，例如事件卡直接放置的兵力可以超出棋子池上限）。

### B 级审计的两个刻意豁免

- **教学剧本的兵力上限**：`TUTORIAL_POWER_CARDS` 给奥斯曼/西班牙的固定教学
  配置不按实体棋子池计数，所以 `checkForcePools` 在 `scenario === "tutorial"`
  时直接返回空。
- **统一棋子池**：`checkForcePools` 直接复用引擎的
  `landPoolLimit` / `navalPoolLimit` / `navalPoolUsed`，与 `buildLand`、
  `addLandFromPool` 的判断完全一致。规则 5.3 规定常规军、雇佣兵与奥斯曼
  骑兵共用同一批实体棋子，所以不能按单位类型分别设上限（这样的审计会误报
  合法建造）。
- **教学剧本的宗教区**：教学剧本只用棋盘的一部分，未启用的宗教区（英格兰、
  苏格兰、荷兰、法国）没有开局摆放，全部留在天主教并不能说明“新教已被消灭”。
  `checkReligion` 只在剧本实际使用的宗教区上做审计。

### `pendingDecider` 必须和 `moveError` 一致

`pendingDecider`（`invariants.ts`）回答“现在轮到哪个势力做决定”，自对弈 harness
用它推导当前行动势力。它只能列出 `moveError` **真的会阻塞**的窗口：一旦把
“冬季设置、春季 `onBegin` 才结算”的非阻塞窗口（HRE 冬季补充、天主教联盟）
也算进去，harness 会把回合派给错误的势力。

2 人局曾因此失败：`pendingHreReplacement` 让 harness 把回合判给 HRE，而引擎的
`chooseWinterReturn` 读取的是 `activePower`（西班牙），一次合法的冬季返还被拒绝。
现在 `pendingWindow.test.ts` 在短对局的**每一步**上断言：只要 `pendingDecider`
给出势力，`moveError` 就必须阻塞（或该窗口由 `ctx.activePlayers` 的 stage 承担）。

## 6. 本轮发现并修复的问题

1. **`pendingConversion` / `pendingScienceTreasure` 没有出现在自对弈策略里**，
   导致 `moveError` 阻塞 `pass`/`endImpulse` 而策略只反复请求 `endImpulse`，
   Action Phase 死锁（`decision.ts` 修复，同时 `harness.ts#decidingPower`
   补上这两个窗口）。
   现象：`VQ-SIM-3` 系列 4 个配置全部停在 `active=protestant/ottoman cp=0~2`
   的 `action` 阶段；`pendingConversion` 为 #32 加尔文宗狂热或 #37 教宗诏书
   打开的第 4 步选择。
2. **#34 神圣罗马的调解可以对自己宣战**：事件目标生成器没有排除 `hre`
   自身，日志出现“神圣罗马帝国 declares war on 神圣罗马帝国”，
   `diplomacy.wars`（规则 9.4）抓到了这个自战。
   修复：目标生成与 `resolveHolyRomanIntercession` 双重排除；
   回归测试 `hreIntercession.test.ts`。
3. **冬季窗口的判定过宽**：规则 20 只要求当前势力确认损失，冬季返还
   是可选的（自动安置即合法结果）。`pendingDecider` 原先对
   `winterReturnChoices[0]` / `winterNavalReturnChoices[0]` 报告“阻塞窗口”，
   2 人教学剧本第 2 回合 Card Draw 因此出现“无席位势力待决”的误报。
   现在只把**当前 activePower 的损失确认**算作阻塞窗口。
4. **非阻塞窗口被误当成待决势力**：`pendingHreReplacement`、`pendingCatholicLeague`
   在冬季设置、由春季 `onBegin` 自动结算，`moveError` 从不为它们拒绝移动。
   把它们列进 `pendingDecider` 后，2 人局（`VQ-SIM-3`）的 harness 把回合判给
   HRE，而 `chooseWinterReturn` 读的是 `activePower`（西班牙），合法返还被拒。
   `pendingDecider` 现在只列出真正阻塞的窗口；`pendingWindow.test.ts` 逐步
   断言它与 `moveError` 一致。

## 7. 运行方式

```sh
# 只跑不变量变异测试（约 1.5 分钟）
npx jest --testPathPatterns "tools/vq-sim/invariantMutation" \
  --testPathIgnorePatterns "/node_modules/" --runInBand

# 待决窗口与 moveError 的一致性（约 1 分钟）
npx jest --testPathPatterns "tools/vq-sim/pendingWindow" \
  --testPathIgnorePatterns "/node_modules/" --runInBand

# 属性型模拟：默认 1 个 seed、四种配置（约 8–12 分钟）
npx jest --testPathPatterns "tools/vq-sim/property" \
  --testPathIgnorePatterns "/node_modules/" --runInBand

# 更多 seed / 更长 soak（本地或手动 CI 用；每加一个 seed 约翻倍）
VQ_PROPERTY_SEEDS=VQ-PROP-1,VQ-PROP-2 VQ_PROPERTY_STEPS=1500 \
  npx jest --testPathPatterns "tools/vq-sim/property" \
  --testPathIgnorePatterns "/node_modules/" --runInBand

# 原有 sweep（6 种配置 / seed）
VQ_SEEDS=VQ-SIM-1 npx jest --testPathPatterns "tools/vq-sim/sweep" \
  --testPathIgnorePatterns "/node_modules/" --runInBand
```

`tools/` 不在 `yarn test` 的路径里（`jest.config.js` 有意排除，避免整套对局
拖慢本地与单元测试），所以以上命令都必须显式指定 `--testPathPatterns`。

## 8. 与规则书的对应

- `docs/VQ_RULES_EXTRACTION.md` 是条款编号来源；
- `VQ 2024 Living Rules Final Low-Res.pdf.txt` 是原文；
- 每条不变量的 `rule` 字段直接写章节号，报告里的 `[rule 16.1 naval.port]`
  可以直接回到原文对应段落。
