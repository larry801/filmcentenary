import {Ctx} from "boardgame.io";
import {CardID, IEra, Region} from "../types/core";

// 中央牌列翻牌原因
export enum CardRevealReason {
    // 进入新时代（含开局时代1）开牌
    NEW_ERA = "newEra",
    // 更新：移走一张牌后补牌
    UPDATE = "update",
    // 检查阶段补满空位
    REFILL = "refill",
}

export interface ICardReveal {
    reason: CardRevealReason,
    cards: CardID[],
    // 两人局按时代整体开牌，没有地区
    region?: Region,
    era?: IEra,
}

// 同一个 move 内可能多次翻牌（如计分后进入新时代再补牌），setMetadata 会覆盖，
// 因此按 ctx.log（每个 move 一个实例）累积。
const pendingReveals = new WeakMap<object, ICardReveal[]>();

export const recordCardReveal = (ctx: Ctx, reveal: ICardReveal): void => {
    const logApi = ctx.log;
    // setup 阶段或客户端没有 log 插件，直接跳过
    if (logApi === undefined || logApi === null || reveal.cards.length === 0) return;
    const reveals = pendingReveals.get(logApi) ?? [];
    reveals.push({...reveal, cards: [...reveal.cards]});
    pendingReveals.set(logApi, reveals);
    logApi.setMetadata({cardReveals: reveals});
}
