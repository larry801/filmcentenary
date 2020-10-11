import {
    EventCardID,
    IBuildingSlot,
    ICard,
    ICardSlot,
    IEffect,
    IEra,
    IEventCard,
    IPrivateInfo,
    IPubInfo,
    IRegionInfo,
    IRegionPrivate, ISchoolCard,
    Region
} from "./core";
import {Ctx, PlayerID} from "boardgame.io";
import {B01, B02, B07} from "../constant/cards/basic";
import {doFillNewEraEventDeck, drawForRegion, drawForTwoPlayerEra, fillPlayerHand, shuffle} from "../game/util";

export interface IG {
    matchID:string,
    twoPlayer: {
        school: ICardSlot[],
        film: ICardSlot[],
    },
    order: PlayerID[],
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
    currentScoreRegion:Region,
    scoringRegions: Region[],
    events: IEventCard[],
    c: {
        players: PlayerID[],
        slots: ICardSlot[],
        buildingSlots: IBuildingSlot[],
        cardIDs: string[],
    },
    pub: IPubInfo[],
    e: {pendingPlayers:PlayerID[], choices: any[], stack: any[], card: ICard|null, regions: Region[] ,currentEffect:any},
    player: IPrivateInfo[],
    competitionInfo: {
        region: Region,
        atk: PlayerID,
        atkPlayedCard: boolean,
        def: PlayerID,
        defPlayedCard: boolean,
        pending: boolean,
        progress: number,
        onWin:{e:string,a:number},
    },
    secretInfo: {
        regions: {
            0: IRegionPrivate,
            1: IRegionPrivate,
            2: IRegionPrivate,
            3: IRegionPrivate,
        },
        events: IEventCard[],
        playerDecks: ICard[][],
        twoPlayer:{
            school:ISchoolCard[],
            film:ICard[],
        },
    },
    regions: {
        0: IRegionInfo,
        1: IRegionInfo,
        2: IRegionInfo,
        3: IRegionInfo,
    },
    pendingEffects: IEffect[],
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
const initialDeck = [B01, B02, B07, B07, B07, B07, B07, B07];
function pubPlayer(): IPubInfo {
    return {
        deposit: 0,
        action: 1,
        discardInSettle:false,
        scoreEvents:[],
        vpAward:{
            v60:false,
            v90:false,
            v120:false,
            v150:false,
        },
        building: {
            cinemaBuilt: false,
            studioBuilt: false,
        },
        champions: [],
        aesthetics: 0,
        allCards: initialDeck,
        archive: [],
        discard: [],
        industry: 0,
        resource: 0,
        playedCardInTurn: [],
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
    return {hand: [], handSize:0,cardsToPeek:[],competitionCards:[],
        finalScoringExtraVp:0,
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
        region: region,
        content: "",
        isCinema: false,
        activated: activated,
        owner: "",
    }
}

// noinspection JSUnusedLocalSymbols
export const setup = (ctx: Ctx, setupData: any): IG => {
    let pub: IPubInfo[] = [];
    let players: IPrivateInfo[] = [];
    let decks: ICard[][] = [];
    let order: PlayerID[] = [];
    for (let i = 0; i < ctx.numPlayers; i++) {
        order.push(i.toString());
        pub.push(pubPlayer());
        players.push(privatePlayer());
        decks.push(shuffle(ctx, initialDeck));
    }
    let events = shuffle(ctx, []);
    // let randomOrder = shuffle(ctx, order);
    let G = {
        matchID:"",
        twoPlayer: {
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
        currentScoreRegion:Region.NONE,
        e: {pendingPlayers:[],choices: [], stack: [], card: null, regions: [],currentEffect:{e:"none",a:1}},
        competitionInfo: {
            region: Region.NONE,
            atk: '0',
            atkPlayedCard: false,
            def: '1',
            defPlayedCard: false,
            progress: 0,
            pending: false,
            onWin:{e:"none",a:1}
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
            twoPlayer:{
              school:[],
              film:[],
            },
            events: events,
            playerDecks: decks,
        },
        regions: {
            0: {
                completedModernScoring:false,
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
                completedModernScoring:false,
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
                completedModernScoring:false,
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
                completedModernScoring:false,
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
    if (ctx.numPlayers > 2) {
        G.regions[Region.NA].buildings[1].activated = true;
        G.regions[Region.WE].buildings[1].activated = true;
        // @ts-ignore
        G.pub[G.order[2]].vp = 1;
    }
    if (ctx.numPlayers > 3) {
        G.regions[Region.EE].buildings[1].activated = true;
        // @ts-ignore
        G.pub[G.order[3]].vp = 2;
    }
    if (ctx.numPlayers === 2) {
        G.regions[Region.NA].share = 12;
        G.regions[Region.WE].share = 10;
        G.regions[Region.EE].share = 8;
        G.regions[Region.ASIA].share = 10;
        drawForTwoPlayerEra(G,ctx,IEra.ONE);
    } else {
        drawForRegion(G, ctx, Region.NA, IEra.ONE);
        drawForRegion(G, ctx, Region.WE, IEra.ONE);
        drawForRegion(G, ctx, Region.EE, IEra.ONE);
    }
    for (let i = 0; i < ctx.numPlayers; i++) {
        fillPlayerHand(G, ctx, i.toString());
    }
    doFillNewEraEventDeck(G, ctx, IEra.ONE);
    return G;
};
