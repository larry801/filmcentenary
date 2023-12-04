export enum ActiveEvents {
    JingKangZhiBian,
    XiangHaiShangFaZhan,
}

export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export enum OtherCountries {
    XiLiao,
    XiXia,
    TuBo,
    DaLi,
    GaoLi
}

export enum OtherCountryState {
    SONG,
    JINN,
    NEUTRAL
}

export enum SJPlayer {
    P1 = '0',
    P2 = '1',
}

export const UNIT_FULL_NAME = [
    ['步军', '步射', '马军', '水军', '霹雳炮', '背嵬军'],
    ['步军', '拐子马', '铁浮屠', '水军', '鹅车', '签军', '齐军']
];
export const UNIT_SHORTHAND = [
    ['步', '弓', '骑', '船', '炮', '背'],
    ['步', '拐', '铁', '船', '鹅', '伪', '齐']
];
export const MID_TERM_DECK = [17, 18, 19, 20];
export const LATE_TERM_DECK = [];
export const INITIAL_RECRUIT_PERMISSION = [
    [true, true, false, true, false, false],
    [true, true, true, false, false, true, false]
];

export const INITIAL_RECRUIT_COST = [
    [1, 1, 0, 2, 0, 0],
    [1, 2, 2, 0, 0, 1, 1]
];

export enum Country {
    SONG = "SONG",
    JINN = "JINN"
}

export enum IEra {
    E = "E",
    M = "M",
    L = "L"
}

export enum TerrainType {
    FLATLAND,
    HILLS,
    MOUNTAINS,
    SWAMP,
    RAMPART,
}

export enum SongBasicCardID {
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

export const SongEarlyCardID = [
    SongBasicCardID.S01,
    SongBasicCardID.S02,
    SongBasicCardID.S03,
    SongBasicCardID.S04,
    SongBasicCardID.S05,
    SongBasicCardID.S06,
    SongBasicCardID.S07,
    SongBasicCardID.S08,
    SongBasicCardID.S09,
    SongBasicCardID.S10,
    SongBasicCardID.S11,
    SongBasicCardID.S12,
    SongBasicCardID.S13,
    SongBasicCardID.S14,
    SongBasicCardID.S15,
    SongBasicCardID.S16
];

export type BasicCardID = SongBasicCardID | JinnBasicCardID;

export enum JinnBasicCardID {
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

export enum OptionalJinnCardID {
    X01,
    X02,
    X03,
    X04,
    X05,
    X06,
    X07
}

export enum OptionalSongCardID {
    X08,
    X09,
    X10,
    X11,
    X12
}

export type CardID = SongBasicCardID | JinnBasicCardID | OptionalSongCardID | OptionalJinnCardID;

export enum SongGeneral {
    ZongZe,
    YueFei,
    HanShiZhong,
    LiXianZhong,
    WuJie,
    WuLin
}

export enum JinnGeneral {
    WoLiBu,
    ZhanHan,
    WuZhu,
    YinShuKe,
    LouShi,
    BenZhu
}

export type General = SongGeneral | JinnGeneral;


export enum EventDuration {
    INSTANT = "INSTANT",
    CONTINUOUS = "CONTINUOUS"
}


export interface LetterOfCredence {
    country: OtherCountries;
    card: CardID;
}

export enum CityID {
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

    ZhenXian = 25,
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