import {Ctx, LongFormMove, PlayerID} from 'boardgame.io';
import {IG} from "../types/setup";
import {
    CardID,
    EventCardID,
    IBasicCard,
    IBuyInfo,
    ICardSlot,
    IEra,
    INormalOrLegendCard,
    IRegionInfo,
    Region, SimpleRuleNumPlayers,
    ValidRegions
} from "../types/core";
import {INVALID_MOVE} from "boardgame.io/core";
import {
    activePlayer,
    aesAward,
    atkCardSettle,
    buildingInRegion,
    canBuyCard, cardInDeck, cardInDiscard, cardInHand, cardSlotOnBoard,
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
    fillTwoPlayerBoard,
    industryAward, isSimpleEffect,
    logger,
    playerEffExec,
    schoolPlayer, simpleEffectExec,
    startBreakThrough,
    startCompetition,
    studioSlotsAvailable,
    try2pScoring,
    tryScoring,
} from "./util";
import {changeStage, signalEndPhase, signalEndStage} from "./logFix";
import {getCardEffect, getEvent} from "../constant/effects";
import {B05} from "../constant/cards/basic";
import {getCardById} from "../types/cards";

export const drawCard: LongFormMove = {
    move: (G: IG, ctx: Ctx,p :PlayerID) => {
        if (activePlayer(ctx) !== p) return INVALID_MOVE;
        logger.info(`p${p}.moves.drawCard(${p})`);
        curPub(G, ctx).action--;
        logger.debug(`p${ctx.currentPlayer}|drawCardWithAP`);
        drawCardForPlayer(G, ctx, ctx.currentPlayer);
    },
    client: false,
}

export const buyCard: LongFormMove = {
    move(G: IG, ctx: Ctx, arg: IBuyInfo): any {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`p${arg.buyer}.moves.buyCard(${JSON.stringify(arg)})`);
        let log = `p${arg.buyer}|buy|${arg.target}|res:${arg.resource}|deposit:${arg.deposit}|${arg.helper}\r\n`
        logger.debug(log);
        if (canBuyCard(G, ctx, arg)) {
            let targetCard = getCardById(arg.target)
            let p = curPub(G, ctx);
            p.action--;
            p.resource -= arg.resource;
            p.deposit -= arg.deposit;
            arg.helper.forEach(c => {
                let pHand = G.player[parseInt(arg.buyer)].hand.map(c => c.cardId);
                let idx = pHand.indexOf(c)
                let helper = G.player[parseInt(arg.buyer)].hand.splice(idx, 1)[0];
                p.playedCardInTurn.push(helper);
            })

            doBuy(G, ctx, targetCard as INormalOrLegendCard | IBasicCard, ctx.currentPlayer);
            let eff = getCardEffect(arg.target);
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
    p: PlayerID,
    idx: number,
    target: PlayerID,
    targetName: string,
}

export const chooseTarget: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: ITargetChooseArgs) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`p${arg.p}.moves.chooseTarget(${JSON.stringify(arg)})`);
        let src = arg.p;
        let p = arg.target;
        let eff = G.e.stack.pop();
        let log = `eff:${JSON.stringify(eff)}`
        switch (eff.e) {
            case "loseVpForEachHand":
                G.c.players = [];
                let handCount = G.player[parseInt(p)].hand.length;
                G.pub[parseInt(p)].vp -= handCount;
                break;
            case "competition":
                if (ctx.numPlayers > SimpleRuleNumPlayers) {
                    G.c.players = [];
                    G.e.stack.push(eff);
                    G.competitionInfo.progress = eff.a.bonus;
                    G.competitionInfo.onWin = eff.a.onWin;
                    logger.debug(log);
                    startCompetition(G, ctx, src, p);
                    return;
                } else {
                    break;
                }
            case "loseAnyRegionShare":
                G.c.players = [];
                G.e.regions = ValidRegions.filter(
                    // @ts-ignore
                    r => G.pub[parseInt(p)].shares[r] > 0
                )
                if (G.e.regions.length > 0) {
                    G.e.stack.push(eff);
                    changeStage(G, ctx, "chooseRegion")
                    return;
                } else {
                    break;
                }
            default:
                G.e.stack.push(eff);
                playerEffExec(G, ctx, p);
        }
    }
}

export interface IChooseHandArg {
    p: PlayerID,
    hand: CardID,
    idx: number,
}

export const chooseHand: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: IChooseHandArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`p${arg.p}.moves.chooseHand(${JSON.stringify(arg)})`);
        let log = `chooseHand|p${arg.p}|${arg.hand}|${arg.idx}`;
        let eff = G.e.stack.pop();
        if (eff === undefined) {
            logger.debug(log);
            throw Error("No effect cannot choose hand!")
        }
        log += `|${JSON.stringify(eff)}`
        let p = arg.p;
        let hand = G.player[parseInt(p)].hand;
        let pub = G.pub[parseInt(p)];
        let card: IBasicCard | INormalOrLegendCard = getCardById(arg.hand);
        switch (eff.e) {
            case "breakthroughResDeduct":
                pub.action--;
                hand.splice(arg.idx, 1);
                pub.archive.push(card);
                if (arg.hand === "1108") {
                    log += "|Nanook"
                    if (pub.deposit < 1) {
                        return;
                    } else {
                        pub.deposit--;
                    }
                }
                startBreakThrough(G, ctx, arg.p);
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
            case "discardLegend":
            case "discardIndustry":
            case "discardAesthetics":
            case "discardNormalOrLegend":
                if (pub.school?.cardId === "3204") {
                    log += `|S3204`
                    pub.discardInSettle = true;
                }
                hand.splice(arg.idx, 1);
                pub.discard.push(card);
                if (eff.a > 1) {
                    eff.a--;
                    log += `|remain:${eff.a}`
                    G.e.stack.push(eff);
                    return;
                }
                break;
            default:
                throw new Error();
        }
        logger.debug(log);
        checkNextEffect(G, ctx);
    }
}

export interface IEffectChooseArg {
    effect: any,
    idx: number,
    p: PlayerID,
}

export const chooseEffect: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: IEffectChooseArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`p${arg.p}.moves.chooseEffect(${JSON.stringify(arg)})`);
        let log = ("chooseEffect")
        log += JSON.stringify(arg);
        let eff = G.e.choices[arg.idx];
        log += JSON.stringify(eff);
        let p = ctx.playerID === undefined ? ctx.currentPlayer : ctx.playerID
        let regions: Region[];
        logger.debug(log)
        switch (eff.e) {
            case "industryBreakthrough":
                G.e.choices = [];
                doIndustryBreakthrough(G, ctx, p);
                return;
            case "aestheticsBreakthrough":
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
    move: (G: IG, ctx: Ctx, cardId:string) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`p${ctx.playerID}.moves.updateSlot(${cardId})`);
        let slot = cardSlotOnBoard(G,ctx,getCardById(cardId));
        if(slot===null){
            return INVALID_MOVE;
        }
        doReturnSlotCard(G, ctx, slot);
        if (ctx.numPlayers > SimpleRuleNumPlayers) {
            fillEmptySlots(G, ctx);
        } else {
            fillTwoPlayerBoard(G, ctx);
        }
        checkNextEffect(G, ctx);
    }
}

export interface IRegionChooseArg {
    r: Region,
    idx: number,
    p: PlayerID,
}

export const chooseRegion = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: IRegionChooseArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`p${arg.p}.moves.chooseRegion(${JSON.stringify(arg)})`);
        let log = "chooseRegion"
        let r = arg.r;
        log += JSON.stringify(arg);
        if (r === Region.NONE) return;
        let eff = G.e.stack.pop();
        log += JSON.stringify(eff);
        logger.debug(log)
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
    idx: number,
    card: INormalOrLegendCard,
    p: PlayerID,
}

export const peek: LongFormMove = {
    client: false,
    undoable: false,
    redact: true,
    move: (G: IG, ctx: Ctx, arg: IPeekArgs) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`p${arg.p}.moves.peek(${JSON.stringify(arg)})`);
        let eff = G.e.stack.pop();
        let p = arg.p;
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
                playerObj.cardsToPeek.splice(arg.idx, 1);
                playerObj.hand.push(arg.card);
                if (eff.a.filter.a > 1) {
                    eff.a.filter.a--;
                    G.e.stack.push(eff);
                    return;
                } else {
                    playerObj.cardsToPeek = []
                }
                break;
        }
        checkNextEffect(G, ctx);
    }
}

export interface IChooseEventArg {
    event: EventCardID,
    p: PlayerID
    idx: number,
}

export const chooseEvent: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: IChooseEventArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`p${arg.p}.moves.chooseEvent(${JSON.stringify(arg)})`);
        let eid: EventCardID = arg.event;
        G.events.splice(arg.idx, 1);
        G.e.card = getCardById(eid);
        let log = "chooseEvent";
        log += `|${arg.event}|${arg.p}|${arg.idx}`;
        if (eid === EventCardID.E03) {
            log += "|Avant-grade"
            G.activeEvents.push(EventCardID.E03);
            for (let i = 0; i < ctx.numPlayers; i++) {
                G.pub[i].action = 2;
            }
            logger.debug(log)
            fillEventCard(G, ctx);
            checkNextEffect(G, ctx);
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
                    log += "|Execute event"
                    G.e.stack.push(getEvent(eid));
                    logger.debug(log)
                    fillEventCard(G, ctx);
                    playerEffExec(G, ctx, arg.p);
                    break;
                default:
                    log += "|Score events"
                    G.pub[parseInt(arg.p)].scoreEvents.push(eid);
                    logger.debug(log)
                    fillEventCard(G, ctx);
                    checkNextEffect(G, ctx);
            }
        }
    }
}

export const requestEndTurn: LongFormMove = {
    client: false,
    undoable: false,
    move: (G: IG, ctx: Ctx, arg: string) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`p${arg}.moves.requestEndTurn(${arg})`);
        let log = `requestEndTurn|${arg}`
        // Clean up
        let obj = G.pub[parseInt(arg)]
        obj.playedCardInTurn.forEach(c => obj.discard.push(c));
        obj.playedCardInTurn = [];
        obj.resource = 0;
        if (obj.deposit > 10) {
            obj.deposit = 10;
        }

        // restore action point fill hand card
        if (obj.school !== null) {
            let schoolId = obj.school.cardId;
            log += `|school|${schoolId}`
            let act = getCardEffect(schoolId).school.action;
            if (act === 1) {
                if (G.activeEvents.includes(EventCardID.E03)) {
                    log += `|Avant-Grade|2ap`
                    obj.action = 2
                } else {
                    log += `|1ap`
                    obj.action = 1
                }
            } else {
                log += `|${act}ap`
                obj.action = act;
            }
        } else {
            if (G.activeEvents.includes(EventCardID.E03)) {
                log += `|Avant-Grade|2ap`
                obj.action = 2
            } else {
                log += `|1ap`
                obj.action = 1
            }
        }
        fillPlayerHand(G, ctx, ctx.currentPlayer);

        // execute development rewards
        log += `|aesAward`
        aesAward(G, ctx, ctx.currentPlayer);
        log += `|industryAward`
        industryAward(G, ctx, ctx.currentPlayer);

        // era scoring check
        ValidRegions.forEach(r => {
            if (r === Region.ASIA && G.regions[Region.ASIA].era === IEra.ONE) return;
            let canScore = checkRegionScoring(G, ctx, r);
            if (canScore) {
                G.scoringRegions.push(r)
            }
        })
        log += `|scoreRegions|${G.scoringRegions}`
        if (ctx.numPlayers > SimpleRuleNumPlayers) {
            log += "|tryScoring"
            logger.debug(log);
            tryScoring(G, ctx);
        } else {
            log += "|try2pScoring"
            logger.debug(log)
            try2pScoring(G, ctx);
        }
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
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        let p = ctx.playerID === undefined ? ctx.currentPlayer : ctx.playerID
        logger.info(`p${p}.moves.confirmRespond(${arg})`);
        let pub = G.pub[parseInt(p)];
        let hand = G.player[parseInt(p)].hand;
        let eff = G.e.stack.pop();
        let log = `confirmRespond|${p}|${arg}|${G.e.stack}|${JSON.stringify(eff)}`;
        logger.debug(log);
        if (arg === "yes") {
            switch (eff.e) {
                case "optional":
                case "alternative":
                    log += "|yes|";
                    G.e.stack.push(eff.a)
                    if (isSimpleEffect(eff.a.e)) {
                        log += "|simple|";
                        logger.debug(log);
                        simpleEffectExec(G, ctx, p)
                    } else {
                        log += "|complex|";
                        logger.debug(log);
                        playerEffExec(G, ctx, p);
                    }
                    break;
                case "searchAndArchive":
                    let deck = G.secretInfo.playerDecks[parseInt(p)];
                    let indexOfTarget = -1
                    if (cardInDeck(G, ctx, parseInt(p), eff.a)) {
                        deck.forEach((c, idx) => {
                            if (c.cardId === eff.a) {
                                indexOfTarget = idx;
                            }
                        })
                        pub.archive.push(deck.splice(indexOfTarget, 1)[0]);
                    }
                    if (cardInHand(G, ctx, parseInt(p), eff.a)) {
                        hand.forEach((c, idx) => {
                            if (c.cardId === eff.a) {
                                indexOfTarget = idx;
                            }
                        })
                        pub.archive.push(hand.splice(indexOfTarget, 1)[0]);
                    }
                    if (cardInDiscard(G, ctx, parseInt(p), eff.a)) {
                        pub.discard.forEach((c, idx) => {
                            if (c.cardId === eff.a) {
                                indexOfTarget = idx;
                            }
                        })
                        pub.archive.push(pub.discard.splice(indexOfTarget, 1)[0]);
                    }
                    pub.vp += 2;
                    break;
                default:
                    throw new Error();
            }
        } else {
            switch (eff.e) {
                case "alternative":
                    log += "|startBreakThrough"
                    logger.debug(log);
                    startBreakThrough(G, ctx, p);
                    return;
                default:
                    break;
            }
        }
        logger.debug(log);
        checkNextEffect(G, ctx);
    },
}

export interface IPlayCardInfo {
    card: CardID,
    idx: number,
    playerID: PlayerID,
    res: number,
}

export const playCard: LongFormMove = {
    move: (G: IG, ctx: Ctx, arg: IPlayCardInfo) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`p${arg.playerID}.moves.playCard(${JSON.stringify(arg)})`);
        let playCard = getCardById(arg.card);
        let pub = G.pub[parseInt(arg.playerID)];
        let hand = G.player[parseInt(arg.playerID)].hand;
        if (cinemaInRegion(G, ctx, playCard.region, arg.playerID)) {
            pub.resource++;
            pub.vp++;
        }
        hand.splice(arg.idx, 1);
        pub.playedCardInTurn.push(playCard);
        G.e.card = playCard;
        let eff = getCardEffect(arg.card).play;
        if (eff.e !== "none") {
            G.e.stack.push(eff)
            curEffectExec(G, ctx);
        }
    },
    client: false,
}

export interface ICompetitionCardArg {
    pass: boolean,
    card: INormalOrLegendCard,
    idx: number,
    p: PlayerID,
}

export const competitionCard: LongFormMove = {
    client: false,
    redact: true,
    move: (G: IG, ctx: Ctx, arg: ICompetitionCardArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`p${arg.p}.moves.competitionCard(${JSON.stringify(arg)})`);
        let p = arg.p;
        G.player[parseInt(p)].competitionCards.push(arg.card);
        let i = G.competitionInfo;
        if (p === i.atk) {
            i.atkPlayedCard = true;
            checkCompetitionDefender(G, ctx);
            return;
        } else {
            if (p === i.def) {
                i.defPlayedCard = true;
                atkCardSettle(G, ctx);
            } else {
                logger.warn("Other player cannot move in competition card stage!")
            }
        }
    },
}

export const breakthrough: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: IPlayCardInfo) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`p${arg.playerID}.moves.breakthrough(${JSON.stringify(arg)})`);
        let p = G.pub[parseInt(arg.playerID)];
        p.action -= 1;
        p.resource -= arg.res;
        p.deposit -= (2 - arg.res);
        let c = getCardById(arg.card);
        G.e.card = c;
        G.player[parseInt(arg.playerID)].hand.splice(arg.idx, 1);
        p.archive.push(c);
        if (arg.card === "1108") {
            if (p.deposit < 1) {
                return INVALID_MOVE;
            } else {
                p.deposit -= 1;
            }
        }
        startBreakThrough(G, ctx, arg.playerID);
    }
}


export interface ICommentArg {
    target: ICardSlot,
    comment: IBasicCard | null,
    p: PlayerID,
}

export const comment: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: ICommentArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`p${arg.p}.moves.comment(${JSON.stringify(arg)})`);
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
        let pub = G.pub[parseInt(arg.p)];
        if (pub.school?.cardId === "2204") {
            pub.resource++;
            pub.vp++;
        }

    }
}

export interface IShowBoardStatusProps {
    regions: IRegionInfo[],
    school: ICardSlot[]
    film: ICardSlot[],
    matchID: string,
    seed: string,
}

export const showBoardStatus: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, args: IShowBoardStatusProps) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`p${ctx.playerID}.moves.showBoardStatus(${JSON.stringify(args)})`);
        if (ctx.phase === "InitPhase") {
            G.matchID = args.matchID;
            signalEndPhase(G, ctx);
        } else {
            signalEndStage(G, ctx);
        }
    },
}
