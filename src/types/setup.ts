import {
    BasicCardID,
    BuildingType,
    CardID,
    ClassicCardID,
    ClassicFilmAutoMoveMode,
    EventCardID,
    FilmCardID,
    GameMode,
    ExtensionMode,
    IBuildingSlot,
    ICardSlot,
    IEra,
    IPrivateInfo,
    IPubInfo,
    IRegionInfo,
    IRegionPrivate,
    PersonCardID,
    Region,
    SchoolCardID,
    SimpleRuleNumPlayers,
    ValidRegion
} from "./core";
import {Ctx, PlayerID} from "boardgame.io";
import {
    buildBuildingFor,
    doFillNewEraEventDeck,
    drawForRegion,
    drawForTwoPlayerEra,
    fillPlayerHand,
    shuffle
} from "../game/util";
import {logger} from "../game/logger";

export interface CompetitionInfo {
    region: Region,
    atk: PlayerID,
    atkPlayedCard: boolean,
    atkCard: CardID | null,
    def: PlayerID,
    defPlayedCard: boolean,
    defCard: CardID | null,
    defShownCards: CardID[],
    pending: boolean,
    progress: number,
    onWin: { e: string, a: number },
}

export interface IG {
    disableUndo: boolean,
    testModeCinema: boolean,
    testModeEnd180: boolean,
    previousMoveUndoable: boolean,
    updateCardHistory: CardID[][],
    settlementTimeline: Array<{
        turn: number,
        round: number,
        players: Array<{
            industry: number,
            aesthetics: number,
            score: number,
            eraRatio: number,
            roundTimeMs: number,
            totalTimeMs: number,
        }>,
    }>,
    timeTracking: {
        hasStartedTiming: boolean,
        currentRound: number,
        currentTurnPlayer: PlayerID | null,
        currentTurnStartedAtMs: number,
        serverNowMs: number,
        roundTimeMsByPlayer: {[key: string]: number},
        totalTimeMsByPlayer: {[key: string]: number},
    },
    mode: GameMode,
    hasSchoolExtension: boolean,
    hasSchoolExtensionMuki: boolean,
    hasSchoolExtensionMuki2: boolean,
    hasSchoolExtensionDawn: boolean,
    hasSchoolExtensionTech: boolean,
    hasSchoolExtensionVisual: boolean,
    hasSchoolExtensionQM: boolean,
    hasExtensionChaosMedia: boolean,
    /** DIY 扩展：已启用的扩展 ID 列表 (src/extensions/) */
    enabledExtensions: string[],
    extensionMode: ExtensionMode,
    randomOrder: boolean,
    anonymousRandomMode: boolean,
    anonymousRandomRevealed: boolean,
    anonymousPlayerNames: string[],
    playerNames: Record<string, string>,
    regionScoreCompensateMarker: PlayerID,
    eventDeckLength: number,
    matchID: string,
    twoPlayer: {
        era: IEra,
        schoolDeckLength: number,
        filmDeckLength: number,
        school: ICardSlot[],
        film: ICardSlot[],
    },
    order: PlayerID[],
    initialOrder: PlayerID[],
    playerCount: number,
    //流派扩
    schoolExt: SchoolCardID[],
	//Muki Pro
    schoolExtMuki: SchoolCardID[],
    activeEvents: EventCardID[],
    logDiscrepancyWorkaround: boolean,
    pending: {
        nextEraRegions: ValidRegion[],
        lastRoundOfGame: boolean,
        endActivePlayer: boolean,
        endTurn: boolean,
        endPhase: boolean,
        endStage: boolean,
        firstPlayer: PlayerID,
    },
    currentScoreRegion: Region,
    scoringRegions: ValidRegion[],
    events: EventCardID[],
    c: {
        players: PlayerID[],
        slots: ICardSlot[],
        buildingSlots: IBuildingSlot[],
        cardIDs: string[],
    },
    pub: IPubInfo[],
    e: {
        pendingPlayers: PlayerID[],
        choices: any[],
        stack: any[],
        card: CardID | null,
        regions: Region[],
        currentEffect: any,
        extraCostToPay: number,
        // 2026-10 分数来源统计：当前结算上下文
        vpContext: { source: string, card?: CardID | null } | null,
    },
    player: IPrivateInfo[],
    competitionInfo: CompetitionInfo,
    secretInfo: {
        regions: {
            [Region.NA]: IRegionPrivate,
            [Region.WE]: IRegionPrivate,
            [Region.EE]: IRegionPrivate,
            [Region.ASIA]: IRegionPrivate,
            [Region.EXTENSION]: IRegionPrivate,
            [Region.EXTENSION1]: IRegionPrivate,
            [Region.EXTENSION2]: IRegionPrivate,
            [Region.MONTHLY_SCHOOL]: IRegionPrivate,
        },
        events: EventCardID[],
        playerDecks: CardID[][],
        twoPlayer: {
            school: SchoolCardID[],
            film: ClassicCardID[],
        },
    },
    regions: {
        [Region.NA]: IRegionInfo,
        [Region.WE]: IRegionInfo,
        [Region.EE]: IRegionInfo,
        [Region.ASIA]: IRegionInfo,
        [Region.EXTENSION]: IRegionInfo,
        [Region.EXTENSION1]: IRegionInfo,
        [Region.EXTENSION2]: IRegionInfo,
        [Region.MONTHLY_SCHOOL]: IRegionInfo,
    },
    pendingEffects: any[],
    basicCards: {
        "B01": number,
        "B02": number,
        "B03": number,
        "B04": number,
        "B05": number,
        "B06": number,
        "B07": number,
    },
}

let initialDeck = [
    BasicCardID.B01, BasicCardID.B02,
    BasicCardID.B07, BasicCardID.B07,
    BasicCardID.B07, BasicCardID.B07,
    BasicCardID.B07, BasicCardID.B07
];

function pubPlayer(): IPubInfo {
    return {
        LES_CHAIERS_DU_CINEMA: false,
        competitionPower: 0,
        industry: 0,
        aesthetics: 0,
        resource: 0,
        deposit: 0,
        action: 1,
        handsize_startturn: 0,
        bought_extension: false,
        techStuntHandSnapshot: -1,
        vpStats: {source: {}, card: {}},
        vpStatsFinal: {source: {}, card: {}},
        actionused: false,
        newHollyWoodUsed: false,
        discardInSettle: false,
        handSize: 0,
        scoreEvents: [],
        vpAward: {
            v60: false,
            v90: false,
            v120: false,
            v150: false,
        },
        building: {
            cinemaBuilt: false,
            studioBuilt: false,
        },
        champions: [],
        allCards: initialDeck,
        archive: [],
        discard: [],
        playedCardInTurn: [],
        activeCardInTurn: [],
        finalScoring: {
            card: 0,
            building: 0,
            industryAward: 0,
            aestheticsAward: 0,
            archive: 0,
            events: 0,
            total: 0,
        },
        revealedHand: [],
        school: null,
        shares: {
            0: 0,
            1: 0,
            2: 0,
            3: 0,
        },
        tempStudios: [],
        vp: 0,
        respondMark: {
            tempStudioRespond: false,
            eventRespond: false,
        },
    }
}

export function privatePlayer(): IPrivateInfo {
    return {
        drawn: [],
        classicFilmAutoMove: ClassicFilmAutoMoveMode.NO_AUTO,
        endTurnEffectExecuted: false,
        hand: [], handSize: 0,
        cardsToPeek: [], competitionCards: [],
        deckEmpty: false,
    }
}

function emptyNormalCardSlot(region: Region): ICardSlot {
    return {
        comment: null, region: region, isLegend: false, card: null,
    }
}

function emptyLegendCardSlot(region: Region): ICardSlot {
    return {
        comment: null, region: region, isLegend: true, card: null,
    }
}

function emptyBuildingSlot(region: Region, activated: boolean = true): IBuildingSlot {
    return {
        building: null,
        region: region,
        activated: activated,
        owner: "",
    }
}

// noinspection JSUnusedLocalSymbols
export const setup = (ctx: Ctx, setupData: any): IG => {
    let pub: IPubInfo[] = [];
    let players: IPrivateInfo[] = [];
    let decks: CardID[][] = [];
    for (let i = 0; i < ctx.numPlayers; i++) {
        pub.push(pubPlayer());
        players.push(privatePlayer());
        decks.push(shuffle(ctx, initialDeck));
    }
    // decks[0].pop();
    // decks[0].push(FilmCardID.F3404);
    // decks[0].push(ScoreCardID.V223);
    // decks[0].push(PersonCardID.P2203);

    // decks[0].push(BasicCardID.B05);
    // decks[0].push(FilmCardID.F2109);
    // // decks[0].push(FilmCardID.F3110)
    // // pub[0].competitionPower = 10;
    // pub[0].industry = 10;
    // pub[0].school = SchoolCardID.S4003;
    // pub[1].school = SchoolCardID.S4001;
    // pub[2].school = SchoolCardID.S4002;
    // pub[3].school = SchoolCardID.S4003;
    // pub[0].resource = 10;
    // pub[0].vp = 10;
    // pub[1].shares[0] = 2;
    const order: PlayerID[] = [];
    for (let i = 0; i < ctx.numPlayers; i++) {
        order.push(i.toString())
    }
    const randomOrder = order;
    const firstMovePlayer = parseInt(randomOrder[0]);
    logger.debug(`firstPlayer${firstMovePlayer}`)
    logger.debug(`order${JSON.stringify(randomOrder)}`)
    let G: IG = {
        disableUndo: false,
        testModeCinema: false,
        testModeEnd180: false,
        previousMoveUndoable: true,
        updateCardHistory: [],
        settlementTimeline: [],
        timeTracking: {
            hasStartedTiming: false,
            currentRound: 0,
            currentTurnPlayer: randomOrder[0] ?? null,
            currentTurnStartedAtMs: 0,
            serverNowMs: 0,
            roundTimeMsByPlayer: {},
            totalTimeMsByPlayer: {},
        },
        mode: GameMode.NORMAL,
        hasSchoolExtension: false,
        hasSchoolExtensionMuki: false,
        hasSchoolExtensionMuki2: false,
        hasSchoolExtensionDawn: false,
        hasSchoolExtensionTech: false,
        hasSchoolExtensionVisual: false,
        hasSchoolExtensionQM: false,
        hasExtensionChaosMedia: false,
        enabledExtensions: [],
        extensionMode: ExtensionMode.NONE,
        randomOrder: false,
        anonymousRandomMode: false,
        anonymousRandomRevealed: false,
        anonymousPlayerNames: order.map(() => ""),
        playerNames: {},
        regionScoreCompensateMarker: "0",
        eventDeckLength: 0,
        matchID: "",
        twoPlayer: {
            era: IEra.ONE,
            schoolDeckLength: 0,
            filmDeckLength: 0,
            school: [
                emptyNormalCardSlot(Region.NONE),
                emptyNormalCardSlot(Region.NONE),
            ],
            film: [
                emptyNormalCardSlot(Region.NONE),
                emptyNormalCardSlot(Region.NONE),
                emptyNormalCardSlot(Region.NONE),
                emptyNormalCardSlot(Region.NONE),
            ],
        },
        order: randomOrder,
        initialOrder: randomOrder,
        logDiscrepancyWorkaround: false,
        schoolExt: [], //SchoolCardID.S4004,SchoolCardID.S4001, SchoolCardID.S4002,SchoolCardID.S4003,
        //     SchoolCardID.S4005,SchoolCardID.S4006,
        //     SchoolCardID.S4007,SchoolCardID.S4008
		schoolExtMuki:[], 
        pending: {
            nextEraRegions: [],
            lastRoundOfGame: false,
            endActivePlayer: false,
            endTurn: false,
            endPhase: false,
            endStage: false,
            firstPlayer: '0'
        },
        playerCount: ctx.numPlayers,
        pub: pub,
        events: [],
        c: {
            players: [],
            slots: [],
            buildingSlots: [],
            cardIDs: [],
        },
        currentScoreRegion: Region.NONE,
        e: {
            pendingPlayers: [],
            choices: [], stack: [], card: null, regions: [],
            currentEffect: {e: "none", a: 1},
            extraCostToPay: 0,
            vpContext: null,
        },
        competitionInfo: {
            region: Region.NONE,
            atk: '0',
            atkPlayedCard: false,
            atkCard: null,
            def: '1',
            defPlayedCard: false,
            defShownCards: [],
            defCard: null,
            progress: 0,
            pending: false,
            onWin: {e: "none", a: 1}
        },
        activeEvents: [],
        player: players,
        secretInfo: {
            regions: {
                [Region.NA]: {
                    legendDeck: [],
                    normalDeck: [],
                },
                [Region.WE]: {
                    legendDeck: [],
                    normalDeck: [],
                },
                [Region.EE]: {
                    legendDeck: [],
                    normalDeck: [],
                },
                [Region.ASIA]: {
                    legendDeck: [],
                    normalDeck: [],
                },
                [Region.EXTENSION]: {
                    legendDeck: [],
                    normalDeck: [],
                },
                [Region.EXTENSION1]: {
                    legendDeck: [],
                    normalDeck: [],
                },
                [Region.EXTENSION2]: {
                    legendDeck: [],
                    normalDeck: [],
                },
                [Region.MONTHLY_SCHOOL]: {
                    legendDeck: [],
                    normalDeck: [],
                },
            },
            twoPlayer: {
                school: [],
                film: [],
            },
            events: [],
            playerDecks: decks,
        },
        regions: {
            [Region.NA] : {
                normalDeckLength: 0,
                legendDeckLength: 0,
                completedLastScoring: false,
                era: IEra.ONE,
                buildings: [
                    emptyBuildingSlot(Region.NA),
                    emptyBuildingSlot(Region.NA, false),
                    emptyBuildingSlot(Region.NA, false),
                ],
                legend: emptyLegendCardSlot(Region.NA),
                normal: [
                    emptyNormalCardSlot(Region.NA),
                    emptyNormalCardSlot(Region.NA),
                    emptyNormalCardSlot(Region.NA),
                ],
                share: 6,
            },
            [Region.WE]: {
                normalDeckLength: 0,
                legendDeckLength: 0,
                completedLastScoring: false,
                era: IEra.ONE,
                buildings: [
                    emptyBuildingSlot(Region.WE),
                    emptyBuildingSlot(Region.WE, false)
                ],
                legend: emptyLegendCardSlot(Region.WE),
                normal: [
                    emptyNormalCardSlot(Region.WE),
                    emptyNormalCardSlot(Region.WE),
                    emptyNormalCardSlot(Region.WE),
                ],
                share: 6,
            },
            [Region.EE] : {
                normalDeckLength: 0,
                legendDeckLength: 0,
                completedLastScoring: false,
                era: IEra.ONE,
                buildings: [
                    emptyBuildingSlot(Region.EE),
                    emptyBuildingSlot(Region.EE, false),
                ],
                legend: emptyLegendCardSlot(Region.EE),
                normal: [emptyNormalCardSlot(Region.EE), emptyNormalCardSlot(Region.EE)],
                share: 4,
            },
            [Region.ASIA]: {
                normalDeckLength: 0,
                legendDeckLength: 0,
                completedLastScoring: false,
                era: IEra.ONE,
                buildings: [
                    emptyBuildingSlot(Region.ASIA),
                    emptyBuildingSlot(Region.ASIA, false),
                ],
                legend: emptyLegendCardSlot(Region.ASIA),
                normal: [emptyNormalCardSlot(Region.ASIA), emptyNormalCardSlot(Region.ASIA)],
                share: 0,
            },
            [Region.EXTENSION] : {
                normalDeckLength: 0,
                legendDeckLength: 0,
                completedLastScoring: false,
                era: IEra.ONE,
                buildings: [emptyBuildingSlot(Region.EXTENSION, false),
                    emptyBuildingSlot(Region.EXTENSION, false)],
                legend: emptyNormalCardSlot(Region.EXTENSION),
                normal: [emptyNormalCardSlot(Region.EXTENSION), emptyNormalCardSlot(Region.EXTENSION), emptyNormalCardSlot(Region.EXTENSION), emptyNormalCardSlot(Region.EXTENSION), emptyNormalCardSlot(Region.EXTENSION)],
                share: 0,
            },
            [Region.EXTENSION1] : {
                normalDeckLength: 0,
                legendDeckLength: 0,
                completedLastScoring: false,
                era: IEra.ONE,
                buildings: [emptyBuildingSlot(Region.EXTENSION1, false),
                    emptyBuildingSlot(Region.EXTENSION1, false)],
                legend: emptyNormalCardSlot(Region.EXTENSION1),
                normal: [emptyNormalCardSlot(Region.EXTENSION1), emptyNormalCardSlot(Region.EXTENSION1), emptyNormalCardSlot(Region.EXTENSION1)],
                share: 0,
            },
            [Region.EXTENSION2] : {
                normalDeckLength: 0,
                legendDeckLength: 0,
                completedLastScoring: false,
                era: IEra.ONE,
                buildings: [emptyBuildingSlot(Region.EXTENSION2, false),
                    emptyBuildingSlot(Region.EXTENSION2, false)],
                legend: emptyNormalCardSlot(Region.EXTENSION2),
                normal: [emptyNormalCardSlot(Region.EXTENSION2), emptyNormalCardSlot(Region.EXTENSION2), emptyNormalCardSlot(Region.EXTENSION2)],
                share: 0,
            },
            [Region.MONTHLY_SCHOOL] : {
                normalDeckLength: 0,
                legendDeckLength: 0,
                completedLastScoring: false,
                era: IEra.ONE,
                buildings: [emptyBuildingSlot(Region.MONTHLY_SCHOOL, false),
                    emptyBuildingSlot(Region.MONTHLY_SCHOOL, false)],
                legend: emptyNormalCardSlot(Region.MONTHLY_SCHOOL),
                normal: [emptyNormalCardSlot(Region.MONTHLY_SCHOOL), emptyNormalCardSlot(Region.MONTHLY_SCHOOL), emptyNormalCardSlot(Region.MONTHLY_SCHOOL)],
                share: 0,
            },
        },
        scoringRegions: [],
        pendingEffects: [],
        basicCards: {
            "B01": 10,
            "B02": 10,
            "B03": 10,
            "B04": 40,
            "B05": 20,
            "B06": 0,
            "B07": 0,
        },
    }
    if (ctx.numPlayers === SimpleRuleNumPlayers) {
        G.pub[parseInt(G.order[1])].vp = 1;
    }
    if (ctx.numPlayers >= 3) {
        G.regions[Region.NA].buildings[1].activated = true;
        G.regions[Region.WE].buildings[1].activated = true;
        G.pub[parseInt(G.initialOrder[1])].vp = 1;
        G.pub[parseInt(G.initialOrder[2])].vp = 3;
    }
    if (ctx.numPlayers === 4) {
        G.pub[parseInt(G.initialOrder[3])].vp = 5;
    }
    if (ctx.numPlayers === 3) {
        G.regions[Region.NA].share--;
        G.regions[Region.WE].share--;
        G.regions[Region.EE].share--;
    }
    if (ctx.numPlayers === SimpleRuleNumPlayers) {
        G.regions[Region.NA].share = 12;
        G.regions[Region.WE].share = 10;
        G.regions[Region.EE].share = 8;
        G.regions[Region.ASIA].share = 10;
        drawForTwoPlayerEra(G, ctx, IEra.ONE);
    } else {
        drawForRegion(G, ctx, Region.NA, IEra.ONE);
        drawForRegion(G, ctx, Region.WE, IEra.ONE);
        // G.regions[Region.EE].era = IEra.THREE;
        drawForRegion(G, ctx, Region.EE, IEra.ONE);
        // drawForRegion(G, ctx, Region.ASIA, IEra.THREE);
        // G.regions[Region.ASIA].era = IEra.TWO;
        // G.regions[Region.ASIA].share = 6;
        // G.pub[0].resource += 10;
        doFillNewEraEventDeck(G, ctx, IEra.ONE);
    }
    G.order.forEach(p => fillPlayerHand(G, ctx, p))
    G.regionScoreCompensateMarker = G.order[G.order.length - 1];
    // G.events[0] = EventCardID.E01;
    // // @ts-ignore
    // G.regions[Region.NA].legend.card = "P2102"
    // // @ts-ignore
    // G.regions[Region.NA].normal[0].card = "F2107"
    // G.regions[Region.WE].share = 1
    // G.pub[2].shares["1"] = 3
    // G.regions[Region.NA].era = IEra.THREE
    // G.regions[Region.WE].era = IEra.TWO
    // G.regions[Region.ASIA].era = IEra.THREE
    // G.regions[Region.WE].share = 1
    // G.regions[Region.EE].share = 1
    // G.regions[Region.NA].legend.card = "P1101"
    // // @ts-ignore
    // G.regions[Region.NA].normal[0].card = "F1103"
    // // @ts-ignore
    // G.pub[0].school = "S3101";
    // G.twoPlayer.era = IEra.THREE;
    // G.regions[Region.ASIA].era = IEra.THREE;
    // @ts-ignore
    // G.pub[0].allCards = ["B07","B07","B07","B07","B07","B07","B07","B07","B07","B07","B07","B07","B07","B07","B07",]
    // @ts-ignore
    // G.secretInfo.playerDecks[0] = ["B01","F2403","B07","P2401"]
    // G.regions["2"].buildings[0].building = BuildingType.studio;
    // G.regions["2"].buildings[0].owner = "2";
    // G.pub[3].shares[Region.NA] = 2;
    // G.pub[3].shares[Region.WE] = 2;
    // G.pub[3].shares[Region.EE] = 2;
    // G.pub[3].shares[Region.ASIA] = 2;
    // G.pub[firstMovePlayer].resource = 20;
    // G.pub[firstMovePlayer].industry = 10;
    // G.pub[firstMovePlayer].competitionPower = 10;
    // @ts-ignore
    // G.pub[0].allCards = ["P2102", "F2110", "F3413", "V111",]
    // @ts-ignore
    // G.player[3].hand = ["P2102", "F2110", "B04", "V111",]
    // G.pub[firstMovePlayer].deposit = 40;
    // G.pub[firstMovePlayer].action = 20;
    // G.pub[0].discard = [];
    // G.twoPlayer.era = IEra.THREE;

    // test LES_CHAIERS_DU_CINEMA_COMPANY_SCALE
    // G.regions[Region.NA].share = 1;
    // G.pub[firstMovePlayer].deposit = 30;
    // G.events[0] = EventCardID.E07;
    // @ts-ignore
    // G.player[1].hand = ["P3102", "F2114", "B07"];
    // @ts-ignore
    // G.player[firstMovePlayer].hand = [ "F3406", "F3113", "B05", "F3413", "P2102",];
    // G.pub[1].shares[Region.NA] = 1;
    // G.pub[1].shares[Region.EE] = 1;
    // @ts-ignore
    // G.pub[2].school = "S1203";
    // G.pub[1].shares[Region.NA] = 2;
    // G.pub[1].shares[Region.EE] = 2;
    // G.pub[firstMovePlayer].vp = 39;
    // // G.pub[firstMovePlayer].aesthetics = 8;
    //
    // G.player[firstMovePlayer].hand = [FilmCardID.F3414, BasicCardID.B07];
    // G.regions[Region.ASIA].era = IEra.THREE;
    // buildBuildingFor(G, ctx,Region.ASIA, firstMovePlayer.toString(), BuildingType.cinema);

    // G.secretInfo.playerDecks[firstMovePlayer] = [BasicCardID.B07,BasicCardID.B07,BasicCardID.B07];
    // G.pub[firstMovePlayer].competitionPower = 7;
    // G.pub[firstMovePlayer].aesthetics = 10;
    // G.pub[1].competitionPower = 3;
    // G.pub[1].school = SchoolCardID.S4005;
    // G.pub[1].aesthetics = 9;
    // G.pub[1].vp = 39;
    // @ts-ignore
    // G.pub[firstMovePlayer].school = "S3101";
    // @ts-ignore
    // G.pub[firstMovePlayer].school = "S2101";
    // // @ts-ignore
    // G.pub[0].school = "S5201";
    // // @ts-ignore
    // G.pub[1].school = "S5202";
    // // @ts-ignore
    // G.pub[2].school = "S5203";
    // // @ts-ignore
    // // G.pub[3].school = "S5204";
    if(ctx.numPlayers === 4){
        // // @ts-ignore
        // G.pub[3].school = "S52681";
        // // @ts-ignore
        // G.pub[1].school = "S52682";
        // // @ts-ignore
        // G.pub[2].school = "S52683";
        // // @ts-ignore
        // G.pub[0].school = "S52684";
    }
    // ===== 2026-9 技术流派测试（测试完毕，已注释）=====
    // 使用方式：大厅勾选「启用【流派扩 2026 - 9】技术革新」后开局（4人局）。
    // 四张技术牌由 setupGameMode 自动发放到月度流派区；四位玩家各测一张，手牌/资源已备足可直接购买。
    // 技术牌购买后进入档案区，不替换流派。
    // if (ctx.numPlayers === 4) {
    //     // 案例1 定格电影 S52691：购买后，使用行动力抽牌 → +1牌、+2声望
    //     G.pub[0].resource = 10;
    //     G.pub[0].deposit = 5;
    //     G.pub[0].action = 2;
    //     // @ts-ignore
    //     G.player[0].hand = ["B02", "B02", "B01"];
    //
    //     // 案例2 特技电影 S52692：购买效果免费突破1次；出牌结算前后手牌数变化≠±1 → +1声望
    //     G.pub[1].resource = 10;
    //     G.pub[1].deposit = 5;
    //     // @ts-ignore
    //     G.player[1].hand = ["B01", "B01", "B01", "B07"];
    //
    //     // 案例3 有声电影 S52693：购买+2声望；此后每-1存款 → +1声望
    //     G.pub[2].resource = 10;
    //     G.pub[2].deposit = 10;
    //     // @ts-ignore
    //     G.player[2].hand = ["B02", "B02", "B02"];
    //
    //     // 案例4 特艺七彩 S52694：购买+2存款；首次到达40/80/120声望 → +1存款，首次到达150 → 选择工/美等级
    //     G.pub[3].resource = 10;
    //     G.pub[3].deposit = 5;
    //     G.pub[3].vp = 39;    // 再+1声望即跨40
    //     // G.pub[3].vp = 149; // 跨150测工业/美学选择
    //     // @ts-ignore
    //     G.player[3].hand = ["B02", "B01", "B01"];
    // }
    // G.player[firstMovePlayer].hand = [FilmCardID.F2407, FilmCardID.F3112, BasicCardID.B02, PersonCardID.P2103];
    // G.pub[firstMovePlayer].resource = 30;
    // G.pub[firstMovePlayer].industry = 10;
    // G.pub[firstMovePlayer].deposit = 30;
    // G.pub[1].resource = 30;
    // G.pub[firstMovePlayer].competitionPower = 10;
    // @ts-ignore
    // G.player[firstMovePlayer].hand = ["P3107",];
    // @ts-ignore
    // G.player[1].hand = ["F2307", "P3102", "B07",]
    // G.secretInfo.playerDecks[0] = [];
    // G.pub[0].action = 10;
    return G;
};
