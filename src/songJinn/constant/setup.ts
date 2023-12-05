import {PlanID} from "./plan";
import {
    ActiveEvents,
    CardID,
    CityID,
    LetterOfCredence,
    Level,
    PlayerPendingEffect,
    ProvinceID,
    SJPlayer,
    SongEarlyCardID,
    JinnEarlyCardID, JinnGeneral
} from "./general";
import {Ctx} from "boardgame.io";
import {shuffle} from "../../game/util";

export interface SJPubInfo {
    troops:[],
    effect: PlayerPendingEffect[],
    military: Level;
    civil: Level;
    plan: PlanID[],
    completedPlan: PlanID[],
    emperor: CityID | null,
    corruption: number,
    ready: number[],
    discard: CardID[],
    remove: CardID[],
    standby: number[],
    provinces: ProvinceID[],
    cities: CityID[]
}

export const initialJinnPub: SJPubInfo = {
    troops:[],
    effect: [],
    plan: [],
    civil: 2,
    completedPlan: [],
    emperor: CityID.LiaoYang,
    corruption: 3,
    discard: [],
    remove: [],
    military: 1,
    ready: [0, 0, 1, 0, 0, 0, 0],
    standby: [5, 16, 17, 5, 1, 10, 10],
    provinces: [
        ProvinceID.BEIJINGLU,
        ProvinceID.DONGJINGLU,
        ProvinceID.XIJINGLU,
        ProvinceID.HEDONGLU,
        ProvinceID.HEBEILIANGLU
    ],
    cities: []
}

export const initialSongPub: SJPubInfo = {
    effect: [],
    plan: [],
    civil: 3,
    completedPlan: [],
    emperor: CityID.KaiFeng,
    corruption: 2,
    discard: [],
    remove: [],
    military: 1,
    ready: [0, 0, 0, 0, 0, 0],
    standby: [9, 18, 9, 2, 3, 5],
    troops:[],
    provinces: [
        ProvinceID.JINGDONGLIANGLU,
        ProvinceID.SHANXILIULU,
        ProvinceID.CHUANSHANSILU,
        ProvinceID.JINGXILIANGLU,
        ProvinceID.HUAINANLIANGLU,
        ProvinceID.JINHULIANGLU,
        ProvinceID.JIANGNANLIANGLU,
        ProvinceID.LIANGZHELU
    ],
    cities: []
}

export interface SJPlayerInfo {
    hand: CardID[],
    combatCard: CardID[],
    plans: PlanID[],
    chosenPlans: PlanID[],
    lod: LetterOfCredence[]
}

export const emptyPlayerInfo: () => SJPlayerInfo = () => {
    return {
        hand: [],
        combatCard: [],
        plans: [],
        chosenPlans: [],
        lod: []
    }
}

export interface SongJinnGame {
    order: SJPlayer[],
    events: ActiveEvents[],
    round: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
    turn: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
    policy: -3 | -2 | -1 | 0 | 1 | 2 | 3,
    colony: 0 | 1 | 2 | 3 | 4,
    song: SJPubInfo,
    jinn: SJPubInfo,
    player: {
        [SJPlayer.P1]: SJPlayerInfo,
        [SJPlayer.P2]: SJPlayerInfo,
    }
    // combat: CombatInfo,
    secret: {
        songDeck: CardID[],
        jinnDeck: CardID[],
        planDeck: PlanID[],
    },
    first: SJPlayer,
}

export const setupSongJinn: (ctx: Ctx, setupData: any) => SongJinnGame = (ctx: Ctx) => {
    const songDeck = shuffle(ctx, SongEarlyCardID);
    const jinnDeck = shuffle(ctx, JinnEarlyCardID);
    const planDeck = shuffle(ctx, [
        PlanID.J01,
        PlanID.J02,
        PlanID.J03,
        PlanID.J04,
        PlanID.J05,
        PlanID.J06
    ])
    return {
        order: [SJPlayer.P1],
        events: [],
        round: 1,
        turn: 1,
        first: SJPlayer.P1,
        policy: -2,
        colony: 2,
        player: {
            [SJPlayer.P1]: emptyPlayerInfo(),
            [SJPlayer.P2]: emptyPlayerInfo(),
        },
        secret: {
            songDeck: songDeck,
            jinnDeck: jinnDeck,
            planDeck: planDeck,
        },
        song: initialSongPub,
        jinn: initialJinnPub,
    }
}