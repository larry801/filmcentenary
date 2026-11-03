# 宋金战争：未完成规则实现计划（执行中）

验证状态：`./node_modules/.bin/jest src/songJinn` 54 passed；`./node_modules/.bin/tsc --noEmit` exit 0。

---

## 一、已完成

### 第 1 步：奖励状态与 stage 骨架 ✅

- `constant/general.ts`：新增 `PendingReward` 枚举（RemoveUnit / RemoveGeneral / RemovePlan /
  RemoveNation / AdjustNation），`SongJinnGame.pending` 增加 `reward`、`province` 两个字段并在
  `setupSongJinn` 初始化。
- `constant/config.ts`：`StagedTurnConfig.stages` 补上 `removeUnit`、`removeGeneral`
  （原先只有 `removeNation` / `removeCompletedPlan` / `adjustNation`），并新增 S19 用的
  `chooseProvince` / `chooseCity`。
- `util.ts`：新增 `grantReward(G, ctx, pid, reward)`（写 `pending.reward` + 切 stage，重复授予打 warning）
  与 `finishReward(G, ctx, reward)`（清标志 + `endStage()`）。

### 第 2 步：六个计划奖励 ✅

| 计划 | 实现 |
| --- | --- |
| J04 / J13 调整 1 个其他国家外交 1 级 | 进入 `adjustNation` stage；`adjustNation` 守卫 stage + 未移出的国家，结算后 `endStage`，天然只允许调 1 次 |
| J06 消灭总共 2 耐久度的部队 | 进入 `removeUnit` stage；`removeUnit` 用**单位基础耐久表**累计，超过 `REWARD_REMOVE_UNIT_BUDGET` 返回 INVALID_MOVE |
| J16 将 1 个在场将领移出游戏 | 进入 `removeGeneral` stage；只允许移除在场的己方将领 |
| J17 将 1 个已完成计划移出游戏 | 进入 `removeCompletedPlan` stage；**去掉 `client: false`**（否则客户端根本调不到），收紧为只删自己的计划 |
| J18 将 1 个其他国家移出游戏 | 进入 `removeNation` stage；不能选已移出的国家 |

`util.ts` 里另加 `baseUnitEndurance(G, ctr)`，`troopEndurance` 改为复用它再叠加地形修正（行为不变）。

### 第 3 步：S19 岳飞登场 ✅

- `moves.ts` 新增 `chooseProvince`（淮南两路 / 荆湖两路，写入 `pending.province`）与
  `chooseGeneralCity`（该路的 capital / other 城市，`moveGeneralByPid` 放岳飞，清 pending、`endStage`）。
- `util.ts` S19 的 `event` 补上 `changePlayerStage(..., 'chooseProvince', 宋国玩家)`。
- `components/operation.tsx` 新增两个选择框，用 `actualStage(G, ctx) === 'chooseProvince' / 'chooseCity'` 控制显示。

### 第 5 步：确定性缺陷 ✅

- `game.ts`：`diplomaticVictory === Country.SONG` 的 winner 从 P2 改为 **P1**。
- `constant/config.ts`：`G.secret.planDeck.concat(player.plans)` 改为 `push(...)`（原先返回值被丢弃，
  选不出来的计划牌会凭空消失），并把 `filter(...)` 的数组真值判断改成 `.length === 0`。
- `moves.ts`：删掉 `confirmRespond` 里 `ZhuDuiShiY` 分支那段会 pop 掉待结算事件并直接 `return` 的
  空 switch（它既丢事件，又让玩家在驻队矢远程阶段无法响应）。

### 第 6 步：测试 ✅

新增 `src/songJinn/reward.test.ts`（15 个用例）：六个奖励计划各自进入正确 stage、奖励给完成计划的
一方、不需要选择的奖励仍直接生效、`removeUnit` 的 2 点耐久预算与 stage 守卫、基础耐久表、
计划牌堆回收守恒、外交胜利归属。

### 第 7 步：客户端按 stage 显示 ✅

原先这几个奖励选择框永远显示（`show={isActive}`），玩家在任何阶段点了都会失败。现在都按
`actualStage(G, ctx) === '<stage>'` 控制：

- `components/adjust.tsx`：`removeNation`（J18）、`adjustNation`（J04/J13）、
  `removeCompletedPlan`（J17）；其中 J17 的候选列表从「双方已完成计划」收紧为「自己的」。
- `components/troops.tsx`：`removeGeneral`（J16，只列在场将领）、`removeUnit`（J06）。

---

## 二、未完成 / 需要数据

### 驻队矢的「岳飞」「减损」（`PendingEvents.YueFeiZhuDuiShi` / `JianSunZhuDuiShi`）

仓库内没有这两项的规则文本，无法凭猜测实现：

- `《宋金战争》 精编版规则书20200106（征求意见稿）(1).pdf`（39 页）已用 pypdf 抽全文核对：
  规则书只有**通则**，没有卡牌与将领卡的文字。其中与岳飞相关的两条：
  - 8.4.5 交锋阶段 i：伤害修正可能受「将领韩世忠、**岳飞**、奔睹、金国军事等级7 或战斗牌【岳家军】」影响
    —— 岳飞的伤害修正到底是几点，PDF 里没有数值。
  - 8.4.6 鸣金阶段：进攻军团中有岳飞或兀术时可选择继续作战；**防守方军团中有岳飞时，可在进攻方选择前
    声明继续作战** —— 这一条代码里已经实现（`canForceRoundTwo()` + `mingJin()` 先把响应权给防守方）。
- 需要补齐的数据：岳飞将领卡的技能文本、以及「减损」的出处（另一张将领卡？还是军事等级 7 的持续奖励
  「远程阶段和交锋阶段受到的伤害减1」，见规则书 5.1.9？）。
- 拿到文本后可照第 1～3 步的同一套做法实现：在对应战斗阶段写 `pending.events`，在
  `moves.ts` 的 `ZhuDuiShiY` / `JiaoFeng` 分支结算。

### 其它已知未做（不在本轮范围）

- 规则书 8.4.3/8.4.5 要求「受创结算完毕后立刻结算**岳飞、战斗牌【劝降】和【岳家军】的征募效果**」，
  代码里 `SongBaseCardID.S36`（岳家军）的 `pre` 恒为 false、`event` 是空实现，这条还没做。
- `constant/{setup,combat,plan}.ts`、`components/opponent-troop.tsx` 是空文件（无引用），可删可留。
- `util.ts` 里其余 TODO：`getSupplyAdj` 的递归补给检查、`getMarchDst` 的周行特例、
  `getTerrainTypeByPlace` 对外国地形的耐久（140 行）。

---

## 三、第二轮：按规则书补的行动（已完成）

读到规则书 PDF 全文后，又找出并修掉了三个「规则书写了、代码没做」的地方。

### 第 8 步：贴军（规则 7.7）✅

原实现只把牌从手里删掉，什么也不做（`tieJun`）。现在按规则实现：

- 打出一张事件牌，**等价支付征募消耗的行动力**，把预备兵区的部队直接补充上场；
- 遵守补充规则（不能放进被围困的城市 —— 新增 `cityIsBesieged`）；
- **不受殖民能力限制**（目标城市不筛 `colonizeLevel`，与补充阶段不同）；
- 没有征募许可的兵种不能贴军 —— 新增 `canRecruitUnitType`（签军需要【大起】类事件解锁）；
- 城市要换算成所在区域再放置，否则会新建一个「驻扎在城市上」的军团而无法与已有军团合并；
- UI：金国手牌里的「贴军」按钮接上 选城市 → 选预备部队 两步对话框（`player-hand.tsx`）。

### 第 9 步：派遣（规则 7.5）✅

原先点了「派遣」也只是把牌丢掉，而且 `moveGeneral` 没有任何校验。现在：

- `paiQian` 校验手牌、可派遣将领（在场且军团没有被围困），弃牌并置 `G.pending.dispatch`；
- `moveGeneral` 必须处于派遣状态，目标必须是**本方军团所在的区域或关隘边界**且没有被围困；
- 新增 `getDispatchableGenerals`（在场 + 未被围困）、`generalIsBesieged`、`getDispatchDsts`、`placeIsBesieged`；
- **修掉一个真 bug**：move 的函数名是 `paiQian`，但 `config.ts` 里从未注册、UI 调的是 `moves.paiQIan`，
  两边对不上 → 客户端拿到的 `moves.paiQIan` 是 undefined，按钮点了完全没反应。现已统一为 `paiQIan` 并注册；
- UI：`player-hand.tsx` 接上 选将领 → 选目标区域 两步对话框。

### 第 10 步：modifyGameState 静默失效 ✅

`modifyGameState` 里写的是 `G = merge(G, arg)`：这把 Immer 的 draft 换成了普通对象，
**之后所有修改都不会被提交**，等于这个 move 一直是空操作（测试里用它准备的场景其实都没生效）。
改为就地深合并（`deepMergeInto`）。这个是查 派遣 问题时顺藤摸瓜发现的。

### 第 11 步：测试 ✅

新增 `src/songJinn/action.test.ts`（12 个用例）：围困判定（城市/位置/将领）、贴军的行动力与许可校验、
不能贴军到被围困城市、派遣的完整流程与三类拒绝（没打牌 / 目标没有本方军团 / 将领被围困）。

总数：**47 个用例全绿，`tsc --noEmit` 干净**。

---

## 三、本轮继续实现

### 第 12 步：补充阶段（规则 5.2.8）✅

- `DeployPhaseConfig.onBegin` 自动结算缺乏补给、围困城市损耗、银术可额外损耗和腐败预备部队。
- `deploy` 只允许在补充阶段向本方控制且未被围困/未邻接交战区的城市放置部队，并校验城市补给等级、编制上限和金国殖民状态。
- `deployGeneral` 只允许把预备将领放入合法补充城市；补充阶段的城市选择框同步收窄到合法目标。
- 新增 `replenish.test.ts`，覆盖腐败、断补、围困、城市上限、殖民和将领补充。

### 第 13 步：胜负与受创校验 ✅

- 实现【建炎南渡】后金控制两浙路的【国破家亡】胜利。
- 绍兴和议计分加入盟国；平分时按宋国政策倾向决定胜负。
- 特殊作战计划不可被夺取，并按对应阵营控制的城市计算特殊分数。
- `takeDamage` 校验玩家、阶段、数组、部队数量和待结算伤害，拒绝用零受创绕过伤害结算。
