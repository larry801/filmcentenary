import {
    BasicCardID,
    CardID,
    ClassicCardID,
    EventCardID,
    IBuildingSlot,
    ICardSlot,
    IEra,
    IPrivateInfo,
    IPubInfo,
    IRegionInfo,
    IRegionPrivate,
    Region,
    SchoolCardID,
    SimpleRuleNumPlayers
} from "./core";
import {Ctx, PlayerID} from "boardgame.io";
import {doFillNewEraEventDeck, drawForRegion, drawForTwoPlayerEra, fillPlayerHand, shuffle} from "../game/util";

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
        lastRoundOfGame: boolean,
        endActivePlayer: boolean,
        endTurn: boolean,
        endPhase: boolean,
        endStage: boolean,
    },
    currentScoreRegion: Region,
    scoringRegions: Region[],
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
        "B04": number
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
        industry: 0,
        aesthetics: 0,
        resource: 0,
        deposit: 0,
        action: 1,
        discardInSettle: false,
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
        endTurnEffectExecuted:false,
        hand: [], handSize: 0,
        cardsToPeek: [], competitionCards: [],
        finalScoringExtraVp: 0,
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
    let order: PlayerID[] = [];
    for (let i = 0; i < ctx.numPlayers; i++) {
        order.push(i.toString());
        pub.push(pubPlayer());
        players.push(privatePlayer());
        decks.push(shuffle(ctx, initialDeck));
    }
    let events = shuffle(ctx, []);
    // TODO enable random order in real game
    // let randomOrder = shuffle(ctx, order);
    let G: IG = {
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
        order: order,
        initialOrder: order,
        logDiscrepancyWorkaround: false,
        pending: {
            lastRoundOfGame: false,
            endActivePlayer: false,
            endTurn: false,
            endPhase: false,
            endStage: false,
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
            events: events,
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
    if (ctx.numPlayers === 3) {
        G.regions[Region.NA].buildings[1].activated = true;
        G.regions[Region.WE].buildings[1].activated = true;
        G.pub[parseInt(G.order[1])].vp = 1;
        G.pub[parseInt(G.order[2])].vp = 2;
    }
    if (ctx.numPlayers === 4) {
        G.regions[Region.NA].buildings[1].activated = true;
        G.regions[Region.WE].buildings[1].activated = true;
        G.pub[parseInt(G.order[2])].vp = 1;
        G.pub[parseInt(G.order[3])].vp = 2;
    }
    if (ctx.numPlayers === 3) {
        G.regions["0"].share--;
        G.regions["1"].share--;
        G.regions["2"].share--;
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
    }
    G.order.forEach(p => fillPlayerHand(G, ctx, p))
    doFillNewEraEventDeck(G, ctx, IEra.ONE);
    G.regionScoreCompensateMarker = G.order[G.order.length - 1];

    // G.pub[0].resource = 20;
    // G.pub[0].deposit = 20;
    // // @ts-ignore
    // G.regions[Region.NA].legend.card = "P1101"
    // // @ts-ignore
    // G.regions[Region.NA].normal[0].card = "F1103"
    // // @ts-ignore
    // G.pub[0].school = "S3101";
    // @ts-ignore
    // G.player[0].hand = ["F3306","P2102"]
    // G.pub[0].resource = 3;
    return G;
};
