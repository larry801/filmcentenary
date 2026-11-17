/**
 * src/extensions/example/cards.ts
 * 
 * 演示扩展 - 卡牌数据定义
 * 
 * 【重要】此文件仅作示例，不会被自动加载。
 * 如需启用此扩展，请在 src/extensions/example/index.ts 中
 * 取消 registerExtension 的注释，并在游戏入口文件中 import。
 */

import {
    IEra, Region, CardCategory, CardType,
    cost, filmCard, schoolCard, eventCard,
    FilmCardID, SchoolCardID, EventCardID,
    INormalOrLegendCard, IEventCard,
} from "../../types/core";

// ============================================================
// 示例卡牌 ID（建议使用 7000+ 范围避免与现有卡牌冲突）
// 实际使用时，你可以在 core.ts 的 FilmCardID/SchoolCardID 枚举中
// 添加新的枚举值，或者直接用字符串（但需要确保 getCardById 能查到）
// ============================================================

/**
 * 示例扩展的卡牌数据
 * 
 * key: 完整的卡牌 ID 字符串（如 "F7001"）
 * value: INormalOrLegendCard 对象
 */
export const exampleCards: Record<string, INormalOrLegendCard> = {
    // --- 一部示例电影（一时代，北美） ---
    "F7001": filmCard({
        era: IEra.ONE,
        region: Region.NA,
        name: "示例电影：光影初现",
        cardId: "F7001" as any,
        cost: cost(3, 1, 1),
        vp: 2,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),

    // --- 一部示例电影（二时代，西欧） ---
    "F7002": filmCard({
        era: IEra.TWO,
        region: Region.WE,
        name: "示例电影：欧洲新浪潮",
        cardId: "F7002" as any,
        cost: cost(5, 2, 2),
        vp: 4,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),

    // --- 一个示例流派（二时代，东欧） ---
    "S7101": schoolCard({
        era: IEra.TWO,
        region: Region.EE,
        name: "示例流派：实验工坊",
        cardId: "S7101" as any,
        cost: cost(4, 1, 2),
        vp: 3,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
};

/**
 * 示例扩展的事件卡（可选）
 */
export const exampleEvents: Record<string, IEventCard> = {
    // 如果有自定义事件，在这里定义
};
