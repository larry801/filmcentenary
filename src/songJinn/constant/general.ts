export const enum ActiveEvents {
    JianYanNanDu = "建炎南渡",
    XiJunQuDuan = "西军曲端",
    JinTaiZongJiaBeng = "金太宗驾崩",
    BaZiJun = "八字军",
    WuLuKeTui = "无路可退",
    XiangHaiShangFaZhan = "向海上发展",
    FuHaiTaoSheng = "浮海逃生",
    ShenBiGong = "神臂弓",
    ZhongBuBing = "重步兵",
    YueShuaiZhiLai = "岳帅之来，此间震怒",
    WuLin = "吴璘",

    JingKangZhiBian = "靖康之变",
    ZhuiWangZhuBei = "追亡逐北",
    JiNanZhiFuLiuYu = "济南知府刘豫",
    JinBingLaiLe = "金兵来了",
    ZhangZhaoZhiZheng = "张赵之争",
    JianLiDaQi = "建立大齐",
    QinHuiDuXiang = "秦桧独相",
    BuJianLaiShi = "不见来使",
    QuDuanZhiSi = "曲端之死",
    XuZhouYeTie = "徐州冶铁",
    TianJuanZhengBian = "天眷政变",
    JieChuBingQuan = "解除兵权"
}

export enum MountainPassID {
    JuYongGuan = "居庸关",
    TongGuan = "潼关",
    WuGuan = "武关",
    DaSanGuan = "大散关",
    JianMenGuan = "剑门关"
}

export const enum PlayerPendingEffect {
    SearchCard,
    TwoPlan,
}

export interface Troop {
    p: TroopPlace,
    c: CityID | null,
    u: number[],
    j: General[],
    country: Country
}


export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const enum VictoryType {
    ShaoXingHeYi,
    PowerOfNation,
    StrategicPlan,
    WuShanLiMa,
    ZhiDaoHuangLong,
    Diplomacy
}

export enum OtherCountryID {
    XiLiao = "西辽",
    XiXia = "西夏",
    TuBo = "吐蕃",
    DaLi = "大理",
    GaoLi = "高丽"
}

export const enum OtherCountryState {
    SONG,
    JINN,
    NEUTRAL
}

export const enum SJPlayer {
    P1 = '0',
    P2 = '1',
}

export const UNIT_FULL_NAME = [
    ['步军', '步射', '马军', '水军', '霹雳炮', '背嵬军'],
    ['步军', '拐子马', '铁浮屠', '水军', '鹅车', '签军', '齐军']
];

export const OtherCountries = [
    OtherCountryID.DaLi,
    OtherCountryID.TuBo,
    OtherCountryID.GaoLi,
    OtherCountryID.XiLiao,
    OtherCountryID.XiXia
];

export enum DevelopChoice {
    MILITARY = "军事",
    CIVIL = "内政",
    COLONY = "殖民",
    POLICY = "政策",
    EMPEROR = "拥立"
}

export const accumulator = (accumulator, currentValue) => accumulator + currentValue;

export const MountainPasses = [
    MountainPassID.DaSanGuan,
    MountainPassID.JianMenGuan,
    MountainPassID.JuYongGuan,
    MountainPassID.TongGuan,
    MountainPassID.WuGuan,
];

export function isRegionID(place: TroopPlace): place is RegionID {
    return typeof place === 'number' && Object.values(RegionID).includes(place as RegionID);
}

export function isOtherCountryID(place: TroopPlace): place is OtherCountryID {
    return typeof place === 'string' && Object.values(OtherCountryID).includes(place as OtherCountryID);
}

export function isMountainPassID(place: TroopPlace): place is MountainPassID {
    return typeof place === 'string' && Object.values(MountainPassID).includes(place as MountainPassID);
}

export type TroopPlace = RegionID | OtherCountryID | MountainPassID | null;

export const UNIT_SHORTHAND = [
    ['步', '弓', '骑', '船', '炮', '背'],
    ['步', '拐', '铁', '船', '鹅', '伪', '齐']
];

export const INITIAL_RECRUIT_PERMISSION = [
    [true, true, false, true, false, false],
    [true, true, true, false, false, true, false]
];

export const INITIAL_RECRUIT_COST = [
    [1, 1, 0, 2, 0, 0],
    [1, 2, 2, 0, 0, 1, 1]
];

export const enum Country {
    SONG = "SONG",
    JINN = "JINN"
}

export const enum IEra {
    E = "E",
    M = "M",
    L = "L"
}

export const enum TerrainType {
    FLATLAND,
    HILLS,
    MOUNTAINS,
    SWAMP,
    RAMPART,
}

export const enum SongBaseCardID {
    S01,
    S02,
    S03,
    S04,
    S05,
    S06,
    S07,
    S08,
    S09,
    S10,
    S11,
    S12,
    S13,
    S14,
    S15,
    S16,
    S17,
    S18,
    S19,
    S20,
    S21,
    S22,
    S23,
    S24,
    S25,
    S26,
    S27,
    S28,
    S29,
    S30,
    S31,
    S32,
    S33,
    S34,
    S35,
    S36,
    S37,
    S38,
    S39,
    S40,
    S41,
    S42,
    S43,
    S44,
    S45,
    S46,
    S47,
    S48,
    S49,
    S50
}


export type BaseCardID = SongBaseCardID | JinnBaseCardID;


export const enum JinnBaseCardID {
    J01,
    J02,
    J03,
    J04,
    J05,
    J06,
    J07,
    J08,
    J09,
    J10,
    J11,
    J12,
    J13,
    J14,
    J15,
    J16,
    J17,
    J18,
    J19,
    J20,
    J21,
    J22,
    J23,
    J24,
    J25,
    J26,
    J27,
    J28,
    J29,
    J30,
    J31,
    J32,
    J33,
    J34,
    J35,
    J36,
    J37,
    J38,
    J39,
    J40,
    J41,
    J42,
    J43,
    J44,
    J45,
    J46,
    J47,
    J48,
    J49,
    J50
}

export const enum OptionalJinnCardID {
    X01,
    X02,
    X03,
    X04,
    X05,
    X06,
    X07
}

export const enum OptionalSongCardID {
    X08,
    X09,
    X10,
    X11,
    X12
}

export const JinnEarlyCardID = [
    JinnBaseCardID.J01
];
export const JinnMidCardID = [];
export const JinnLateCardID = [];

export const SongMidCardID = [];
export const SongLateCardID = [SongBaseCardID.S50];
export const SongEarlyCardID = [
    SongBaseCardID.S01,
    SongBaseCardID.S02,
    SongBaseCardID.S03,
    SongBaseCardID.S04,
    SongBaseCardID.S05,
    SongBaseCardID.S06,
    SongBaseCardID.S07,
    SongBaseCardID.S08,
    SongBaseCardID.S09,
    SongBaseCardID.S10,
    SongBaseCardID.S11,
    SongBaseCardID.S12,
    SongBaseCardID.S13,
    SongBaseCardID.S14,
    SongBaseCardID.S15,
    SongBaseCardID.S16
];

export type CardID = SongBaseCardID | JinnBaseCardID | OptionalSongCardID | OptionalJinnCardID;

export const enum SongGeneral {
    ZongZe,
    YueFei,
    HanShiZhong,
    LiXianZhong,
    WuJie,
    WuLin
}

export const enum JinnGeneral {
    WoLiBu,
    ZhanHan,
    WuZhu,
    YinShuKe,
    LouShi,
    BenZhu
}

export type General = SongGeneral | JinnGeneral;


export const enum EventDuration {
    INSTANT = "INSTANT",
    CONTINUOUS = "CONTINUOUS"
}


export interface LetterOfCredence {
    country: OtherCountryID;
    card: CardID;
}

export const enum CityID {
    DaTong = 0,

    DaDing = 1,
    LiaoYang = 2,

    XiJin = 3,

    YangQu = 4,
    LinFen = 5,

    ShangDang = 6,
    ZhenDing = 7,
    AnXi = 8,
    HeJian = 9,
    YuanCheng = 10,
    LiCheng = 11,
    XuCheng = 12,
    SongCheng = 13,

    Fushi = 14,
    TianXing = 15,
    ChangAn = 16,

    LuoYang = 17,
    WanQiu = 18,
    XiangYang = 19,

    KaiFeng = 20,

    JiangDu = 21,
    XiaCai = 22,

    NanZhen = 23,
    ChengDu = 24,

    QiXian = 25,
    JiangLing = 26,
    AnLu = 27,
    ChangSha = 28,

    JiangNing = 29,
    NanChang = 30,

    DanTu = 31,
    WuXian = 32,
    QianTang = 33,

    MinXian = 34
}

export enum RegionID {
    R01,
    R02,
    R03,
    R04,
    R05,
    R06,
    R07,
    R08,
    R09,
    R10,
    R11,
    R12,
    R13,
    R14,
    R15,
    R16,
    R17,
    R18,
    R19,
    R20,
    R21,
    R22,
    R23,
    R24,
    R25,
    R26,
    R27,
    R28,
    R29,
    R30,
    R31,
    R32,
    R33,
    R34,
    R35,
    R36,
    R37,
    R38,
    R39,
    R40,
    R41,
    R42,
    R43,
    R44,
    R45,
    R46,
    R47,
    R48,
    R49,
    R50,
    R51,
    R52,
    R53,
    R54,
    R55,
    R56,
    R57,
    R58,
    R59,
    R60,
    R61,
    R62,
    R63,
    R64,
    R65,
    R66,
    R67,
    R68,
    R69,
    R70,
    R71,
    R72,
    R73,
    R74,
    R75,
    R76,
    R77
}

export const enum ProvinceID {
    XIJINGLU,
    BEIJINGLU,
    YANJINGLU,
    DONGJINGLU,
    HEDONGLU,
    HEBEILIANGLU,
    JINGDONGLIANGLU,
    JINGXILIANGLU,
    JINGJILU,
    HUAINANLIANGLU,
    CHUANSHANSILU,
    JINHULIANGLU,
    JIANGNANLIANGLU,
    LIANGZHELU,
    FUJIANLU,
    SHANXILIULU
}