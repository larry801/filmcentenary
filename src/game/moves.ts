import {Ctx, LongFormMove, PlayerID} from 'boardgame.io';
import {CompetitionInfo, IG} from "../types/setup";
import {
    AvantGradeAP,
    B05,
    BasicCardID,
    BuildingType,
    CardID,
    CardType,
    ClassicCardID,
    ClassicFilmAutoMoveMode,
    EventCardID,
    GameMode,
    GameTurnOrder,
    getCardById,
    IBasicCard,
    IBuyInfo,
    ICardSlot, IEra,
    INormalOrLegendCard,
    IRegionInfo, ItrEffects, Region,
    SchoolCardID,
    SimpleRuleNumPlayers,
    valid_regions,
    VictoryType
} from "../types/core";
import {INVALID_MOVE} from "boardgame.io/core";
import {
    activePlayer, addRes,
    addVp,
    aesAward,
    atkCardSettle,
    buildBuildingFor,
    buildingInRegion, buyCardEffectPrepare,
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
    loseVp,
    payCost,
    playerEffExec,
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
                if (r === undefined || r === Region.NONE) {
                    log.push(`|invalid`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return INVALID_MOVE;
                }
                buildBuildingFor(G, ctx, r, ctx.playerID, BuildingType.cinema);
                break;
            case "buildStudio":
                G.e.regions = [];
                log.push(`|region:|${r}`);
                if (r === undefined || r === Region.NONE) {
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
            // case "competition":
            //     let players = [];
            //     const p = ctx.playerID;
            //     if (ctx.numPlayers > SimpleRuleNumPlayers) {
            //         if (G.mode !== GameMode.TEAM2V2) {
            //             log.push(`|normal`);
            //             players = seqFromCurrentPlayer(G, ctx);
            //         } else {
            //             log.push(`|2v2`);
            //             players = opponentTeamPlayers(p);
            //         }
            //         const ownIndex = players.indexOf(p)
            //         if (ownIndex !== -1) {
            //             players.splice(ownIndex, 1)
            //         }
            //         log.push(`|competitionPlayers:|${JSON.stringify(players)}`);
            //         log.push(`|players:|${JSON.stringify(players)}`);
            //         G.c.players = players;
            //         G.e.stack.push(eff)
            //         log.push(`|chooseTarget`);
            //         logger.debug(`${G.matchID}|${log.join('')}`);
            //         changePlayerStage(G, ctx, "chooseTarget", p);
            //         return;
            //     } else {
            //         G.competitionInfo.progress = eff.a.bonus;
            //         G.competitionInfo.onWin = eff.a.onWin;
            //         log.push(`|startCompetition`);
            //         logger.debug(`${G.matchID}|${log.join('')}`);
            //         const opponent2p = p === '0' ? '1' : '0';
            //         startCompetition(G, ctx, p, opponent2p);
            //         return;
            //     }
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
    // TODO remove comment cannot undo in real game
    // undoable: false,
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
        logger.debug(`${G.matchID}|${log.join('')}`);
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
        logger.debug(JSON.stringify(eff));
        const log = [`players|${JSON.stringify(G.c.players)}|eff:${JSON.stringify(eff)}`];
        switch (eff.e) {
            case "loseVpForEachHand":
                G.c.players = [];
                const handCount = G.player[parseInt(p)].hand.length;
                loseVp(G, ctx, p, handCount);
                break;
            case "competition":
                G.c.players = [];
                // G.competitionInfo.progress = eff.a.bonus;
                G.competitionInfo.onWin = eff.a.onWin;
                log.push(`|startCompetition`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                startCompetition(G, ctx, src, p);
                return;
            case "loseAnyRegionShare":
                G.c.players = [];
                G.e.regions = valid_regions.filter(
                    r => G.pub[parseInt(p)].shares[r] > 0
                )
                if (G.e.regions.length > 0) {
                    G.e.stack.push(eff);
                    G.c.players = [p];
                    changePlayerStage(G, ctx, "chooseRegion", src);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return;
                } else {
                    ctx?.events?.endStage?.()
                    log.push(`|endStage`);
                    break;
                }
            case "handToAnyPlayer":
                G.c.players = [arg.target]
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "chooseHand", arg.p);
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            default:
                eff.target = p;
                G.e.stack.push(eff);
                log.push(`|otherEffects|${JSON.stringify(eff)}`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                checkNextEffect(G, ctx);
                return
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
        checkNextEffect(G, ctx);
        return;
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
        const log = [`chooseHand|p${arg.p}|${arg.hand}|${arg.idx}`];
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
        switch (eff.e) {
            case "playedCardInTurnEffect":
                log.push(`|${target}`);
                let cardEff = getCardEffect(target);
                if (cardEff.hasOwnProperty("play")) {
                    const eff = {...cardEff.play};
                    if (eff.e !== "none") {
                        eff.target = arg.p;
                        G.e.stack.push(eff)
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
                // if (arg.hand === FilmCardID.F1108) {
                //     log.push(`Nanook`);
                //     const eraNA = ctx.numPlayers > SimpleRuleNumPlayers ? G.regions[Region.NA].era : G.twoPlayer.era;
                //     if (eraNA === IEra.ONE) {
                //         return INVALID_MOVE;
                //     }
                // }
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
                    log.push(`|handNotInAllCards`);
                }
                hand.splice(arg.idx, 1);
                G.player[parseInt(G.c.players[0])].hand.push(arg.hand);
                G.pub[parseInt(G.c.players[0])].allCards.push(arg.hand);
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
                hand.splice(arg.idx, 1);
                pub.archive.push(arg.hand);
                if (eff.a > 1) {
                    log.push(`|prev:${eff.a}`);
                    eff.a--;
                    log.push(`|remain:${eff.a}`);
                    G.e.stack.push(eff);
                }
                break;
            case "discard":
            case "discardLegend":
            case "discardIndustry":
            case "discardAesthetics":
            case "discardNormalOrLegend":
                if (pub.school === SchoolCardID.S3201) {
                    log.push(`|NewWaveFlagSet`);
                    // pub.discardInSettle = true;
                }
                hand.splice(arg.idx, 1);
                pub.discard.push(arg.hand);
                if (eff.a > 1) {
                    log.push(`|prev:${eff.a}`);
                    eff.a--;
                    log.push(`|remain:${eff.a}`);
                    G.e.stack.push(eff);
                }
                break;
            default:
                throw new Error();
        }
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
    client: false,
    move: (G: IG, ctx: Ctx, arg: IEffectChooseArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.chooseEffect(${JSON.stringify(arg)})`);
        const log = [("chooseEffect")];
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
    move: (G: IG, ctx: Ctx, arg: IRegionChooseArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.chooseRegion(${JSON.stringify(arg)})`);
        const log = ["chooseRegion"];
        const r = arg.r;
        const pub = G.pub[parseInt(arg.p)]
        log.push(JSON.stringify(arg));
        if (r === Region.NONE) return;
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
                    G.c.players = [];
                    G.pub[parseInt(p)].shares[r]--;
                    reg.share++;
                    break;
                case ItrEffects.anyRegionShareCompetition:
                    // const loser = i.progress > 0 ? i.def : i.atk;
                    const loser = i.def;
                    G.pub[parseInt(loser)].shares[r]--;
                    pub.shares[r]++;
                    if (eff.a > 1) {
                        eff.a--;
                        G.e.stack.push(eff);
                    }
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
    // undoable: false,
    move: (G: IG, ctx: Ctx, arg: IPeekArgs) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.peek(${JSON.stringify(arg)})`);
        let eff = G.e.stack.pop();
        let p = arg.p;
        let playerObj = G.player[parseInt(p)];
        let pub = G.pub[parseInt(p)];
        let deck = G.secretInfo.playerDecks[parseInt(p)];
        const log = [`peek|${JSON.stringify(eff)}`];
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
                    }
                })
                playerObj.cardsToPeek = []
                break;
            case "choice":
                log.push(`|${JSON.stringify(playerObj.cardsToPeek)}`);
                playerObj.cardsToPeek.splice(arg.idx, 1);
                log.push(`|${JSON.stringify(playerObj.cardsToPeek)}`);
                if (arg.card !== null) {
                    log.push(`|hand|${arg.card}`);
                    log.push(`|${JSON.stringify(playerObj.hand)}`);
                    playerObj.hand.push(arg.card);
                    log.push(`|${JSON.stringify(playerObj.hand)}`);
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
                        log.push(`|evaluating${card}`);
                        log.push(`|discard|${card}`);
                        log.push(`|${JSON.stringify(pub.discard)}`);
                        pub.discard.push(card)
                        log.push(`|${JSON.stringify(pub.discard)}`);
                    })
                    playerObj.cardsToPeek = []
                }
                break;
        }
        log.push(`|afterDeck|${JSON.stringify(deck)}|afterHand${JSON.stringify(playerObj.hand)}|afterDiscard|${JSON.stringify(pub.discard)}`);
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

export const chooseEvent: LongFormMove = {
    client: false,
    move: (G: IG, ctx: Ctx, arg: IChooseEventArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.chooseEvent(${JSON.stringify(arg)})`);
        let eid: EventCardID = arg.event;
        const log = ["chooseEvent"];
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
            if (eid === EventCardID.E07) {
                log.push("|LES CHAIERS DU CINEMA");
                G.activeEvents.push(EventCardID.E07);
            }
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
                                pub.vp += 5;
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
                        valid_regions.forEach(r => {
                            if (pub.champions.filter(c => c.region === r).length) {
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
                        pub.champions.forEach(c=>{
                            switch (c.era) {
                                case IEra.ONE:
                                    pub.vp += 2;
                                    break;
                                case IEra.TWO:
                                    pub.vp += 4;
                                    break;
                                case IEra.THREE:
                                    pub.vp += 6;
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
    // undoable: false,
    move: (G: IG, ctx: Ctx, arg: string) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg}.moves.requestEndTurn("${arg}")`);
        const log = [`requestEndTurn|${arg}`];
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
    move: (G: IG, ctx: Ctx, p: PlayerID) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${p}.moves.concede("${p}")`);
        const log = [`p${p}conceded`];
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
    move: (G: IG, ctx: Ctx, arg: string) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        let p = ctx.playerID === undefined ? ctx.currentPlayer : ctx.playerID
        logger.info(`${G.matchID}|p${p}.moves.confirmRespond(${JSON.stringify(arg)})`);
        let pub = G.pub[parseInt(p)];
        let hand = G.player[parseInt(p)].hand;
        let eff = G.e.stack.pop();
        const log = [`confirmRespond|p${p}|${JSON.stringify(arg)}|${JSON.stringify(G.e.stack)}|${JSON.stringify(eff)}`];
        logger.debug(`${G.matchID}|${log.join('')}`);
        if (arg === "yes") {
            switch (eff.e) {
                case "optional":
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
                    log.push("|yes");
                    G.e.stack.push(newEff)
                    break;
                case "alternative":
                    const popEff = G.e.stack.pop()
                    log.push(`|pop|${JSON.stringify(popEff)}`);
                    G.e.stack.push(eff.a)
                    log.push(`|push|${JSON.stringify(eff.a)}`);
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
                    log.push(`|nextEff`);
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
    move: (G: IG, ctx: Ctx, arg: IPlayCardInfo) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.playerID}.moves.playCard(${JSON.stringify(arg)})`);
        const log = ["playCard"];
        const playCard = getCardById(arg.card);
        const pub = G.pub[parseInt(arg.playerID)];
        const hand = G.player[parseInt(arg.playerID)].hand;
        if (cinemaInRegion(G, ctx, playCard.region, arg.playerID) && playCard.type === CardType.F) {
            log.push(`|cinemaInRegion|${playCard.region}`);
            addRes(G, ctx, arg.playerID, 1);
            addVp(G, ctx, arg.playerID, 1);
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
                    log.push(`|ClassicFilm|AutoAesthetics`);
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
                G.e.stack.push(eff)
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
    move: (G: IG, ctx: Ctx, arg: IPlayCardInfo) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.playerID}.moves.breakthrough(${JSON.stringify(arg)})`);
        const log = [`breakthrough`];
        // if (arg.card === FilmCardID.F1108) {
        //     log.push(`Nanook`);
        //     const eraNA = ctx.numPlayers > SimpleRuleNumPlayers ? G.regions[Region.NA].era : G.twoPlayer.era;
        //     if (eraNA === IEra.ONE) {
        //         return INVALID_MOVE;
        //     }
        // }
        const pub = G.pub[parseInt(arg.playerID)];
        pub.action -= 1;
        pub.resource -= arg.res;
        pub.deposit -= (2 - arg.res);
        const c = getCardById(arg.card);
        G.e.card = c.cardId;
        G.player[parseInt(arg.playerID)].hand.splice(arg.idx, 1);
        pub.archive.push(arg.card);
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
