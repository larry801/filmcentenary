import {Ctx, LongFormMove, PlayerID} from 'boardgame.io';
import {IG} from "../types/setup";
import {
    EventCardID,
    IBasicCard,
    IBuyInfo,
    ICard,
    ICardSlot,
    IEra,
    IFilmCard,
    INormalOrLegendCard,
    IPubInfo,
    Region,
    ValidRegions
} from "../types/core";
import {INVALID_MOVE} from "boardgame.io/core";
import {
    aesAward,
    buildingInRegion,
    canBuyCard,
    checkNextEffect,
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
    nextPlayer,
    playerEffExec, startCompetition,
    studioSlotsAvailable,
    tryScoring,
} from "./util";
import {changePlayerStage, changeStage, signalEndPhase} from "./logFix";
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
            if (eff.e !== "none") {
                G.e.stack.push(eff.buy);
                checkNextEffect(G, ctx);
            }
        } else {
            return INVALID_MOVE;
        }

    },
    client: false,
}

export const chooseTarget: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: PlayerID) => {
        let src = ctx.playerID === undefined ? ctx.currentPlayer:ctx.playerID;
        let p = arg;
        let eff = G.e.stack.pop();
        switch (eff.e) {
            case "competition":
                G.c.players = [];
                startCompetition(G,ctx,src,p);
                return;
            case "loseAnyRegionShare":
                G.c.players = [];
                G.e.regions = ValidRegions.filter(
                    // @ts-ignore
                    r => G.pub[parseInt(p)].shares[r] > 0
                )
                G.e.stack.push(eff);
                changeStage(G, ctx, "chooseRegion")
                return;
        }
        playerEffExec(G, ctx, arg);
    }
}

export const chooseHand: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: string) => {
        let eff = G.e.stack.pop();
        let p = ctx.playerID !== undefined ? ctx.playerID : ctx.currentPlayer;
        let hand = G.player[parseInt(p)].hand;
        let pub = G.pub[parseInt(p)];
        // @ts-ignore
        let card: IBasicCard | INormalOrLegendCard = hand[parseInt(arg)]
        switch (eff.e) {
            case "everyPlayer":
                switch (eff.e.a.e) {
                    case "discard":
                        hand.splice(parseInt(arg), 1);
                        pub.discard.push(card);
                        if (eff.e.a.a > 1) {
                            eff.e.a.a--;
                        } else {
                            nextPlayer(G, ctx);
                        }
                        G.e.stack.push(eff);
                        return;
                    case "archiveToEEBuildingVP":
                        hand.splice(parseInt(arg), 1);
                        pub.archive.push(card);
                        if (buildingInRegion(G, ctx, Region.EE, p)) {
                            G.pub[parseInt(p)].vp += card.vp;
                        }
                        G.e.stack.push(eff);
                        nextPlayer(G, ctx);
                        return;
                    default:
                        throw new Error()
                }
            case "handToOthers":
                hand.splice(parseInt(arg), 1);
                let targetPub = G.player[parseInt(G.c.players[0])];
                targetPub.hand.push(card);
                break;
            case "refactor":
                hand.splice(parseInt(arg), 1);
                pub.archive.push(card);
                // @ts-ignore
                pub.vp += (card.vp + G.e.card.vp);
                doBuy(G, ctx, B05, p);
                break;
            case "archive":
                hand.splice(parseInt(arg), 1);
                pub.archive.push(card);
                break;
            case "discard":
            case "discardIndustry":
            case "discardAesthetics":
                hand.splice(parseInt(arg), 1);
                pub.discard.push(card);
                if (eff.a > 1) {
                    eff.a--;
                    G.e.stack.push(eff);
                    return;
                }
                break;
            default:
                throw new Error();
        }
        checkNextEffect(G, ctx);
    }
}

export const chooseEffect: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: string) => {
        let eff = G.e.choices[parseInt(arg)];
        let p = ctx.playerID === undefined ? ctx.currentPlayer : ctx.playerID
        let regions: Region[];
        let top;
        switch (eff.e) {
            case "everyPlayer":
                G.e.stack.push(eff);
                switch (eff.e.a.e) {
                    case "industryOrAestheticsLevelUp":
                        G.e.choices = [];
                        G.e.stack.push(eff);
                        playerEffExec(G, ctx, p);
                        nextPlayer(G, ctx);
                        return;
                    default:
                        throw new Error()
                }
            case "industryBreakthrough":
                top = G.e.stack.pop();
                if (top.e === "industryOrAestheticsBreakthrough") {
                    top.a.industry--;
                }
                G.e.stack.push(top);
                G.e.choices = [];
                doIndustryBreakthrough(G, ctx, p);
                return;
            case "aestheticsBreakthrough":
                top = G.e.stack.pop();
                if (top.e === "industryOrAestheticsBreakthrough") {
                    top.a.industry--;
                }
                G.e.stack.push(top);
                G.e.choices = [];
                doAestheticsBreakthrough(G, ctx, p);
                break;
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
            default:
                G.e.choices = [];
                G.e.stack.push(eff);
                playerEffExec(G,ctx,p);
                return;
        }
    }
}

export const updateSlot = {
    client: false,
    move: (G: IG, ctx: Ctx, slot: ICardSlot) => {
        doUpdateSlot(G, ctx, slot);
        checkNextEffect(G, ctx);
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
                G.regions[r].buildings.forEach(slot => {
                    if (slot.activated && slot.owner === "") {
                        slot.owner = p;
                        slot.content = "studio"
                        slot.isCinema = false;
                        G.pub[parseInt(p)].building.studioBuilt = true;
                        G.e.regions = [];
                        checkNextEffect(G, ctx);
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
                        G.e.regions = [];
                        checkNextEffect(G, ctx);
                        return;
                    }
                })
                break;
            case "loseAnyRegionShare":
                p = G.c.players[0] as PlayerID;
                G.pub[parseInt(p)].shares[r]--;
                G.regions[r].share++;
                break;
            case "anyRegionShare":
                let i = G.competitionInfo;
                if (i.pending) {
                    let loser = i.progress > 0 ? i.def : i.atk;
                    G.pub[parseInt(loser)].shares[r]--;
                    G.pub[parseInt(p)].shares[r]++;
                    if(eff.a>1){
                        eff.a--;
                        G.e.stack.push(eff);
                        checkNextEffect(G,ctx);
                        return;
                    }else {
                        break;
                    }
                } else {
                    G.pub[parseInt(p)].shares[r]++;
                    G.regions[r].share++;
                    break;
                }
            default:
                throw new Error();
        }
        G.e.regions = [];
        checkNextEffect(G, ctx);
        return;
    }
}

export const peek: LongFormMove = {
    client: false,
    undoable: false,
    move: (G: IG, ctx: Ctx, args: any) => {
        let eff = G.e.stack.pop();
        let p = ctx.playerID === undefined ? ctx.currentPlayer : ctx.playerID;
        let playerObj = G.player[parseInt(p)];
        let pub = G.pub[parseInt(p)];
        switch (eff.e) {
            case "peekIndustry":
                for (let card of playerObj.cardsToPeek) {
                    let c = card as INormalOrLegendCard;
                    if (c.industry > 0) {
                        playerObj.hand.push(c);
                    } else {
                        pub.discard.push(c);
                    }
                }
                break;
            case "peekAesthetics":
                for (let card of playerObj.cardsToPeek) {
                    let c = card as INormalOrLegendCard;
                    if (c.aesthetics > 0) {
                        playerObj.hand.push(c);
                    } else {
                        pub.discard.push(c);
                    }
                }
                break;
        }
        checkNextEffect(G, ctx);
    }
}

export const chooseEvent: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: string) => {
        let eid: EventCardID = G.events[parseInt(arg)].cardId as EventCardID;
        G.e.stack.push(getEvent(eid));
        if(eid===EventCardID.E02){

        }
        else{
            curEffectExec(G, ctx);
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
        ValidRegions.forEach(r => {
            if(r===Region.ASIA && G.regions[Region.ASIA].era === IEra.ONE)return;
            let canScore = checkRegionScoring(G, ctx, r);
            if (canScore) {
                G.scoringRegions.push(r)
            }
        })
        obj.resource = 0;
        tryScoring(G, ctx);
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
            let eff = G.e.stack.pop();
            switch (eff.e) {
                case "pay":
                    G.e.stack.push(eff.a.eff)
                    curEffectExec(G, ctx);
                    break;
                case "optional":
                    G.e.stack.push(eff.a)
                    curEffectExec(G, ctx);
                    break;
                default:
                    throw new Error();
            }
        } else {
            G.e.stack.pop();
        }
        checkNextEffect(G, ctx);
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
    client: false,
    redact: true,
    move: (G: IG, ctx: Ctx, arg: IFilmCard) => {
        let p = ctx.playerID === undefined ? ctx.currentPlayer : ctx.playerID;
        G.player[parseInt(p)].competitionCards.push(arg);

        let i = G.competitionInfo;
        if (p === i.atk) {
            i.atkPlayedCard = true;
            changePlayerStage(G, ctx, "competitionCard", i.def);
            return;
        } else {
            if (p === i.def) {
                i.defPlayedCard = true;

            } else {
                throw new Error();
            }
        }

    },
}

export const breakthrough: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: IPlayCardInfo) => {
        let p = G.pub[parseInt(arg.playerID)];
        let playerObj = G.player[parseInt(arg.playerID)];
        p.action -= 1;
        // TODO let player choose 2res/1res 1dep /2dep
        p.resource -= arg.res;
        p.deposit -= (2 - arg.res);
        // @ts-ignore
        let c: INormalOrLegendCard | IBasicCard = playerObj.hand.splice(arg.idx, 1)[0];
        p.archive.push(c);
        let eff = getCardEffect(c.cardId).archive;
        if (eff)
            if (c.cardId === "1108") {
                if (p.deposit < 1) {
                    return INVALID_MOVE;
                } else {
                    p.deposit -= 1;
                }
            }
        if (c.cardId === "1208") {
            G.e.stack.push({
                e: "industryOrAestheticsBreakthrough", a: {
                    industry: p.industry,
                    aesthetics: p.aesthetics,
                }
            })
            curEffectExec(G, ctx);
            return;
        }

        let i = c.industry
        let a = c.aesthetics
        if (i === 0 && a === 0) {
            return;
        }
        if (i > 0 && a > 0) {
            G.e.stack.push({
                e: "industryOrAestheticsBreakthrough", a: {
                    industry: p.industry,
                    aesthetics: p.aesthetics,
                }
            })
            curEffectExec(G, ctx);
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
        signalEndPhase(G, ctx);
    },
}
