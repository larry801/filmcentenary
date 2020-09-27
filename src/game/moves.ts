import {Ctx, LongFormMove, PlayerID} from 'boardgame.io';
import {IG} from "../types/setup";
import {
    EventCardID,
    IBasicCard,
    IBuyInfo,
    ICard,
    ICardSlot,
    IFilmCard,
    INormalOrLegendCard,
    IPubInfo,
    Region
} from "../types/core";
import {INVALID_MOVE} from "boardgame.io/core";
import {
    aesAward,
    canBuyCard, checkNextEffect,
    checkRegionScoring,
    cinemaSlotsAvailable,
    curEffectExec,
    curPid,
    curPub,
    doAestheticsBreakthrough,
    doBuy,
    doIndustryBreakthrough,
    doUpdateSlot,
    drawCardForPlayer,
    fillPlayerHand,
    industryAward,
    playerEffExec,
    studioSlotsAvailable,
} from "./util";
import {changeStage, signalEndPhase, signalEndTurn} from "./logFix";
import {getCardEffect, getEvent} from "../constant/effects";
import {B05} from "../constant/cards/basic";

export const drawCard: LongFormMove = {
    move: (G: IG, ctx: Ctx) => {
        curPub(G, ctx).action--;
        drawCardForPlayer(G, ctx, ctx.currentPlayer);
    },
    client: false,
}

export const buyCard = {
    move(G: IG, ctx: Ctx, arg: IBuyInfo): any {
        console.log(JSON.stringify(arg));
        if (canBuyCard(G, ctx, arg)) {
            let p = curPub(G, ctx);
            p.action--;
            p.resource -= arg.resource;
            p.deposit -= arg.deposit;
            arg.helper.forEach(c => {
                let pHand = G.player[parseInt(arg.buyer)].hand;
                let idx = pHand.indexOf(c)
                let helper: ICard = pHand.splice(idx, 1)[0];
                p.discard.push(helper);
            })
            doBuy(G, ctx, arg.target as INormalOrLegendCard | IBasicCard, ctx.currentPlayer);
            let eff = getCardEffect(arg.target.cardId);
            G.e.stack.push(eff.buy);
            curEffectExec(G, ctx);
        } else {
            return INVALID_MOVE;
        }

    },
    client: false,
}

export const chooseTarget: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: PlayerID) => {
        playerEffExec(G, ctx, arg);
    }
}

export const chooseHand: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: string) => {
        let eff = G.e.stack.pop();
        let player = ctx.playerID !== undefined ? ctx.playerID : ctx.currentPlayer;
        let hand = G.player[parseInt(player)].hand;
        let pub = G.pub[parseInt(player)];
        // @ts-ignore
        let card: IBasicCard | INormalOrLegendCard = hand[parseInt(arg)]
        switch (eff.e) {
            case "refactor":
                hand.splice(parseInt(arg), 1);
                pub.archive.push(card);
                // @ts-ignore
                pub.vp += (card.vp + G.e.card.vp);
                doBuy(G, ctx, B05, player);
                break;
            default:
                throw  new Error();
        }
    }
}

export const chooseEffect: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: string) => {
        let eff = G.e.choices[parseInt(arg)];
        let p = ctx.playerID === undefined ? ctx.currentPlayer : ctx.playerID
        let regions: Region[];
        switch (eff.e) {
            case "buildStudio":
                G.e.choices = [];
                G.e.stack.push(eff);
                regions = studioSlotsAvailable(G, ctx, p);
                regions.forEach(r => G.e.regions.push(r));
                changeStage(G, ctx, "chooseRegion");
                return;
            case "buildCinema":
                G.e.choices = [];
                G.e.stack.push(eff);

                regions = cinemaSlotsAvailable(G, ctx, p);
                regions.forEach(r => G.e.regions.push(r));
                changeStage(G, ctx, "chooseRegion");
                return;
        }
        G.e.stack.push(eff);
        console.log(JSON.stringify(eff));
        curEffectExec(G, ctx);
        checkNextEffect(G,ctx);
    }
}

export const updateSlot = {
    client: false,
    move: (G: IG, ctx: Ctx, slot: ICardSlot) => {
        doUpdateSlot(G, ctx, slot);
    }
}
export const chooseRegion = {
    client: false,
    move: (G: IG, ctx: Ctx, region: string) => {
        let r = parseInt(region) as Region;
        if (r === Region.NONE) return;
        let eff = G.e.stack.pop();
        let p = ctx.playerID === undefined ? ctx.currentPlayer : ctx.playerID
        switch (eff.e) {
            case "buildStudio":
                G.e.regions = [];
                G.regions[r].buildings.forEach(slot => {
                    if (slot.activated && slot.owner === "") {
                        slot.owner = p;
                        slot.content = "studio"
                        slot.isCinema = false;
                        G.pub[parseInt(p)].building.studioBuilt = true;
                        checkNextEffect(G,ctx);
                        return;
                    }
                })
                break;
            case "buildCinema":
                G.regions[r].buildings.forEach(slot => {
                    if (slot.activated && slot.owner === "") {
                        slot.owner = p;
                        slot.content = "cinema"
                        slot.isCinema = true;
                        G.pub[parseInt(p)].building.cinemaBuilt = true;
                        checkNextEffect(G,ctx);
                        return;
                    }
                })
                break;
            default:
                throw new Error();
        }
    }
}
export const chooseEvent: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: string) => {
        // @ts-ignore
        let eid: EventCardID = G.events[parseInt(arg)].cardId;
        G.e.stack.push(getEvent(eid));
        curEffectExec(G, ctx);
        if (G.e.stack.length === 0) {
            ctx?.events?.endStage?.();
        }
    }
}
export const requestEndTurn: LongFormMove = {
    client: false,
    undoable: false,
    move: (G: IG, ctx: Ctx, arg: string) => {
        let obj = G.pub[parseInt(arg)]
        obj.playedCardInTurn.forEach(c => obj.discard.push(c));
        obj.playedCardInTurn = [];
        if (obj.school !== null) {
            let act = getCardEffect(obj.school.cardId).school.action;
            if (act === 1) {
                if (G.activeEvents.includes(EventCardID.E03)) {
                    obj.action = 2
                } else {
                    obj.action = 1
                }
            } else {
                obj.action = act;
            }
        } else {
            if (G.activeEvents.includes(EventCardID.E03)) {
                obj.action = 2
            } else {
                obj.action = 1
            }
        }
        fillPlayerHand(G, ctx, ctx.currentPlayer);
        aesAward(G, ctx, ctx.currentPlayer);
        industryAward(G, ctx, ctx.currentPlayer);
        let na = checkRegionScoring(G, ctx, Region.NA);
        if (na) {

        }
        obj.resource = 0;
        signalEndTurn(G, ctx);
    },
}

export const moveBlocker: LongFormMove = {
    client: false,
    move: () => {
        return INVALID_MOVE;
    },
}

export const confirmRespond: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: string) => {
        if (arg === "yes") {

        } else {
            G.e.stack.pop();
        }
        curEffectExec(G, ctx);
    },
}

export interface IPlayCardInfo {
    card: ICard,
    idx: number,
    playerID: PlayerID,
    res: number,
}

export const playCard: LongFormMove = {
    move: (G: IG, ctx: Ctx, arg: IPlayCardInfo) => {
        let c = G.player[curPid(G, ctx)].hand.splice(arg.idx, 1);
        G.e.card = c[0];
        G.e.stack.push(getCardEffect(c[0].cardId).play)
        curEffectExec(G, ctx);
    },
    client: false,
}

export const competitionCard: LongFormMove = {
    move: (G: IG, ctx: Ctx, arg: IFilmCard) => {
        let f = arg.cost.res;
        let i = G.competitionInfo;
        if (arg.industry > 0) {
            f++;
        }
        // @ts-ignore
        if (arg.region === i.region) {
            f++;
        }
        if (ctx.currentPlayer === i.atk) {
            i.progress += f;
        } else {
            i.progress -= f;
        }
        if (f >= 5) {

        }
        if (f <= 5) {

        }
    },
    client: false,
}

export const breakthrough: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: IPlayCardInfo) => {
        let p = G.pub[parseInt(arg.playerID)];
        let playerObj = G.player[parseInt(arg.playerID)];
        p.action -= 1;
        p.resource -= arg.res;
        p.deposit -= (2 - arg.res);
        // @ts-ignore
        let c: INormalOrLegendCard | IBasicCard = playerObj.hand.splice(arg.idx, 1)[0];
        p.archive.push(c);
        let i = c.industry
        let a = c.aesthetics
        if (i === 0 && a === 0) {
            return;
        }
        if (i > 0 && a > 0) {
            G.e.choices.push({e: "industryBreakthrough", a: p.industry})
            G.e.choices.push({e: "aestheticsBreakthrough", a: p.aesthetics})
            changeStage(G, ctx, "chooseEffect")
        } else {
            if (i === 0) {
                doAestheticsBreakthrough(G, ctx, arg.playerID);
            } else {
                doIndustryBreakthrough(G, ctx, arg.playerID);
            }
        }
    }
}


export interface ICommentArg {
    target: ICardSlot,
    comment: IBasicCard | null,
}

export const comment: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: ICommentArg) => {
        if (arg.comment === null && arg.target.comment !== null) {
            arg.target.comment = null;
        } else {
            arg.target.comment = arg.comment;
        }
    }
}

export const initialSetup: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, args: IPubInfo[]) => {
        console.log(JSON.stringify(args));
        signalEndPhase(G, ctx);
    },
}
