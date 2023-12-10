import {
    ActiveEvents,
    CityID,
    Country, EarlyPlanID,
    GeneralStatus,
    JinnEarlyCardID,
    LetterOfCredence,
    Level,
    NationID,
    PlanID,
    PlayerPendingEffect,
    ProvinceID,
    RegionID,
    SJEventCardID,
    SJPlayer,
    SongEarlyCardID, SpecialPlan,
    Troop,
    TroopPlace
} from "./general";
import {Ctx} from "boardgame.io";
import {shuffle} from "../../game/util";
//
// export interface GeneralInfo {
//     country: Country;
//     name: string;
//     status: GeneralStatus;
//     place: TroopPlace | null;
//     skill: boolean;
// }

export interface SJPubInfo {
    specialPlan: number,
    generalSkill: boolean[],
    generalPlace: TroopPlace[],
    dices: number[],
    troopIdx: number,
    cities: CityID[],
    civil: Level,
    completedPlan: PlanID[],
    corruption: number;
    nations: NationID[];
    develop: SJEventCardID[],
    discard: SJEventCardID[],
    effect: PlayerPendingEffect[],
    emperor: CityID | null,
    generals: GeneralStatus[],
    military: Level,
    plan: PlanID[],
    provinces: ProvinceID[],
    ready: number[],
    remove: SJEventCardID[],
    standby: number[],
    troops: Troop[],
    usedDevelop: number
}

export const initialJinnPub: SJPubInfo = {
    specialPlan: 0,
    generalSkill: [true, true, true, false, false, true],
    generalPlace: [RegionID.R20, RegionID.R37, RegionID.R11, RegionID.R01, RegionID.R01, RegionID.R01],
    dices: [],
    troopIdx: -1,
    develop: [],
    usedDevelop: 0,
    troops: [
        {u: [1, 2, 1, 0, 1, 0, 0], p: RegionID.R20, c: null, country: Country.JINN},
        {u: [2, 0, 0, 0, 0, 0, 0], p: RegionID.R11, c: CityID.LinFen, country: Country.JINN},
        {u: [2, 2, 1, 0, 0, 0, 0], p: RegionID.R37, c: CityID.LuoYang, country: Country.JINN},

        {u: [1, 0, 1, 0, 1, 0, 0], p: RegionID.R06, c: CityID.LiaoYang, country: Country.JINN},

        {u: [0, 0, 0, 0, 0, 1, 0], p: RegionID.R10, c: CityID.YangQu, country: Country.JINN},
        {u: [0, 0, 0, 0, 0, 1, 0], p: RegionID.R12, c: CityID.ShangDang, country: Country.JINN},
        {u: [0, 0, 0, 0, 0, 1, 0], p: RegionID.R13, c: CityID.AnXi, country: Country.JINN},

        {u: [0, 0, 0, 0, 0, 1, 0], p: RegionID.R14, c: CityID.ZhenDing, country: Country.JINN},
        {u: [0, 0, 0, 0, 0, 1, 0], p: RegionID.R15, c: CityID.HeJian, country: Country.JINN},


        {u: [4, 0, 0, 0, 0, 0, 0], p: RegionID.R18, c: CityID.YuanCheng, country: Country.JINN},
    ],
    nations: [NationID.GaoLi, NationID.XiXia],
    effect: [],
    plan: [],
    civil: 2,
    completedPlan: [],
    emperor: CityID.LiaoYang,
    corruption: 0,
    discard: [],
    remove: [],
    military: 3,
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
        CityID.DaTong,
        CityID.DaDing,
        CityID.LiaoYang,
        CityID.XiJin,
        CityID.YangQu,
        CityID.LinFen,
        CityID.ShangDang,
        CityID.ZhenDing,
        CityID.AnXi,
        CityID.HeJian,
        CityID.YuanCheng,
        CityID.LuoYang
    ],
    generals: [
        GeneralStatus.TROOP,
        GeneralStatus.TROOP,
        GeneralStatus.TROOP,
        GeneralStatus.PRE,
        GeneralStatus.PRE,
        GeneralStatus.PRE
    ]
}

export const initialSongPub: SJPubInfo = {
    specialPlan: 0,
    generalSkill: [false, false, false, false, false, false],
    generalPlace: [RegionID.R19, RegionID.R01, RegionID.R01, RegionID.R01, RegionID.R01, RegionID.R01],
    dices: [],
    troopIdx: -1,
    cities: [
        CityID.LiCheng,
        CityID.SongCheng,
        CityID.XuCheng,
        CityID.KaiFeng,
        CityID.XiangYang,
        CityID.WanQiu,
        CityID.JiangDu,
        CityID.XiaCai,
        CityID.JiangNing,
        CityID.DanTu,
        CityID.WuXian,
        CityID.QianTang,
        CityID.MinXian,
        CityID.NanChang,
        CityID.ChangSha,
        CityID.AnLu,

        CityID.ChangAn,
        CityID.Fushi,
        CityID.TianXing,

        CityID.JiangLing,

        CityID.ChengDu,
        CityID.QiXian,
        CityID.NanZhen
    ],
    civil: 3,
    completedPlan: [],
    corruption: 2,
    nations: [NationID.XiLiao, NationID.DaLi],
    develop: [],
    discard: [],
    effect: [],
    emperor: CityID.KaiFeng,
    generals: [
        GeneralStatus.TROOP,
        GeneralStatus.PRE,
        GeneralStatus.PRE,
        GeneralStatus.PRE,
        GeneralStatus.PRE,
        GeneralStatus.PRE
    ],
    military: 2,
    plan: [],
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
    ready: [0, 0, 0, 0, 0, 0],
    remove: [],
    standby: [9, 18, 9, 2, 3, 5],
    troops: [
        {u: [2, 2, 0, 0, 0, 0], p: RegionID.R19, c: null, country: Country.SONG},
        {u: [0, 1, 0, 0, 0, 0], p: RegionID.R21, c: CityID.LiCheng, country: Country.SONG},
        {u: [0, 1, 0, 0, 0, 0], p: RegionID.R28, c: CityID.SongCheng, country: Country.SONG},
        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R32, c: CityID.Fushi, country: Country.SONG},

        {u: [0, 1, 0, 0, 0, 0], p: RegionID.R33, c: CityID.TianXing, country: Country.SONG},
        {u: [1, 1, 1, 0, 0, 0], p: RegionID.R36, c: CityID.ChangAn, country: Country.SONG},

        {u: [2, 1, 0, 0, 0, 0], p: RegionID.R42, c: CityID.XiangYang, country: Country.SONG},
        {u: [2, 3, 0, 0, 0, 0], p: RegionID.R43, c: CityID.KaiFeng, country: Country.SONG},

        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R46, c: CityID.JiangDu, country: Country.SONG},
        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R48, c: CityID.XiaCai, country: Country.SONG},
        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R54, c: CityID.ChengDu, country: Country.SONG},

        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R60, c: CityID.JiangLing, country: Country.SONG},
        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R66, c: CityID.JiangNing, country: Country.SONG},
        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R77, c: CityID.MinXian, country: Country.SONG},

    ],
    usedDevelop: 0
}

export interface SJPlayerInfo {
    hand: SJEventCardID[],
    combatCard: SJEventCardID[],
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
    matchID:string,
    pending: {
        event: string,
        regions: RegionID[],
        cities: CityID[],
    }
    op: number,
    qi: ProvinceID[],
    plans: PlanID[],
    dices: number[],
    order: SJPlayer[],
    removedNation: NationID[],
    events: ActiveEvents[],
    round: number,
    turn: number,
    policy: number,
    colony: number,
    song: SJPubInfo,
    jinn: SJPubInfo,
    player: {
        [SJPlayer.P1]: SJPlayerInfo,
        [SJPlayer.P2]: SJPlayerInfo,
    }
    // combat: CombatInfo,
    secret: {
        songDeck: SJEventCardID[],
        jinnDeck: SJEventCardID[],
        planDeck: PlanID[],
    },
    first: SJPlayer,
}

export const setupSongJinn: (ctx: Ctx, setupData: any) => SongJinnGame = (ctx: Ctx, setupData: any) => {
    const songDeck = shuffle(ctx, SongEarlyCardID);
    const jinnDeck = shuffle(ctx, JinnEarlyCardID);
    // const planDeck = shuffle(ctx, SpecialPlan);
    const planDeck = shuffle(ctx, EarlyPlanID);
    const G = {
        matchID:"default",
        pending: {
            event: "",
            regions: [],
            cities: [],
        },
        qi: [],
        op: 0,
        plans: [],
        dices: [],
        removedNation: [],
        // start from action phase for debugging
        order: [SJPlayer.P1, SJPlayer.P2],
        // order: [SJPlayer.P1],
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
    G.player[SJPlayer.P1].hand = songDeck.slice(-9);
    G.player[SJPlayer.P2].hand = jinnDeck.slice(-7);
    G.secret.songDeck = songDeck.slice(0, 7);
    G.secret.jinnDeck = jinnDeck.slice(0, 9);
    console.log(G.secret.songDeck.toString());
    console.log(G.secret.jinnDeck.toString());
    //
    // G.player['1'].hand.push(JinnBaseCardID.J09);
    // G.player['1'].hand.push(JinnBaseCardID.J18);

    return G;
}