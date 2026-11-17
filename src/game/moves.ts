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
    ExtensionMode,
    GameTurnOrder,
    getCardById,
    IBasicCard,
    IBuyInfo,
    ICardSlot,
    IEra,
    INormalOrLegendCard,
    IRegionInfo,
    ItrEffects,
    PersonCardID,
    Region,
    SchoolCardID,
    SimpleEffectNames,
    SimpleRuleNumPlayers,
    valid_regions,
    ValidRegion,
    VictoryType
} from "../types/core";
import { runExtensionSetups } from "../extensions/registry";
import {INVALID_MOVE} from "boardgame.io/core";
import {
    activePlayer,
    addRegionPoolCards,
    addRes,
    addSchoolVp,
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
    deductDeposit,
    die,
    doAestheticsBreakthrough,
    doBuy,
    doFillNewEraEventDeck,
    doIndustryBreakthrough,
    doReturnSlotCard,
    drawCardForPlayer,
    drawForRegion,
    endTurnEffect,
    fillEmptySlots,
    fillEventCard,
    fillTwoPlayerBoard,
    getEraEffectByRegion,
    loseCompetitionPower,
    loseVp,
    onAestheticsLevelUp,
    payCost,
    playerEffExec,
    playerLoseShare,
    recordVpStat,
    regionScoringCheck,
    schoolPlayer,
    seqFromPos,
    shuffle,
    startBreakThrough,
    startCompetition,
    studioSlotsAvailable,
    sync3DFilmCompetitionPower,
    techStuntActionSettle,
    techStuntActionStart,
} from "./util";
import {changePlayerStage, changeStage, signalEndPhase, signalEndStage, stopTimingForGameEnd} from "./logFix";
import {getPersonCardsOnBoard} from "./board-util";
import {getCardEffect, getEvent} from "../constant/effects";
import {logger} from "./logger";
import {CardRevealReason} from "./cardReveal";

export interface IChangePlayerSettingArgs {
    classicFilmAutoMoveMode: ClassicFilmAutoMoveMode
}

export interface ISetupGameModeArgs {
    order: GameTurnOrder,
    mode: GameMode,
    enableSchoolExtension: boolean,
    enableSchoolExtensionMuki: boolean,
    enableSchoolExtensionMuki2: boolean,
    enableSchoolExtensionDawn: boolean,
    enableSchoolExtensionTech: boolean,
    enableSchoolExtensionVisual: boolean,
    enableSchoolExtensionQM: boolean,
    enableExtensionChaosMedia: boolean,
    extensionMode: ExtensionMode,
    disableUndo: boolean,
    testModeCinema: boolean,
    testModeEnd180: boolean,
    /** DIY 扩展：已启用的扩展 ID 列表 */
    enabledExtensions?: string[],
}

/** 判断效果是否会增加份额（用于「每时代2个」流派扩的地区不重复约束） */
const effectGainsShare = (eff: any): boolean => {
    if (eff === null || eff === undefined || typeof eff !== "object") return false;
    if (["shareNA", "shareWE", "shareEE", "shareASIA"].includes(eff.e)) return true;
    if (eff.e === "step" || eff.e === "choice" || eff.e === "era") {
        return Array.isArray(eff.a) && eff.a.some((sub: any) => effectGainsShare(sub));
    }
    if (eff.e === "optional" || eff.e === "everyOtherCompany" || eff.e === "everyPlayer") {
        return effectGainsShare(eff.a);
    }
    return false;
};

const schoolAddsShare = (id: CardID): boolean => {
    const cardEff = getCardEffect(id);
    return effectGainsShare(cardEff.buy) || effectGainsShare(cardEff.play) || effectGainsShare(cardEff.archive);
};

/**
 * 流派分类（用于「每时代2个」的工美约束）：
 * 依次判定——先比购买需求的 ⚙/📖 等级要求，再比携带的 ⚙/📖 标志；
 * 均相同则视为「双修」，可同时充当工业 / 美学流派，对同时代的另一流派不具约束。
 */
type SchoolKind = "industry" | "aesthetics" | "dual";

const schoolCardType = (id: CardID): SchoolKind => {
    const card = getCardById(id);
    if (card.cost.industry > card.cost.aesthetics) return "industry";
    if (card.cost.aesthetics > card.cost.industry) return "aesthetics";
    if (card.industry > card.aesthetics) return "industry";
    if (card.aesthetics > card.industry) return "aesthetics";
    return "dual";
};

// Reserved for future curated company names.
const Companies: string[] = [
    "派拉蒙",
    "华纳兄弟",
    "爱迪生电影",
    "索尼",
    "东映",
    "环球影片",
    "联美电影",
    "米高梅",
    "狮门",
    "百代",
    "莫斯科电影",
    "嘉禾",
    "哥伦比亚",
    "邵氏",
    "巴兰多夫",
    "东宝",
    "二十世纪",
    "印度斯坦"
];

const assignVpByOrder = (G: IG, order: PlayerID[], numPlayers: number) => {
    for (let i = 0; i < G.pub.length; i++) {
        G.pub[i].vp = 0;
        // 重新设置对局选项时重置分数来源统计
        G.pub[i].vpStats = {source: {}, card: {}};
        G.pub[i].vpStatsFinal = {source: {}, card: {}};
    }
    G.pub[parseInt(order[0])].vp = 0;
    G.pub[parseInt(order[1])].vp = 1;
    if (numPlayers >= 3) {
        G.pub[parseInt(order[2])].vp = 3;
    }
    if (numPlayers >= 4) {
        G.pub[parseInt(order[3])].vp = 5;
    }
    G.pub.forEach((pub, idx) => {
        if (pub.vp > 0) {
            recordVpStat(G, idx.toString() as PlayerID, pub.vp, "初始设置");
        }
    });
}

const assignAnonymousCompanyNames = (ctx: Ctx, order: PlayerID[], numPlayers: number): string[] => {
    const assignedNames = Array.from({length: numPlayers}, () => "");
    const shuffledCompanies = shuffle(ctx, [...Companies]);
    for (let i = 0; i < order.length; i++) {
        const playerId = parseInt(order[i]);
        assignedNames[playerId] = shuffledCompanies[i] ?? `Company_${i + 1}`;
    }
    return assignedNames;
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
        G.anonymousRandomMode = args.order === GameTurnOrder.ANONYMOUS_RANDOM;
        G.anonymousRandomRevealed = false;
        G.anonymousPlayerNames = order.map(() => "");
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
            case GameTurnOrder.ANONYMOUS_RANDOM:
                log.push(`|ANONYMOUS_RANDOM`);
                initOrder = order;
                break;
            case GameTurnOrder.FIXED:
                log.push(`|FIXED`);
                initOrder = order;
                break;
        }
        G.disableUndo = args.disableUndo;
        G.testModeCinema = args.testModeCinema;
        G.testModeEnd180 = args.testModeEnd180;
        log.push(`|turnOrder|${JSON.stringify(initOrder)}`);
        G.order = initOrder;
        G.initialOrder = initOrder;
        assignVpByOrder(G, initOrder, ctx.numPlayers);
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
                
            } else {
                G.regions[Region.EXTENSION].legend.card = schoolCardPopped;
            }
            for (let iCardSlot of G.regions[Region.EXTENSION].normal) {
                schoolCardPopped = G.schoolExt.pop();
                if (schoolCardPopped === undefined) {
                    break;
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

        G.regions[Region.EXTENSION1].legend.card = null;
        for (let iCardSlot of G.regions[Region.EXTENSION1].normal) {
            iCardSlot.card = null;
        }
        let cardsEx = [];
        if(args.enableSchoolExtensionMuki) {
			for (let sch of shuffle(ctx, [SchoolCardID.S5001, SchoolCardID.S5003]).slice(0, 1)) {
                log.push(`|${sch}|drawn`);
                cardsEx.push(sch);
            }
			for (let sch of shuffle(ctx, [SchoolCardID.S5002, SchoolCardID.S5004]).slice(0, 1)) {
                log.push(`|${sch}|drawn`);
                cardsEx.push(sch);
            }
        }
        if(args.enableSchoolExtensionQM){
            let cards = [SchoolCardID.S6001, SchoolCardID.S6002, SchoolCardID.S6003/*, SchoolCardID.S6004*/];
            for (let card of shuffle(ctx, cards).slice(0, 2)) cardsEx.push(card);
        }

        if(cardsEx.length > 0){
            let schoolCardPopped = cardsEx.pop();
            if (schoolCardPopped === undefined) {
                throw new Error(schoolCardPopped);
            } else {
                G.regions[Region.EXTENSION1].legend.card = schoolCardPopped;
            }
            for (let iCardSlot of G.regions[Region.EXTENSION1].normal) {
                schoolCardPopped = cardsEx.pop();
                if (schoolCardPopped === undefined) {
                    break;
                } else {
                    iCardSlot.card = schoolCardPopped;
                }
            }
        }

        
        G.regions[Region.EXTENSION2].legend.card = null;
        for (let iCardSlot of G.regions[Region.EXTENSION2].normal) {
            iCardSlot.card = null;
        }
        let cardsMukiEx2 = [];
        if(args.enableSchoolExtensionMuki2){
            let industryCards = [
                SchoolCardID.S5201, SchoolCardID.S5204, SchoolCardID.S5205,
                SchoolCardID.S5203, SchoolCardID.S5203,
            ];
            let aestheticCards = [
                SchoolCardID.S5201, SchoolCardID.S5204, SchoolCardID.S5205,
                SchoolCardID.S5202, SchoolCardID.S5202,
            ];
            let industryCard = shuffle(ctx, industryCards)[0];
            if(industryCard !== SchoolCardID.S5203){
                aestheticCards.splice(aestheticCards.indexOf(industryCard), 1);
            }
            let aestheticCard = shuffle(ctx, aestheticCards)[0];
            cardsMukiEx2.push(industryCard);
            cardsMukiEx2.push(aestheticCard);

            
            let era2Cards = shuffle(ctx, [
                SchoolCardID.S5206,
                SchoolCardID.S5207,
                SchoolCardID.S5208,
                SchoolCardID.S5209
            ]).slice(0, 2);
            cardsMukiEx2.push(...era2Cards);
        }
        if(cardsMukiEx2.length > 0){
            let schoolCardPopped = cardsMukiEx2.pop();
            if (schoolCardPopped === undefined) {
                throw new Error(schoolCardPopped);
            } else {
                G.regions[Region.EXTENSION2].legend.card = schoolCardPopped;
            }
            for (let iCardSlot of G.regions[Region.EXTENSION2].normal) {
                schoolCardPopped = cardsMukiEx2.pop();
                if (schoolCardPopped === undefined) {
                    break;
                } else {
                    iCardSlot.card = schoolCardPopped;
                }
            }
        }

        
        G.regions[Region.MONTHLY_SCHOOL].legend.card = null;
        for (let iCardSlot of G.regions[Region.MONTHLY_SCHOOL].normal) {
            iCardSlot.card = null;
        }
        // 月度流派扩：全部发放模式下 2026-8 / 2026-9 / 2026-10 互斥，优先级 2026-10 > 2026-9 > 2026-8
        let monthlyChoice: "visual" | "tech" | "dawn" | null = null;
        if (args.extensionMode === ExtensionMode.NONE) {
            if (args.enableSchoolExtensionVisual) {
                monthlyChoice = "visual";
            } else if (args.enableSchoolExtensionTech) {
                monthlyChoice = "tech";
            } else if (args.enableSchoolExtensionDawn) {
                monthlyChoice = "dawn";
            }
        }
        const monthlyConflict = args.extensionMode === ExtensionMode.NONE &&
            ((args.enableSchoolExtensionDawn && args.enableSchoolExtensionTech) ||
                (args.enableSchoolExtensionDawn && args.enableSchoolExtensionVisual) ||
                (args.enableSchoolExtensionTech && args.enableSchoolExtensionVisual));
        if (monthlyConflict) {
            log.push(`|monthlyConflict|${monthlyChoice}Wins`);
        }
        let cardsMonthly: SchoolCardID[] = [];
        if (monthlyChoice === "visual") {
            cardsMonthly.push(...shuffle(ctx, [
                SchoolCardID.S52701,
                SchoolCardID.S52702
            ]));
        } else if (monthlyChoice === "tech") {
            let sepCards = shuffle(ctx, [
                SchoolCardID.S52691,
                SchoolCardID.S52692,
                SchoolCardID.S52693,
                SchoolCardID.S52694
            ]);
            cardsMonthly.push(...sepCards);
        } else if (monthlyChoice === "dawn") {
            let dawnCards = shuffle(ctx, [
                SchoolCardID.S52681,
                SchoolCardID.S52682,
                SchoolCardID.S52683,
                SchoolCardID.S52684
            ]);
            cardsMonthly.push(...dawnCards);
        }
        if(cardsMonthly.length > 0){
            let schoolCardPopped = cardsMonthly.pop();
            if (schoolCardPopped === undefined) {
                throw new Error(schoolCardPopped);
            } else {
                G.regions[Region.MONTHLY_SCHOOL].legend.card = schoolCardPopped;
            }
            for (let iCardSlot of G.regions[Region.MONTHLY_SCHOOL].normal) {
                schoolCardPopped = cardsMonthly.pop();
                if (schoolCardPopped === undefined) {
                    break;
                } else {
                    iCardSlot.card = schoolCardPopped;
                }
            }
        }

        if(args.extensionMode === ExtensionMode.NONE){
            //as default, do nothing
        }else if(args.extensionMode === ExtensionMode.FOUR){
            // 每个时代按「抽扩 → 抽牌」循环，凑满 2 张即停；工美按流派分类判定；
            // 1/2 时代中会增加份额的流派不重复地区。
            // 特殊：Muki 扩（Muki扩 + Muki扩2）与 QM 扩视为同一个流派扩（合并为同一卡池）。
            const packs: { id: string, cards: CardID[] }[] = [];
            if(args.enableSchoolExtension) packs.push({id: "yang", cards: [
                SchoolCardID.S4001, SchoolCardID.S4002, SchoolCardID.S4003, SchoolCardID.S4004,
                SchoolCardID.S4005, SchoolCardID.S4006, SchoolCardID.S4007, SchoolCardID.S4008,
            ]});
            // Muki 扩（Muki扩 + Muki扩2）与 QM 扩视为同一个流派扩：合并为同一个卡池参与抽取。
            // 该卡池覆盖Ⅰ/Ⅱ/Ⅲ 三个时代：Muki扩=Ⅰ，Muki扩2=Ⅱ/Ⅲ，QM=Ⅱ。
            const mukiQmCards: CardID[] = [];
            if(args.enableSchoolExtensionMuki) mukiQmCards.push(
                SchoolCardID.S5001, SchoolCardID.S5002, SchoolCardID.S5003, SchoolCardID.S5004,
            );
            if(args.enableSchoolExtensionMuki2) mukiQmCards.push(
                SchoolCardID.S5201, SchoolCardID.S5202, SchoolCardID.S5203, SchoolCardID.S5204, SchoolCardID.S5205,
                SchoolCardID.S5206, SchoolCardID.S5207, SchoolCardID.S5208, SchoolCardID.S5209,
            );
            if(args.enableSchoolExtensionQM) mukiQmCards.push(
                SchoolCardID.S6001, SchoolCardID.S6002, SchoolCardID.S6003,
            );
            if(mukiQmCards.length > 0) packs.push({id: "muki_qm", cards: mukiQmCards});
            if(args.enableSchoolExtensionDawn) packs.push({id: "dawn", cards: [
                SchoolCardID.S52681, SchoolCardID.S52682, SchoolCardID.S52683, SchoolCardID.S52684,
            ]});
            if(args.enableSchoolExtensionTech) packs.push({id: "tech", cards: [
                SchoolCardID.S52691, SchoolCardID.S52692, SchoolCardID.S52693, SchoolCardID.S52694,
            ]});
            if(args.enableSchoolExtensionVisual) packs.push({id: "visual", cards: [
                SchoolCardID.S52701, SchoolCardID.S52702,
            ]});

            // 单张牌能否与已抽出的牌组成合法组合
            // 工美：双修不具约束；两张同为工业流派或同为美学流派则不合法
            // 份额地区：仅 Ⅰ/Ⅱ 时代，两张都加份额且地区相同则不合法
            const schoolPairIsLegal = (era: IEra, first: SchoolCardID, second: SchoolCardID): boolean => {
                if (first === second) return false;
                const t1 = schoolCardType(first);
                const t2 = schoolCardType(second);
                if (t1 === "industry" && t2 === "industry") return false;
                if (t1 === "aesthetics" && t2 === "aesthetics") return false;
                const c1 = getCardById(first);
                const c2 = getCardById(second);
                if (era <= IEra.TWO && schoolAddsShare(first) && schoolAddsShare(second) && c1.region === c2.region) return false;
                return true;
            };
            const drawTwoForEra = (era: IEra): SchoolCardID[] => {
                const eraPacks = packs
                    .map(p => ({id: p.id, cards: p.cards.filter(id => getCardById(id).era === era) as SchoolCardID[]}))
                    .filter(p => p.cards.length > 0);
                if (eraPacks.length === 0) return [];

                const drawn: SchoolCardID[] = [];
                // 抽取一个【流派扩】，直到所有扩都被抽取过（顺序随机）
                for (const pack of shuffle(ctx, eraPacks)) {
                    // 在该扩内继续抽取【流派】：满足份额地区与工美约束才加入，否则继续抽该扩下一张
                    for (const card of shuffle(ctx, pack.cards)) {
                        if (drawn.length >= 2) break;
                        if (drawn.every((d: SchoolCardID) => schoolPairIsLegal(era, d, card))) {
                            drawn.push(card);
                        }
                    }
                    // 该时代流派已凑满 2 个，立即退出
                    if (drawn.length >= 2) break;
                }
                // 所有扩都抽完仍不足 2 个：从该时代剩余流派中降级补齐（不再校验约束）
                if (drawn.length < 2) {
                    const rest: SchoolCardID[] = [];
                    eraPacks.forEach(p => p.cards.forEach((id: SchoolCardID) => {
                        if (!drawn.includes(id)) rest.push(id);
                    }));
                    for (const card of shuffle(ctx, rest)) {
                        if (drawn.length >= 2) break;
                        drawn.push(card);
                    }
                }
                return drawn;
            };

            const drawn_cards: SchoolCardID[] = [
                ...drawTwoForEra(IEra.ONE),
                ...drawTwoForEra(IEra.TWO),
                ...drawTwoForEra(IEra.THREE),
            ];
            
            G.regions[Region.EXTENSION].legend.card = null;
            for (let iCardSlot of G.regions[Region.EXTENSION].normal) {
                iCardSlot.card = null;
            }

            let schoolCardPopped = drawn_cards.pop();
            if (schoolCardPopped === undefined) {
                //
            } else {
                G.regions[Region.EXTENSION].legend.card = schoolCardPopped;
            }
            for (let iCardSlot of G.regions[Region.EXTENSION].normal) {
                schoolCardPopped = drawn_cards.pop();
                if (schoolCardPopped === undefined) {
                    break;
                } else {
                    iCardSlot.card = schoolCardPopped;
                }
            }
        }

        G.hasSchoolExtension = args.enableSchoolExtension;
        G.hasSchoolExtensionMuki = args.enableSchoolExtensionMuki;
        G.hasSchoolExtensionMuki2 = args.enableSchoolExtensionMuki2;
        G.hasSchoolExtensionDawn = args.enableSchoolExtensionDawn &&
            (args.extensionMode !== ExtensionMode.NONE || monthlyChoice === "dawn");
        G.hasSchoolExtensionTech = args.enableSchoolExtensionTech &&
            (args.extensionMode !== ExtensionMode.NONE || monthlyChoice === "tech");
        G.hasSchoolExtensionVisual = args.enableSchoolExtensionVisual &&
            (args.extensionMode !== ExtensionMode.NONE || monthlyChoice === "visual");
        G.hasSchoolExtensionQM = args.enableSchoolExtensionQM;
        G.hasExtensionChaosMedia = args.enableExtensionChaosMedia;
        G.extensionMode = args.extensionMode;
        G.enabledExtensions = args.enabledExtensions || [];

        // ★ 执行所有启用 DIY 扩展的 onSetup 钩子
        if (G.enabledExtensions.length > 0) {
            runExtensionSetups(G, ctx);
        }

        
        if (ctx.numPlayers === 4) {
            drawForRegion(G, ctx, Region.NA, IEra.ONE);
            drawForRegion(G, ctx, Region.WE, IEra.ONE);
            drawForRegion(G, ctx, Region.EE, IEra.ONE);
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

        // console.log("payAdditionalCost: " , G.secretInfo);

        undoCheck(G, log);
        let pub = G.pub[parseInt(ctx.playerID)]
        let eff = G.e.stack.pop();
        const r = G.e.regions[Region.NA];
        if (eff === undefined) {
            log.push(`|stackEmpty`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return INVALID_MOVE
        } else {
            G.e.extraCostToPay = 0;
            pub.resource -= arg.res;
            deductDeposit(G, ctx, ctx.playerID as PlayerID, arg.deposit);
            log.push(`|${pub.resource}|${pub.deposit}`);
        }
        switch ((eff.e)) {
            case "buildCinema":
                G.e.regions = [];
                log.push(`|region:|${r}`);
                if (!([Region.NA, Region.WE, Region.EE, Region.ASIA].includes(r))) {
                    log.push(`|invalid`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return INVALID_MOVE;
                }
                // @ts-ignore
                buildBuildingFor(G, ctx, r, ctx.playerID, BuildingType.cinema);
                break;
            case "buildStudio":
                G.e.regions = [];
                log.push(`|region:|${r}`);
                if (!([Region.NA, Region.WE, Region.EE, Region.ASIA].includes(r))) {
                    log.push(`|invalid`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return INVALID_MOVE;
                }
                // @ts-ignore
                buildBuildingFor(G, ctx, r, ctx.playerID, BuildingType.studio);
                break;
            case "industryLevelUpCost":
                log.push(`|industry|${pub.industry}`);
                if (pub.industry < 10) {
                    pub.industry++
                    sync3DFilmCompetitionPower(G, ctx.playerID as PlayerID);
                } else {
                    log.push(`|cannotUpgrade`);
                }
                break;
            case "aestheticsLevelUpCost":
                log.push(`|aes:|${pub.aesthetics}`);
                if (pub.aesthetics < 10) {
                    pub.aesthetics++
                    sync3DFilmCompetitionPower(G, ctx.playerID as PlayerID);
                    onAestheticsLevelUp(G, ctx, ctx.playerID as PlayerID);
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
        const pub = curPub(G, ctx);
        G.e.vpContext = null;
        pub.action--;
        pub.actionused = true;
        drawCardForPlayer(G, ctx, ctx.currentPlayer);
        // 2026-9 技术：定格电影 - 使用行动力抽牌后，+1牌，+3声望（2026-10 由 +2 调整为 +3）
        if (pub.archive.includes("S52691" as any)) {
            drawCardForPlayer(G, ctx, ctx.currentPlayer);
            addVp(G, ctx, ctx.currentPlayer, 3, "卡牌效果", "S52691");
        }
        // 2026-9 技术：特技电影 - 行动结算完毕，对比手牌变化（2026-10：不再由行动力抽牌触发）
        techStuntActionSettle(G, ctx);
        // 特艺七彩150选择等效果压入栈时，立即结算
        if (G.e.stack.length > 0) {
            checkNextEffect(G, ctx);
        }
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
            G.e.vpContext = {source: "卡牌效果", card: arg.target};
            pub.action--;
            pub.actionused = true;
            pub.resource -= arg.resource;
            deductDeposit(G, ctx, arg.buyer, arg.deposit);
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
                if (G.e.stack.length > 0) {
                    checkNextEffect(G, ctx);
                } else {
                    // 2026-9 技术：特技电影 - 行动结算完毕，对比手牌变化
                    techStuntActionSettle(G, ctx);
                    G.e.vpContext = null;
                }
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
                        const targetRegion = G.e.regions[Region.NA];
                        G.e.regions = [];
                        log.push(`|onlyOneRegion|${targetRegion}`)
                        if ([Region.NA, Region.WE, Region.EE, Region.ASIA].includes(targetRegion)) {
                            // @ts-ignore
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
            case "discardToAnyPlayer":
                log.push(`|own|chooseDiscard`);
                G.c.players = [arg.target];
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "chooseDiscard", arg.p);
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
        } else if (eff.e === "personCardOnBoardEffect") {
            target = getPersonCardsOnBoard(G)[arg.idx];
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
            case "personCardOnBoardEffect":
                log.push(`|${target}`);
                let cardEff = getCardEffect(target);
                if (cardEff.hasOwnProperty("play")) {
                    let eff = {...cardEff.play};
                    if (eff.e !== "none") {
                        if (eff.e === "era") {
                            // 武侠电影
                            if (pub.school === SchoolCardID.S5209 && pub.action == 1) {
                                const isObsoleteFilm = card.type === CardType.F && card.region !== Region.NONE &&
                                    card.era < G.regions[card.region].era;
                                if (isObsoleteFilm) {
                                    if (pub.deposit >= 1) {
                                        deductDeposit(G, ctx, p, 1);
                                        let era;
                                        for (era = 0; era < 3; era++) {
                                            if (eff.a[era].e !== 'none') break;
                                        }
                                        log.push(`|era|${era}|payDeposit`);
                                        eff = {...eff.a[era]};
                                        if (eff.hasOwnProperty("target")) {
                                            eff.target = eff.target
                                        }
                                    } else {
                                        eff = getEraEffectByRegion(G, ctx, eff, card.region);
                                        eff.target = arg.p;
                                        G.e.stack.push(eff);
                                        log.push(`|noDeposit|wuxia`);
                                        addSchoolVp(G, ctx, p, 1);
                                        break;
                                    }
                                } else {
                                    eff = getEraEffectByRegion(G, ctx, eff, card.region);
                                }
                            } else {
                                eff = getEraEffectByRegion(G, ctx, eff, card.region);
                            }
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
                //黑浪潮
                if (pub.school === SchoolCardID.S5208) {
                    let active = false;

                    let card = getCardById(arg.hand);
                    if(card.region !== Region.NONE && card.era != G.regions[card.region].era && card.type === CardType.F) active = true;
                    if(arg.hand === BasicCardID.B04) active = true;

                    if(active){
                        doBuy(G, ctx, B05, p);
                        //drawCardForPlayer(G, ctx, p);
                    }
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
                //黑浪潮
                if (pub.school === SchoolCardID.S5208) {
                    let active = false;

                    let card = getCardById(arg.hand);
                    if(card.region !== Region.NONE && card.era != G.regions[card.region].era && card.type === CardType.F) active = true;
                    if(arg.hand === BasicCardID.B04) active = true;

                    if(active){
                        doBuy(G, ctx, B05, p);
                        //drawCardForPlayer(G, ctx, p);
                    }
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
                    addSchoolVp(G, ctx, G.c.players[0], 2);
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
                //黑浪潮
                if (pub.school === SchoolCardID.S5208) {
                    let active = false;
                    
                    let card = getCardById(arg.hand);
                    if(card.region !== Region.NONE && card.era != G.regions[card.region].era && card.type === CardType.F) active = true;
                    if(arg.hand === BasicCardID.B04) active = true;

                    if(active){
                        doBuy(G, ctx, B05, p);
                        //drawCardForPlayer(G, ctx, p);
                    }
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
                //黑浪潮
                if (pub.school === SchoolCardID.S5208) {
                    let active = false;

                    let card = getCardById(arg.hand);
                    if(card.region !== Region.NONE && card.era != G.regions[card.region].era && card.type === CardType.F) active = true;
                    if(arg.hand === BasicCardID.B04) active = true;

                    if(active){
                        doBuy(G, ctx, B05, p);
                        //drawCardForPlayer(G, ctx, p);
                    }
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
                    addSchoolVp(G, ctx, p, 1);
                }
                /*
                if (pub.school === SchoolCardID.S6342) {
                    for(let i = 0; i < getCardById(arg.hand).industry; i++) addRes(G, ctx, p, 1);
                    for(let i = 0; i < getCardById(arg.hand).aesthetics; i++) addVp(G, ctx, p, 1);
                }
                */
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

export interface IChooseDiscardArg {
    p: PlayerID,
    discard: CardID,
    idx: number,
}

export const chooseDiscard: LongFormMove = {
    undoable: (G) => G.previousMoveUndoable,
    client: false,
    move: (G: IG, ctx: Ctx, arg: IChooseDiscardArg) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${G.matchID}|p${arg.p}.moves.chooseDiscard(${JSON.stringify(arg)})`);
        const log = [`chooseDiscard|p${arg.p}|${arg.discard}|${arg.idx}`];
        undoCheck(G, log);
        let eff = G.e.stack.pop();
        if (eff === undefined) {
            logger.debug(`${G.matchID}|${log.join('')}`);
            throw Error("No effect cannot choose discard!")
        }
        log.push(`|${JSON.stringify(eff)}`);
        let p = arg.p;
        let pub = G.pub[parseInt(p)];
        let target: CardID = arg.discard;
        const discard = G.pub[parseInt(p)].discard;
        const card: IBasicCard | INormalOrLegendCard = getCardById(target);
        log.push(`|prev|discard|${JSON.stringify(discard)}`);

        switch (eff.e) {
            case "discardToAnyPlayer":
                const allCardsIndex = pub.allCards.indexOf(arg.discard);
                if (allCardsIndex !== -1) {
                    pub.allCards.splice(allCardsIndex, 1);
                } else {
                    log.push(`|discardNotInAllCards`);
                }
                discard.splice(arg.idx, 1);
                G.player[parseInt(G.c.players[0])].hand.push(arg.discard);
                G.pub[parseInt(G.c.players[0])].allCards.push(arg.discard);
                //流派扩：波兰学派
                if (pub.school === SchoolCardID.S4004 && parseInt(G.c.players[0]) !== parseInt(p)) {
                    drawCardForPlayer(G, ctx, p);
                }
                if (pub.school !== SchoolCardID.S4004 && G.pub[parseInt(G.c.players[0])].school === SchoolCardID.S4004 && arg.discard in BasicCardID) {
                    addSchoolVp(G, ctx, G.c.players[0], 2);
                }
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
        log.push(`|after|discard|${JSON.stringify(discard)}`);
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
        if (eff === undefined) {
            return INVALID_MOVE;
        }
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
                regions = studioSlotsAvailable(G, ctx, p);
                if (regions.length === 0) {
                    // 无法执行：空置执行
                    log.push(`|noStudioSlot|skip`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    checkNextEffect(G, ctx);
                    return;
                }
                G.e.stack.push(eff);
                regions.forEach(r => G.e.regions.push(r));
                changeStage(G, ctx, "chooseRegion");
                return;
            case "buildCinema":
                G.e.choices = [];
                regions = cinemaSlotsAvailable(G, ctx, p);
                if (regions.length === 0) {
                    // 无法执行：空置执行
                    log.push(`|noCinemaSlot|skip`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    checkNextEffect(G, ctx);
                    return;
                }
                G.e.stack.push(eff);
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
            // 2026-10 修复：目标卡位已失效（如所有地区为空）时不再卡住，直接继续结算
            logger.debug(`${G.matchID}|updateSlot|slotNull|skip`);
            checkNextEffect(G, ctx);
            return;
        }
        const newWavePlayer = schoolPlayer(G, ctx, SchoolCardID.S3201);
        if (newWavePlayer === ctx.playerID) {
            drawCardForPlayer(G, ctx, newWavePlayer);
            addSchoolVp(G, ctx, newWavePlayer, 2);
        }
        doReturnSlotCard(G, ctx, slot);
        const updateResult = ctx.numPlayers > SimpleRuleNumPlayers ?
            fillEmptySlots(G, ctx, CardRevealReason.UPDATE) :
            fillTwoPlayerBoard(G, ctx, CardRevealReason.UPDATE);
        G.updateCardHistory.push(updateResult);

        const newCinemaPlayer = schoolPlayer(G, ctx, SchoolCardID.S6342);
        if (newCinemaPlayer !== null) {
            drawCardForPlayer(G, ctx, newCinemaPlayer);
        }

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
        if (!([Region.NA, Region.WE, Region.EE, Region.ASIA].includes(r))) {
            logger.debug(`${G.matchID}|${log.join('')}|NONE|return`);
            return;
        }
        // 2026-10：必须从 G.e.regions 提供的候选里选。
        // chooseRegion 是盲 pop 栈顶，若不校验，传入候选外的地区会导致份额被扣成负数
        // （如 anyRegionShareCompetition 对败者 shares[r]--）。
        const candidateRegions: Region[] = Array.isArray(G.e.regions) ? G.e.regions : [];
        if (candidateRegions.length > 0 && !candidateRegions.includes(r)) {
            log.push(`|regionNotInCandidates|${r}|${JSON.stringify(candidateRegions)}`);
            logger.debug(`${G.matchID}|${log.join('')}|invalidRegion|return`);
            return;
        }
        const eff = G.e.stack.pop();
        log.push(JSON.stringify(eff));
        logger.debug(`${G.matchID}|${log.join('')}`);
        let p = arg.p;
        const totalResource = pub.resource + pub.deposit;
        // @ts-ignore
        const reg = G.regions[r]
        const i = G.competitionInfo;
        if (eff.e === "buildStudio" || eff.e === "buildCinema") {
            if (totalResource === 3) {
                payCost(G, ctx, p, 3);
                if (eff.e === "buildStudio") {
                    // @ts-ignore
                    buildBuildingFor(G, ctx, r, p, BuildingType.studio);
                }
                if (eff.e === "buildCinema") {
                    // @ts-ignore
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
                    // @ts-ignore
                    playerLoseShare(G, r, p, 1);
                    loseCompetitionPower(G, ctx, p, 1);
                    break;
                case ItrEffects.anyRegionShareCompetition:
                    // const loser = i.progress > 0 ? i.def : i.atk;
                    const loser = i.def;
                    const loserPid = parseInt(loser);
                    // @ts-ignore
                    log.push(`|beforeLose|${G.pub[loserPid].shares[r]}|${pub.shares[r]}`);
                    // @ts-ignore
                    G.pub[loserPid].shares[r]--;
                    // @ts-ignore
                    pub.shares[r]++;
                    // @ts-ignore
                    log.push(`|afterLose|${G.pub[loserPid].shares[r]}|${pub.shares[r]}`);
                    if (eff.a > 1) {
                        eff.a--;
                        G.e.stack.push(eff);
                    }
                    competitionCleanUp(G, ctx);
                    break;
                case ItrEffects.anyRegionShareCentral:
                case ItrEffects.anyRegionShare:
                    // @ts-ignore
                    pub.shares[r]++;
                    reg.share--;
                    if (eff.a > 1) {
                        eff.a--;
                        G.e.stack.push(eff);
                    }
                    break;
                case "52701_buy": {
                    // 2026-10 技术：变焦镜头 - 该地区 +3 份额，+2 普通牌，+1 传奇牌
                    log.push(`|52701|${r}|share+3|cards+3`);
                    const validR = r as ValidRegion;
                    G.regions[validR].share += 3;
                    addRegionPoolCards(G, ctx, validR, 2, 1);
                    break;
                }
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
                            addSchoolVp(G, ctx, p, 1);
                        }
                        /*
                        if (pub.school === SchoolCardID.S6342) {
                            for(let i = 0; i < getCardById(card).industry; i++) addRes(G, ctx, p, 1);
                            for(let i = 0; i < getCardById(card).aesthetics; i++) addVp(G, ctx, p, 1);
                        }
                        */
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
                            addSchoolVp(G, ctx, p, 1);
                        }
                        /*
                        if (pub.school === SchoolCardID.S6342) {
                            for(let i = 0; i < getCardById(card).industry; i++) addRes(G, ctx, p, 1);
                            for(let i = 0; i < getCardById(card).aesthetics; i++) addVp(G, ctx, p, 1);
                        }
                        */
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
                            addSchoolVp(G, ctx, p, 1);
                        }
                        /*
                        if (pub.school === SchoolCardID.S6342) {
                            for(let i = 0; i < getCardById(card).industry; i++) addRes(G, ctx, p, 1);
                            for(let i = 0; i < getCardById(card).aesthetics; i++) addVp(G, ctx, p, 1);
                        }
                            */
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
                        /*
                       if (pub.school === SchoolCardID.S6342) {
                            for(let i = 0; i < getCardById(card).industry; i++) addRes(G, ctx, p, 1);
                            for(let i = 0; i < getCardById(card).aesthetics; i++) addVp(G, ctx, p, 1);
                        }
                        */
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
                            addSchoolVp(G, ctx, p, 1);
                        }
                        /*
                        if (pub.school === SchoolCardID.S6342) {
                            for(let i = 0; i < getCardById(card).industry; i++) addRes(G, ctx, p, 1);
                            for(let i = 0; i < getCardById(card).aesthetics; i++) addVp(G, ctx, p, 1);
                        }*/
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
        // 2026-10 分数来源统计：事件效果产生的分数归入「事件」
        G.e.vpContext = {source: "事件"};
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
                                    addVp(G, ctx, j, 8);
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
                stopTimingForGameEnd(G, ctx);
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
        const handCountBeforePlay = hand.length;
        // 2026-9 技术：特技电影 - 记录行动前手牌数 Hand_0
        techStuntActionStart(G, ctx, arg.playerID);
        // 2026-10 分数来源统计：本次出牌效果产生的分数归属到该卡
        G.e.vpContext = {source: "卡牌效果", card: arg.card};
        if (cinemaInRegion(G, ctx, playCard.region, arg.playerID) && playCard.type === CardType.F) {
            log.push(`|cinemaInRegion|${playCard.region}`);
            switch (pub.school) {
                //流派扩：玛萨拉电影
                case SchoolCardID.S4002:
                    drawCardForPlayer(G, ctx, arg.playerID);
                    G.e.stack.push({e: "addVp", a: 1, source: "电影院", card: pub.school});
                    log.push(`|masala|${JSON.stringify(G.e.stack)}`)
                    break;
                default:
                    if (G.testModeCinema) {
                        G.e.stack.push({e: "addVp", a: 1, source: "电影院", card: arg.card});
                        G.e.stack.push({e: "res", a: 1});
                    } else {
                        G.e.stack.push({e: "addVp", a: 2, source: "电影院", card: arg.card});
                        G.e.stack.push({e: "res", a: 1});
                    }
                    log.push(`|${JSON.stringify(G.e.stack)}`)
                    break;
            }
        }
        if (pub.school === SchoolCardID.S4008 && playCard.industry > 0) {
            //流派扩：高概
            G.e.stack.push({e: "addVp", a: playCard.industry, source: "卡牌效果", card: pub.school});
            G.e.stack.push({e: "res", a: playCard.industry});
            log.push(`${JSON.stringify(G.e.stack)}`)
        }
        if (pub.school === SchoolCardID.S4005 && playCard.aesthetics > 0) {
            //流派扩：现代主义
            switch (playCard.aesthetics) {
                case 1:
                    addRes(G, ctx, arg.playerID, 1);
                    addSchoolVp(G, ctx, arg.playerID, 2);
                    break;
                case 2:
                    addRes(G, ctx, arg.playerID, 1);
                    addSchoolVp(G, ctx, arg.playerID, 2);
                    drawCardForPlayer(G, ctx, arg.playerID);
                    break;
                case 3:
                    addRes(G, ctx, arg.playerID, 1);
                    addSchoolVp(G, ctx, arg.playerID, 4);
                    drawCardForPlayer(G, ctx, arg.playerID);
                    drawCardForPlayer(G, ctx, arg.playerID);
                    break;
                default:
                    break;
            }
        }

        hand.splice(arg.idx, 1);
        pub.playedCardInTurn.push(arg.card);
        pub.activeCardInTurn.push(arg.card);
        
        G.e.card = arg.card;
        // [可选]支付1声望，将打出的牌置入档案馆
        const proseFilmArchiveEffect = pub.school === SchoolCardID.S52681 && handCountBeforePlay === 5
            ? {e: "optional",
            a: {e: "pay", a: {
                cost: {
                    e: "vp", a: 1
                },
                eff: {e: "EssayFilm_doArchive", a: arg.card}
            }}
            , target: arg.playerID}
            : null;
        let autoActive = false;
        if (arg.card === BasicCardID.B05) {
            const privateInfo = G.player[parseInt(arg.playerID)];
            switch (privateInfo.classicFilmAutoMove) {
                case ClassicFilmAutoMoveMode.AESTHETICS_AWARD:
                    aesAward(G, ctx, arg.playerID);
                    log.push(`|ClassicFilm|AutoAesthetics`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    autoActive = true;
                    break;
                case ClassicFilmAutoMoveMode.DRAW_CARD:
                    drawCardForPlayer(G, ctx, arg.playerID);
                    log.push(`|ClassicFilm|AutoDraw`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    autoActive = true;
                    break;
                default:
                    log.push(`|ClassicFilm|NO_AUTO_MOVE`);
            }
        }
        let cardEff = getCardEffect(arg.card);
        if (!autoActive && cardEff.hasOwnProperty("play")) {
            const eff = {...cardEff.play};
            
            // 黑浪潮
            if (pub.school === SchoolCardID.S5208 && arg.card === BasicCardID.B05) {
                eff.a = [...eff.a,
                    {e: "step", a:
                        [
                            {e: "deposit", a: 1},
                            {e: "addVp", a: 2, source: "卡牌效果", card: pub.school},
                        ]
                    }
                ];
            }

            if (eff.e !== "none") {
                log.push(`|${JSON.stringify(eff)}`);
                G.e.stack.splice(0, 0, eff);
                if (proseFilmArchiveEffect !== null) {
                    G.e.stack.splice(0, 0, proseFilmArchiveEffect);
                }
                log.push(`${JSON.stringify(G.e.stack)}`)
                playerEffExec(G, ctx, ctx.currentPlayer);
                //checkNextEffect(G, ctx);
            } else {
                log.push(`|emptyPlayEffect`);
                if (proseFilmArchiveEffect !== null) {
                    G.e.stack.splice(0, 0, proseFilmArchiveEffect);
                }
                checkNextEffect(G, ctx);
            }
        } else {
            log.push(`|noPlayEffect`);
            if (proseFilmArchiveEffect !== null) {
                G.e.stack.splice(0, 0, proseFilmArchiveEffect);
            }
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
        // // 明星制
        // if(pub.school === SchoolCardID.S5206){
        //     if(playCard.category === CardCategory.BASIC){
        //         if(pub.vp > 0){
        //             loseVp(G, ctx, arg.playerID, 1);
        //             addRes(G, ctx, arg.playerID, 1);
        //         }
        //     }
        // }
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
        G.e.vpContext = {source: "卡牌效果", card: arg.card};
        pub.action -= 1;
        pub.actionused = true;
        pub.resource -= arg.res;
        deductDeposit(G, ctx, arg.playerID, 2 - arg.res);
        const c = getCardById(arg.card);
        G.e.card = c.cardId;
        G.player[parseInt(arg.playerID)].hand.splice(arg.idx, 1);
        pub.archive.push(arg.card);
        // 流派扩：波兰学派
        if (pub.school === SchoolCardID.S4004) {
            drawCardForPlayer(G, ctx, arg.playerID);
        }
        // 流派扩：黑浪潮
        if (pub.school === SchoolCardID.S5208) {
            let active = false;

            let card = getCardById(arg.card);
            if(card.region !== Region.NONE && card.era != G.regions[card.region].era && card.type === CardType.F) active = true;
            if(arg.card === BasicCardID.B04) active = true;

            if(active){
                doBuy(G, ctx, B05, arg.playerID);
                // drawCardForPlayer(G, ctx, arg.playerID);
            }
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
        const log = ["comment"];
        undoCheck(G, log);
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
            addSchoolVp(G, ctx, newWavePlayer, 2);
        }
        const pub = G.pub[parseInt(arg.p)];
        if (pub.school === SchoolCardID.S2204) {
            addRes(G, ctx, arg.p, 1);
            addSchoolVp(G, ctx, arg.p, 1);
        }
        checkNextEffect(G, ctx);
    }
}

export interface IShowBoardStatusProps {
    regions: IRegionInfo[],
    school: ICardSlot[]
    film: ICardSlot[],
    matchID: string,
    playerNames?: Record<string, string>,
}

export const showBoardStatus: LongFormMove = {
    client: false,
    undoable: false,
    move: (G: IG, ctx: Ctx, args: IShowBoardStatusProps) => {
        if (activePlayer(ctx) !== ctx.playerID) return INVALID_MOVE;
        logger.info(`${args.matchID}|p${ctx.playerID}.moves.showBoardStatus(${JSON.stringify(args)})`);
        if (args.playerNames) {
            G.playerNames = { ...G.playerNames, ...args.playerNames };
        }
        if (ctx.phase === "InitPhase") {
            if (G.anonymousRandomMode && !G.anonymousRandomRevealed) {
                const shuffledOrder = shuffle(ctx, [...G.order]);
                G.order = shuffledOrder;
                G.initialOrder = shuffledOrder;
                assignVpByOrder(G, shuffledOrder, ctx.numPlayers);
                G.anonymousPlayerNames = assignAnonymousCompanyNames(ctx, shuffledOrder, ctx.numPlayers);
                G.anonymousRandomRevealed = true;
            }
            G.matchID = args.matchID;
            signalEndPhase(G, ctx);
        } else {
            signalEndStage(G, ctx);
        }
    },
}
