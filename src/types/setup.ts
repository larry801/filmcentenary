import {
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
import {fillPlayerHand, drawForRegion, shuffle} from "../game/util";

export interface IG {
    order: PlayerID[],
    playerCount: number,
    logDiscrepancyWorkaround: boolean,
    pending: {
        endActivePlayer: boolean,
        endTurn: boolean,
        endPhase: boolean,
        endStage: boolean,
    },
    c:{
      players:PlayerID[],
      slots:ICardSlot[],
      buildingSlots:IBuildingSlot[],
    },
    pub: IPubInfo[],
    e: { choices: any[], stack: any[], card: ICard },
    player: IPrivateInfo[],
    competitionInfo: {
        region: Region,
        atk: PlayerID,
        def: PlayerID,
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
    basicCards:{
        "B01":number,
        "B02":number,
        "B03":number,
        "B04":number
        "B05":number,
        "B06":number,
        "B07":number,
    },
}

function pubPlayer(): IPubInfo {
    return {
        action: 1,
        aesthetics: 0,
        allCards: [B01, B02, B07, B07, B07, B07, B07, B07],
        archive: [],
        cash: 0,
        discard: [],
        industry: 0,
        resource: 0,
        revealedHand: [],
        school: null,
        shares: {
            0: 0,
            1: 0,
            2: 0,
            3: 0,
        },
        tempStudios:[],
        vp: 0,
        respondMark:{
            tempStudioRespond:false,
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

function emptyBuildingSlot(region: Region): IBuildingSlot {
    return {
        region: region,
        content: "",
        activated: false,
        owner: "",
    }
}

export function setup(ctx: Ctx, setupData: any): IG {
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
    let realOrder = shuffle(ctx, order);
    let g = {
        order: realOrder,
        logDiscrepancyWorkaround: true,
        pending: {
            endActivePlayer: false,
            endTurn: false,
            endPhase: false,
            endStage: false,
        },
        playerCount: ctx.numPlayers,
        pub: pub,
        c:{
            players:[],
            slots:[],
            buildingSlots:[],
        },
        e: {choices: [], stack: [],card:B07},
        competitionInfo: {
            region: Region.NA,
            atk: '0',
            def: '0',
            progress: 0,
        },
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
                buildings: [emptyBuildingSlot(0)],
                legend: emptyLegendCardSlot(0),
                normal: [
                    emptyNormalCardSlot(0),
                    emptyNormalCardSlot(0),
                    emptyNormalCardSlot(0),
                ],
                share: 7,
            },
            1: {
                era: IEra.ONE,
                buildings: [emptyBuildingSlot(1)],
                legend: emptyLegendCardSlot(1),
                normal: [
                    emptyNormalCardSlot(1),
                    emptyNormalCardSlot(1),
                ],
                share: 7,
            },
            2: {
                era: IEra.ONE,
                buildings: [emptyBuildingSlot(2)],
                legend: emptyLegendCardSlot(2),
                normal: [emptyNormalCardSlot(2), emptyNormalCardSlot(2)],
                share: 7,
            },
            3: {
                era: IEra.TWO,
                buildings: [emptyBuildingSlot(3)],
                legend: emptyLegendCardSlot(3),
                normal: [emptyNormalCardSlot(3), emptyNormalCardSlot(3)],
                share: 7,
            },
        },
        pendingEffects: [],
        basicCards: {
            "B01":20,
            "B02":20,
            "B03":10,
            "B04":40,
            "B05":20,
            "B06":0,
            "B07":0,
        },
    }
    drawForRegion(g, ctx, Region.NA, IEra.ONE);
    drawForRegion(g, ctx, Region.WE, IEra.ONE);
    drawForRegion(g, ctx, Region.EE, IEra.ONE);
    for (let i = 0; i < ctx.numPlayers; i++) {
        fillPlayerHand(g, ctx, i.toString());
    }
    return g;
}
