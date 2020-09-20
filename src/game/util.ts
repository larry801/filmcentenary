import {CardCategory, IBuyInfo, ICost, INormalOrLegendCard, IPubInfo, Region} from "../types/core";
import {IG} from "../types/setup";
import {Ctx} from "boardgame.io";
import {NACards} from "../constant/cards/northAmerica";

export const curPid = (G: IG, ctx: Ctx): number => {
    return parseInt(ctx.currentPlayer);
}
export const curPub = (G: IG, ctx: Ctx): IPubInfo => {
    if (ctx.activePlayers === null) {
        return G.pub[curPid(G, ctx)]
    } else {
        let players = Object.keys(ctx.activePlayers);
        players.splice(players.indexOf(ctx.currentPlayer), 1);
        return G.pub[parseInt(players[0])];
    }
}
export const shuffle = (ctx: Ctx, arg: any[]): any[] => {
    let r = ctx.random;
    if (r === undefined) {
        throw new Error("");
    } else {
        return r.Shuffle(arg);
    }
}

export const execOwnEffect = (G: IG, ctx: Ctx): void => {
    let eff = G.e.stack.pop();
    let obj = G.pub[curPid(G, ctx)];
    switch (eff.e) {
        case "none":
            return
        case "cash":
            obj.cash += eff.a;
            break;
        case "res":
            obj.resource += eff.a;
            break;
        case "noStudio":

            break;
        case "step":
            for (let e of eff.a) {
                G.e.stack.push(e)
            }
            break;
        case "share":
            break;
        case "choice":
            G.e.choices = eff.a;
            // TODO changeStage
            break;
    }
    if (G.e.stack.length >= 0) {
        execOwnEffect(G, ctx);
    }
}
export const execPlayerEff = (G: IG, ctx: Ctx): void => {

}

export const cardOnBoard = (G: IG, ctx: Ctx, card: INormalOrLegendCard): boolean => {
    let r = G.regions[card.region];
    if (card.category === CardCategory.LEGEND) {
        if (r.legend.card !== null) {
            return r.legend.card.cardId === card.cardId
        } else {
            return false;
        }
    } else {
        for (let slot of r.normal) {
            if (slot.card !== null) {
                if (slot.card.cardId == card.cardId) {
                    return true;
                }
            }
        }
        return false;
    }
}

export function idOnBoard(G: IG, ctx: Ctx, id: string): boolean {
    // @ts-ignore
    return cardOnBoard(G, ctx, NACards[0][1]);
}

export function cardDepleted(G: IG, ctx: Ctx, region: Region) {
    let r = G.regions[region];
    return r.legend.card === null && r.normal.filter(value => value.card !== null).length === 0;
}

export function shareDepleted(G: IG, ctx: Ctx, region: Region) {
    return G.regions[region].share === 0;
}

export function canBuyCard(G: IG, ctx: Ctx, arg: IBuyInfo): boolean {
    let cost: ICost = arg.target.cost;
    let resRequired = 0;
    let aesthetics: number = cost.aesthetics
    let industry: number = cost.industry
    let resGiven: number = arg.resource + arg.cash;
    for (const helperItem of arg.helper) {
        aesthetics += 1;
        industry += 1;
    }
    return resRequired === resGiven;
}
