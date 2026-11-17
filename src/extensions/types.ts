/**
 * src/extensions/types.ts
 * 扩展系统的类型定义
 * 
 * 所有 DIY 扩展应保存在 ./src/extensions/ex_Name/ 下
 */
import { IG } from "../types/setup";
import { Ctx } from "boardgame.io";
import {
    INormalOrLegendCard,
    IEventCard,
    CardID,
    Region,
    IEra,
} from "../types/core";

/**
 * 卡牌效果描述（与 constant/effects.ts 中的 IEff 对齐）
 */
export interface IEff {
    e: string;
    a: IEff[] | number | string;
}

/**
 * 单张卡牌的完整效果定义
 */
export interface ICardEffectDef {
    canBuy?: (G: IG, ctx: Ctx) => boolean;
    canPlay?: (G: IG, ctx: Ctx) => boolean;
    canArchive?: (G: IG, ctx: Ctx) => boolean;
    buy?: IEff;
    play?: IEff;
    archive?: IEff;
    response?: { pre: IEff; effect: IEff };
    /** 流派卡独有：学校 hand/action 限制等 */
    school?: {
        hand?: number;
        action?: number;
    };
}

/**
 * 单个扩展的定义
 */
export interface IExtension {
    /** 唯一标识，如 "example"、"my_custom_cards" */
    id: string;

    /** 扩展显示名称 */
    name: string;

    /** 扩展描述 */
    description?: string;

    /** 扩展版本 */
    version?: string;

    /**
     * UI 中 checkbox 的标签文本。
     * 中文环境下显示 ch，英文环境下显示 en。
     * 如果未提供，则使用 name 作为标签。
     */
    label?: {
        ch: string;
        en: string;
    };

    /**
     * 该扩展提供的卡牌数据。
     * key = 完整卡牌 ID (如 "F7001")，value = 卡牌数据对象
     */
    cards?: Record<string, INormalOrLegendCard>;

    /**
     * 该扩展提供的卡牌效果。
     * key = 卡牌 ID 的数字部分 (如 "7001" 对应 "F7001")
     * value = 效果定义
     */
    effects?: Record<string, ICardEffectDef>;

    /**
     * 该扩展提供的事件卡
     */
    events?: Record<string, IEventCard>;

    /**
     * 该扩展提供的事件效果
     */
    eventEffects?: Record<string, IEff>;

    /**
     * 扩展是否在当前游戏中启用。
     * 默认实现：检查 G.enabledExtensions 是否包含本扩展的 id。
     * 如有特殊逻辑可覆盖。
     */
    isEnabled?: (G: IG) => boolean;

    /**
     * 扩展初始化钩子（游戏 setupGameMode 时调用）
     * 可用于初始化扩展专属的游戏状态字段
     */
    onSetup?: (G: IG, ctx: Ctx) => void;
}
