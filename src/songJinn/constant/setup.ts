import {PlanID} from "./plan";
import {
    ActiveEvents,
    CardID,
    CityID,
    Country,
    JinnEarlyCardID,
    JinnGeneral,
    LetterOfCredence,
    Level, OtherCountries, OtherCountryID,
    PlayerPendingEffect,
    ProvinceID,
    RegionID,
    SJPlayer,
    SongEarlyCardID,
    SongGeneral,
    Troop
} from "./general";
import {Ctx} from "boardgame.io";
import {shuffle} from "../../game/util";

export interface SJPubInfo {
    countries: OtherCountryID[],
    troops: Troop[],
    effect: PlayerPendingEffect[],
    military: Level;
    civil: Level;
    plan: PlanID[],
    completedPlan: PlanID[],
    emperor: CityID | null,
    corruption: number,
    ready: number[],
    discard: CardID[],
    develop: CardID[],
    usedDevelop: number,
    remove: CardID[],
    standby: number[],
    provinces: ProvinceID[],
    cities: CityID[]
}

export const initialJinnPub: SJPubInfo = {
    develop:[],
    usedDevelop:0,
    troops: [
        {u: [1, 2, 1, 0, 1, 0, 0], p: RegionID.R20, j: [JinnGeneral.WoLiBu], c: null, country: Country.JINN},
        {u: [2, 0, 0, 0, 0, 0, 0], p: RegionID.R11, j: [JinnGeneral.LouShi], c: CityID.LinFen, country: Country.JINN},
        {u: [2, 2, 1, 0, 0, 0, 0], p: RegionID.R37, j: [JinnGeneral.ZhanHan], c: CityID.LuoYang, country: Country.JINN},

        {u: [1, 0, 1, 0, 1, 0, 0], p: RegionID.R06, j: [], c: CityID.LiaoYang, country: Country.JINN},

        {u: [0, 0, 0, 0, 0, 1, 0], p: RegionID.R10, j: [], c: CityID.YangQu, country: Country.JINN},
        {u: [0, 0, 0, 0, 0, 1, 0], p: RegionID.R12, j: [], c: CityID.ShangDang, country: Country.JINN},
        {u: [0, 0, 0, 0, 0, 1, 0], p: RegionID.R13, j: [], c: CityID.AnXi, country: Country.JINN},

        {u: [0, 0, 0, 0, 0, 1, 0], p: RegionID.R14, j: [], c: CityID.ZhenDing, country: Country.JINN},
        {u: [0, 0, 0, 0, 0, 1, 0], p: RegionID.R15, j: [], c: CityID.HeJian, country: Country.JINN},


        {u: [4, 0, 0, 0, 0, 0, 0], p: RegionID.R18, j: [], c: CityID.YuanCheng, country: Country.JINN},
    ],
    countries: [OtherCountryID.GaoLi, OtherCountryID.XiXia],
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
    cities: [
        CityID.KaiFeng,
        CityID.MinXian
    ]
}

export const initialSongPub: SJPubInfo = {
    develop:[],
    usedDevelop:0,
    troops: [
        {u: [2, 2, 0, 0, 0, 0], p: RegionID.R19, j: [SongGeneral.ZongZe], c: null, country: Country.SONG},
        {u: [0, 1, 0, 0, 0, 0], p: RegionID.R21, j: [], c: CityID.LiCheng, country: Country.SONG},
        {u: [0, 1, 0, 0, 0, 0], p: RegionID.R28, j: [], c: CityID.SongCheng, country: Country.SONG},
        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R32, j: [], c: CityID.Fushi, country: Country.SONG},

        {u: [0, 1, 0, 0, 0, 0], p: RegionID.R33, j: [], c: CityID.TianXing, country: Country.SONG},
        {u: [1, 1, 1, 0, 0, 0], p: RegionID.R36, j: [], c: CityID.ChangAn, country: Country.SONG},

        {u: [2, 1, 0, 0, 0, 0], p: RegionID.R42, j: [], c: CityID.XiangYang, country: Country.SONG},
        {u: [2, 3, 0, 0, 0, 0], p: RegionID.R43, j: [], c: CityID.KaiFeng, country: Country.SONG},

        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R46, j: [], c: CityID.JiangDu, country: Country.SONG},
        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R48, j: [], c: CityID.XiaCai, country: Country.SONG},
        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R54, j: [], c: CityID.ChengDu, country: Country.SONG},

        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R60, j: [], c: CityID.JiangLing, country: Country.SONG},
        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R66, j: [], c: CityID.JiangNing, country: Country.SONG},
        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R77, j: [], c: CityID.MinXian, country: Country.SONG},

    ],
    effect: [],
    plan: [],
    countries: [OtherCountryID.XiLiao, OtherCountryID.DaLi],
    civil: 3,
    completedPlan: [],
    emperor: CityID.KaiFeng,
    corruption: 2,
    discard: [],
    remove: [],
    military: 1,
    ready: [0, 0, 0, 0, 0, 0],
    standby: [9, 18, 9, 2, 3, 5],
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
    removedCountries: OtherCountryID[],
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
        removedCountries: [],
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