# Virgin Queen 玩家谈判：UI 与规则引擎

本文描述《Virgin Queen》外交阶段“谈判桌”（Negotiation Table）的实现。目标是把规则书 9.1 的**私下协商 → 宣布 → 后手确认**流程做成可在线异步使用的结构化系统，而不是让玩家在聊天里口头约定后手动改状态。

## 1. 范围与原则

- 只把**会改变当前游戏状态**的条款视为有约束力：议和、同盟、海军借调、归还被俘陆军将领、让渡地区、随机赠牌/宝藏/雇佣兵、王室订婚（规则 9.1）。
- 关于未来回合的承诺（“下回合进攻米兰”“不打出某张牌”）单独记录为 `promises`，**永不由引擎执行，也不会出现在公共日志或对手的协议记录里**。
- 谈判只在外交阶段开放；未确认的提议在阶段结束时失效。
- 每次谈判只在两名玩家之间进行，且同一时间只有一张谈判桌。多边/多人条件协议不在本版范围内。
- 资源校验在**提议时**和**密封时**各做一次。规则允许“宣布多于最终能确认的协议”，因此未密封的提议不预占资源；先密封者先执行。

## 2. 代码结构

| 文件 | 职责 |
| --- | --- |
| `src/virginQueen/negotiation.ts` | 条款/提议/历史类型；合法性校验；原子执行；条款文案；可让渡地区、可归还将领、可婚配王室、可借调港口等候选列表 |
| `src/virginQueen/negotiationMoves.ts` | `proposeDeal`、`respondDeal`、`counterDeal`、`withdrawDeal` 四个 move |
| `src/virginQueen/game.ts` | 注册 move 与 `dealOffer` / `dealResponse` 临时 stage；阶段生命周期；`playerView` 私密信息裁剪 |
| `src/virginQueen/components/board/panels/NegotiationPanel.tsx` | 谈判桌 UI（提议构建器、收件箱、还价、历史） |
| `src/virginQueen/components/board/panels/DiplomacyPanel.tsx` | 在外交面板顶部挂载谈判桌 |
| `src/virginQueen/negotiation.test.ts` | 规则引擎单元测试 |
| `src/virginQueen/negotiationStage.test.ts` | 用真实 boardgame.io reducer 跑 stage 流程与日志裁剪 |
| `src/virginQueen/negotiationUi.test.tsx` | 服务端渲染 UI 快照/文案测试 |

## 3. 数据模型

```ts
interface NegotiationState {
  offer: NegotiationOffer | null;   // 当前唯一一张谈判桌
  history: NegotiationRecord[];     // 已密封协议（约束条款公开）
  nextId: number;
}

interface NegotiationOffer {
  id: string;
  from: Power;
  to: Power;
  terms: NegotiationTerm[];         // 有约束力
  promises: {from: Power; text: string}[]; // 非约束
  counterOf?: string;
  year: number;
  turn: number;
}
```

`NegotiationTerm` 是可辨识联合：

- `peace`
- `alliance`
- `cards` / `treasures` / `mercenaries`（含 `from`、`to`、`count`）
- `yieldSpace`（`space`）
- `returnLeader`（`leaderId`）
- `betrothal`（`male`、`female`）
- `navalLoan`（`fromPort`、`toPort`、`ship`、可选 `leader`）

## 4. 状态机

```text
             proposeDeal
  (无桌) ─────────────────▶ 提议待回应
                              │  │  │
                    accept ───┘  │  └─── reject
                              │  │
                       counterDeal │
                              ▼  ▼
                         新的提议待回应
                              │
                    withdrawDeal（原提议方）
                              ▼
                           (无桌)

  外交阶段结束：未确认提议自动失效（不进入历史）
```

- `proposeDeal` 把**提议方**放入 `dealOffer` stage，把**回应方**放入 `dealResponse` stage，各给 1 步。回应方可在自己回合之外立即回应。
- `respondDeal(accept)` 在服务端重新校验并**原子执行**；成功后写入 `history` 并清除两个 stage，控制权回到原提议方的外交回合。
- `respondDeal(reject)` 只清除提议与 stage，不写公共日志。
- `counterDeal` 用新提议替换旧提议，方向反转；双方重新各获得 1 步。
- 所有谈判 move 都是 `client: false`：客户端只持有裁剪后的状态，不能让它在本地用隐藏手牌做校验。`proposeDeal`/`respondDeal`/`counterDeal` 同时 `redact: true`，避免 move 参数泄露私下条款。

### 宣布顺序

规则 9.1 要求“冲动顺序靠前的强国提出，靠后的强国确认”。结构化流程中：

- 靠前方向靠后方提议：靠后方点击“密封”即完成提出+确认。
- 靠后方先发提议：靠前方点击“密封”时视为靠前方向正式提出，靠后方的原始提议即确认；历史记录仍写作 `proposer=靠前方`、`confirmer=靠后方`。
- 还价会反转方向，因此还价方成为新提议方。

## 5. 合法性校验

`validateNegotiation(G, from, to, terms, promises)` 返回 `{term?, code, params?}[]`，UI 和引擎共用。主要检查：

| 类别 | 规则 |
| --- | --- |
| 基本 | 双方不同、都有玩家席位、至少一条约束条款、条款只涉及双方 |
| 议和 | 必须处于交战；西班牙/英格兰永不能议和；天主教联盟年度禁约 |
| 同盟 | 不能已结盟；交战时须同时议和；西/新教永不能结盟；西/英宣战费 ≤3 不能结盟；法国不能同时与西/新教结盟 |
| 赠牌 | 每方向每回合 ≤2；全回合只能单向；须有非本国牌；与交战国交易须同时议和 |
| 赠宝藏 | 每方向每回合 ≤2；全回合只能单向；须有宝藏 |
| 赠雇佣兵 | 每方向每回合 ≤4；全回合只能单向；奥斯曼不能给；奥斯曼/HRE 不能收；HRE 可用市场轨道支付；接收方须有可用首都 |
| 让渡地区 | 仅规则 9.1(a)-(d)：归还家乡、法国/新教互换法国地区、西班牙/新教互换尼德兰地区、独立家乡地区相邻或同海域 |
| 归还将领 | 只能是 `captured` 的陆军将领；归还给其所属强国；俘获方必须是提议中的给出方 |
| 订婚 | 双方王室可用、非同一家族、不同强国、非交战中（除非同交易议和）、天主教联盟禁约、玛丽被俘时禁止 |
| 海军借调 | 同一交易必须有同盟条款；每对玩家每回合只能单向；港口控制与纯海域路径合法；船型和可选海军将领属于借出方 |

UI 从裁剪后的 `playerView` 取不到对手手牌/宝藏内容，因此构造提议时用 `handCounts` / `treasureCounts` 做近似校验；服务端在 `respondDeal` 中用完整状态重新校验。若最终无法执行，move 返回 `INVALID_MOVE`，不会产生半成品状态。

## 6. 原子执行

`executeNegotiation` 的顺序固定：

1. 议和（`clearWar`，含摩尔人起义的清理逻辑）
2. 结盟
3. 其余条款：订婚 → 赠牌/宝藏/雇佣兵 → 海军借调 → 让渡地区 → 归还将领

这个顺序保证前面的条款不会因后面的控制权变化而失效（例如先抽走要赠送的雇佣兵，再让渡其所在地区）。

执行前对 `G` 做一次 JSON 快照；任一执行异常会回滚整个 `G` 并返回问题码。所有校验通过才会写入公共日志：

```text
France and Spain announce an agreement: peace; France gives 2 random card(s) to Spain.
```

赠牌/宝藏只公布数量，不公布具体牌面或价值；这与“随机抽取”的规则一致。

## 7. UI 流程

外交面板顶部新增“谈判桌”：

1. 选择谈判对象（自动过滤无玩家席位/同一玩家的强国）。
2. 用“条款”下拉框逐条添加：议和、结盟、随机手牌、随机宝藏、雇佣兵、让渡地区、归还将领、王室联姻、海军借调。
3. 对有方向的条款选择“我方给出/对方给出”；地区、将领、王室、港口、舰船从引擎给出的合法候选中选择。
4. 可选填最多 4 条非约束承诺，并明确标注“引擎永不强制执行”。
5. 实时显示问题码；无问题时点击“发送提议”。
6. 收到提议的一方看到“密封协议 / 拒绝 / 还价”。还价会保留议和/结盟这类对称条款，方向性条款需重新添加。
7. 已密封协议在本年度历史中显示；非约束承诺只对参与双方可见。

## 8. 隐私边界

`playerView` 对非参与方：

- 把 `negotiation.offer` 置为 `null`；
- 保留 `history` 的约束条款（已公开），但清空 `promises`；
- 不暴露 `diplomacyGifts` 之外的私下交易信息。

move 日志：

- `proposeDeal` / `respondDeal` / `counterDeal` / `withdrawDeal` 均 `redact: true`；
- 非行动方收到的 action log 中 `args` 为 `null`；
- 公共 `G.log` 只包含密封后的约束条款。

## 9. 已知限制

- 同一时间只支持一张谈判桌；多边协议、多人同时谈判、谈判计时器不在本版范围。
- 非玩家控制的 HRE/激活强国家不能作为谈判对象（无玩家席位）；与 HRE 的王室联姻仍走原有 `proposeBetroth` 的影响力路径。
- 海军借调要求同盟条款在同一交易中；原有的“已结盟后单独借调”按钮仍保留，属于历史行为。
- 承诺只是文本记录，不做任何语义解析或后续校验。
- 接收雇佣兵默认放入第一个合法首都；规则允许在多个首都间分配，当前 UI 未开放逐个分配。
- 规则书要求的“冲动顺序靠前者提出”通过密封时的正式记录近似实现；没有单独的“宣布队列”UI。

## 10. 验证

```sh
./node_modules/.bin/jest src/virginQueen/negotiation.test.ts \
  src/virginQueen/negotiationStage.test.ts \
  src/virginQueen/negotiationUi.test.tsx --runInBand
```

测试覆盖：提议/stage、接受/拒绝/还价/撤回、牌与雇佣兵转移、议和+联姻、让渡、海军借调、礼物上限/单向、交战禁赠、天主教联盟禁约、过期、服务端重新校验、`playerView` 与 move 日志裁剪。
