# Virgin Queen 本地热座试玩 QA 与修复记录

- 日期：2026-11-10
- 版本：当前工作区（基线 `78a4a7f`，Vite 8.3.5 / boardgame.io 0.49.13）
- 环境：Chromium 1440×900，`yarn start`，`http://127.0.0.1:5173`
- 试玩入口：`/localVQ`（Campaign · 拉罗谢尔之围 · 6 人）与 `/localVQ/tutorial`（勒班陀海战 · 2 人）

## 1. 结论摘要

| # | 严重度 | 类型 | 问题 | 状态 |
|---|---|---|---|---|
| R1 | 高 | 规则 | “结束行动轮次”在未出牌时被当作 pass，但绕过“本国牌未打出”“手牌超过行政评级”两条禁止 pass 的规则 | 已修复 |
| R2 | 高 | UI/规则提示 | 强制事件/响应牌/战斗牌在手中统一显示为“行动牌”；持有强制事件时仍可点结束按钮，确认后静默失败 | 已修复 |
| U1 | 中 | UI | 西班牙面板外交“目标强国”下拉为空白，并持续输出 MUI out-of-range 警告 | 已修复 |
| U2 | 中 | UI/日志 | 日志阶段标题显示“回合 46 · 2 · 行动阶段”，把 boardgame.io 内部 turn 当成游戏回合 | 已修复 |
| U3 | 中 | 本地化 | 多条日志仍为英文或中英混排 | 已修复 |
| U4 | 中 | UI/反馈 | 行动完成后模式不退出；0 CP 时点地图触发 invalid move，界面无提示 | 已修复 |
| U5 | 低 | 热座 UX | 响应窗口/HRE 冬季选择在别的玩家面板上只显示“等待”，没有“切换到 PX”提示 | 已修复 |
| U6 | 低 | 教程文案 | 教程提示句末出现“。.”；教程第一步手牌含强制事件，文案只教“作为 CP” | 已修复 |
| U7 | 低 | UI | 顶栏“当前：英格兰 西班牙 · 0 CP”没有说明第二个势力是当前查看面板 | 已修复 |

本次流程推进正常：第 1 回合 Card Draw → 外交 → 春季部署 → 行动 → 冬季自动结算 → 第 2 回合，VP 与日志均更新；强制事件、响应窗口、冬季补员、征募、教学前 3 步都能走通。

## 2. 修复内容（R1 / R2 / U1–U7）

### R1 pass 规则守卫

规则书 Section 11 / Passing：

> Powers may never pass if: Their Home card has not been played, A Mandatory Event is in their hand that has not been played, or They have more cards in their hand than their ruler's Administrative Rating.

修复前：

- “跳过” → `moves.pass()`：检查强制事件和行政评级，漏了本国牌。
- “结束行动轮次” → `moves.endImpulse()`：未出牌时等价于 pass，但只检查强制事件，连行政评级也不检查。

修复：

- `src/virginQueen/moves.ts` 新增 `passBlock(G, p)`，统一返回 `"played" | "mandatory" | "home" | "admin" | undefined`。
- `pass` 和 `endImpulse` 的未出牌分支都调用 `passBlock`。
- “出牌后结束 impulse”仍然允许（`cardPlayed` 为真时 `endImpulse` 不套用 pass 限制），但“出牌后再点跳过”会被拒绝。
- UI 的“跳过”/“结束行动轮次”在会被拒绝时禁用，并在按钮上方用 `role="status"` 显示具体原因。

新增/调整的回归测试：

- `passAdminRating.test.ts`：本国牌、行政评级、出牌后结束、出牌后 pass 共 5 个新用例。
- `board.test.tsx`：卡牌类型标签、强制事件时两个按钮禁用共 2 个新用例。
- `virginQueen.test.ts` / `cardEvents.test.ts` / `twoPlayer.test.ts`：旧的“全 pass”模拟按新守卫改写（先打强制事件、本国牌或烧牌）。

### R2 卡牌类型与强制事件提示

修复前：

- 手牌标签只有 `home` / `event` / 其他三个分支，导致 `mandatory`、`response`、`combat` 全部显示为“行动牌”；卡面本身却写着“强制事件牌”“响应牌”。
- 持有强制事件时“结束行动轮次”仍可点；确认后对话框关闭、局面不变，控制台重复 `ERROR: invalid move: endImpulse`，没有 toast。第 1 回合法国因此连续点击多次（累计 16 次错误）。

修复：

- `cardKindLabel` 按 `officialKind` 输出“本国牌 / 事件牌 / 强制事件牌 / 响应牌 / 战斗牌”，手牌托盘和卡牌详情共用。
- 持有强制事件且未出牌时，两个结束按钮禁用并显示“请先打出强制事件：XXX”。
- 出牌后“跳过”禁用（提示“本回合已出牌，请用结束行动轮次”），“结束行动轮次”恢复可用。

UI 复核：

- `12-fixed-mandatory-panel.png`：强制事件“德意志的介入”在手时，两个按钮禁用并显示红色原因。
- `13-fixed-after-event-panel.png`：打出该事件后，“结束行动轮次”恢复，“跳过”禁用，状态提示消失。

### U1–U7 UI 修复

- **U1**：新增 `legalDiplomacyTarget`，把目标 clamp 到合法敌方；西班牙面板自动选中“奥斯曼帝国”，MUI `out-of-range value spain` 警告降为 0。
- **U2**：日志标题改用 `mark.year`；冬季结算单独写入 `phase: "winter"` 的 mark。现在显示“回合 2 · 行动阶段”和“回合 1 · 冬季结算”，不再出现“回合 46”。
- **U3**：补齐 HRE 补员、秘密宗教倾向、Paris VP 等日志翻译规则；`France gains 1 Paris VP.` 等不再中英混排。
- **U4**：CP 不足时自动退出行动模式并弹出 toast；一次性行动点击非法目标时提前拦截并提示，不再把非法点击发给引擎。
- **U5**：热座模式在响应窗口/HRE 选择显示“请切换到 PX 标签页”；HRE 提示改为“在其外交回合选择”，避免误导。
- **U6**：教程去掉“。.”；英文等待句改为“Waiting for the opponent; switch to …”；第 3 步明确“先打强制事件”。
- **U7**：顶栏查看面板增加“查看”前缀，显示“当前：英格兰 查看：西班牙 · 0 CP”。

## 3. 试玩路径（可复现原始问题）

1. 打开 `/localVQ`，确认 P1–P6 抽牌。
2. 六国依次“结束外交回合”。
3. 六国春季部署；奥斯曼、西班牙选择归国海军将领港口，HRE 选择保留本国牌。
4. 行动阶段：各国 pass；法国持有强制事件“珍宝舰队”，pass 连续失败。
5. 法国把“珍宝舰队”作为事件打出，再结束行动轮次；六国连续 pass 后冬季结算。
6. 第 2 回合重复抽牌、外交、春季部署；HRE 选择“维也纳 +1 正规军”。
7. 第 2 回合行动阶段：奥斯曼将“风暴”作为 2 CP 打出，在伊斯坦布尔征募 1 个正规军。
8. 额外打开 `/localVQ/tutorial`，完成第 1–3 步，并打开“德意志的介入”卡牌详情。

## 4. 规则问题详情

### R1（高，已修复）“结束行动轮次”绕过 pass 的两条硬限制

实际试玩证据：第 1 回合奥斯曼手牌 8 张（苏莱曼行政评级 2），且持有“大维齐尔”“奥斯曼贡金”两张本国牌；点击“结束行动轮次”并确认后，行动权交给西班牙，日志写“奥斯曼帝国 跳过（未出牌）”。这同时违反了“手牌数 ≤ 行政评级”和“本国牌必须先打出”。

对局日志原文（第 1 回合行动阶段，时间倒序节选）：

```text
法国 跳过（未出牌）。
英格兰 跳过（未出牌）。
西班牙 跳过（未出牌）。
奥斯曼帝国 跳过（未出牌）。
新教联盟 跳过（未出牌）。
神圣罗马帝国 跳过（未出牌）。
法国 在强制事件后获得 2 CP。
珍宝舰队 出现在 加勒比海，携带 2 个宝藏。
法国 将 珍宝舰队 作为事件打出。
英格兰 跳过（未出牌）。
西班牙 跳过（未出牌）。
奥斯曼帝国 跳过（未出牌）。
```

修复前的最小复现（临时 Jest 测试，已删除）：

```text
pass()        + 3 张手牌（> 行政评级 2）      → INVALID
endImpulse()  + 3 张手牌（> 行政评级 2）      → ALLOWED   ← 不应该
pass()        + 1 张本国牌 vq-001              → ALLOWED   ← 不应该
endImpulse()  + 1 张本国牌 vq-001              → ALLOWED   ← 不应该
```

修复后：

```text
pass()        + 3 张手牌                      → INVALID
endImpulse()  + 3 张手牌                      → INVALID
pass()        + 本国牌 vq-001                  → INVALID
endImpulse()  + 本国牌 vq-001                  → INVALID
endImpulse()  + 已出牌 + 本国牌 vq-001          → ALLOWED（出牌后结束 impulse，合法）
```

### R2（高，已修复）强制事件可见性/可操作性不足

修复前手牌标签：

- “消失的殖民地”“塞利姆二世”：卡面“强制事件牌”，下方标签“行动牌”
- “边境掠夺者”“风暴”：卡面“响应牌”，下方标签“行动牌”
- 第 2 回合法国手里的“消失的殖民地”“塞利姆二世”，以及 P6 手里的“珍宝舰队”“教宗诏书”也都是强制事件

修复前行为：持有强制事件时点击“结束行动轮次”→ 确认 → 对话框关闭、局面完全不变；控制台：

```text
ERROR: invalid move: endImpulse args:
```

无 Snackbar、无红字、无“请先打出强制事件”的提示。玩家视角就是“按钮坏了/游戏卡住”。

修复后：标签正确，按钮禁用并显示具体卡名；出牌后可正常结束。

## 5. U1–U7 修复记录

| # | 原问题 | 处理 |
|---|---|---|
| U1 | 西班牙面板外交“目标强国”空白 + MUI 警告 | 派生 `diploTargetValue`，非法时回退到第一个合法敌方；Playwright 验证 0 条 `spain` 越界警告 |
| U2 | 日志“回合 46 · 2 · 行动阶段” | 改用 `mark.year`；冬季另打 mark；单测覆盖 `turn: 46 / year: 2` 与冬季分组 |
| U3 | `Holy Roman replacement...`、`France gains 1 Paris VP.` 等未翻译 | 新增日志规则与 i18n 单测 |
| U4 | 征募后 0 CP 模式不退出；点非法目标无反馈 | CP 不足自动退出 + toast；一次性行动目标预检 + toast；Playwright 验证不再出现 invalid move |
| U5 | 响应/HRE 只显示“等待”，没有切换提示 | `hotseat` prop + “请切换到 PX 标签页”；HRE 文案说明在其外交回合选择；静态渲染测试覆盖 |
| U6 | 教程“。.”、第一步未提示强制事件 | 去掉重复句号；第 3 步明确先打强制事件；教程测试断言无“。.”且含“强制事件” |
| U7 | 顶栏“当前：英格兰 西班牙 · 0 CP”归属不明 | 查看面板加“查看”前缀；静态渲染测试断言“查看 西班牙” |

## 6. 验证

- `./node_modules/.bin/tsc --noEmit`：通过。
- `./node_modules/.bin/jest src/virginQueen`：207 suites / 1159 tests 全部通过。
- `./node_modules/.bin/playwright test e2e/hotseat.spec.ts e2e/tutorial.spec.ts`：6 tests 全部通过。
- UI 手动复核：`12-fixed-mandatory-panel.png`、`13-fixed-after-event-panel.png`、`14-u1-diplomacy-spain.png`、`15-u4-cp-toast.png`、`16-u4-illegal-target.png`。
- U1 Playwright：西班牙面板目标显示“奥斯曼帝国”，`out-of-range value spain` 警告 0 条。
- U4 Playwright：征募后 CP 0，模式退出并显示“CP 不足，已退出当前行动。”；点击非法目标显示“该地区不是当前行动的合法目标。”；控制台无 `invalid move`。
- U5/U6/U7：静态渲染与教程测试覆盖（“请切换到 P2/P5 标签页”、无“。.”、含“强制事件”、顶栏含“查看 西班牙”）。

## 7. 证据索引

- `01-turn2-france-hand.png`：第 2 回合法国手牌全图。
- `02-card-type-labels.png`：强制事件/响应牌卡面与“行动牌”标签的对比。
- `03-spain-diplomacy-blank-target.png`：西班牙面板“目标强国”空白。
- `04-log-turn-number.png`：日志“回合 46 · 2 · 行动阶段”。
- `05-response-window-p6.png`：P6 响应窗口“轮到你选择”。
- `06-response-waiting-p1.png`：P1 面板“需要响应 · 新教联盟 · 等待选择”。
- `07-zero-cp-stuck.png`：征募后 0 CP 仍停留在目标选择模式。
- `08-tutorial-step3.png`：教程第 3 步与“跳过/结束行动轮次”并存。
- `09-tutorial-mandatory-card.png`：教程手牌中的强制事件“德意志的介入”。
- `10-ottoman-hand-turn1.png`：第 1 回合奥斯曼 8 张手牌（含两张本国牌）。
- `11-hre-waiting.png`：HRE 冬季补员“等待神圣罗马选择…”出现在 P6 面板。
- `12-fixed-mandatory-block.png` / `12-fixed-mandatory-panel.png`：修复后强制事件禁用两个按钮并显示原因。
- `13-fixed-after-event.png` / `13-fixed-after-event-panel.png`：修复后打出强制事件，结束按钮恢复、“跳过”禁用。
- `14-u1-diplomacy-spain.png`：西班牙面板目标为“奥斯曼帝国”，无空白/警告。
- `15-u4-cp-toast.png`：CP 耗尽后模式退出并提示。
- `16-u4-illegal-target.png`：非法目标被拦截并提示。

## 8. 后续建议

1. U1–U7 已修复；下一步建议用同样的方式继续覆盖攻城、野战、海战、婚姻、天主教联盟成立、刺杀等分支。
2. 运行完整 7 回合，重点观察冬季结算、日志分组和热座响应窗口在后期多 pending 状态下的表现。
3. 目前 `passBlock` 与 UI 的提示文案是手写的；如果后续新增 pass 限制，记得同时更新 `PassBlock`、`passAdminRating.test.ts` 和 `board.test.tsx`。
