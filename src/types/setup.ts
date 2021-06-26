import {
    BasicCardID,
    CardID,
    ClassicCardID,
    ClassicFilmAutoMoveMode,
    EventCardID,
    GameMode,
    IBuildingSlot,
    ICardSlot,
    IEra,
    IPrivateInfo,
    IPubInfo,
    IRegionInfo,
    IRegionPrivate,
    Region,
    SchoolCardID,
    SimpleRuleNumPlayers,
    ValidRegion
} from "./core";
import {Ctx, PlayerID} from "boardgame.io";
import {doFillNewEraEventDeck, drawForRegion, drawForTwoPlayerEra, fillPlayerHand, shuffle} from "../game/util";
import {logger} from "../game/logger";

export interface CompetitionInfo {
    region: Region,
    atk: PlayerID,
    atkPlayedCard: boolean,
    atkCard: CardID | null,
    def: PlayerID,
    defPlayedCard: boolean,
    defCard: CardID | null,
    pending: boolean,
    progress: number,
    onWin: { e: string, a: number },
}

export interface IG {
    updateCardHistory: CardID[][],
    mode: GameMode,
    randomOrder: boolean,
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
    },
    player: IPrivateInfo[],
    competitionInfo: CompetitionInfo,
    secretInfo: {
        regions: {
            0: IRegionPrivate,
            1: IRegionPrivate,
            2: IRegionPrivate,
            3: IRegionPrivate,
        },
        events: EventCardID[],
        playerDecks: CardID[][],
        twoPlayer: {
            school: SchoolCardID[],
            film: ClassicCardID[],
        },
    },
    regions: {
        0: IRegionInfo,
        1: IRegionInfo,
        2: IRegionInfo,
        3: IRegionInfo,
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
        competitionPower: 0,
        industry: 0,
        aesthetics: 0,
        resource: 0,
        deposit: 0,
        action: 1,
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
    const order: PlayerID[] = [];
    for (let i = 0; i < ctx.numPlayers; i++) {
        order.push(i.toString())
    }
    const randomOrder = order;
    const firstMovePlayer = parseInt(randomOrder[0]);
    logger.debug(`firstPlayer${firstMovePlayer}`)
    logger.debug(`order${JSON.stringify(randomOrder)}`)
    let G: IG = {
        updateCardHistory: [],
        mode: GameMode.NORMAL,
        randomOrder: false,
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
        },
        competitionInfo: {
            region: Region.NONE,
            atk: '0',
            atkPlayedCard: false,
            atkCard: null,
            def: '1',
            defPlayedCard: false,
            defCard: null,
            progress: 0,
            pending: false,
            onWin: {e: "none", a: 1}
        },
        activeEvents: [],
        player: players,
        secretInfo: {
            regions: {
                0: {
                    legendDeck: [],
                    normalDeck: [],
                },
                1: {
                    legendDeck: [],
                    normalDeck: [],
                },
                2: {
                    legendDeck: [],
                    normalDeck: [],
                },
                3: {
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
            0: {
                normalDeckLength: 0,
                legendDeckLength: 0,
                completedModernScoring: false,
                era: IEra.ONE,
                buildings: [
                    emptyBuildingSlot(0),
                    emptyBuildingSlot(0, false),
                    emptyBuildingSlot(0, false),
                ],
                legend: emptyLegendCardSlot(0),
                normal: [
                    emptyNormalCardSlot(0),
                    emptyNormalCardSlot(0),
                    emptyNormalCardSlot(0),
                ],
                share: 6,
            },
            1: {
                normalDeckLength: 0,
                legendDeckLength: 0,
                completedModernScoring: false,
                era: IEra.ONE,
                buildings: [
                    emptyBuildingSlot(1),
                    emptyBuildingSlot(1, false)
                ],
                legend: emptyLegendCardSlot(1),
                normal: [
                    emptyNormalCardSlot(1),
                    emptyNormalCardSlot(1),
                    emptyNormalCardSlot(1),
                ],
                share: 6,
            },
            2: {
                normalDeckLength: 0,
                legendDeckLength: 0,
                completedModernScoring: false,
                era: IEra.ONE,
                buildings: [
                    emptyBuildingSlot(2),
                    emptyBuildingSlot(2, false),
                ],
                legend: emptyLegendCardSlot(2),
                normal: [emptyNormalCardSlot(2), emptyNormalCardSlot(2)],
                share: 4,
            },
            3: {
                normalDeckLength: 0,
                legendDeckLength: 0,
                completedModernScoring: false,
                era: IEra.ONE,
                buildings: [
                    emptyBuildingSlot(3),
                    emptyBuildingSlot(3, false),
                ],
                legend: emptyLegendCardSlot(3),
                normal: [emptyNormalCardSlot(3), emptyNormalCardSlot(3)],
                share: 0,
            },
        },
        scoringRegions: [],
        pendingEffects: [],
        basicCards: {
            "B01": 20,
            "B02": 20,
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
    if (ctx.numPlayers === 3) {
        G.regions[Region.NA].buildings[1].activated = true;
        G.regions[Region.WE].buildings[1].activated = true;
        G.pub[parseInt(G.initialOrder[1])].vp = 1;
        G.pub[parseInt(G.initialOrder[2])].vp = 2;
    }
    if (ctx.numPlayers === 4) {
        G.regions[Region.NA].buildings[1].activated = true;
        G.regions[Region.WE].buildings[1].activated = true;
        G.pub[parseInt(G.initialOrder[2])].vp = 1;
        G.pub[parseInt(G.initialOrder[3])].vp = 2;
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
        drawForRegion(G, ctx, Region.EE, IEra.ONE);
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
    // @ts-ignore
    // G.pub[0].allCards = ["P2102", "F2110", "F3413", "V111",]
    // @ts-ignore
    // G.player[3].hand = ["P2102", "F2110", "B04", "V111",]
    // G.pub[firstMovePlayer].deposit = 40;
    // G.pub[firstMovePlayer].action = 20;
    // G.pub[0].discard = [];
    // G.twoPlayer.era = IEra.THREE;
    // @ts-ignore
    // G.player[firstMovePlayer].hand = ["F1108", "F3113", "B05", "F3413", "P2102",];
    // G.pub[firstMovePlayer].vp = 149;
    // G.pub[firstMovePlayer].aesthetics = 10;
    // @ts-ignore
    // G.pub[firstMovePlayer].school = "S3101";
    // @ts-ignore
    // G.pub[firstMovePlayer].school = "S2101";
    // G.pub[firstMovePlayer].resource = 30;
    // G.pub[firstMovePlayer].deposit = 30;
    // G.pub[1].resource = 30;
    // @ts-ignore
    // G.player[firstMovePlayer].hand = ["P1101", "F2212", "P3102", "B07", "B07",]
    // @ts-ignore
    // G.player[1].hand = ["F2307", "P3102", "B07", "B07",]
    // G.secretInfo.playerDecks[0] = [];
    // G.pub[0].action = 10;
    return G;
};
