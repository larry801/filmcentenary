import {TurnConfig, PhaseConfig, LongFormMove} from 'boardgame.io';
import {IG} from "../types/setup";
import {Ctx} from "boardgame.io";
import {CardType, IBasicCard, IBuyInfo, ICard, ICardSlot, IFilmCard, INormalOrLegendCard} from "../types/core";
import {INVALID_MOVE} from "boardgame.io/core";
import {canBuyCard, curPid} from "./util";

export const drawCard: LongFormMove = {
    move: (G: IG, ctx: Ctx) => {
        let pid = parseInt(ctx.currentPlayer);
        let p = G.player[pid]
        let s = G.secret.playerDecks[pid]
        if (s.length === 0) {
            if (ctx.random === undefined) {

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
    },
    client: false,
}

export const buyCard = {
    move(G: IG, ctx: Ctx, arg: IBuyInfo): any {
        if(canBuyCard(G,ctx,arg)){
            let pn:number = curPid(G,ctx);
            let discard = G.pub[pn].discard;
            if (arg.target.type === CardType.S){
                // TODO previous school
                G.pub[pn].school = arg.target;
            }else{
                discard.push(arg.target)
            }
            let card:ICard;
            for(card of arg.helper){
                discard.push(card);
            }
        }else{
            return INVALID_MOVE;
        }
    },
    client:false,
}
export const chooseTarget: LongFormMove = {
    move: (G: IG, ctx: Ctx, arg: IBuyInfo) => {
    }
}
export const chooseEffect: LongFormMove = {
    move: (G: IG, ctx: Ctx, arg: IBuyInfo) => {
    }
}
export const playCard: LongFormMove = {
    move: (G: IG, ctx: Ctx, arg: IBuyInfo) => {
    }
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
        if(f>=5){

        }
        if(f<=5){

        }
    }

}
export const breakthrough: LongFormMove = {
    move: (G: IG, ctx: Ctx, arg: IBuyInfo) => {
    }
}

export interface ICommentArg {
    target: ICardSlot,
    comment: IBasicCard | null,
}

export const comment: LongFormMove = {
    move: (G: IG, ctx: Ctx, arg: ICommentArg) => {
        if (arg.comment === null && arg.target.comment !== null) {
            arg.target.comment = null;
        } else {
            arg.target.comment = arg.comment;
        }
    }
}
