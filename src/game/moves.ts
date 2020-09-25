import {LongFormMove, PlayerID} from 'boardgame.io';
import {IG} from "../types/setup";
import {Ctx} from "boardgame.io";
import {
    CardType,
    IBasicCard,
    IBuyInfo,
    ICard,
    ICardSlot,
    IFilmCard,
    IPubInfo
} from "../types/core";
import {INVALID_MOVE} from "boardgame.io/core";
import {
    canBuyCard,
    curPid,
    drawCardForPlayer,
    curEffectExec,
    curPub,
    doBuy,
    playerEffExec
} from "./util";
import {changeStage, signalEndPhase} from "./logFix";
import {getCardEffect} from "../constant/effects";

export const drawCard: LongFormMove = {
    move: (G: IG, ctx: Ctx) => {
        curPub(G,ctx).action --;
        drawCardForPlayer(G, ctx, ctx.currentPlayer);
    },
    client: false,
}

export const buyCard = {
    move(G: IG, ctx: Ctx, arg: IBuyInfo): any {
        if (canBuyCard(G, ctx, arg)) {
            let pn: number = curPid(G, ctx);
            let discard = G.pub[pn].discard;
            if (arg.target.type === CardType.S) {
                // TODO previous school response
                G.pub[pn].school = arg.target;
            } else {
                discard.push(arg.target)
            }
            let card: ICard;
            for (card of arg.helper) {
                discard.push(card);
            }
        } else {
            return INVALID_MOVE;
        }
        let p = curPub(G,ctx);
        p.action --;
        p.resource -= arg.resource;
        p.deposit -= arg.deposit;
        arg.helper.forEach(c=>{
            let pHand =G.player[parseInt(arg.buyer)].hand;
            let idx = pHand.indexOf(c)
            pHand.splice(idx,1);
        })
        // @ts-ignore
        doBuy(G,ctx,arg.target,ctx.currentPlayer);
        let eff = getCardEffect(arg.target.cardId);
        G.e.stack.push(eff.buy);
        curEffectExec(G,ctx);
    },
    client: false,
}
export const chooseTarget: LongFormMove = {
    client:false,
    move: (G: IG, ctx: Ctx, arg: PlayerID) => {
        playerEffExec(G,ctx,arg);
    }
}

export const chooseHand: LongFormMove = {
    client:false,
    move: (G: IG, ctx: Ctx, arg: number) => {

    }
}

export const chooseEffect: LongFormMove = {
    client:false,
    move: (G: IG, ctx: Ctx, arg: string) => {
        let eff = G.e.choices[parseInt(arg)];
        G.e.stack.push(eff);
        G.e.choices = []
        curEffectExec(G,ctx);
    }
}

export const requesetEndTurn:LongFormMove = {
    client:false,
    move: (G: IG, ctx: Ctx, arg: string) => {

    }
}

export const moveBlocker: LongFormMove = {
    client:false,
    move: (G: IG, ctx: Ctx, arg: boolean) => {
        return INVALID_MOVE;
    },
}

export const confirmRespond: LongFormMove = {
    client:false,
    move: (G: IG, ctx: Ctx, arg: string) => {
        if(arg==="yes"){

        }else {
            G.e.stack.pop();
        }
        curEffectExec(G, ctx);
    },
}

export interface IPlayCardInfo {
    card: ICard,
    idx: number,
    playerID:PlayerID,
    res:number,
}

export const playCard: LongFormMove = {
    move: (G: IG, ctx: Ctx, arg: IPlayCardInfo) => {
        let c = G.player[curPid(G, ctx)].hand.splice(arg.idx, 1);
        G.e.card = c[0];
        G.e.stack.push(getCardEffect(c[0].cardId).play)
        curEffectExec(G, ctx);
    },
    client:false,
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
    client:false,
}

export const breakthrough: LongFormMove = {
    client:false,
    move: (G: IG, ctx: Ctx, arg: IPlayCardInfo) => {
        let p = G.pub[parseInt(arg.playerID)];
        let playerObj = G.player[parseInt(arg.playerID)];
        p.action -= 1;
        p.resource -= arg.res;
        p.deposit -= (2 - arg.res);
        let c = G.player[curPid(G, ctx)].hand.splice(arg.idx, 1)[0];
        p.archive.push(c);
        if(p.industry === 0 && p.aesthetics === 0) {
            return;
        }
        if(p.industry > 0 && p.aesthetics >0){
            G.e.choices.push({e:"industryBreakthrough",a:p.industry})
            G.e.choices.push({e:"aestheticsBreakthrough",a:p.aesthetics})
            changeStage(G,ctx,"chooseEffect")
        }else{
            if(p.industry === 0) {
                if(playerObj.hand.length===0){
                    p.aesthetics ++;
                }else {
                    G.e.choices.push({e:"aestheticsLevelUp",a:1})
                    G.e.choices.push({e:"refactor",a:1})
                    changeStage(G,ctx,"chooseEffect")
                }
            }else{
                if(p.resource + p.deposit < 3){
                    p.industry ++;
                }else {
                    G.e.choices.push({e: "industryLevelUp", a: 1})
                    G.e.choices.push({e: "buildStudio", a: 1})
                    G.e.choices.push({e: "buildCinema", a: 1})
                    changeStage(G, ctx, "chooseEffect")
                }
            }

        }
    }
}

export interface ICommentArg {
    target: ICardSlot,
    comment: IBasicCard | null,
}

export const comment: LongFormMove = {
    client:false,
    move: (G: IG, ctx: Ctx, arg: ICommentArg) => {
        if (arg.comment === null && arg.target.comment !== null) {
            arg.target.comment = null;
        } else {
            arg.target.comment = arg.comment;
        }
    }
}

export const initialSetup: LongFormMove = {
    client:false,
    move: (G: IG, ctx: Ctx, args: IPubInfo[]) => {
        signalEndPhase(G,ctx);
    },
}
