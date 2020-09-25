import {
    BasicCardID,
    CardCategory,
    IBasicCard,
    IBuyInfo,
    ICardSlot,
    ICost,
    IEra,
    INormalOrLegendCard,
    IPubInfo,
    Region
} from "../types/core";
import {IG} from "../types/setup";
import {Ctx, PlayerID} from "boardgame.io";
import {cardsByCond, idToCard} from "../types/cards";
import {Stage} from "boardgame.io/core";
import {changePlayerStage, changeStage} from "./logFix";

export const curPid = (G: IG, ctx: Ctx): number => {
    return parseInt(ctx.currentPlayer);
}

export function activePlayer(ctx: Ctx) {
    if (ctx.activePlayers === null) {
        return ctx.currentPlayer
    } else {
        let players = Object.keys(ctx.activePlayers);
        players.splice(players.indexOf(ctx.currentPlayer), 1);
        return players[0];
    }
}

export const curPub = (G: IG, ctx: Ctx): IPubInfo => G.pub[curPid(G, ctx)];

export const activePub = (G: IG, ctx: Ctx): IPubInfo => {
    if (ctx.activePlayers === null) {
        return G.pub[curPid(G, ctx)];
    } else {
        return G.pub[parseInt(activePlayer(ctx))];
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

export const actualStage = (G: IG, ctx: Ctx,): string => {
    if (ctx.activePlayers === null) {
        return Stage.NULL;
    } else {
        return ctx.activePlayers[activePlayer(ctx)]
    }
}

export const doConfirm = (G: IG, ctx: Ctx, a: boolean) => {
    let stage =actualStage(G,ctx);
    if(stage===Stage.NULL){
        // TODO
    }else {
        switch (stage) {
            case "optionalEff":
                if(a){
                    let eff=G.e.stack.pop();
                    if(eff===undefined){
                        throw new Error();
                    }else {
                        G.e.stack.push(eff.a)
                    }
                    curEffectExec(G,ctx);
                }else {
                    let eff=G.e.stack.pop();
                    if(eff===undefined){
                        // TODO
                        throw new Error();
                    }else {
                        G.e.stack.push(eff.a)
                        curEffectExec(G,ctx);
                    }
                }
                return;
            default:
                throw new  Error("Unsupported stage " + stage);
        }
    }
}

export const doBuyToHand = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    let obj = G.player[parseInt(p)];
    let pObj = G.pub[parseInt(p)];
    if (card.category === CardCategory.BASIC) {
        // @ts-ignore
        G.basicCards[card.cardId] -= 1;
    } else {
        let slot = cardSlotOnBoard(G, ctx, card);
        if (slot === null) {
            throw new Error("Cannot buy card off board!");
        } else {
            slot.card = null;
            if (slot.comment !== null) {
                obj.hand.push(slot.comment);
                pObj.allCards.push(slot.comment);
                slot.comment = null;
            }//TODO update
        }
    }
    obj.hand.push(card);
    pObj.allCards.push(card)
}


export const doBuy = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    let obj = G.pub[parseInt(p)];
    if (card.category === CardCategory.BASIC) {
        // @ts-ignore
        G.basicCards[card.cardId] -= 1;
    } else {
        let slot = cardSlotOnBoard(G, ctx, card);
        if (slot === null) {
            throw new Error("Cannot buy card off board!");
        } else {
            slot.card = null;
            if (slot.comment !== null) {
                obj.discard.push(slot.comment);
                obj.allCards.push(slot.comment);
                slot.comment = null;
            }//TODO update
        }
    }
    obj.discard.push(card);
    obj.allCards.push(card);
}


const idInHand = (G: IG, ctx: Ctx, p: number, cardId: string): boolean => {
    return G.player[p].hand.filter(c => c.cardId === cardId).length > 0;
}

export const getPidHasCard = (G: IG, ctx: Ctx, cardId: string): number[] => {
    let p: number[] = [];
    Array(G.playerCount).fill(1).forEach((i, idx) => {
            if (idInHand(G, ctx, idx, cardId)) {
                p.push(idx);
            }
        }
    );
    return p;
}
export const studioInRegion = (G: IG, ctx: Ctx, r: Region, p: PlayerID): boolean => {
    if(r===Region.NONE)return false;
    return G.regions[r].buildings.filter(s => s.content === "studio" && s.owner === p).length > 0;
}

export const studioPlayers = (G: IG, ctx: Ctx, r: Region): PlayerID[] => {
    if(r===Region.NONE)return [];
    return  Array(G.playerCount).fill(1).map((i,idx)=>idx.toString()).filter(pid=>studioInRegion(G,ctx,r,pid));
}

export const noStudioPlayers = (G: IG, ctx: Ctx, r: Region): PlayerID[] => {
    if(r===Region.NONE)return [];
    return  Array(G.playerCount).fill(1).map((i,idx)=>idx.toString()).filter(pid=>!studioInRegion(G,ctx,r,pid));
}

export const posOfPlayer = (G: IG, ctx: Ctx,p:PlayerID): number => {
    return G.order.indexOf(p);
}

export const curEffectExec = (G: IG, ctx: Ctx): void => {
    let eff = G.e.stack.pop();
    let obj = G.pub[curPid(G, ctx)];
    let card: INormalOrLegendCard;
    let region = G.e.card.region;
    console.log(JSON.stringify(eff));
    switch (eff.e) {
        case "none":
            return
        case "cash":
            obj.cash += eff.a;
            break;
        case "res":
            obj.resource += eff.a;
            break;
        case "vp":
            obj.vp += eff.a;
            break;
        case "noStudio":
            G.c.players = noStudioPlayers(G,ctx,region);
            changeStage(G,ctx,"choosePlayer")
            break;
        case "studio":
            let players = studioPlayers(G,ctx,region);
            players.forEach(p=>playerEffExec(G,ctx,p));
            break;
        case "step":
            eff.a.reduceRight((_: any, item: any) => {
                return G.e.stack.push(item);
            });
            break;
        case "drawCard":
            for (let i = 0; i < eff.a; i++) {
                drawCardForPlayer(G, ctx, ctx.currentPlayer);
            }
            break;
        case "shareToVp":
            if(region===Region.NONE)return;
            obj.vp += obj.shares[region];
            break;
        case "aesAward":
            for (let i = 0; i < eff.a; i++) {
                aesAward(G, ctx, ctx.currentPlayer);
            }
            break;
        case "industryAward":
            for (let i = 0; i < eff.a; i++) {
                industryAward(G, ctx, ctx.currentPlayer);
            }
            break;
        case "buyCard":
            card = idToCard(eff.a);
            doBuy(G,ctx,card,ctx.currentPlayer);
            break;
        case "buyCardToHand":
            card = idToCard(eff.a);
            doBuy(G,ctx,card,ctx.currentPlayer);
            break;
        case "share":
            if(region !==Region.NONE){
                if (G.regions[region].share >= eff.a) {
                    obj.shares[region] += eff.a;
                    G.regions[region].share -= eff.a;
                } else {
                    obj.shares[region] += G.regions[region].share;
                    G.regions[region].share = 0
                }
            }
            break
        case "archiveHand":
        case "discardIndustry":
        case "discardAesthetics":
            ctx.events?.setStage?.("chooseTarget");
            break
        case "choice":
            G.e.choices = eff.a;
            ctx.events?.setStage?.(eff.e);
            return;
        case "update":
        case "pay":
        case "comment":
        case "alternative":
            ctx.events?.setStage?.(eff.e);
            return;
        default:
            throw new Error(JSON.stringify(eff));
    }
    if (G.e.stack.length > 0) {
        curEffectExec(G, ctx);
    }
}
export const playerEffExec = (G: IG, ctx: Ctx,p:PlayerID): void => {
    let eff = G.e.stack.pop();
    let obj = G.pub[parseInt(p)];
    let card: INormalOrLegendCard;
    let region = G.e.card.region;
    switch (eff.e) {
        case "none":
            return
        case "share":
            if(region !==Region.NONE){
                if (G.regions[region].share >= eff.a) {
                    obj.shares[region] += eff.a;
                    G.regions[region].share -= eff.a;
                } else {
                    obj.shares[region] += G.regions[region].share;
                    G.regions[region].share = 0
                }
            }
            break
        case "cash":
            obj.cash += eff.a;
            break;
        case "res":
            obj.resource += eff.a;
            break;
        case "vp":
            obj.vp += eff.a;
            break;
        case "drawCard":
            for (let i = 0; i < eff.a; i++) {
                drawCardForPlayer(G, ctx, p);
            }
            break;
        case "buyCard":
            card = idToCard(eff.a);
            doBuy(G,ctx,card,ctx.currentPlayer);
            break;
        case "buyCardToHand":
            card = idToCard(eff.a);
            doBuy(G,ctx,card,ctx.currentPlayer);
            break;
        case "archiveHand":
        case "discardIndustry":
        case "discardAesthetics":
            changePlayerStage(G,ctx,p,"chooseTarget");
            break
        default:
            throw new Error(JSON.stringify(eff));
    }
}

export const aesAward = (G: IG, ctx: Ctx, p: PlayerID): void => {
    let o = G.pub[parseInt(p)];
    if (o.aesthetics > 1) o.vp += 2;
    if (o.aesthetics > 4) o.vp += 1;
    if (o.aesthetics > 7) o.vp += 1;
    if (o.aesthetics >= 10) {
        // TODO
    }
}

export const industryAward = (G: IG, ctx: Ctx, p: PlayerID): void => {
    let o = G.pub[parseInt(p)];
    if (o.industry > 1) o.cash += 2;
    if (o.industry > 4) drawCardForPlayer(G, ctx, p);
    if (o.industry > 7) drawCardForPlayer(G, ctx, p);
    if (o.industry >= 10) {
        // TODO
    }
}

export const cardSlotOnBoard = (G: IG, ctx: Ctx, card: INormalOrLegendCard): ICardSlot | null => {
    if(card.region===Region.NONE)return null;
    let r = G.regions[card.region];
    if (card.category === CardCategory.LEGEND) {
        if (r.legend.card !== null) {
            if (r.legend.card.cardId === card.cardId) {
                return r.legend;
            } else {
                return null;
            }
        } else {
            return null;
        }
    } else {
        for (let slot of r.normal) {
            if (slot.card !== null) {
                if (slot.card.cardId === card.cardId) {
                    return slot;
                }
            }
        }
        return null;
    }
}

export const cardOnBoard = (G: IG, ctx: Ctx, card: INormalOrLegendCard): boolean => {
    return cardSlotOnBoard(G, ctx, card) !== null;
}

export function idOnBoard(G: IG, ctx: Ctx, id: string): boolean {
    return cardOnBoard(G, ctx, idToCard(id));
}

export function cardDepleted(G: IG, ctx: Ctx, region: Region) {
    if(region===Region.NONE)return false;
    let r = G.regions[region];
    return r.legend.card === null && r.normal.filter(value => value.card !== null).length === 0;
}

export function shareDepleted(G: IG, ctx: Ctx, region: Region) {
    if(region===Region.NONE)return false;
    return G.regions[region].share === 0;
}

export function resCost(G: IG, ctx: Ctx, arg: IBuyInfo): number {
    let cost: ICost = arg.target.cost;
    let resRequired = 0;
    let pub = G.pub[parseInt(arg.buyer)]
    let aesthetics: number = cost.aesthetics
    let industry: number = cost.industry
    aesthetics -= pub.aesthetics;
    industry -= pub.industry;
    for (const helperItem of arg.helper) {
        // @ts-ignore
        industry -= helperItem.industry;
        // @ts-ignore
        aesthetics -= helperItem.aesthetics;
    }
    if(aesthetics>0)resRequired+=aesthetics*2;
    if(industry>0)resRequired+=industry*2;
    return resRequired + arg.target.cost.res;
}

export function canAfford(G:IG,ctx:Ctx,card:INormalOrLegendCard,p:PlayerID){
    let pub = G.pub[parseInt(p)]
     let res = resCost(G,ctx,{
         buyer:p,
         target:card,
         helper:G.player[parseInt(p)].hand,
         resource:0,
         cash:0
     })
    return pub.cash + pub.resource >= res;
}

export function canBuyCard(G: IG, ctx: Ctx, arg: IBuyInfo): boolean {
    let resRequired = resCost(G,ctx,arg);
    let resGiven: number = arg.resource + arg.cash;
    return resRequired === resGiven;
}

export const drawForRegion = (G: IG, ctx: Ctx, r: Region, e: IEra): void => {
    if(r===Region.NONE)return;
    let legend = cardsByCond(r, e, true);
    let normal = cardsByCond(r, e, false);
    G.secret.regions[r].legendDeck = shuffle(ctx, legend);
    G.secret.regions[r].normalDeck = shuffle(ctx, normal);
    let l: INormalOrLegendCard[] = G.secret.regions[r].legendDeck;
    let n: INormalOrLegendCard[] = G.secret.regions[r].normalDeck;
    for (let s of G.regions[r].normal) {
        let c = n.pop();
        if (c === undefined) {
            throw new Error(c);
        } else {
            s.card = c;
        }
    }
    let c = l.pop();
    if (c === undefined) {
        throw new Error(c);
    } else {
        G.regions[r].legend.card = c;
    }
}
export const drawCardForPlayer = (G: IG, ctx: Ctx, id: PlayerID): void => {
    let pid = parseInt(id);
    let p = G.player[pid]
    let s = G.secret.playerDecks[pid]
    if (s.length === 0) {
        if (ctx.random === undefined) {
            throw new Error();
        } else {
            s = ctx.random.Shuffle(G.pub[pid].discard)
        }
    }
    let card = s.pop();
    if (card === undefined) {
        // TODO what if player has no card at all?
        throw new Error("Error drawing card");
    } else {
        p.hand.push(card);
    }
}
export const fillPlayerHand = (G: IG, ctx: Ctx, p: PlayerID): void => {
    let i = parseInt(p);
    let s = G.pub[i].school
    let limit: number;
    if (s === null) {
        limit = 4;
    } else {
        limit = 5;
    }
    for (let t = 0; t < limit; t++) {
        drawCardForPlayer(G, ctx, p);
    }
}

export const updateSlot = (G: IG, ctx: Ctx, slot: ICardSlot): void => {
    let d;
    // TODO return basic card
    if(slot.comment!==null){
        // @ts-ignore
        let commentId:BasicCardID = slot.comment.cardId;
        G.basicCards[commentId] ++;
        slot.comment=null;
    }
    if(slot.region===Region.NONE)return;
    if (slot.isLegend) {
        d = G.secret.regions[slot.region].legendDeck;
    } else {
        d = G.secret.regions[slot.region].normalDeck;
    }
    if (d.length === 0) {
        return;
    } else {
        if (slot.card === null) {

        } else {
            d.push(slot.card);
        }
        let c = d.pop();
        if (c !== undefined) {
            slot.card = c;
        }
    }
}
