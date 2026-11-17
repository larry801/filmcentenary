/**
 * 近期卡牌调整登记表。
 * 卡面右上角会显示「地区颜色的齿轮 + 黑边」角标，悬停展示本表的对照内容。
 * 调整过期后直接从该表中删除对应条目即可（新增卡牌不入表）。
 */
export interface ICardAdjustmentChange {
    /** 调整的具体项，如「【购买】置入档案区生效」 */
    label: string,
    /** 调整前 */
    before: string,
    /** 调整后 */
    after: string,
}

export interface ICardAdjustment {
    /** 浮层标题，默认「近期调整」 */
    title?: string,
    /** 调整日期 */
    date: string,
    /** 一句话概括 */
    summary: string,
    /** 调整对照表 */
    changes: ICardAdjustmentChange[],
}

/** 键为卡牌 ID */
export const RecentCardAdjustments: Record<string, ICardAdjustment> = {
    "S52683": {
        date: "2026/10/18",
        summary: "突破资金后的选择由「可选」改为「必选」",
        changes: [
            {label: "突破资金后", before: "可选，可跳过不选择", after: "必选，必须选择一项"},
        ],
    },
    "S52691": {
        date: "2026/10/18",
        summary: "使用行动力抽牌后的声望上调",
        changes: [
            {label: "【流派】使用行动力抽牌后", before: "+2 声望", after: "+3 声望"},
        ],
    },
    "S52692": {
        date: "2026/10/18",
        summary: "触发时机由「行动」改为「出牌」",
        changes: [
            {label: "触发时机", before: "行动：购买 / 突破 / 行动力抽牌后也会结算", after: "出牌：仅在出牌结算前后判定手牌数"},
        ],
    },
    "S52693": {
        date: "2026/10/18",
        summary: "购买获得的声望下调",
        changes: [
            {label: "【购买】置入档案区生效", before: "+5 声望", after: "+2 声望"},
        ],
    },
};

export const getCardAdjustment = (cardId: string): ICardAdjustment | undefined => RecentCardAdjustments[cardId];
