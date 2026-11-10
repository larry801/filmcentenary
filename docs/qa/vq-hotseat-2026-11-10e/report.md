# Virgin Queen 本地热座：新教宗教胜利路径与规则/UI 修复（第五轮）

- 日期：2026-11-10
- 基线：`205c71f` 之后的工作区（含上一轮未提交修复）
- 环境：Chromium 1440×900，`yarn start`，`http://127.0.0.1:5173`
- 入口：`/localVQ` → Tournament · 荷兰起义开始 · 6 人
- 范围：六国逐座位操作，其他玩家不压制新教、英格兰主动在英格兰镇压异端（=新教转化），新教打出转化事件并连续布道；从第 3 回合 Card Draw 推进到新教地区轨超过 50，触发即时新教宗教胜利

## 1. 结论

| # | 严重度 | 类型 | 问题 | 状态 |
|---|---|---|---|---|
| R1 | 高 | 规则/地图数据 | 法国宗教斗争区缺少巴黎、鲁昂、亚眠、第戎、马赛、波尔多、南特、布雷斯特、加来、梅斯的 `area` 标记。这些地区无法成为新教转化目标，也不计入新教地区轨/宗教特殊 VP，导致宗教胜利在数据上几乎不可达 | 已修复 |
| U1 | 中 | UI/本地化 | 新教转化掷骰提示显示中英混排 `新教联盟 conversions in 法国: [...]`；名称替换先于规则匹配，导致转化规则失配，通用 `label: [dice]` 规则抢先命中 | 已修复 |
| U2 | 中 | UI/规则可见性 | “场景与胜利条件”只显示“新教地区 N”，没有显示超过 50 即新教宗教胜利的门槛，热座玩家无法判断宗教胜利进度 | 已修复 |
| U3 | 低 | 文案/规则 | 新教宗教胜利文案写成“超过半数宗教地区”，实际规则是“新教影响超过 50 个地区”；天主教宗教胜利文案同样不准确 | 已修复 |
| U4 | 低 | UI/热座 | 对局结束时最近掷骰提示仍浮在结束面板/手牌上方，结束时应清除 | 已修复 |

本轮修复前，同类对局的新教地区轨在第 5–6 回合停在 46 左右，最终以时限/支配胜利结束；修复后同一路径在 Tournament 第 5 回合达到 51 并立即由 P6 新教联盟获胜。

## 2. 修复明细

### R1 法国宗教斗争区缺失地区

规则 18.5 的官方示例明确把 **巴黎** 和 **第戎** 作为法国地区的转化目标；规则 20.10 与代码中的 `inFrenchReligiousArea()` 也把“法国本土地区 + 法国境内的胡格诺本土地区 + 梅斯”视为法国宗教斗争区。但地图数据只给其中一部分地区写了 `area: "france"`，遗漏：

- `paris`、`rouen`、`amiens`、`dijon`、`marseille`、`bordeaux`、`nantes`、`brest`、`calais`、`metz`

修复：

- `src/virginQueen/constant/spaces.ts`：为上述 9 个重建地图地区补 `area: "france"`。
- `src/virginQueen/data/spaces.ts`：为 Scenario Book 追加的 `calais` 补 `area: "france"`。
- 法国宗教区总地区数 48 → **58**；Campaign 开局地图新教数 7 → **9**，Tournament 20 → **21**；印刷的新教地区轨起始值仍为 **18 / 30**，通过差值联动保持正确。
- `src/virginQueen/scenarioReligion.test.ts`：新增“所有法国本土地区 + 梅斯都在法国宗教区”的回归断言，并锁定 Campaign/Tournament 的开局地图计数。

修复后两次实测分别出现 `Converted: Paris, Metz, Dijon, Nimes, Reims.` 与 `Converted: Calais…; Converted: Brussels, Maastricht, Lille.`，证明巴黎、第戎、梅斯、加来等新增地区已真正进入转化目标池。

### U1 新教转化提示中英混排

`localizeLogLine()` 会先把 `protestant` 替换为“新教联盟”，而转化规则原只接受 `([a-z]+)`，于是：

1. 规则对已替换文本失配；
2. 通用规则 `/^([^:]+): \[(.+)\]$/` 命中，输出 `新教联盟 conversions in 法国：[…]`；
3. 原始文本回退永远没有机会执行。

修复：

- `logText.ts` 的转化规则接受 `protestant | 新教 | 新教联盟 | 天主教`；
- `religion()` 将“新教联盟”归一为“新教”；
- `DiceToast` 的 `aria-label` 也改用本地化文本，避免屏幕阅读器读英文；
- `i18n.test.ts` 与 `DiceToast.test.tsx` 新增新教转化摘要断言。

### U2 场景面板显示宗教胜利门槛

- 新增 locale 键 `vq.intel.protestantSpacesGoal` / `protestantSpacesGoalHint`（中英双语）。
- 场景面板由“新教地区 30”改为“新教地区 30 / 51”，并在 `title` 中说明“超过 50 个时立即取得新教宗教胜利”。
- `board.test.tsx` 新增面板断言。

### U3 胜利原因文案

- 新教：`Protestant influence over 50 spaces` / `新教影响超过 50 个地区`。
- 天主教：`Protestant spaces reduced to 9` / `新教地区降至 9 个`。
- `i18n.test.ts` 新增两条断言。

### U4 结束面板清除掷骰提示

对局结束后 `DiceToast` 不再接收 `G.lastRolls`：

```tsx
<DiceToast rolls={ctx.gameover === undefined ? G.lastRolls : undefined}/>
```

避免最近一次转化骰面提示继续覆盖结束面板或手牌。

## 3. 完整对局路径

1. 打开 `/localVQ`，选择 Tournament · 荷兰起义开始 · 6 人；第 3 回合开局，新教地区轨 30。
2. Card Draw / Diplomacy / Spring：六国依次结束；处理返回海军将领、HRE 宗教倾向、保留本国牌。
3. Action：
   - 其他玩家不针对新教，按规则出牌换 CP 后结束行动轮次；
   - 英格兰使用 **Suppress Heresy（英格兰）**，这是英格兰地区的新教转化；
   - 新教优先把 `加尔文宗狂热`、`比利时信条` 等新教转化事件作为事件打出，再用剩余 CP 在法国/尼德兰/苏格兰布道；
   - 法国、尼德兰、苏格兰的候选地区逐步耗尽后转向英格兰/其他地区。
4. 新教地区轨：30 → 37 → 44 → 48。第 5 回合新教打出 `加尔文宗狂热`：法国转化 **加来**，尼德兰转化 **布鲁塞尔、马斯特里赫特、里尔**，轨道达到 **51**。
5. 转化动作结束后 `checkVictory` 返回：

```json
{"winner":"5","power":"protestant","reason":"protestantReligious"}
```

6. 结束面板：`对局结束 · 胜者：P6 新教联盟` / `原因: 新教宗教胜利：新教影响超过 50 个地区`。

## 4. 规则复核

- **门槛**：官方“over 50 spaces”为 51+；代码 `n > 50` 与 UI `/ 51` 一致。
- **即时胜利**：转化动作结束后 `checkVictory` 返回新教宗教胜利。
- **动荡**：`protestantSpaceCount` 不计动荡地区，符合“Spaces in unrest are never included”。
- **法国区**：巴黎、第戎、梅斯等已进入转化池；`Converted: Paris, Metz, Dijon…` 为直接证据。
- **开局轨道**：地图计数变化后仍从 18 / 30 起算，宗教特殊 VP 与地图差值联动。
- **其他胜利**：本轮未再出现军事/支配/时限胜利抢先结束；新教宗教胜利为合法即时胜利。

## 5. 验证

- `./node_modules/.bin/tsc --noEmit`：通过
- `./node_modules/.bin/jest --silent --runInBand`：215 suites / **1238 tests** 全部通过
- `./node_modules/.bin/playwright test e2e/hotseat.spec.ts e2e/diplomacy.spec.ts e2e/tutorial.spec.ts e2e/map.spec.ts e2e/local-smoke.spec.ts`：14 tests 全部通过
- `yarn build`：通过
- 本地热座实测：Tournament 6 人，六国操作，新教地区轨 30 → 51，P6 新教联盟即时宗教胜利；结束面板与掷骰提示均为中文

## 6. 证据

- `01-protestant-spaces-goal.png`：Tournament 开局场景面板显示“新教地区 30 / 51”
- `02-religious-victory.png`：结束面板“P6 新教联盟 / 新教宗教胜利：新教影响超过 50 个地区”
- `03-victory-toast.png`：最后一次转化的掷骰提示已本地化为“新教 在 尼德兰 的转化：[…]”
- `04-gameover.txt`：结束状态、轨道值与最后转化日志

## 7. 后续建议

1. 继续补宗教路径的玩家选择：18.5 第 4 步“用 6 降为 5 抵消 1 个动荡”目前由引擎自动处理，未提供选择；动荡落点也未让玩家选择。可加入确认/选择面板。
2. 新增地图地区时，建议在数据测试中强制检查：法国本土地区与梅斯必须有 `area: "france"`，避免再次出现“可转化但不在宗教区”的数据遗漏。
3. 继续覆盖宗教事件链：破坏圣像运动、胡格诺派大斋期、天主教联盟成立后的法国转化与叛乱联动。
4. 热座结束态可继续补充：结束面板出现时清空所有临时提示（本轮已清掷骰提示，确认框在上一轮已清）。
