import {Ctx, LongFormMove, PlayerID} from 'boardgame.io';
import {CompetitionInfo, IG} from "../types/setup";
import {
    B05,
    BasicCardID,
    BuildingType,
    CardCategory,
    CardID,
    CardType,
    ClassicCardID,
    EventCardID,
    getCardById,
    IBasicCard,
    IBuyInfo,
    ICardSlot,
    INormalOrLegendCard,
    IRegionInfo,
    Region,
    SchoolCardID,
    SimpleRuleNumPlayers,
    ValidRegions,
    VictoryType
} from "../types/core";
import {INVALID_MOVE} from "boardgame.io/core";
import {
    activePlayer,
    addVp,
    atkCardSettle,
    buildBuildingFor,
    buildingInRegion,
    canBuyCard,
    cardInDeck,
    cardInDiscard,
    cardInHand,
    cardSlotOnBoard,
    cardSlotOnBoard2p,
    checkCompetitionDefender,
    checkNextEffect,
    cinemaInRegion,
    cinemaSlotsAvailable,
    competitionCleanUp,
    competitionResultSettle,
    curCard,
    curPub,
    doAestheticsBreakthrough,
    doBuy,
    doIndustryBreakthrough,
    doReturnSlotCard,
    drawCardForPlayer,
    endTurnEffect,
    fillEmptySlots,
    fillEventCard,
    fillTwoPlayerBoard,
    isSimpleEffect,
    logger,
    loseVp,
    payCost,
    playerEffExec,
    regionScoringCheck,
    schoolPlayer,
    seqFromPos,
    simpleEffectExec,
    startBreakThrough,
    startCompetition,
    studioSlotsAvailable,
} from "./util";
import {changePlayerStage, changeStage, signalEndPhase, signalEndStage} from "./logFix";
import {getCardEffect, getEvent} from "../constant/effects";

export interface IPayAdditionalCostArgs {
    res: number,
    deposit: number,
}

export const payAdditionalCost: LongFormMove = {
    move: (G: IG, ctx: Ctx, arg: IPayAdditionalCostArgs) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${ctx.playerID}.moves.payAdditionalCost(${JSON.stringify(arg)})`);
        let log = `payAdditionalCost|${JSON.stringify(arg)}`
        let pub = G.pub[parseInt(ctx.playerID)]
        let eff = G.e.stack.pop();
        const r = G.e.regions[0];
        if (eff === undefined) {
            log += `|stackEmpty`
            logger.debug(`${G.matchID}|${log}`);
            return INVALID_MOVE
        } else {
            G.e.extraCostToPay = 0;
            pub.resource -= arg.res;
            pub.deposit -= arg.deposit;
            log += `|${pub.resource}|${pub.deposit}`
        }
        switch ((eff.e)) {
            case "buildCinema":
                G.e.regions = [];
                log += `|region:|${r}`
                if (r === undefined || r === Region.NONE) {
                    log += `|invalid`
                    logger.debug(`${G.matchID}|${log}`);
                    return INVALID_MOVE;
                }
                buildBuildingFor(G, ctx, r, ctx.playerID, BuildingType.cinema);
                break;
            case "buildStudio":
                G.e.regions = [];
                log += `|region:|${r}`
                if (r === undefined || r === Region.NONE) {
                    log += `|invalid`
                    logger.debug(`${G.matchID}|${log}`);
                    return INVALID_MOVE;
                }
                buildBuildingFor(G, ctx, r, ctx.playerID, BuildingType.studio);
                break;
            case "industryLevelUpCost":
                log += `|industry|${pub.industry}`
                if (pub.industry < 10) {
                    pub.industry++
                } else {
                    log += `|cannotUpgrade`
                }
                break;
            case "aestheticsLevelUpCost":
                log += `|aes:|${pub.aesthetics}`
                if (pub.aesthetics < 10) {
                    pub.aesthetics++
                } else {
                    log += `|cannotUpgrade`
                }
                break;
            default:
                throw Error(`Invalid effect ${JSON.stringify(eff)}`)
        }
        log += `|checkNextEffect`
        logger.debug(`${G.matchID}|${log}`);
        checkNextEffect(G, ctx);
    }
}

export interface IShowCompetitionResultArgs {
    info: CompetitionInfo
}

export const showCompetitionResult: LongFormMove = {
    // TODO remove comment cannot undo in real game
    // undoable: false,
    move: (G: IG, ctx: Ctx, args: IShowCompetitionResultArgs) => {
        logger.info(`${G.matchID}|p${ctx.playerID}.moves.showCompetitionResult(${JSON.stringify(args)})`)
        competitionResultSettle(G, ctx);
    }
}

export const drawCard: LongFormMove = {
    client: false,
    // undoable: false,
    move: (G: IG, ctx: Ctx, p: PlayerID) => {
        if (activePlayer(ctx) !== p) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${p}.moves.drawCard(${p})`);
        curPub(G, ctx).action--;
        drawCardForPlayer(G, ctx, ctx.currentPlayer);
    },
}

export const buyCard: LongFormMove = {
    move(G: IG, ctx: Ctx, arg: IBuyInfo): any {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.buyer}.moves.buyCard(${JSON.stringify(arg)})`);
        let log = `p${arg.buyer}|buy|${arg.target}|res:${arg.resource}|deposit:${arg.deposit}|${arg.helper}\r\n`
        logger.debug(`${G.matchID}|${log}`);
        if (canBuyCard(G, ctx, arg)) {
            let targetCard = getCardById(arg.target)
            let pub = curPub(G, ctx);
            pub.action--;
            pub.resource -= arg.resource;
            pub.deposit -= arg.deposit;
            arg.helper.forEach(c => {
                let pHand = G.player[parseInt(arg.buyer)].hand;
                let idx = pHand.indexOf(c)
                let helper = G.player[parseInt(arg.buyer)].hand.splice(idx, 1)[0];
                pub.playedCardInTurn.push(helper);
            })
            G.e.card = arg.target;
            doBuy(G, ctx, targetCard as INormalOrLegendCard | IBasicCard, ctx.currentPlayer);
            let cardEff = getCardEffect(arg.target);
            let hasEffect = false;
            if (cardEff.hasOwnProperty("buy")) {
                const eff = {...cardEff.buy};
                if (eff.e !== "none") {
                    eff.target = arg.buyer;
                    G.e.stack.push(eff);
                    hasEffect = true;
                }
            } else {
                log += `|noPlayEff`
            }
            if (pub.school === SchoolCardID.S3101) {
                if ((targetCard.category === CardCategory.NORMAL
                    || targetCard.category === CardCategory.LEGEND)
                    && targetCard.type === CardType.F
                ) {
                    log += `|newHollyWood`
                    G.e.stack.push({
                        e: "optional", a: {
                            e: "pay", a: {
                                cost: {e: "deposit", a: 1},
                                eff: {e: "anyRegionShare", a: 1}
                            }
                        },
                        target: arg.buyer,
                    })
                    hasEffect = true;
                }
            }
            if (hasEffect) {
                log += `|hasEffect`
                logger.debug(`${G.matchID}|${log}`);
                checkNextEffect(G, ctx);
            } else {
                logger.debug(`${G.matchID}|${log}`);
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
        logger.info(`${G.matchID}|p${arg.p}.moves.chooseTarget(${JSON.stringify(arg)})`);
        let src = arg.p;
        let p = arg.target;
        let eff = G.e.stack.pop();
        let log = `players|${JSON.stringify(G.c.players)}|eff:${JSON.stringify(eff)}`
        switch (eff.e) {
            case "loseVpForEachHand":
                G.c.players = [];
                const handCount = G.player[parseInt(p)].hand.length;
                loseVp(G, ctx, p, handCount);
                break;
            case "competition":
                G.c.players = [];
                G.competitionInfo.progress = eff.a.bonus;
                G.competitionInfo.onWin = eff.a.onWin;
                log += `|startCompetition`
                logger.debug(`${G.matchID}|${log}`);
                startCompetition(G, ctx, src, p);
                return;
            case "loseAnyRegionShare":
                G.c.players = [];
                G.e.regions = ValidRegions.filter(
                    r => G.pub[parseInt(p)].shares[r] > 0
                )
                if (G.e.regions.length > 0) {
                    G.e.stack.push(eff);
                    G.c.players = [p];
                    changePlayerStage(G, ctx, "chooseRegion", src);
                    return;
                } else {
                    ctx?.events?.endStage?.()
                    log += `|endStage`
                    break;
                }
            case "handToAnyPlayer":
                G.c.players = [arg.target]
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "chooseHand", arg.p);
                return;
            default:
                eff.target = p;
                G.e.stack.push(eff);
                log += `|otherEffects|${JSON.stringify(eff)}`
                logger.debug(`${G.matchID}|${log}`);
                checkNextEffect(G, ctx);
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
        logger.info(`${G.matchID}|p${arg.p}.moves.chooseHand(${JSON.stringify(arg)})`);
        let log = `chooseHand|p${arg.p}|${arg.hand}|${arg.idx}`;
        let eff = G.e.stack.pop();
        if (eff === undefined) {
            logger.debug(`${G.matchID}|${log}`);
            throw Error("No effect cannot choose hand!")
        }
        log += `|${JSON.stringify(eff)}`
        let p = arg.p;
        let target: CardID;
        const pub = G.pub[parseInt(p)];
        if (eff.e === "playedCardInTurnEffect") {
            target = pub.playedCardInTurn[arg.idx];
        } else {
            target = arg.hand
        }
        const hand = G.player[parseInt(p)].hand;
        const card: IBasicCard | INormalOrLegendCard = getCardById(target);
        switch (eff.e) {
            case "playedCardInTurnEffect":
                log += `|${target}`
                let cardEff = getCardEffect(target);
                if (cardEff.hasOwnProperty("play")) {
                    const eff = {...cardEff.play};
                    if (eff.e !== "none") {
                        eff.target = arg.p;
                        G.e.stack.push(eff)
                    } else {
                        log += `|emptyPlayEffect`
                    }
                } else {
                    log += `|noPlayEffect`
                }
                break;
            case "breakthroughResDeduct":
                hand.splice(arg.idx, 1);
                pub.archive.push(arg.hand);
                startBreakThrough(G, ctx, arg.p, arg.hand);
                return;
            case "archiveToEEBuildingVP":
                hand.splice(arg.idx, 1);
                pub.archive.push(arg.hand);
                if (buildingInRegion(G, ctx, Region.EE, p)) {
                    addVp(G, ctx, p, card.vp)
                }
                break
            case "handToAnyPlayer":
                const allCardsIndex = pub.allCards.indexOf(arg.hand);
                if (allCardsIndex !== -1) {
                    pub.allCards.splice(allCardsIndex, 1);
                } else {
                    log += `|handNotInAllCards`
                }
                hand.splice(arg.idx, 1);
                G.player[parseInt(G.c.players[0])].hand.push(arg.hand);
                G.pub[parseInt(G.c.players[0])].allCards.push(arg.hand);
                break;
            case "refactor":
                hand.splice(arg.idx, 1);
                pub.archive.push(arg.hand);
                const cur = curCard(G);
                const vpToAdd = cur.vp;
                if (vpToAdd > 0) {
                    addVp(G, ctx, p, vpToAdd);
                } else {
                    loseVp(G, ctx, p, -vpToAdd);
                }
                doBuy(G, ctx, B05, p);
                break;
            case "archive":
                hand.splice(arg.idx, 1);
                pub.archive.push(arg.hand);
                break;
            case "discard":
            case "discardLegend":
            case "discardIndustry":
            case "discardAesthetics":
            case "discardNormalOrLegend":
                if (pub.school === SchoolCardID.S3201) {
                    log += `|NewWaveFlagSet`
                    pub.discardInSettle = true;
                }
                hand.splice(arg.idx, 1);
                pub.discard.push(arg.hand);
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
        log += `|checkNextEffect`
        logger.debug(`${G.matchID}|${log}`);
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
        logger.info(`${G.matchID}|p${arg.p}.moves.chooseEffect(${JSON.stringify(arg)})`);
        let log = ("chooseEffect")
        log += JSON.stringify(arg);
        log += `|`
        let eff = G.e.choices[arg.idx];
        log += JSON.stringify(eff);
        let p = ctx.playerID === undefined ? ctx.currentPlayer : ctx.playerID
        let regions: Region[];
        logger.debug(`${G.matchID}|${log}`);
        switch (eff.e) {
            case "industryBreakthrough":
                G.e.choices = [];
                if (eff.a > 1) {
                    log += `|multiple`
                    eff.a--;
                    G.e.stack.push(eff);
                }
                logger.debug(`${G.matchID}|${log}`);
                doIndustryBreakthrough(G, ctx, p);
                return;
            case "aestheticsBreakthrough":
                G.e.choices = [];
                if (eff.a > 1) {
                    log += `|multiple`
                    eff.a--;
                    G.e.stack.push(eff);
                }
                logger.debug(`${G.matchID}|${log}`);
                doAestheticsBreakthrough(G, ctx, p);
                return;
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
                log += `|exec|${JSON.stringify(eff)}`
                playerEffExec(G, ctx, p);
                return;
        }
    }
}

export const updateSlot = {
    client: false,
    move: (G: IG, ctx: Ctx, cardId: string) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${ctx.playerID}.moves.updateSlot(${cardId})`);
        let slot;
        if (ctx.numPlayers > SimpleRuleNumPlayers) {
            slot = cardSlotOnBoard(G, ctx, getCardById(cardId));
        } else {
            slot = cardSlotOnBoard2p(G, ctx, getCardById(cardId));
        }
        if (slot === null) {
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

export const chooseRegion: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: IRegionChooseArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.chooseRegion(${JSON.stringify(arg)})`);
        let log = "chooseRegion"
        const r = arg.r;
        const pub = G.pub[parseInt(arg.p)]
        log += JSON.stringify(arg);
        if (r === Region.NONE) return;
        const eff = G.e.stack.pop();
        log += JSON.stringify(eff);
        logger.debug(`${G.matchID}|${log}`);
        let p = arg.p;
        const totalResource = pub.resource + pub.deposit;
        const reg = G.regions[r]
        if (eff.e === "buildStudio" || eff.e === "buildCinema") {
            if (totalResource === 3) {
                payCost(G, ctx, p, 3);
                if(eff.e === "buildStudio"){
                    buildBuildingFor(G, ctx, r, p, BuildingType.studio);
                }
                if(eff.e === "buildCinema"){
                    buildBuildingFor(G, ctx, r, p, BuildingType.cinema);
                }
            } else {
                G.e.regions = [r]
                G.e.extraCostToPay = 3;
                log += `|total${totalResource}|payAdditionalCost`
                G.e.stack.push(eff);
                logger.debug(`${G.matchID}|${log}`);
                changePlayerStage(G, ctx, "payAdditionalCost", p);
                return;
            }
        }
        switch (eff.e) {
            case "loseAnyRegionShare":
                p = G.c.players[0] as PlayerID;
                G.c.players = [];
                G.pub[parseInt(p)].shares[r]--;
                reg.share++;
                break;
            case "anyRegionShareCentral":
                pub.shares[r]++;
                reg.share--;
                if (eff.a > 1) {
                    eff.a--;
                    G.e.stack.push(eff);
                }
                break;
            case "anyRegionShare":
                let i = G.competitionInfo;
                if (i.pending) {
                    let loser = i.progress > 0 ? i.def : i.atk;
                    G.pub[parseInt(loser)].shares[r]--;
                    pub.shares[r]++;
                    if (eff.a > 1) {
                        eff.a--;
                        G.e.stack.push(eff);
                        break;
                    } else {
                        competitionCleanUp(G, ctx);
                        return
                    }
                } else {
                    pub.shares[r]++;
                    reg.share--;
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
    card: ClassicCardID | null,
    p: PlayerID,
    shownCards: CardID[],
}

export const peek: LongFormMove = {
    client: false,
    // undoable: false,
    move: (G: IG, ctx: Ctx, arg: IPeekArgs) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.peek(${JSON.stringify(arg)})`);
        let eff = G.e.stack.pop();
        let p = arg.p;
        let playerObj = G.player[parseInt(p)];
        let pub = G.pub[parseInt(p)];
        let deck = G.secretInfo.playerDecks[parseInt(p)];
        let log = `peek|${JSON.stringify(eff)}`
        log += `|deck|${JSON.stringify(deck)}`
        log += `|hand${JSON.stringify(playerObj.hand)}|discard|${JSON.stringify(pub.discard)}`
        log += `|cardsToPeek|${JSON.stringify(playerObj.cardsToPeek)}`
        switch (eff.a.filter.e) {
            case "industry":
                log += `|industry`
                playerObj.cardsToPeek.forEach(card => {
                    log += `|evaluating${card}`
                    let c = getCardById(card);
                    if (c.industry > 0) {
                        log += `|hand|${card}`
                        log += `|${JSON.stringify(playerObj.hand)}`
                        playerObj.hand.push(card);
                        log += `|${JSON.stringify(playerObj.hand)}`
                    } else {
                        log += `|discard|${card}|`
                        log += `|${JSON.stringify(pub.discard)}`
                        pub.discard.push(card);
                        log += `|${JSON.stringify(pub.discard)}`
                    }
                })
                playerObj.cardsToPeek = []
                break;
            case "aesthetics":
                playerObj.cardsToPeek.forEach(card => {
                    log += `|evaluating${card}`
                    let c = getCardById(card);
                    if (c.aesthetics > 0) {
                        log += `|hand|${card}`
                        log += `|${JSON.stringify(playerObj.hand)}`
                        playerObj.hand.push(card);
                        log += `|${JSON.stringify(playerObj.hand)}`
                    } else {
                        log += `|discard|${card}`
                        log += `|${JSON.stringify(pub.discard)}`
                        pub.discard.push(card);
                        log += `|${JSON.stringify(pub.discard)}`
                    }
                })
                playerObj.cardsToPeek = []
                break;
            case "region":
                playerObj.cardsToPeek.forEach(card => {
                    log += `|evaluating${card}`
                    let c = getCardById(card);
                    if (c.region === eff.a.filter.a) {
                        log += `|hand|${card}`
                        playerObj.hand.push(card);
                        log += `|${JSON.stringify(playerObj.hand)}`
                    } else {
                        log += `|discard|${card}`
                        log += `|${JSON.stringify(pub.discard)}`
                        pub.discard.push(card);
                        log += `|${JSON.stringify(pub.discard)}`
                    }
                })
                playerObj.cardsToPeek = []
                break;
            case "era":
                playerObj.cardsToPeek.forEach(card => {
                    log += `|evaluating${card}`
                    let c = getCardById(card);
                    if (c.era === eff.a.filter.a) {
                        log += `|hand|${card}`
                        log += `|${JSON.stringify(playerObj.hand)}`
                        playerObj.hand.push(card);
                        log += `|${JSON.stringify(playerObj.hand)}`
                    } else {
                        log += `|discard|${card}`
                        log += `|${JSON.stringify(pub.discard)}`
                        pub.discard.push(card);
                        log += `|${JSON.stringify(pub.discard)}`
                    }
                })
                playerObj.cardsToPeek = []
                break;
            case "choice":
                log += `|${JSON.stringify(playerObj.cardsToPeek)}`
                playerObj.cardsToPeek.splice(arg.idx, 1);
                log += `|${JSON.stringify(playerObj.cardsToPeek)}`
                if (arg.card !== null) {
                    log += `|hand|${arg.card}`
                    log += `|${JSON.stringify(playerObj.hand)}`
                    playerObj.hand.push(arg.card);
                    log += `|${JSON.stringify(playerObj.hand)}`
                } else {
                    log += `|noChoice`
                }
                if (eff.a.filter.a > 1) {
                    log += `|pendingChoices`
                    eff.a.filter.a--;
                    G.e.stack.push(eff);
                    log += `|afterDeck|${JSON.stringify(deck)}`
                    log += `|afterHand${JSON.stringify(playerObj.hand)}|afterDiscard|${JSON.stringify(pub.discard)}`
                    logger.debug(`${G.matchID}|${log}`);
                    return;
                } else {
                    log += `|discardRemaining`
                    playerObj.cardsToPeek.forEach(card => {
                        log += `|evaluating${card}`
                        log += `|discard|${card}`
                        log += `|${JSON.stringify(pub.discard)}`
                        pub.discard.push(card)
                        log += `|${JSON.stringify(pub.discard)}`
                    })
                    playerObj.cardsToPeek = []
                }
                break;
        }
        log += `|afterDeck|${JSON.stringify(deck)}|afterHand${JSON.stringify(playerObj.hand)}|afterDiscard|${JSON.stringify(pub.discard)}`
        log += `|cardsToPeek|${JSON.stringify(playerObj.cardsToPeek)}`
        logger.debug(`${G.matchID}|${log}`);
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
        logger.info(`${G.matchID}|p${arg.p}.moves.chooseEvent(${JSON.stringify(arg)})`);
        let eid: EventCardID = arg.event;
        G.events.splice(arg.idx, 1);
        G.e.card = eid;
        let log = "chooseEvent";
        log += `|${arg.event}|${arg.p}|${arg.idx}`;
        if (eid === EventCardID.E03) {
            log += "|Avant-grade"
            G.activeEvents.push(EventCardID.E03);
            for (let i = 0; i < G.order.length; i++) {
                G.pub[i].action = 2;
            }
            logger.debug(`${G.matchID}|${log}`);
            fillEventCard(G, ctx);
            checkNextEffect(G, ctx);
            return
        } else {
            if (eid === EventCardID.E08) {
                G.regions[Region.EE].buildings[1].activated = true;
            }
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
                    logger.debug(`${G.matchID}|${log}`);
                    fillEventCard(G, ctx);
                    checkNextEffect(G, ctx);
                    break;
                case EventCardID.E10:
                    G.order.forEach(j => {
                        const pub = G.pub[parseInt(j)];
                        G.order.forEach(o => {
                            const other = G.pub[parseInt(o)];
                            if (other.vp > pub.vp) {
                                pub.vp += 4;
                            }
                        })
                    })
                    fillEventCard(G, ctx);
                    checkNextEffect(G, ctx);
                    break;
                case EventCardID.E11:
                    G.order.forEach(j => {
                        const pidInt = parseInt(j)
                        const pub = G.pub[pidInt];
                        const s = G.player[pidInt]
                        const validID = [...G.secretInfo.playerDecks[pidInt], ...pub.discard, ...s.hand, ...pub.archive]
                        const validCards = validID.map(c => getCardById(c));
                        pub.vp += validCards.filter(c => c.type === CardType.P).length * 4;
                    })
                    fillEventCard(G, ctx);
                    checkNextEffect(G, ctx);
                    break;
                case EventCardID.E12:
                    G.order.forEach(j => {
                        const pidInt = parseInt(j)
                        const pub = G.pub[pidInt];
                        pub.vp += pub.industry;
                        pub.vp += pub.aesthetics;
                    })
                    fillEventCard(G, ctx);
                    checkNextEffect(G, ctx);
                    break;
                case EventCardID.E13:
                    G.order.forEach(j => {
                        const pidInt = parseInt(j)
                        const pub = G.pub[pidInt];
                        let championRegionCount = 0;
                        ValidRegions.forEach(r => {
                            if (pub.champions.filter(c => c.region = r).length) {
                                championRegionCount++;
                            }
                        })
                        switch (championRegionCount) {
                            case 4:
                                pub.vp += 20;
                                break;
                            case 3:
                                pub.vp += 12;
                                break;
                            case 2:
                                pub.vp += 6;
                                break;
                            case 1:
                                pub.vp += 2;
                                break;
                            default:
                                break;
                        }
                    })
                    fillEventCard(G, ctx);
                    checkNextEffect(G, ctx);
                    break;
                case EventCardID.E14:
                    G.order.forEach(j => {
                        const pidInt = parseInt(j)
                        const pub = G.pub[pidInt];
                        pub.vp += pub.champions.length;
                        ValidRegions.forEach(r => pub.vp += pub.shares[r]);
                    })
                    fillEventCard(G, ctx);
                    checkNextEffect(G, ctx);
                    break;
                default:
                    log += `|noSuchEventID|${eid}`
                    break;
            }
        }
        logger.debug(`${G.matchID}|${log}`);
    }
}

export const requestEndTurn: LongFormMove = {
    client: false,
    // undoable: false,
    move: (G: IG, ctx: Ctx, arg: string) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg}.moves.requestEndTurn("${arg}")`);
        let log = `requestEndTurn|${arg}`
        const playerObj = G.player[parseInt(arg)]
        if (!playerObj.endTurnEffectExecuted) {
            endTurnEffect(G, ctx, arg);
            playerObj.endTurnEffectExecuted = true;
        } else {
            log += `|endTurnEffectAlreadyExecuted`
            logger.debug(`${G.matchID}|${log}`);
        }
        if (G.e.stack.length === 0) {
            regionScoringCheck(G, ctx, arg);
            playerObj.endTurnEffectExecuted = false;
        } else {
            checkNextEffect(G, ctx);
        }
    },
}

export const moveBlocker: LongFormMove = {
    client: false,
    move: () => {
        return INVALID_MOVE;
    },
}

export const concedeMove: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, p: PlayerID) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${p}.moves.confirmRespond("${p}")`);
        let log = `p${p}conceded`
        if (G.order.includes(p)) {
            const concedeIndex = G.order.indexOf(p);
            log += `|index|${concedeIndex}|before|${JSON.stringify(G.order)}`
            G.order.splice(concedeIndex, 1);
            if (concedeIndex < G.order.length) {
                log += `|notLastPlayer|DeductNewOrder`
                G.order = seqFromPos(G, ctx, concedeIndex);
            } else {
                log += `|lastPlayerConcede`
            }

            log += `|after|${JSON.stringify(G.order)}`
            if (G.order.length < 2) {
                const winner = G.order[0];
                log += `|onePlayerLeft|endGame|winner|${winner}`
                logger.debug(`${G.matchID}|${log}`);
                ctx?.events?.endGame?.({
                    winner: winner,
                    reason: VictoryType.othersConceded
                })
            } else {
                log += `|endPhaseToUpdateOrder`
                ctx?.events?.endPhase?.()
                logger.debug(`${G.matchID}|${log}`);
            }
        } else {
            throw Error();
        }
    }
}

export const confirmRespond: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: string) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        let p = ctx.playerID === undefined ? ctx.currentPlayer : ctx.playerID
        logger.info(`${G.matchID}|p${p}.moves.confirmRespond(${JSON.stringify(arg)})`);
        let pub = G.pub[parseInt(p)];
        let hand = G.player[parseInt(p)].hand;
        let eff = G.e.stack.pop();
        let log = `confirmRespond|p${p}|${JSON.stringify(arg)}|${JSON.stringify(G.e.stack)}|${JSON.stringify(eff)}`;
        logger.debug(`${G.matchID}|${log}`);
        if (arg === "yes") {
            switch (eff.e) {
                case "optional":
                    log += "|yes|";
                    G.e.stack.push(eff.a)
                    if (isSimpleEffect(G, eff.a)) {
                        log += "|simple|";
                        logger.debug(`${G.matchID}|${log}`);
                        simpleEffectExec(G, ctx, p);
                    } else {
                        log += "|complex|";
                        logger.debug(`${G.matchID}|${log}`);
                        playerEffExec(G, ctx, p);
                        return;
                    }
                    break;
                case "alternative":
                    const popEff = G.e.stack.pop()
                    log += `|pop|${JSON.stringify(popEff)}`
                    G.e.stack.push(eff.a)
                    log += `|push|${JSON.stringify(eff.a)}`
                    break;
                case "searchAndArchive":
                    let deck = G.secretInfo.playerDecks[parseInt(p)];
                    let indexOfTarget = -1
                    if (cardInDeck(G, ctx, parseInt(p), eff.a)) {
                        deck.forEach((c, idx) => {
                            if (c === eff.a) {
                                indexOfTarget = idx;
                            }
                        })
                        pub.archive.push(deck.splice(indexOfTarget, 1)[0]);
                    }
                    if (cardInHand(G, ctx, parseInt(p), eff.a)) {
                        hand.forEach((c, idx) => {
                            if (c === eff.a) {
                                indexOfTarget = idx;
                            }
                        })
                        pub.archive.push(hand.splice(indexOfTarget, 1)[0]);
                    }
                    if (cardInDiscard(G, ctx, parseInt(p), eff.a)) {
                        pub.discard.forEach((c, idx) => {
                            if (c === eff.a) {
                                indexOfTarget = idx;
                            }
                        })
                        pub.archive.push(pub.discard.splice(indexOfTarget, 1)[0]);
                    }
                    addVp(G, ctx, p, 2);
                    break;
                default:
                    throw new Error();
            }
        } else {
            switch (eff.e) {
                case "alternative":
                    log += `|nextEff`
                    break
                default:
                    break;
            }
        }
        logger.debug(`${G.matchID}|${log}`);
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
        logger.info(`${G.matchID}|p${arg.playerID}.moves.playCard(${JSON.stringify(arg)})`);
        let log = "playCard"
        let playCard = getCardById(arg.card);
        let pub = G.pub[parseInt(arg.playerID)];
        let hand = G.player[parseInt(arg.playerID)].hand;
        if (cinemaInRegion(G, ctx, playCard.region, arg.playerID)) {
            log += `|cinemaInRegion|${playCard.region}`
            pub.resource++;
            addVp(G, ctx, arg.playerID, 1);
        }
        hand.splice(arg.idx, 1);
        pub.playedCardInTurn.push(arg.card);
        G.e.card = arg.card;
        let cardEff = getCardEffect(arg.card);
        if (cardEff.hasOwnProperty("play")) {
            const eff = {...cardEff.play};
            if (eff.e !== "none") {
                log += `|${JSON.stringify(eff)}`
                G.e.stack.push(eff)
                playerEffExec(G, ctx, ctx.currentPlayer);
            } else {
                log += `|emptyPlayEffect`
                checkNextEffect(G, ctx);
            }
        } else {
            log += `|noPlayEffect`
            checkNextEffect(G, ctx);
        }
        logger.debug(`${G.matchID}|${log}`);
    },
    client: false,
}

export interface ICompetitionCardArg {
    pass: boolean,
    card: ClassicCardID,
    idx: number,
    p: PlayerID,
}

export const competitionCard: LongFormMove = {
    client: false,
    redact: true,
    move: (G: IG, ctx: Ctx, arg: ICompetitionCardArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.competitionCard(${JSON.stringify(arg)})`);
        let p = arg.p;
        G.player[parseInt(p)].competitionCards.push(arg.card);
        G.player[parseInt(p)].hand.splice(arg.idx, 1);
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
                logger.error("Other player cannot move in competition card stage!")
            }
        }
    },
}

export const breakthrough: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: IPlayCardInfo) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.playerID}.moves.breakthrough(${JSON.stringify(arg)})`);
        let p = G.pub[parseInt(arg.playerID)];
        p.action -= 1;
        p.resource -= arg.res;
        p.deposit -= (2 - arg.res);
        let c = getCardById(arg.card);
        G.e.card = c.cardId;
        G.player[parseInt(arg.playerID)].hand.splice(arg.idx, 1);
        p.archive.push(arg.card);
        let log = `breakthrough`
        log += `|startBreakthrough`
        logger.debug(`${G.matchID}|${log}`);
        startBreakThrough(G, ctx, arg.playerID, arg.card);
    }
}


export interface ICommentArg {
    target: ClassicCardID,
    comment: BasicCardID | null,
    p: PlayerID,
}

export const comment: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: ICommentArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.comment(${JSON.stringify(arg)})`);
        let slot = ctx.numPlayers > SimpleRuleNumPlayers
            ? cardSlotOnBoard(G, ctx, getCardById(arg.target))
            : cardSlotOnBoard2p(G, ctx, getCardById(arg.target));
        if (slot === null) {
            return INVALID_MOVE
        }
        if (arg.comment === null) {
            slot.comment = null;
        } else {
            slot.comment = arg.comment;
        }
        let p = schoolPlayer(G, ctx, SchoolCardID.S3204);
        if (p !== null) {
            drawCardForPlayer(G, ctx, p);
        }
        let pub = G.pub[parseInt(arg.p)];
        if (pub.school === SchoolCardID.S2204) {
            pub.resource++;
            addVp(G, ctx, arg.p, 1);
        }
        checkNextEffect(G, ctx);
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
        logger.info(`${args.matchID}|p${ctx.playerID}.moves.showBoardStatus(${JSON.stringify(args)})`);
        if (ctx.phase === "InitPhase") {
            G.matchID = args.matchID;
            signalEndPhase(G, ctx);
        } else {
            signalEndStage(G, ctx);
        }
    },
}
