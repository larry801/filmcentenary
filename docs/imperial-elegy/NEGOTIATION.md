# Imperial Elegy 外交阶段谈判：UI 与规则引擎

本文描述《Imperial Elegy》外交阶段（11.0 / 11.1）的谈判桌实现。目标是把规则书的**出示手牌 → 提议随机抽牌交易（可附许诺）→ 对方确认/还价 → 阶段结束时统一结算 → 再选本土牌**做成可在线异步使用的结构化系统，而不是让玩家在聊天里口头约定后手动转账。

## 1. 范围与原则

印刷规则只有两条，边界很清楚：

- **11.0 外交阶段**：玩家可以**向其他玩家出示行动牌**（"to encourage cooperation or to back up a threat"）。除 11.1 外所有协议**不具约束力**，且不影响同盟轨道。
- **11.1 转交行动牌**：唯一有约束力、且必须兑现的条款——
  1. 必须是**双方正式同意**（"a formal agreement between both players"）；
  2. 在**外交阶段结束时**执行；
  3. **不能指定具体牌**，"all card draws must be random"，**本土牌永不参与**；
  4. 协商结束后按回合顺序宣布，**必须对方确认**才生效；
  5. 随机抽牌**对全桌公开**。

本实现的取舍：

- 许诺（promises）是文本，**引擎永不执行**，不进公开日志，阶段结束清空。它们回答"我们口头约好下回合打某张牌"这类 11.0 自由谈判。
- 未获确认的提议在阶段结束时**自动失效**（等价于"从未宣布"）。这是异步对局与机器人席位必需的确定性出口；11.1 本身也只承认"已确认"的抽牌。
- 一次交易只在两名玩家之间。多人条件协议不在本版范围。

## 2. 代码结构

| 文件 | 职责 |
| --- | --- |
| `src/imperialElegy/engine/negotiation.ts` | 类型无关的规则层：`dealProblem`、`readPromises`、`settleDeals`、`expireOffers`、`shownCardsFor`、条款文案 |
| `src/imperialElegy/moves.ts` | `showCard` / `hideCard` / `proposeDeal` / `respondDeal` / `counterDeal` / `withdrawDeal`；`beginActionPhaseAfterDiplomacy` 在进入行动阶段前结算 |
| `src/imperialElegy/game.ts` | 注册六个 move（全部 `redact: true`）；`diplomacyBegin` 清空明牌与上一轮提议 |
| `src/imperialElegy/engine/privacy.ts` | 未确认提议只给双方；已结算交易与全桌展示对所有人生效 |
| `src/imperialElegy/components/OrdersPanel.tsx` | 第五个条件页 `deals`（仅外交阶段），有待确认提议时置 `urgent` |
| `src/imperialElegy/components/DiplomacyPanel.tsx` | 谈判桌 UI：明牌、提议表单、收件箱（确认/拒绝/还价/撤回）、结算记录 |
| `src/imperialElegy/components/HandTray.tsx` | 手牌行新增"展示"按钮，并列出"本阶段已展示 / 他人向你展示" |
| `src/imperialElegy/components/logText.ts` | `cardShownPublic`、`cardShownPrivate`、`dealProposed` 等双语文案 |

## 3. 数据模型

```ts
interface DiplomacyDeals {
  offers: DealOffer[];        // 仍在桌上的提议（proposed / accepted）
  history: DealSettlement[];  // 已结算的交易，公开
  shown: ShownCard[];         // 本阶段有效，阶段开始/结束清空
  nextId: number;
  settledTurn?: number;       // 结算幂等标记
}

interface DealOffer {
  id: string;                 // deal-<n>
  from: Power; to: Power;     // from 是提议方/宣布方
  give: number;               // from → to 的随机抽牌数
  take: number;               // to → from 的随机抽牌数
  promises: {from: Power; text: string}[];
  status: "proposed" | "accepted" | "refused" | "withdrawn" | "countered";
  counterOf?: string;         // 这是对哪一份提议的还价
  turn: number;
  seq: number;
}

interface DealSettlement {
  id: string; turn: number; from: Power; to: Power;
  given: CardId[]; taken: CardId[];
  shortfall: boolean;         // 手牌不足，少交
}

interface ShownCard {card: CardId; from: Power; to: Power | null; turn: number} // null = 全桌
```

`ImperialElegyState.negotiation` 是可选字段：`engine/migrations.ts#ensureStateDefaults` 只在字段存在时补齐子记录，旧存档按"空谈判桌"读取，`playerView` 也因此永不抛错。

**所有数字都只是数字。** `give`/`take` 不含牌 id，客户端无法指定牌，随机抽取只发生在 `settleDeals` 里。

## 4. 状态机

```text
              proposeDeal
  (无桌) ─────────────────▶ 提议待确认 ──── respondDeal(accept) ──▶ 已同意
                              │  │                                    │
                    refuse ───┘  └─── counterDeal ──▶ 反向的新提议     │
                    (移除)                          (旧提议 countered) │
                              │                                       │
                    withdrawDeal（原提议方，移除）                      │
                                                                      │
                        外交阶段结束：settleDeals（按座位顺序）◀──────┘
                                   │
                            未确认提议 expireOffers（不进历史）
```

- 接受**不会**立刻动牌：11.1 明说"done at the end of the diplomacy phase"。
- 接受时用**当前手牌**重新校验；手牌缩水的提议会被拒绝，提议留在桌上。
- 还价方向反转：表单里的 `give`/`take` 始终是**操作者自己**交出/收到的张数；UI 用「给出 / 获取」开关一次只表达一个方向，非活动方向恒为 0。
- 9.1 的谈判段由每个席位的 `flags.negotiationDone` 收尾；只有全桌（未淘汰席位）都结束后，`chooseHomeCard` 才接受选择。旧存档没有该标记时按“已完成”读取，避免恢复的旧对局卡死。
- `settleDeals` 通过 `settledTurn` 幂等，重复进入行动阶段不会重复抽牌。

## 5. 结算

`settleDeals(G, ctx)` 的顺序：

1. 取 `status === "accepted"` 的提议，按**印序座位**（GE→UK→FR→AU→RU→OT）排序，同座位按 `seq`；
2. 每份交易先抽 `give`（from→to）再抽 `take`（to→from）；
3. 每次抽取都 `randomIndex(ctx, pool.length)`，池子来自 `dealableCards`（排除 `kind === "home"`）；
4. 手牌不足则抽到多少算多少，`shortfall: true`；
5. 写公开日志 `dealCardDrawn`（带牌面）、`dealSettled`、必要时 `dealShortfall`；
6. 写入 `history`，把该提议移出 `offers`。

随后 `expireOffers(G)` 清空未确认提议、写下 `dealsExpired`（一条汇总），并清空 `shown`。

## 6. 隐私边界

| 内容 | 谁能看 |
| --- | --- |
| `offers`（未确认） | 只有 `from` / `to` 两个座位；第三方与观战者读到空数组 |
| `history` | 所有人（11.1 "in full view of all players"） |
| `shown`，`to === null` | 所有人，包括观战者 |
| `shown`，`to === Power` | 只有 `from` / `to` |
| 条款文本、许诺 | 与 `offers` 同一范围 |

`playerView` 只裁剪、不写入；`redactLog` 把 `cardShownPublic`、`dealCardDrawn` 视为公开牌面参数（规则本身要求公开），私密展示的日志**不含牌 id**，只有 `to`。

## 7. UI 流程

外交阶段，Orders 面板出现第五页「谈判 / Deals」；有提议发给该席位时徽标 `!` 并把页面拉到前面。

1. **明牌**：列出本阶段桌面上的明牌（全桌 / 私下）。
2. **提议**：
   - 选择对象（自动排除自己与已淘汰势力）；
   - 「给出 / 获取」开关一次只选一个方向，数量用下拉列表，选项上限就是该方向实际可交易的手牌数（本土牌不计）；表单因此默认构造**单向**交易；
   - 最多 3 条许诺，每行一条，明确标注"引擎不强制执行"；
   - 条款预览实时拼出中文/英文句子；
   - 存在非法条件时禁用发送并给出原因（仅外交阶段 / 不能与自己交易 / 至少要移动 1 张 / 手牌不足）。
3. **收件箱**：发给我的提议 → 确认 / 拒绝 / **还价**；我发出的提议 → 撤回。已同意显示"已同意 · 阶段末结算"。
4. **已结算**：本回合公开的抽牌结果，按方向列出牌名；短交标注"人手不足"。
5. **手牌行**：外交阶段每张牌多一个「向他人展示」按钮。点击后弹出目标选择：全桌（公开）或某一强国的私下展示；11.0 的私下展示因此有了直接入口。已展示的牌在托盘下方按收件人列出并可「收回」，同一张牌可以分别展示给不同对象。
6. **先结束谈判，再选本土牌**：规则 9.1 把谈判段排在弹簧部署段之前，所以外交阶段一开始**不开放**本土牌选择。每个席位在谈判桌（`ie-deals-negotiation-step` / `ie-finish-negotiation-from-deals`）或指令区（`ie-finish-negotiation`）点击「结束谈判」；只有全桌都结束后，指令区按钮 `ie-open-home-card` 与谈判桌的 `ie-deals-home-step` 才出现。对话框可关闭而不作答（`ie-choice-close` / `ie-choice-continue`），选择依然欠着，随时可再次打开。谈判桌会列出仍在谈判的席位，结束后显示“谈判已结束”。

## 8. 机器人（规则 34）

bot 在外交阶段先看有没有发给自己的提议，有则 `respondDeal(id, false)`，然后立即 `finishNegotiation`；等全桌谈判结束后照旧选本土牌并 `endDiplomacy`。bot 不占用框架的“当前玩家”轮次来结束谈判：驱动会挑选仍在谈判的 bot 席位，其余席位（人类）还没结束时 bot 会停等而不是空转。机器人**不还价**：双方都不确认的提议在阶段结束时自动失效，所以不会出现"机器人互相还价到回合超时"。

## 9. 已知限制

- 一次只有两张椅子（两名玩家）的交易；多边协议、同时多桌不在范围。
- 许诺只是文本，不做任何语义解析或后续校验。
- 未确认提议会失效而不是挂起到下一回合（规则不承认未确认的抽牌）。
- 交易只交换行动牌。规则 11.1 之外的其他让步（地区、停战、同盟）属于战争/条约系统，不走谈判桌。

## 10. 验证

```sh
./node_modules/.bin/jest src/imperialElegy/negotiation.test.ts \
  src/imperialElegy/negotiationSettlement.test.ts \
  src/imperialElegy/negotiationPrivacy.test.ts \
  src/imperialElegy/negotiationStage.test.ts \
  src/imperialElegy/components/diplomacyPanel.test.tsx --runInBand
```

覆盖：提议校验（自交易、淘汰、阶段、手牌上限）、确认/拒绝/撤回/还价（含连续还价方向复原、还价后重新校验）、结算座位顺序、随机抽取（die→牌、本土牌排除、双向、短交）、幂等、未确认失效、公开与非公开边界、真实 boardgame.io reducer 下的跨座位回应与阶段切换、UI 静态渲染。
