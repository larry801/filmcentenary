/**
 * src/extensions/example/effects.ts
 * 
 * 演示扩展 - 卡牌效果定义
 * 
 * 【重要】此文件仅作示例，不会被自动加载。
 */

import { IG } from "../../types/setup";
import { Ctx } from "boardgame.io";
import { ICardEffectDef, IEff } from "../types";

// 空效果占位符（与 constant/effects.ts 中的 noEff 一致）
const noEff: IEff = { e: "none", a: 1 };
const noResponse = { pre: noEff, effect: noEff };

/**
 * 示例扩展的卡牌效果
 * 
 * key: 卡牌 ID 的数字部分（去掉 F/S/P 前缀）
 *      例如 "7001" 对应 "F7001"
 * value: ICardEffectDef 效果定义
 */
export const exampleEffects: Record<string, ICardEffectDef> = {

    // ========== F7001: 示例电影：光影初现 ==========
    "7001": {
        canBuy: (_G: IG, _ctx: Ctx) => true,
        buy: noEff,
        canPlay: (_G: IG, _ctx: Ctx) => true,
        // play: 获得 2 资源 + 1 VP
        play: {
            e: "step",
            a: [
                { e: "res", a: 2 },
                { e: "vp", a: 1 },
            ],
        },
        canArchive: (_G: IG, _ctx: Ctx) => true,
        archive: noEff,
    },

    // ========== F7002: 示例电影：欧洲新浪潮 ==========
    "7002": {
        canBuy: (_G: IG, _ctx: Ctx) => true,
        buy: noEff,
        canPlay: (_G: IG, _ctx: Ctx) => true,
        // play: 获得 1 资源 + 抽 1 张牌
        play: {
            e: "step",
            a: [
                { e: "res", a: 1 },
                { e: "draw", a: 1 },
            ],
        },
        canArchive: (_G: IG, _ctx: Ctx) => true,
        archive: { e: "deposit", a: 1 },
    },

    // ========== S7101: 示例流派：实验工坊 ==========
    "7101": {
        canBuy: (_G: IG, _ctx: Ctx) => true,
        buy: noEff,
        canPlay: (_G: IG, _ctx: Ctx) => true,
        // play: 美学奖励 +1
        play: {
            e: "step",
            a: [
                { e: "aesAward", a: 1 },
            ],
        },
        canArchive: (_G: IG, _ctx: Ctx) => true,
        archive: noEff,
        // 流派特有：手牌上限和行动力
        school: {
            hand: 5,
            action: 1,
        },
    },
};
