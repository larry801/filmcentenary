import {Ctx, LongFormMove, PlayerID} from 'boardgame.io';
import {IG} from "../types/setup";
import {
    EventCardID,
    IBasicCard,
    IBuyInfo,
    ICard,
    ICardSlot,
    IEra,
    INormalOrLegendCard,
    IPubInfo,
    Region,
    ValidRegions
} from "../types/core";
import {INVALID_MOVE} from "boardgame.io/core";
import {
    aesAward,
    atkCardSettle, breakthroughEffectExec,
    buildingInRegion,
    canBuyCard,
    checkCompetitionDefender,
    checkNextEffect,
    checkRegionScoring,
    cinemaInRegion,
    cinemaSlotsAvailable,
    curEffectExec,
    curPub,
    doAestheticsBreakthrough,
    doBuy,
    doIndustryBreakthrough,
    doReturnSlotCard,
    drawCardForPlayer,
    fillEmptySlots,
    fillEventCard,
    fillPlayerHand,
    industryAward, logger,
    playerEffExec,
    schoolPlayer, startBreakThrough,
    startCompetition,
    studioSlotsAvailable,
    tryScoring,
} from "./util";
import { changeStage, signalEndPhase} from "./logFix";
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
                p.playedCardInTurn.push(helper);
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
export interface ITargetChooseArgs {
    p:PlayerID,
    idx:number,
    target:PlayerID,
}
export const chooseTarget: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: ITargetChooseArgs) => {
        let src = arg.p;
        let p = arg.target;
        let eff = G.e.stack.pop();
        switch (eff.e) {
            case "loseVpForEachHand":
                G.c.players = [];
                let handCount =  G.player[parseInt(p)].hand.length;
                G.pub[parseInt(p)].vp -= handCount;
                break;
            case "competition":
                G.c.players = [];
                G.e.stack.push(eff);
                G.competitionInfo.progress = eff.a.bonus;
                G.competitionInfo.onWin = eff.a.onWin;
                startCompetition(G, ctx, src, p);
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
            default:
                playerEffExec(G, ctx, p);
        }
    }
}
export interface IChooseHandArg {
    p:PlayerID,
    hand:ICard,
    idx:number,
}
export const chooseHand: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg:IChooseHandArg) => {
        let eff = G.e.stack.pop();
        let p = arg.p;
        let hand = G.player[parseInt(p)].hand;
        let pub = G.pub[parseInt(p)];
        // @ts-ignore
        let card: IBasicCard | INormalOrLegendCard = arg.hand;
        switch (eff.e) {
            case "breakthroughResDeduct":
                pub.action --;
                hand.splice(arg.idx, 1);
                pub.archive.push(card);
                if (arg.hand.cardId === "1108") {
                    if (pub.deposit < 1) {
                        return;
                    }else {
                        pub.deposit --;
                    }
                }
                startBreakThrough(G,ctx,arg.p);
                break;
            case "archiveToEEBuildingVP":
                hand.splice(arg.idx, 1);
                pub.archive.push(card);
                if (buildingInRegion(G, ctx, Region.EE, p)) {
                    G.pub[parseInt(p)].vp += card.vp;
                }
                break
            case "handToOthers":
                hand.splice(arg.idx, 1);
                let targetPub = G.player[parseInt(G.c.players[0])];
                targetPub.hand.push(card);
                break;
            case "refactor":
                hand.splice(arg.idx, 1);
                pub.archive.push(card);
                // @ts-ignore
                pub.vp += (card.vp + G.e.card.vp);
                doBuy(G, ctx, B05, p);
                break;
            case "archive":
                hand.splice(arg.idx, 1);
                pub.archive.push(card);
                break;
            case "discard":
            case "discardIndustry":
            case "discardAesthetics":
            case "discardNormalOrLegend":
                hand.splice(arg.idx, 1);
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
export interface IEffectChooseArg {
    effect:any,
    idx:number,
    p:PlayerID,
}
export const chooseEffect: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: IEffectChooseArg) => {
        let eff = G.e.choices[arg.idx];
        let p = ctx.playerID === undefined ? ctx.currentPlayer : ctx.playerID
        let regions: Region[];
        let top;
        switch (eff.e) {
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
                playerEffExec(G, ctx, p);
                return;
        }
    }
}

export const updateSlot = {
    client: false,
    move: (G: IG, ctx: Ctx, slot: ICardSlot) => {
        doReturnSlotCard(G, ctx, slot);
        fillEmptySlots(G,ctx);
        checkNextEffect(G, ctx);
    }
}
export interface IRegionChooseArg {
    r:Region,
    idx:number,
    p:PlayerID,
}
export const chooseRegion = {
    client: false,
    move: (G: IG, ctx: Ctx, arg:IRegionChooseArg) => {
        let r = arg.r;
        if (r === Region.NONE) return;
        let eff = G.e.stack.pop();
        let p = arg.p;
        let built = false;
        switch (eff.e) {
            case "buildStudio":
                G.regions[r].buildings.forEach(slot => {
                    if (slot.activated && slot.owner === "" && !built) {
                        slot.owner = p;
                        slot.content = "studio"
                        slot.isCinema = false;
                        G.pub[parseInt(p)].building.studioBuilt = true;
                        G.e.regions = [];
                        built = true;
                    }
                })
                break;
            case "buildCinema":
                G.regions[r].buildings.forEach(slot => {
                    if (slot.activated && slot.owner === "" && !built) {
                        slot.owner = p;
                        slot.content = "cinema"
                        slot.isCinema = true;
                        G.pub[parseInt(p)].building.cinemaBuilt = true;
                        G.e.regions = [];
                        built = true;
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
                    if (eff.a > 1) {
                        eff.a--;
                        G.e.stack.push(eff);
                        checkNextEffect(G, ctx);
                        return;
                    } else {
                        break;
                    }
                } else {
                    G.pub[parseInt(p)].shares[r]++;
                    G.regions[r].share--;
                    if (eff.a > 1) {
                        eff.a--;
                        G.e.stack.push(eff);
                        checkNextEffect(G, ctx);
                        return;
                    } else {
                        break;
                    }
                }
            default:
                throw new Error();
        }
        G.e.regions = [];
        checkNextEffect(G, ctx);
        return;
    }
}
export interface IPeekArgs {
    idx:number,
    card:INormalOrLegendCard,
    p:PlayerID,
}
export const peek: LongFormMove = {
    client: false,
    undoable: false,
    move: (G: IG, ctx: Ctx, args: IPeekArgs) => {
        let eff = G.e.stack.pop();
        let p = args.p;
        let playerObj = G.player[parseInt(p)];
        let pub = G.pub[parseInt(p)];
        switch (eff.a.filter.e) {
            case "industry":
                for (let card of playerObj.cardsToPeek) {
                    let c = card as INormalOrLegendCard;
                    if (c.industry > 0) {
                        playerObj.hand.push(c);
                    } else {
                        pub.discard.push(c);
                    }
                }
                playerObj.cardsToPeek = []
                break;
            case "aesthetics":
                for (let card of playerObj.cardsToPeek) {
                    let c = card as INormalOrLegendCard;
                    if (c.aesthetics > 0) {
                        playerObj.hand.push(c);
                    } else {
                        pub.discard.push(c);
                    }
                }
                playerObj.cardsToPeek = []
                break;
            case "era":
                for (let card of playerObj.cardsToPeek) {
                    let c = card as INormalOrLegendCard;
                    if (c.era === eff.a.filter.a) {
                        playerObj.hand.push(c);
                    } else {
                        pub.discard.push(c);
                    }
                }
                playerObj.cardsToPeek = []
                break;
            case "choice":
                playerObj.cardsToPeek.splice(args.idx,1);
                playerObj.hand.push(args.card);
                if(eff.a.filter.a > 1){
                    eff.a.filter.a --;
                    G.e.stack.push(eff);
                    return;
                }else{
                    playerObj.cardsToPeek = []
                }
                break;
        }
        checkNextEffect(G, ctx);
    }
}
export interface IChooseEventArg {
    idx:number,
    event:EventCardID,
    p:PlayerID
}
export const chooseEvent: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: IChooseEventArg) => {
        let eid: EventCardID = arg.event;
        G.events.splice(arg.idx,1);
        if (eid === EventCardID.E03) {
            G.activeEvents.push(EventCardID.E03);
            for(let i=0;i<ctx.numPlayers;i++){
                G.pub[i].action = 2;
            }
        } else {
            switch (eid) {
                case EventCardID.E01:
                case EventCardID.E02:
                case EventCardID.E04:
                case EventCardID.E05:
                case EventCardID.E06:
                case EventCardID.E07:
                case EventCardID.E08:
                case EventCardID.E09:
                    G.e.stack.push(getEvent(eid));
                    playerEffExec(G, ctx,arg.p);
                    break;
                default:
                    G.pub[parseInt(arg.p)].scoreEvents.push(eid);
                    fillEventCard(G,ctx);
                    checkNextEffect(G,ctx);
            }
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
            if (r === Region.ASIA && G.regions[Region.ASIA].era === IEra.ONE) return;
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
        let eff = G.e.stack.pop();
        if (arg === "yes") {
            switch (eff.e) {
                case "pay":
                    G.e.stack.push(eff.a.eff)
                    curEffectExec(G, ctx);
                    break;
                case "optional":
                case "alternative":
                    G.e.stack.push(eff.a)
                    curEffectExec(G, ctx);
                    break;
                default:
                    throw new Error();
            }
        } else {
            switch (eff.e) {
                case "alternative":
                    breakthroughEffectExec(G,ctx);
                    return;
                default:
                    G.e.stack.pop();

            }
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
        let pub = G.pub[parseInt(arg.playerID)];
        let hand = G.player[parseInt(arg.playerID)].hand;
        if (cinemaInRegion(G, ctx, arg.card.region, arg.playerID)) {
            pub.resource++;
            pub.vp++;
        }
        hand.splice(arg.idx,1);
        pub.playedCardInTurn.push(arg.card);
        G.e.card = arg.card;
        G.e.stack.push(getCardEffect(arg.card.cardId).play)
        curEffectExec(G, ctx);
    },
    client: false,
}

export interface ICompetitionCardArg {
    pass: boolean,
    card: INormalOrLegendCard,
    idx :number,
    p:PlayerID,
}

export const competitionCard: LongFormMove = {
    client: false,
    redact: true,
    move: (G: IG, ctx: Ctx, arg: ICompetitionCardArg) => {
        let p = arg.p;
        G.player[parseInt(p)].competitionCards.push(arg.card);
        let i = G.competitionInfo;
        if (p === i.atk) {
            i.atkPlayedCard = true;
            checkCompetitionDefender(G,ctx);
            return;
        } else {
            if (p === i.def) {
                i.defPlayedCard = true;
                atkCardSettle(G,ctx);
            } else {
                logger.debug("Other player cannot move in competition card stage!")
            }
        }

    },
}

export const breakthrough: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: IPlayCardInfo) => {
        logger.log("debug",arg);
        let p = G.pub[parseInt(arg.playerID)];
        p.action -= 1;
        p.resource -= arg.res;
        p.deposit -= (2 - arg.res);
        let c = arg.card;
        G.e.card = c;
        G.player[parseInt(arg.playerID)].hand.splice(arg.idx, 1);
        p.archive.push(c);
        if (arg.card.cardId === "1108") {
            if (p.deposit < 1) {
                return INVALID_MOVE;
            } else {
                p.deposit -= 1;
            }
        }
        startBreakThrough(G,ctx,arg.playerID);
    }
}


export interface ICommentArg {
    target: ICardSlot,
    comment: IBasicCard | null,
    pid: PlayerID,
}

export const comment: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: ICommentArg) => {
        if (arg.comment === null && arg.target.comment !== null) {
            arg.target.comment = null;
        } else {
            arg.target.comment = arg.comment;
        }
        // let p = schoolPlayer(G,ctx,"S3204")
        let p = schoolPlayer(G, ctx, "3204");
        if (p !== null) {
            drawCardForPlayer(G, ctx, p);
        }
        let pub = G.pub[parseInt(arg.pid)];
        if (pub.school?.cardId === "2204") {
            pub.resource++;
            pub.vp++;
        }

    }
}

export const initialSetup: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, args: IPubInfo[]) => {
        signalEndPhase(G, ctx);
    },
}
