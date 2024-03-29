import {Ctx, LongFormMove, PlayerID} from 'boardgame.io';
import {CompetitionInfo, IG} from "../types/setup";
import {
    AvantGradeAP,
    B05,
    BasicCardID,
    BuildingType,
    CardCategory,
    CardID,
    CardType,
    ClassicCardID,
    ClassicFilmAutoMoveMode,
    EventCardID,
    FilmCardID,
    GameMode,
    GameTurnOrder,
    getCardById,
    IBasicCard,
    IBuyInfo,
    ICardSlot,
    IEra,
    INormalOrLegendCard,
    IRegionInfo,
    ItrEffects,
    Region,
    SchoolCardID,
    SimpleEffectNames,
    SimpleRuleNumPlayers,
    valid_regions,
    VictoryType
} from "../types/core";
import {INVALID_MOVE} from "boardgame.io/core";
import {
    activePlayer,
    addRes,
    addVp,
    aesAward,
    atkCardSettle,
    buildBuildingFor,
    buildingInRegion,
    buyCardEffectPrepare,
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
    curPub,
    die,
    doAestheticsBreakthrough,
    doBuy,
    doIndustryBreakthrough,
    doReturnSlotCard,
    drawCardForPlayer,
    endTurnEffect,
    fillEmptySlots,
    fillEventCard,
    fillTwoPlayerBoard,
    getEraEffectByRegion,
    loseCompetitionPower,
    loseVp,
    payCost,
    playerEffExec,
    playerLoseShare,
    regionScoringCheck,
    schoolPlayer,
    seqFromPos,
    shuffle,
    startBreakThrough,
    startCompetition,
    studioSlotsAvailable,
} from "./util";
import {changePlayerStage, changeStage, signalEndPhase, signalEndStage} from "./logFix";
import {getCardEffect, getEvent} from "../constant/effects";
import {logger} from "./logger";

export interface IChangePlayerSettingArgs {
    classicFilmAutoMoveMode: ClassicFilmAutoMoveMode
}

export interface ISetupGameModeArgs {
    order: GameTurnOrder,
    mode: GameMode,
    enableSchoolExtension: boolean,
    disableUndo: boolean
}

const undoCheck = (G: IG, log: string[]) => {
    if (!G.disableUndo) {
        log.push('canUndo')
        if (!G.previousMoveUndoable) {
            G.previousMoveUndoable = true;
            log.push(`|cleanPrevMoveUndoable`);
        }
    }
}

export const changePlayerSetting: LongFormMove = {
    move: (G: IG, ctx: Ctx, args: IChangePlayerSettingArgs) => {
        if (ctx.playerID) {
            logger.info(`${G.matchID}|p${ctx.playerID}.moves.changePlayerSetting(${JSON.stringify(args)})`);
            G.player[parseInt(ctx.playerID)].classicFilmAutoMove = args.classicFilmAutoMoveMode;
        } else {
            return INVALID_MOVE
        }
    }
}
export const setupGameMode: LongFormMove = {
    move: (G: IG, ctx: Ctx, args: ISetupGameModeArgs) => {
        logger.info(`${G.matchID}|p${ctx.playerID}.moves.setupGameMode(${JSON.stringify(args)})`);
        const log = ["setupGameMode"];
        undoCheck(G, log);
        G.mode = args.mode;
        const order: PlayerID[] = [];
        let initOrder: PlayerID[] = [];
        for (let i = 0; i < ctx.numPlayers; i++) {
            order.push(i.toString())
        }
        switch (args.order) {
            case GameTurnOrder.ALL_RANDOM:
                log.push(`|ALL_RANDOM`);
                if (args.mode === GameMode.TEAM2V2) {
                    log.push(`|${args.mode}`);
                    const teamAOrder = shuffle(ctx, ['0', '2'])
                    const teamBOrder = shuffle(ctx, ['1', '3'])
                    log.push(`|teamAOrder|[${teamAOrder}]`);
                    log.push(`|teamBOrder|[${teamBOrder}]`);
                    const teamOrder = shuffle(ctx, [teamAOrder, teamBOrder]);
                    log.push(`|teamOrder|${JSON.stringify(teamOrder)}`);
                    initOrder.push(teamOrder[0][0]);
                    initOrder.push(teamOrder[1][0]);
                    initOrder.push(teamOrder[0][1]);
                    initOrder.push(teamOrder[1][1]);
                } else {
                    initOrder = shuffle(ctx, order);
                }
                break;
            case GameTurnOrder.FIRST_RANDOM:
                const firstMovePlayer = die(ctx, ctx.numPlayers) - 1;
                log.push(`firstPlayer${firstMovePlayer}`);
                const remainPlayers = ctx.numPlayers
                for (let i = firstMovePlayer; i < remainPlayers; i++) {
                    initOrder.push(i.toString())
                }
                for (let i = 0; i < firstMovePlayer; i++) {
                    initOrder.push(i.toString())
                }
                log.push(`|FIRST_RANDOM`);
                break;
            case GameTurnOrder.FIXED:
                log.push(`|FIXED`);
                initOrder = order;
                break;
        }
        G.disableUndo = args.disableUndo;
        log.push(`|turnOrder|${JSON.stringify(initOrder)}`);
        G.order = initOrder;
        G.initialOrder = initOrder;
        G.pub[parseInt(initOrder[0])].vp = 0;
        G.pub[parseInt(initOrder[1])].vp = 1;
        if (ctx.numPlayers >= 3) {
            G.pub[parseInt(initOrder[2])].vp = 3;
        }
        if (ctx.numPlayers >= 4) {
            G.pub[parseInt(initOrder[3])].vp = 5;
        }
        if (args.enableSchoolExtension) {
            log.push(`|drawForSchoolExtension`)
            for (let sch of shuffle(ctx, [SchoolCardID.S4005, SchoolCardID.S4006, SchoolCardID.S4007, SchoolCardID.S4008]).slice(0, 2)) {
                log.push(`|${sch}|drawn`);
                G.schoolExt.push(sch);
            }
            for (let sch of shuffle(ctx, [SchoolCardID.S4001, SchoolCardID.S4002, SchoolCardID.S4003, SchoolCardID.S4004]).slice(0, 2)) {
                log.push(`|${sch}|drawn`);
                G.schoolExt.push(sch);
            }
            let schoolCardPopped = G.schoolExt.pop();
            if (schoolCardPopped === undefined) {
                throw new Error(schoolCardPopped);
            } else {
                G.regions[Region.EXTENSION].legend.card = schoolCardPopped;
            }
            for (let iCardSlot of G.regions[Region.EXTENSION].normal) {
                schoolCardPopped = G.schoolExt.pop();
                if (schoolCardPopped === undefined) {
                    throw new Error(schoolCardPopped);
                } else {
                    iCardSlot.card = schoolCardPopped;
                }
            }
        } else {
            log.push(`cleanUpSchoolExtension`)
            G.regions[Region.EXTENSION].legend.card = null;
            for (let iCardSlot of G.regions[Region.EXTENSION].normal) {
                iCardSlot.card = null;
            }
        }
        G.hasSchoolExtension = args.enableSchoolExtension;
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export interface IPayAdditionalCostArgs {
    res: number,
    deposit: number,
}

export const payAdditionalCost: LongFormMove = {
    move: (G: IG, ctx: Ctx, arg: IPayAdditionalCostArgs) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${ctx.playerID}.moves.payAdditionalCost(${JSON.stringify(arg)})`);
        const log = [`payAdditionalCost|${JSON.stringify(arg)}`];
        undoCheck(G, log);
        let pub = G.pub[parseInt(ctx.playerID)]
        let eff = G.e.stack.pop();
        const r = G.e.regions[0];
        if (eff === undefined) {
            log.push(`|stackEmpty`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return INVALID_MOVE
        } else {
            G.e.extraCostToPay = 0;
            pub.resource -= arg.res;
            pub.deposit -= arg.deposit;
            log.push(`|${pub.resource}|${pub.deposit}`);
        }
        switch ((eff.e)) {
            case "buildCinema":
                G.e.regions = [];
                log.push(`|region:|${r}`);
                if (r === undefined || r === Region.NONE || r === Region.EXTENSION) {
                    log.push(`|invalid`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return INVALID_MOVE;
                }
                buildBuildingFor(G, ctx, r, ctx.playerID, BuildingType.cinema);
                break;
            case "buildStudio":
                G.e.regions = [];
                log.push(`|region:|${r}`);
                if (r === undefined || r === Region.NONE || r === Region.EXTENSION) {
                    log.push(`|invalid`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return INVALID_MOVE;
                }
                buildBuildingFor(G, ctx, r, ctx.playerID, BuildingType.studio);
                break;
            case "industryLevelUpCost":
                log.push(`|industry|${pub.industry}`);
                if (pub.industry < 10) {
                    pub.industry++
                } else {
                    log.push(`|cannotUpgrade`);
                }
                break;
            case "aestheticsLevelUpCost":
                log.push(`|aes:|${pub.aesthetics}`);
                if (pub.aesthetics < 10) {
                    pub.aesthetics++
                } else {
                    log.push(`|cannotUpgrade`);
                }
                break;
            default:
                throw Error(`Invalid effect ${JSON.stringify(eff)}`)
        }
        log.push(`|checkNextEffect`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        checkNextEffect(G, ctx);
        return;
    }
}

export interface IShowCompetitionResultArgs {
    info: CompetitionInfo
}

export const showCompetitionResult: LongFormMove = {
    undoable: false,
    move: (G: IG, ctx: Ctx, args: IShowCompetitionResultArgs) => {
        logger.info(`${G.matchID}|p${ctx.playerID}.moves.showCompetitionResult(${JSON.stringify(args)})`)
        competitionResultSettle(G, ctx);
    }
}

export const drawCard: LongFormMove = {
    client: false,
    undoable: false,
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
        const log = [`p${arg.buyer}|buy|${arg.target}|res:${arg.resource}|deposit:${arg.deposit}|${arg.helper}`];
        undoCheck(G, log);
        logger.debug(`${G.matchID}|${log.join('')}`);
        if (canBuyCard(G, ctx, arg)) {
            let targetCard = getCardById(arg.target)
            let pub = curPub(G, ctx);
            pub.action--;
            pub.actionused = true;
            pub.resource -= arg.resource;
            pub.deposit -= arg.deposit;
            arg.helper.forEach(c => {
                let pHand = G.player[parseInt(arg.buyer)].hand;
                let idx = pHand.indexOf(c)
                let helper = G.player[parseInt(arg.buyer)].hand.splice(idx, 1)[0];
                pub.playedCardInTurn.push(helper);
            })
            G.e.card = arg.target;
            const buyTarget: INormalOrLegendCard | IBasicCard = targetCard;
            doBuy(G, ctx, buyTarget, ctx.currentPlayer);
            const hasEffect = buyCardEffectPrepare(G, ctx, arg.target, ctx.currentPlayer);
            if (hasEffect) {
                log.push(`|hasEffect`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                checkNextEffect(G, ctx);
            } else {
                logger.debug(`${G.matchID}|${log.join('')}`);
            }
            return;
        } else {
            return INVALID_MOVE;
        }
    },
    client: false,
    undoable: (G) => G.previousMoveUndoable
}

export interface ITargetChooseArgs {
    p: PlayerID,
    idx: number,
    target: PlayerID,
    targetName: string,
}

export const chooseTarget: LongFormMove = {
    client: false,
    undoable: (G) => G.previousMoveUndoable,
    move: (G: IG, ctx: Ctx, arg: ITargetChooseArgs) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.chooseTarget(${JSON.stringify(arg)})`);
        let choosePlayerID = arg.p;
        let targetPlayerId = arg.target;
        let eff = G.e.stack.pop();
        const log = [`${G.matchID}|p${arg.p}.moves.chooseTarget(${JSON.stringify(arg)})|players|${JSON.stringify(G.c.players)}|eff:${JSON.stringify(eff)}`];
        undoCheck(G, log);
        log.push(`|eff|${JSON.stringify(eff)}`);
        switch (eff.e) {
            case SimpleEffectNames.loseVpForEachHand:
                G.c.players = [];
                const handCount = G.player[parseInt(targetPlayerId)].hand.length;
                loseVp(G, ctx, targetPlayerId, handCount);
                break;
            case ItrEffects.competition:
                G.c.players = [];
                G.competitionInfo.onWin = eff.a.onWin;
                log.push(`|startCompetition`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                startCompetition(G, ctx, choosePlayerID, targetPlayerId);
                return;
            case ItrEffects.loseAnyRegionShare:
                log.push(`|loseAnyRegionShare`);
                G.c.players = [];
                G.e.regions = valid_regions.filter(
                    r => G.pub[parseInt(targetPlayerId)].shares[r] > 0
                )
                log.push(`|regions${JSON.stringify(G.e.regions)}`);
                if (G.e.regions.length > 0) {
                    if (G.e.regions.length > 1) {
                        log.push(`|stackBeforePush|${JSON.stringify(G.e.stack)}`);
                        G.e.stack.push(eff);
                        log.push(`|stackAfterPush|${JSON.stringify(G.e.stack)}`);
                        G.c.players = [targetPlayerId];
                        changePlayerStage(G, ctx, "chooseRegion", choosePlayerID);
                        log.push(`|p${choosePlayerID}|chooseRegion`);
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        return;
                    } else {
                        const targetRegion = G.e.regions[0];
                        G.e.regions = [];
                        log.push(`|onlyOneRegion|${targetRegion}`)
                        if (targetRegion !== Region.NONE && targetRegion !== Region.EXTENSION) {
                            playerLoseShare(G, targetRegion, targetPlayerId, 1);
                            loseCompetitionPower(G, ctx, targetPlayerId, 1);
                        }
                        checkNextEffect(G, ctx);
                        break;
                    }
                } else {
                    checkNextEffect(G, ctx);
                    break;
                }
            case ItrEffects.handToAnyPlayer:
                log.push(`|own|chooseHand`);
                G.c.players = [arg.target];
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "chooseHand", arg.p);
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            default:
                log.push(`|${JSON.stringify(eff)}|otherEffects|playerEffExec`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                eff.target = arg.target;
                G.e.stack.push(eff);
                playerEffExec(G, ctx, targetPlayerId);
                return
        }
    }
}

export interface IChooseHandArg {
    p: PlayerID,
    hand: CardID,
    idx: number,
}

export const chooseHand: LongFormMove = {
    undoable: (G) => G.previousMoveUndoable,
    client: false,
    move: (G: IG, ctx: Ctx, arg: IChooseHandArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.chooseHand(${JSON.stringify(arg)})`);
        const log = [`chooseHand|p${arg.p}|${arg.hand}|${arg.idx}`];
        undoCheck(G, log);
        let eff = G.e.stack.pop();
        if (eff === undefined) {
            logger.debug(`${G.matchID}|${log.join('')}`);
            throw Error("No effect cannot choose hand!")
        }
        log.push(`|${JSON.stringify(eff)}`);
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
        log.push(`|prev|hand|${JSON.stringify(hand)}|discard|${JSON.stringify(pub.discard)}`);

        switch (eff.e) {
            case "discardBasic":
                if (card.category !== CardCategory.BASIC) {
                    return INVALID_MOVE;
                } else {
                    break;
                }
            case "discardLegend":
                if (card.category !== CardCategory.LEGEND) {
                    return INVALID_MOVE;
                } else {
                    break;
                }
            case "discardIndustry":
                if (card.industry === 0) {
                    return INVALID_MOVE;
                } else {
                    break;
                }
            case "discardAesthetics":
                if (card.aesthetics === 0) {
                    return INVALID_MOVE;
                } else {
                    break;
                }
            case "discardNormalOrLegend":
                if (card.category !== CardCategory.LEGEND && card.category !== CardCategory.NORMAL) {
                    return INVALID_MOVE;
                } else {
                    break;
                }
            default:
                break;
        }
        switch (eff.e) {
            // Effect of "Blue" S3303 only
            case "playedCardInTurnEffect":
                log.push(`|${target}`);
                let cardEff = getCardEffect(target);
                if (cardEff.hasOwnProperty("play")) {
                    let eff = {...cardEff.play};
                    if (eff.e !== "none") {
                        if (eff.e === "era") {
                            eff = getEraEffectByRegion(G, ctx, eff, card.region);
                        }
                        eff.target = arg.p;
                        G.e.stack.push(eff);
                    } else {
                        log.push(`|emptyPlayEffect`);
                    }
                } else {
                    log.push(`|noPlayEffect`);
                }
                break;
            case "breakthroughResDeduct":
                hand.splice(arg.idx, 1);
                pub.archive.push(arg.hand);
                //流派扩：波兰学派
                if (pub.school === SchoolCardID.S4004) {
                    drawCardForPlayer(G, ctx, p);
                }
                startBreakThrough(G, ctx, arg.p, arg.hand);
                return;
            case "archiveToEEBuildingVP":
                hand.splice(arg.idx, 1);
                pub.archive.push(arg.hand);
                //流派扩：波兰学派
                if (pub.school === SchoolCardID.S4004) {
                    drawCardForPlayer(G, ctx, p);
                }
                if (buildingInRegion(G, ctx, Region.EE, p)) {
                    addVp(G, ctx, p, card.vp)
                }
                break;
            case "handToAnyPlayer":
                const allCardsIndex = pub.allCards.indexOf(arg.hand);
                if (allCardsIndex !== -1) {
                    pub.allCards.splice(allCardsIndex, 1);
                } else {
                    log.push(`|handNotInAllCards`);
                }
                hand.splice(arg.idx, 1);
                G.player[parseInt(G.c.players[0])].hand.push(arg.hand);
                G.pub[parseInt(G.c.players[0])].allCards.push(arg.hand);
                //流派扩：波兰学派
                if (pub.school === SchoolCardID.S4004 && parseInt(G.c.players[0]) !== parseInt(p)) {
                    drawCardForPlayer(G, ctx, p);
                }
                if (pub.school !== SchoolCardID.S4004 && G.pub[parseInt(G.c.players[0])].school === SchoolCardID.S4004 && arg.hand in BasicCardID) {
                    addVp(G, ctx, G.c.players[0], 2);
                }
                if (eff.a > 1) {
                    log.push(`|prev:${eff.a}`);
                    eff.a--;
                    log.push(`|remain:${eff.a}`);
                    G.e.stack.push(eff);
                }
                break;
            case "refactor":
                hand.splice(arg.idx, 1);
                pub.archive.push(arg.hand);
                //流派扩：波兰学派
                if (pub.school === SchoolCardID.S4004) {
                    drawCardForPlayer(G, ctx, p);
                }
                const vpToAdd = getCardById(arg.hand).vp;
                if (vpToAdd > 0) {
                    addVp(G, ctx, p, vpToAdd);
                } else {
                    loseVp(G, ctx, p, -vpToAdd);
                }
                doBuy(G, ctx, B05, p);
                if (eff.a > 1) {
                    log.push(`|prev:${eff.a}`);
                    eff.a--;
                    log.push(`|remain:${eff.a}`);
                    G.e.stack.push(eff);
                }
                break;
            case "archive":
                log.push(`|archive|prev|${JSON.stringify(pub.archive)}`);
                hand.splice(arg.idx, 1);
                pub.archive.push(arg.hand);
                //流派扩：波兰学派
                if (pub.school === SchoolCardID.S4004) {
                    drawCardForPlayer(G, ctx, p);
                }
                if (eff.a > 1) {
                    log.push(`|prev:${eff.a}`);
                    eff.a--;
                    log.push(`|remain:${eff.a}`);
                    G.e.stack.push(eff);
                }
                log.push(`|after|${JSON.stringify(pub.archive)}`);
                break;
            case "discard":
            case "discardBasic":
            case "discardLegend":
            case "discardIndustry":
            case "discardAesthetics":
            case "discardNormalOrLegend":
                log.push(`|discard|prev|${JSON.stringify(pub.discard)}`);
                hand.splice(arg.idx, 1);
                pub.discard.push(arg.hand);
                log.push(`|after|${JSON.stringify(pub.discard)}`);
                if (eff.a > 1) {
                    log.push(`|multipleDiscard|prev:${eff.a}`);
                    eff.a--;
                    G.e.stack.push(eff);
                    log.push(`|stack|${JSON.stringify(G.e.stack)}`);
                }
                if (pub.school === SchoolCardID.S4003) {
                    pub.deposit += 1;
                    addVp(G, ctx, p, 1);
                }
                break;
            default:
                throw new Error();
        }
        log.push(`|after|hand|${JSON.stringify(hand)}`);
        log.push(`|checkNextEffect`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        checkNextEffect(G, ctx);
    }
}

export interface IEffectChooseArg {
    effect: any,
    idx: number,
    p: PlayerID,
}

export const chooseEffect: LongFormMove = {
    undoable: (G) => G.previousMoveUndoable,
    client: false,
    move: (G: IG, ctx: Ctx, arg: IEffectChooseArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.chooseEffect(${JSON.stringify(arg)})`);
        const log = [("chooseEffect")];
        undoCheck(G, log);
        log.push(JSON.stringify(arg));
        log.push(`|`);
        let eff = G.e.choices[arg.idx];
        log.push(JSON.stringify(eff));
        let p = ctx.playerID === undefined ? ctx.currentPlayer : ctx.playerID
        let regions: Region[];
        logger.debug(`${G.matchID}|${log.join('')}`);
        switch (eff.e) {
            case "industryBreakthrough":
                G.e.choices = [];
                if (eff.a > 1) {
                    log.push(`|multiple`);
                    eff.a--;
                    G.e.stack.push(eff);
                }
                logger.debug(`${G.matchID}|${log.join('')}`);
                doIndustryBreakthrough(G, ctx, p);
                return;
            case "aestheticsBreakthrough":
                G.e.choices = [];
                if (eff.a > 1) {
                    log.push(`|multiple`);
                    eff.a--;
                    G.e.stack.push(eff);
                }
                logger.debug(`${G.matchID}|${log.join('')}`);
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
                log.push(`|exec|${JSON.stringify(eff)}`);
                playerEffExec(G, ctx, p);
                return;
        }
    }
}

export interface IUpdateSlotProps {
    p: PlayerID,
    slot: ICardSlot,
    cardId: CardID,
    updateHistoryIndex: number,
}

export const updateSlot: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: IUpdateSlotProps) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${ctx.playerID}.moves.updateSlot(${JSON.stringify(arg)})`);
        const cardId = arg.cardId;
        const slot = ctx.numPlayers > SimpleRuleNumPlayers ? cardSlotOnBoard(G, ctx, getCardById(cardId)) : cardSlotOnBoard2p(G, ctx, getCardById(cardId));
        if (slot === null) {
            return INVALID_MOVE;
        }
        const newWavePlayer = schoolPlayer(G, ctx, SchoolCardID.S3201);
        if (newWavePlayer === ctx.playerID) {
            drawCardForPlayer(G, ctx, newWavePlayer);
            addVp(G, ctx, newWavePlayer, 2);
        }
        doReturnSlotCard(G, ctx, slot);
        const updateResult = ctx.numPlayers > SimpleRuleNumPlayers ? fillEmptySlots(G) : fillTwoPlayerBoard(G);
        ctx.log?.setMetadata({updateResult})
        G.updateCardHistory.push(updateResult);
        checkNextEffect(G, ctx);
    },
    undoable: false
}

export interface IRegionChooseArg {
    r: Region,
    idx: number,
    p: PlayerID,
}

export const chooseRegion: LongFormMove = {
    client: false,
    undoable: (G) => G.previousMoveUndoable,
    move: (G: IG, ctx: Ctx, arg: IRegionChooseArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.chooseRegion(${JSON.stringify(arg)})`);
        const log = ["chooseRegion"];
        undoCheck(G, log);
        const r = arg.r;
        const pub = G.pub[parseInt(arg.p)]
        log.push(JSON.stringify(arg));
        if (r === Region.NONE || r === Region.EXTENSION) {
            logger.debug(`${G.matchID}|${log.join('')}|NONE|return`);
            return;
        }
        const eff = G.e.stack.pop();
        log.push(JSON.stringify(eff));
        logger.debug(`${G.matchID}|${log.join('')}`);
        let p = arg.p;
        const totalResource = pub.resource + pub.deposit;
        const reg = G.regions[r]
        const i = G.competitionInfo;
        if (eff.e === "buildStudio" || eff.e === "buildCinema") {
            if (totalResource === 3) {
                payCost(G, ctx, p, 3);
                if (eff.e === "buildStudio") {
                    buildBuildingFor(G, ctx, r, p, BuildingType.studio);
                }
                if (eff.e === "buildCinema") {
                    buildBuildingFor(G, ctx, r, p, BuildingType.cinema);
                }
            } else {
                G.e.regions = [r]
                G.e.extraCostToPay = 3;
                log.push(`|total${totalResource}|payAdditionalCost`);
                G.e.stack.push(eff);
                logger.debug(`${G.matchID}|${log.join('')}`);
                changePlayerStage(G, ctx, "payAdditionalCost", p);
                return;
            }
        } else {
            switch (eff.e) {
                case ItrEffects.loseAnyRegionShare:
                    p = G.c.players[0];
                    log.push(`|targetPlayer|p${p}`);
                    G.c.players = [];
                    playerLoseShare(G, r, p, 1);
                    loseCompetitionPower(G, ctx, p, 1);
                    break;
                case ItrEffects.anyRegionShareCompetition:
                    // const loser = i.progress > 0 ? i.def : i.atk;
                    const loser = i.def;
                    const loserPid = parseInt(loser);
                    log.push(`|beforeLose|${G.pub[loserPid].shares[r]}|${pub.shares[r]}`);
                    G.pub[loserPid].shares[r]--;
                    pub.shares[r]++;
                    log.push(`|afterLose|${G.pub[loserPid].shares[r]}|${pub.shares[r]}`);
                    if (eff.a > 1) {
                        eff.a--;
                        G.e.stack.push(eff);
                    }
                    competitionCleanUp(G, ctx);
                    break;
                case ItrEffects.anyRegionShareCentral:
                case ItrEffects.anyRegionShare:
                    pub.shares[r]++;
                    reg.share--;
                    if (eff.a > 1) {
                        eff.a--;
                        G.e.stack.push(eff);
                    }
                    break;
                default:
                    throw new Error("Unknown effect cannot execute chooseRegion");
            }
        }
        G.e.regions = [];
        logger.debug(`${G.matchID}|${log.join('')}`);
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
    undoable: (G) => G.previousMoveUndoable,
    move: (G: IG, ctx: Ctx, arg: IPeekArgs) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.peek(${JSON.stringify(arg)})`);
        let eff = G.e.stack.pop();
        let p = arg.p;
        let playerObj = G.player[parseInt(p)];
        let pub = G.pub[parseInt(p)];
        let deck = G.secretInfo.playerDecks[parseInt(p)];
        const log = [`peek|${JSON.stringify(eff)}`];
        undoCheck(G, log);
        log.push(`|deck|${JSON.stringify(deck)}`);
        log.push(`|hand${JSON.stringify(playerObj.hand)}|discard|${JSON.stringify(pub.discard)}`);
        log.push(`|cardsToPeek|${JSON.stringify(playerObj.cardsToPeek)}`);
        switch (eff.a.filter.e) {
            case "industry":
                log.push(`|industry`);
                playerObj.cardsToPeek.forEach(card => {
                    log.push(`|evaluating${card}`);
                    let c = getCardById(card);
                    if (c.industry > 0) {
                        log.push(`|hand|${card}`);
                        log.push(`|${JSON.stringify(playerObj.hand)}`);
                        playerObj.hand.push(card);
                        log.push(`|${JSON.stringify(playerObj.hand)}`);
                    } else {
                        log.push(`|discard|${card}|`);
                        log.push(`|${JSON.stringify(pub.discard)}`);
                        pub.discard.push(card);
                        log.push(`|${JSON.stringify(pub.discard)}`);
                        if (pub.school === SchoolCardID.S4003) {
                            pub.deposit += 1;
                            addVp(G, ctx, p, 1);
                        }
                    }
                })
                playerObj.cardsToPeek = []
                break;
            case "aesthetics":
                playerObj.cardsToPeek.forEach(card => {
                    log.push(`|evaluating${card}`);
                    let c = getCardById(card);
                    if (c.aesthetics > 0) {
                        log.push(`|hand|${card}`);
                        log.push(`|${JSON.stringify(playerObj.hand)}`);
                        playerObj.hand.push(card);
                        log.push(`|${JSON.stringify(playerObj.hand)}`);
                    } else {
                        log.push(`|discard|${card}`);
                        log.push(`|${JSON.stringify(pub.discard)}`);
                        pub.discard.push(card);
                        log.push(`|${JSON.stringify(pub.discard)}`);
                        if (pub.school === SchoolCardID.S4003) {
                            pub.deposit += 1;
                            addVp(G, ctx, p, 1);
                        }
                    }
                })
                playerObj.cardsToPeek = []
                break;
            case "region":
                playerObj.cardsToPeek.forEach(card => {
                    log.push(`|evaluating${card}`);
                    let c = getCardById(card);
                    if (c.region === eff.a.filter.a) {
                        log.push(`|hand|${card}`);
                        playerObj.hand.push(card);
                        log.push(`|${JSON.stringify(playerObj.hand)}`);
                    } else {
                        log.push(`|discard|${card}`);
                        log.push(`|${JSON.stringify(pub.discard)}`);
                        pub.discard.push(card);
                        log.push(`|${JSON.stringify(pub.discard)}`);
                        if (pub.school === SchoolCardID.S4003) {
                            pub.deposit += 1;
                            addVp(G, ctx, p, 1);
                        }
                    }
                })
                playerObj.cardsToPeek = []
                break;
            case "era":
                playerObj.cardsToPeek.forEach(card => {
                    log.push(`|evaluating${card}`);
                    let c = getCardById(card);
                    if (c.era === eff.a.filter.a) {
                        log.push(`|hand|${card}`);
                        log.push(`|${JSON.stringify(playerObj.hand)}`);
                        playerObj.hand.push(card);
                        log.push(`|${JSON.stringify(playerObj.hand)}`);
                    } else {
                        log.push(`|discard|${card}`);
                        log.push(`|${JSON.stringify(pub.discard)}`);
                        pub.discard.push(card);
                        log.push(`|${JSON.stringify(pub.discard)}`);
                        if (pub.school === SchoolCardID.S4003) {
                            pub.deposit += 1;
                            addVp(G, ctx, p, 1);
                        }
                    }
                })
                playerObj.cardsToPeek = [];
                break;
            case "choice":
                if (arg.card !== null) {
                    log.push(`|add|${arg.card}to|hand|`);
                    log.push(`|${JSON.stringify(playerObj.hand)}`);
                    playerObj.hand.push(arg.card);
                    log.push(`|after|${JSON.stringify(playerObj.hand)}`);
                    const idxCard = playerObj.cardsToPeek[arg.idx];
                    log.push(`|remove|${arg.card}`)
                    log.push(`|${JSON.stringify(playerObj.cardsToPeek)}`);
                    if (idxCard === arg.card) {
                        playerObj.cardsToPeek.splice(arg.idx, 1);
                    } else {
                        if (playerObj.cardsToPeek.includes(arg.card)) {
                            playerObj.cardsToPeek.splice(
                                playerObj.cardsToPeek.indexOf(arg.card), 1
                            );
                        }
                    }
                    log.push(`|${JSON.stringify(playerObj.cardsToPeek)}`);
                } else {
                    log.push(`|noChoice`);
                }
                if (eff.a.filter.a > 1) {
                    log.push(`|pendingChoices`);
                    eff.a.filter.a--;
                    G.e.stack.push(eff);
                    log.push(`|afterDeck|${JSON.stringify(deck)}`);
                    log.push(`|afterHand${JSON.stringify(playerObj.hand)}|afterDiscard|${JSON.stringify(pub.discard)}`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return;
                } else {
                    log.push(`|discardRemaining`);
                    playerObj.cardsToPeek.forEach(card => {
                        log.push(`|discard|${card}`);
                        log.push(`|${JSON.stringify(pub.discard)}`);
                        pub.discard.push(card);
                        if (pub.school === SchoolCardID.S4003) {
                            pub.deposit += 1;
                            addVp(G, ctx, p, 1);
                        }
                        log.push(`|${JSON.stringify(pub.discard)}`);
                    })
                    playerObj.cardsToPeek = [];
                }
                break;
        }
        log.push(`|after|deck|${JSON.stringify(deck)}|hand${JSON.stringify(playerObj.hand)}|discard|${JSON.stringify(pub.discard)}`);
        log.push(`|cardsToPeek|${JSON.stringify(playerObj.cardsToPeek)}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        checkNextEffect(G, ctx);
    }
}

export interface IChooseEventArg {
    event: EventCardID,
    p: PlayerID,
    idx: number,
}

export const showDrawnCard: LongFormMove = {
    move: (G: IG, ctx: Ctx, arg: CardID[]) => {
        const pid = ctx.playerID;
        const log = [`showDrawnCard`];
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`${G.matchID}|p${pid}.moves.showDrawnCard(${JSON.stringify(arg)})`);
        // player
        const playerObj = G.player[parseInt(pid)];
        log.push(`before|${playerObj.drawn}playerObj.drawn`);
        playerObj.drawn = [];
        log.push(`after|${playerObj.drawn}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export const chooseEvent: LongFormMove = {
    client: false,
    undoable: (G) => G.previousMoveUndoable,
    move: (G: IG, ctx: Ctx, arg: IChooseEventArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`$:{G.matchID}|p${arg.p}.moves.chooseEvent(${JSON.stringify(arg)})`);
        let eid: EventCardID = arg.event;
        const log = ["chooseEvent"];
        undoCheck(G, log);
        log.push(`|${JSON.stringify(G.events)}|${arg.event}|p${arg.p}|idx${arg.idx}`);
        G.events.splice(arg.idx, 1);
        G.e.card = eid;
        if (eid === EventCardID.E03) {
            log.push("|Avant-grade");
            G.activeEvents.push(EventCardID.E03);
            for (let i = 0; i < G.order.length; i++) {
                const prevAction = G.pub[i].action;
                if (prevAction < AvantGradeAP) {
                    G.pub[i].action = AvantGradeAP;
                }
            }
            logger.debug(`${G.matchID}|${log.join('')}`);
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
                    log.push(`|eventDeck|${JSON.stringify(G.secretInfo.events)}`);
                    log.push("|execute");
                    G.e.stack.push(getEvent(eid));
                    log.push(`|stack|${JSON.stringify(G.e.stack)}`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    fillEventCard(G, ctx);
                    // console.log('filled')
                    checkNextEffect(G, ctx);
                    // console.log('checked')
                    break;
                case EventCardID.E10:
                    G.order.forEach(j => {
                        const pub = G.pub[parseInt(j)];
                        G.order.forEach(o => {
                            const other = G.pub[parseInt(o)];
                            if (other.vp > pub.vp) {
                                addVp(G, ctx, j, 5);
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
                        const vpForJ = validCards.filter(c => c.type === CardType.P).length * 4;
                        addVp(G, ctx, j, vpForJ);
                    })
                    fillEventCard(G, ctx);
                    checkNextEffect(G, ctx);
                    break;
                case EventCardID.E12:
                    G.order.forEach(j => {
                        const pidInt = parseInt(j)
                        const pub = G.pub[pidInt];
                        addVp(G, ctx, j, pub.industry);
                        addVp(G, ctx, j, pub.aesthetics);
                    })
                    fillEventCard(G, ctx);
                    checkNextEffect(G, ctx);
                    break;
                case EventCardID.E13:
                    G.order.forEach(j => {
                        const pidInt = parseInt(j)
                        const pub = G.pub[pidInt];
                        let championRegionCount = 0;
                        valid_regions.forEach(r => {
                            if (pub.champions.filter(c => c.region === r).length) {
                                championRegionCount++;
                            }
                        })
                        switch (championRegionCount) {
                            case 4:
                                addVp(G, ctx, j, 20);
                                break;
                            case 3:
                                addVp(G, ctx, j, 12);
                                break;
                            case 2:
                                addVp(G, ctx, j, 6);
                                break;
                            case 1:
                                addVp(G, ctx, j, 2);
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
                        pub.champions.forEach(c => {
                            switch (c.era) {
                                case IEra.ONE:
                                    addVp(G, ctx, j, 2);
                                    break;
                                case IEra.TWO:
                                    addVp(G, ctx, j, 4);
                                    break;
                                case IEra.THREE:
                                    addVp(G, ctx, j, 6);
                                    break;
                            }
                        });
                    })
                    fillEventCard(G, ctx);
                    checkNextEffect(G, ctx);
                    break;
                default:
                    log.push(`|noSuchEventID|${eid}`);
                    break;
            }
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export const requestEndTurn: LongFormMove = {
    client: false,
    undoable: (G) => G.previousMoveUndoable,
    move: (G: IG, ctx: Ctx, arg: string) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg}.moves.requestEndTurn("${arg}")`);
        const log = [`requestEndTurn|${arg}`];
        undoCheck(G, log);
        const playerObj = G.player[parseInt(arg)]
        if (!playerObj.endTurnEffectExecuted) {
            endTurnEffect(G, ctx, arg);
            playerObj.endTurnEffectExecuted = true;
        } else {
            log.push(`|endTurnEffectAlreadyExecuted`);
            logger.debug(`${G.matchID}|${log.join('')}`);
        }
        if (G.e.stack.length === 0) {
            regionScoringCheck(G, ctx, arg);
            playerObj.endTurnEffectExecuted = false;
            logger.debug(`${G.matchID}|${log.join('')}`);
        } else {
            log.push(`|stack|${JSON.stringify(G.e.stack)}`);
            log.push(`|checkNextEffect`);
            logger.debug(`${G.matchID}|${log.join('')}`);
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
    undoable: (G) => G.previousMoveUndoable,
    move: (G: IG, ctx: Ctx, p: PlayerID) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${p}.moves.concede("${p}")`);
        const log = [`p${p}conceded`];
        undoCheck(G, log);
        if (G.order.includes(p)) {
            const concedeIndex = G.order.indexOf(p);
            log.push(`|index|${concedeIndex}|before|${JSON.stringify(G.order)}`);
            G.order.splice(concedeIndex, 1);
            if (concedeIndex < G.order.length) {
                log.push(`|notLastPlayer|DeductNewOrder`);
                G.order = seqFromPos(G, ctx, concedeIndex);
            } else {
                log.push(`|lastPlayerConcede`);
            }

            log.push(`|after|${JSON.stringify(G.order)}`);
            if (G.order.length < 2) {
                const winner = G.order[0];
                log.push(`|onePlayerLeft|endGame|winner|${winner}`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                ctx?.events?.endGame?.({
                    winner: winner,
                    reason: VictoryType.othersConceded
                })
            } else {
                log.push(`|endPhaseToUpdateOrder`);
                ctx?.events?.endPhase?.()
                logger.debug(`${G.matchID}|${log.join('')}`);
            }
        } else {
            throw Error("Conceded player cannot concede again.");
        }
    }
}

export const confirmRespond: LongFormMove = {
    client: false,
    undoable: (G) => G.previousMoveUndoable,
    move: (G: IG, ctx: Ctx, arg: string) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        let p = ctx.playerID === undefined ? ctx.currentPlayer : ctx.playerID
        logger.info(`${G.matchID}|p${p}.moves.confirmRespond(${JSON.stringify(arg)})`);
        let pub = G.pub[parseInt(p)];
        let hand = G.player[parseInt(p)].hand;
        let eff = G.e.stack.pop();
        const log = [`confirmRespond|p${p}|${JSON.stringify(arg)}|${JSON.stringify(G.e.stack)}|${JSON.stringify(eff)}`];
        undoCheck(G, log);
        logger.debug(`${G.matchID}|${log.join('')}`);
        if (arg === "yes") {
            log.push("|yes");
            switch (eff.e) {
                case "optional":
                    log.push(`|optional`);
                    const newEff = {...eff.a}
                    if (newEff.e === ItrEffects.newHollyWoodEff) {
                        log.push(`|newHollyWoodEff|${eff.target}`);
                        newEff.target = eff.target;
                        newEff.e = ItrEffects.anyRegionShare;
                        pub.newHollyWoodUsed = true;
                    } else {
                        if (eff.hasOwnProperty("target")) {
                            log.push(`|targetSpecified|${eff.target}`);
                            newEff.target = eff.target;
                        } else {
                            newEff.target = p;
                        }
                    }
                    log.push(`|${JSON.stringify(newEff)}`);
                    G.e.stack.push(newEff)
                    break;
                case "alternative":
                    log.push(`|alternative`);
                    const popEff = G.e.stack.pop()
                    log.push(`|pop|${JSON.stringify(popEff)}`);
                    G.e.stack.push(eff.a)
                    log.push(`|push|${JSON.stringify(eff.a)}`);
                    break;
                case "searchAndArchive":
                    log.push(`|searchAndArchive`);
                    let deck = G.secretInfo.playerDecks[parseInt(p)];
                    let indexOfTarget = -1
                    //流派扩：波兰学派
                    if (cardInDeck(G, ctx, parseInt(p), eff.a)) {
                        deck.forEach((c, idx) => {
                            if (c === eff.a) {
                                indexOfTarget = idx;
                            }
                        })
                        pub.archive.push(deck.splice(indexOfTarget, 1)[0]);
                        if (pub.school === SchoolCardID.S4004) {
                            drawCardForPlayer(G, ctx, p);
                        }
                    }
                    if (cardInHand(G, ctx, parseInt(p), eff.a)) {
                        hand.forEach((c, idx) => {
                            if (c === eff.a) {
                                indexOfTarget = idx;
                            }
                        })
                        pub.archive.push(hand.splice(indexOfTarget, 1)[0]);
                        if (pub.school === SchoolCardID.S4004) {
                            drawCardForPlayer(G, ctx, p);
                        }
                    }
                    if (cardInDiscard(G, ctx, parseInt(p), eff.a)) {
                        pub.discard.forEach((c, idx) => {
                            if (c === eff.a) {
                                indexOfTarget = idx;
                            }
                        })
                        pub.archive.push(pub.discard.splice(indexOfTarget, 1)[0]);
                        if (pub.school === SchoolCardID.S4004) {
                            drawCardForPlayer(G, ctx, p);
                        }
                    }
                    addVp(G, ctx, p, 2);
                    break;
                default:
                    throw new Error();
            }
        } else {
            log.push(`|no|nextEff`);
            switch (eff.e) {
                case "alternative":
                    break
                default:
                    break;
            }
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
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
    client: false,
    undoable: (G) => G.previousMoveUndoable,
    move: (G: IG, ctx: Ctx, arg: IPlayCardInfo) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        //流派扩：法国印象派
        let has_4001 = false;
        let id_4001 = 0;
        let vp_4001 = 0;
        for (let pkl = 0; pkl < ctx.numPlayers; pkl++) {
            if (G.pub[pkl].school === SchoolCardID.S4001) {
                vp_4001 = G.pub[pkl].vp;
                has_4001 = true;
                id_4001 = pkl;
                break;
            }
        }
        logger.info(`${G.matchID}|p${arg.playerID}.moves.playCard(${JSON.stringify(arg)})`);
        const log = ["playCard"];
        undoCheck(G, log);
        const playCard = getCardById(arg.card);
        const pub = G.pub[parseInt(arg.playerID)];
        const hand = G.player[parseInt(arg.playerID)].hand;
        if (cinemaInRegion(G, ctx, playCard.region, arg.playerID) && playCard.type === CardType.F) {
            log.push(`|cinemaInRegion|${playCard.region}`);
            switch (pub.school) {
                //流派扩：玛萨拉电影
                case SchoolCardID.S4002:
                    drawCardForPlayer(G, ctx, arg.playerID);
                    G.e.stack.push({e: "addVp", a: 1});
                    log.push(`|masala|${JSON.stringify(G.e.stack)}`)
                    break;
                default:
                    G.e.stack.push({e: "addVp", a: 2});
                    G.e.stack.push({e: "res", a: 1});
                    log.push(`|${JSON.stringify(G.e.stack)}`)
                    break;
            }
        }
        if (pub.school === SchoolCardID.S4008 && playCard.industry > 0) {
            //流派扩：高概
            G.e.stack.push({e: "addVp", a: playCard.industry});
            G.e.stack.push({e: "res", a: playCard.industry});
            log.push(`${JSON.stringify(G.e.stack)}`)
        }
        if (pub.school === SchoolCardID.S4005 && playCard.aesthetics > 0) {
            //流派扩：现代主义
            switch (playCard.aesthetics) {
                case 1:
                    addRes(G, ctx, arg.playerID, 1);
                    addVp(G, ctx, arg.playerID, 2);
                    break;
                case 2:
                    addRes(G, ctx, arg.playerID, 1);
                    addVp(G, ctx, arg.playerID, 2);
                    drawCardForPlayer(G, ctx, arg.playerID);
                    break;
                case 3:
                    addRes(G, ctx, arg.playerID, 1);
                    addVp(G, ctx, arg.playerID, 4);
                    drawCardForPlayer(G, ctx, arg.playerID);
                    drawCardForPlayer(G, ctx, arg.playerID);
                    break;
                default:
                    break;
            }
        }

        hand.splice(arg.idx, 1);
        pub.playedCardInTurn.push(arg.card);
        G.e.card = arg.card;
        if (arg.card === BasicCardID.B05) {
            const privateInfo = G.player[parseInt(arg.playerID)];
            switch (privateInfo.classicFilmAutoMove) {
                case ClassicFilmAutoMoveMode.AESTHETICS_AWARD:
                    aesAward(G, ctx, arg.playerID);
                    log.push(`|ClassicFilm|AutoAesthetics`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return;
                case ClassicFilmAutoMoveMode.DRAW_CARD:
                    drawCardForPlayer(G, ctx, arg.playerID);
                    log.push(`|ClassicFilm|AutoDraw`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return;
                default:
                    log.push(`|ClassicFilm|NO_AUTO_MOVE`);
            }
        }
        let cardEff = getCardEffect(arg.card);
        if (cardEff.hasOwnProperty("play")) {
            const eff = {...cardEff.play};
            if (eff.e !== "none") {
                log.push(`|${JSON.stringify(eff)}`);
                G.e.stack.splice(0, 0, eff);
                log.push(`${JSON.stringify(G.e.stack)}`)
                playerEffExec(G, ctx, ctx.currentPlayer);
            } else {
                log.push(`|emptyPlayEffect`);
                checkNextEffect(G, ctx);
            }
        } else {
            log.push(`|noPlayEffect`);
            checkNextEffect(G, ctx);
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
        //流派扩：法国印象派
        if (has_4001) {
            if (G.pub[id_4001].school === SchoolCardID.S4001) {
                if (G.pub[id_4001].vp - vp_4001 >= 3) {
                    G.pub[id_4001].resource += 1;
                }
            }
        }
    },

}

export interface ICompetitionCardArg {
    pass: boolean,
    card: ClassicCardID,
    idx: number,
    p: PlayerID,
}

export const competitionCard: LongFormMove = {
    client: false,
    undoable: (G) => G.previousMoveUndoable,
    redact: true,
    move: (G: IG, ctx: Ctx, arg: ICompetitionCardArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.competitionCard(${JSON.stringify(arg)})`);
        const p = arg.p;
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
    undoable: (G) => G.previousMoveUndoable,
    move: (G: IG, ctx: Ctx, arg: IPlayCardInfo) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.playerID}.moves.breakthrough(${JSON.stringify(arg)})`);
        const log = [`breakthrough`];
        undoCheck(G, log);
        const pub = G.pub[parseInt(arg.playerID)];
        pub.action -= 1;
        pub.actionused = true;
        pub.resource -= arg.res;
        pub.deposit -= (2 - arg.res);
        const c = getCardById(arg.card);
        G.e.card = c.cardId;
        G.player[parseInt(arg.playerID)].hand.splice(arg.idx, 1);
        pub.archive.push(arg.card);
        if (pub.school === SchoolCardID.S4004) {
            drawCardForPlayer(G, ctx, arg.playerID);
        }
        log.push(`|startBreakthrough`);
        logger.debug(`${G.matchID}|${log.join('')}`);
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
    undoable: (G) => G.previousMoveUndoable,
    move: (G: IG, ctx: Ctx, arg: ICommentArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.comment(${JSON.stringify(arg)})`);
        const slot = ctx.numPlayers > SimpleRuleNumPlayers
            ? cardSlotOnBoard(G, ctx, getCardById(arg.target))
            : cardSlotOnBoard2p(G, ctx, getCardById(arg.target));
        if (slot === null) {
            return INVALID_MOVE
        }
        if (arg.comment === null) {
            G.basicCards[slot.comment as BasicCardID]++;
            slot.comment = null;
        } else {
            if (G.basicCards[arg.comment as BasicCardID] > 0) {
                G.basicCards[arg.comment as BasicCardID]--;
            } else {
                return INVALID_MOVE
            }
            slot.comment = arg.comment;
        }
        const leftBankPlayer = schoolPlayer(G, ctx, SchoolCardID.S3204);
        if (leftBankPlayer !== null) {
            drawCardForPlayer(G, ctx, leftBankPlayer);
        }
        const newWavePlayer = schoolPlayer(G, ctx, SchoolCardID.S3201);
        if (newWavePlayer === arg.p) {
            drawCardForPlayer(G, ctx, newWavePlayer);
            addVp(G, ctx, newWavePlayer, 2);
        }
        const pub = G.pub[parseInt(arg.p)];
        if (pub.school === SchoolCardID.S2204) {
            addRes(G, ctx, arg.p, 1);
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
}

export const showBoardStatus: LongFormMove = {
    client: false,
    undoable: false,
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
