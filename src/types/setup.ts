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
    IRegionPrivate,
    Region
} from "./core";
import {Ctx, PlayerID} from "boardgame.io";
import {B01, B02, B07} from "../constant/cards/basic";
import {doFillNewEraEvents, drawForRegion, fillPlayerHand, shuffle} from "../game/util";

export interface IG {
    order: PlayerID[],
    playerCount: number,
    activeEvents:EventCardID[],
    logDiscrepancyWorkaround: boolean,
    pending: {
        lastRoundOfGame: boolean,
        endActivePlayer: boolean,
        endTurn: boolean,
        endPhase: boolean,
        endStage: boolean,
    },
    scoringRegions:Region[],
    events:IEventCard[],
    c: {
        players: PlayerID[],
        slots: ICardSlot[],
        buildingSlots: IBuildingSlot[],
        cardIDs: string[],
    },
    pub: IPubInfo[],
    e: { choices: any[], stack: any[], card: ICard ,regions:Region[]},
    player: IPrivateInfo[],
    competitionInfo: {
        region: Region,
        atk: PlayerID,
        atkPlayedCard: boolean,
        def: PlayerID,
        defPlayedCard: boolean,
        pending: boolean,
        progress: number,
    },
    secret: {
        regions: {
            0: IRegionPrivate,
            1: IRegionPrivate,
            2: IRegionPrivate,
            3: IRegionPrivate,
        },
        events: IEventCard[],
        playerDecks: ICard[][],
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

function pubPlayer(): IPubInfo {
    return {
        building:{
          cinemaBuilt:false,
          studioBuilt:false,
        },
        champions:[],
        action: 1,
        aesthetics: 0,
        allCards: [B01, B02, B07, B07, B07, B07, B07, B07],
        archive: [],
        deposit: 20,
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

function privatePlayer(): IPrivateInfo {
    return {hand: [], filmAwardCandidate: null}
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

function emptyBuildingSlot(region: Region,activated:boolean = true): IBuildingSlot {
    return {
        region: region,
        content: "",
        isCinema:false,
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
        decks.push(shuffle(ctx, [B01, B02, B07, B07, B07, B07, B07, B07]));
    }
    let events = shuffle(ctx, []);
    let randomOrder = shuffle(ctx, order);
    let G = {
        order: randomOrder,
        logDiscrepancyWorkaround: true,
        pending: {
            lastRoundOfGame: false,
            endActivePlayer: false,
            endTurn: false,
            endPhase: false,
            endStage: false,
        },
        playerCount: ctx.numPlayers,
        pub: pub,
        events:[],
        c: {
            players: [],
            slots: [],
            buildingSlots: [],
            cardIDs: [],

        },
        e: {choices: [], stack: [], card: B07, regions: [],},
        competitionInfo: {
            region: Region.NONE,
            atk: '0',
            atkPlayedCard: false,
            def: '1',
            defPlayedCard: false,
            progress: 0,
            pending:false,
        },
        activeEvents:[],
        player: players,
        secret: {
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
            events: events,
            playerDecks: decks,
        },
        regions: {
            0: {
                era: IEra.ONE,
                buildings: [
                    emptyBuildingSlot(0),
                    emptyBuildingSlot(0,false),
                    emptyBuildingSlot(0,false),
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
                era: IEra.ONE,
                buildings: [
                    emptyBuildingSlot(1),
                    emptyBuildingSlot(1,false)
                ],
                legend: emptyLegendCardSlot(1),
                normal: [
                    emptyNormalCardSlot(1),
                    emptyNormalCardSlot(1),
                ],
                share: 6,
            },
            2: {
                era: IEra.ONE,
                buildings: [
                    emptyBuildingSlot(2),
                    emptyBuildingSlot(2,false),
                ],
                legend: emptyLegendCardSlot(2),
                normal: [emptyNormalCardSlot(2), emptyNormalCardSlot(2)],
                share: 4,
            },
            3: {
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
        scoringRegions:[],
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
    if (ctx.numPlayers > 2){
        G.regions[Region.NA].buildings[1].activated = true;
        G.regions[Region.WE].buildings[1].activated = true;
    }
    if (ctx.numPlayers > 3) {
        G.regions[Region.EE].buildings[1].activated = true;
    }
    drawForRegion(G, ctx, Region.NA, IEra.ONE);
    drawForRegion(G, ctx, Region.WE, IEra.ONE);
    drawForRegion(G, ctx, Region.EE, IEra.ONE);
    for (let i = 0; i < ctx.numPlayers; i++) {
        fillPlayerHand(G, ctx, i.toString());
    }
    doFillNewEraEvents(G,ctx,IEra.ONE);
    return G;
};
