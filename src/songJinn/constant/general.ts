export const enum ActiveEvents {
    JianYanNanDu = "建炎南渡",
    LiGang = "李纲",
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
    YanJingYiNan = "燕京以南，号令不行",

    JingKangZhiBian = "靖康之变",
    JinTaiZong = "金太宗",
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
    country: Country
}

export enum MarchResult {
    MOVE,
    MERGE,
    OVERFLOW,
    JOINT,
    ELIMINATE,
    RIVER,
}

export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const enum VictoryType {
    ShaoXingHeYi = "绍兴和议",
    PowerOfNation = "国力",
    StrategicPlan = "作战计划",
    WuShanLiMa = "吴山立马",
    ZhiDaoHuangLong = "直捣黄龙",
    Diplomacy = "外交"
}

export enum NationID {
    XiLiao = "西辽",
    XiXia = "西夏",
    TuBo = "吐蕃",
    DaLi = "大理",
    GaoLi = "高丽"
}

export const enum NationState {
    SONG,
    JINN,
    NEUTRAL
}

export const enum SJPlayer {
    P1 = '0',
    P2 = '1',
}

export const GeneralNames = [
    ["宗泽", "岳飞", "韩世忠", "李显忠", "吴玠", "吴璘"],
    ["斡离不", "粘罕", "娄室", "兀朮", "银术可", "奔睹"]
]

export const UNIT_FULL_NAME = [
    ['步军', '步射', '马军', '水军', '霹雳炮', '背嵬军'],
    ['步军', '拐子马', '铁浮屠', '水军', '鹅车', '签军', '齐军']
];

export const Nations = [
    NationID.DaLi,
    NationID.TuBo,
    NationID.GaoLi,
    NationID.XiLiao,
    NationID.XiXia
];

export enum DevelopChoice {
    MILITARY = "军事",
    CIVIL = "内政",
    COLONY = "殖民",
    POLICY = "政策",
    EMPEROR = "拥立"
}

export const accumulator = (accumulator: number, currentValue: number) => accumulator + currentValue;

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

export function isNationID(place: TroopPlace): place is NationID {
    return typeof place === 'string' && Object.values(NationID).includes(place as NationID);
}

export function isMountainPassID(place: TroopPlace): place is MountainPassID {
    return typeof place === 'string' && Object.values(MountainPassID).includes(place as MountainPassID);
}

export function isCityID(place: TroopPlace): place is MountainPassID {
    return typeof place === 'string' && Object.values(CityID).includes(place as CityID);
}
// CityID表示被围困
export type TroopPlace = RegionID | NationID | MountainPassID | CityID;

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
    SONG = "宋",
    JINN = "金"
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
    S01 = "S01",
    S02 = "S02",
    S03 = "S03",
    S04 = "S04",
    S05 = "S05",
    S06 = "S06",
    S07 = "S07",
    S08 = "S08",
    S09 = "S09",
    S10 = "S10",
    S11 = "S11",
    S12 = "S12",
    S13 = "S13",
    S14 = "S14",
    S15 = "S15",
    S16 = "S16",
    S17 = "S17",
    S18 = "S18",
    S19 = "S19",
    S20 = "S20",
    S21 = "S21",
    S22 = "S22",
    S23 = "S23",
    S24 = "S24",
    S25 = "S25",
    S26 = "S26",
    S27 = "S27",
    S28 = "S28",
    S29 = "S29",
    S30 = "S30",
    S31 = "S31",
    S32 = "S32",
    S33 = "S33",
    S34 = "S34",
    S35 = "S35",
    S36 = "S36",
    S37 = "S37",
    S38 = "S38",
    S39 = "S39",
    S40 = "S40",
    S41 = "S41",
    S42 = "S42",
    S43 = "S43",
    S44 = "S44",
    S45 = "S45",
    S46 = "S46",
    S47 = "S47",
    S48 = "S48",
    S49 = "S49",
    S50 = "S50"
}


export type BaseCardID = SongBaseCardID | JinnBaseCardID;


export const enum JinnBaseCardID {
    J01 = "J01",
    J02 = "J02",
    J03 = "J03",
    J04 = "J04",
    J05 = "J05",
    J06 = "J06",
    J07 = "J07",
    J08 = "J08",
    J09 = "J09",
    J10 = "J10",
    J11 = "J11",
    J12 = "J12",
    J13 = "J13",
    J14 = "J14",
    J15 = "J15",
    J16 = "J16",
    J17 = "J17",
    J18 = "J18",
    J19 = "J19",
    J20 = "J20",
    J21 = "J21",
    J22 = "J22",
    J23 = "J23",
    J24 = "J24",
    J25 = "J25",
    J26 = "J26",
    J27 = "J27",
    J28 = "J28",
    J29 = "J29",
    J30 = "J30",
    J31 = "J31",
    J32 = "J32",
    J33 = "J33",
    J34 = "J34",
    J35 = "J35",
    J36 = "J36",
    J37 = "J37",
    J38 = "J38",
    J39 = "J39",
    J40 = "J40",
    J41 = "J41",
    J42 = "J42",
    J43 = "J43",
    J44 = "J44",
    J45 = "J45",
    J46 = "J46",
    J47 = "J47",
    J48 = "J48",
    J49 = "J49",
    J50 = "J50"
}

export const enum OptionalJinnCardID {
    X01 = "X01",
    X02 = "X02",
    X03 = "X03",
    X04 = "X04",
    X05 = "X05",
    X06 = "X06",
    X07 = "X07"
}

export const enum OptionalSongCardID {
    X08 = "X08",
    X09 = "X09",
    X10 = "X10",
    X11 = "X11",
    X12 = "X12"
}

export const JinnEarlyCardID = [
    JinnBaseCardID.J01,
    JinnBaseCardID.J02,
    JinnBaseCardID.J03,
    JinnBaseCardID.J04,
    JinnBaseCardID.J05,
    JinnBaseCardID.J06,
    JinnBaseCardID.J07,
    JinnBaseCardID.J08,
    JinnBaseCardID.J09,
    JinnBaseCardID.J10,
    JinnBaseCardID.J11,
    JinnBaseCardID.J12,
    JinnBaseCardID.J13,
    JinnBaseCardID.J14,
    JinnBaseCardID.J15,
    JinnBaseCardID.J16,
];
export const JinnMidCardID = [
    JinnBaseCardID.J17,
    JinnBaseCardID.J18,
    JinnBaseCardID.J19,
    JinnBaseCardID.J20,
    JinnBaseCardID.J21,
    JinnBaseCardID.J22,
    JinnBaseCardID.J23,
    JinnBaseCardID.J24,
    JinnBaseCardID.J25,
    JinnBaseCardID.J26,
    JinnBaseCardID.J27,
    JinnBaseCardID.J28,
    JinnBaseCardID.J29,
    JinnBaseCardID.J30,
    JinnBaseCardID.J31,
    JinnBaseCardID.J32,
    JinnBaseCardID.J33,
    JinnBaseCardID.J34,
    JinnBaseCardID.J35,
    JinnBaseCardID.J36,
    JinnBaseCardID.J37,
    JinnBaseCardID.J38,
    JinnBaseCardID.J39,
    JinnBaseCardID.J40
];
export const JinnLateCardID = [
    JinnBaseCardID.J41,
    JinnBaseCardID.J42,
    JinnBaseCardID.J43,
    JinnBaseCardID.J44,
    JinnBaseCardID.J45,
    JinnBaseCardID.J46,
    JinnBaseCardID.J47,
    JinnBaseCardID.J48,
    JinnBaseCardID.J49,
    JinnBaseCardID.J50,

];

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
export const SongMidCardID = [
    SongBaseCardID.S17,
    SongBaseCardID.S18,
    SongBaseCardID.S19,
    SongBaseCardID.S20,
    SongBaseCardID.S21,
    SongBaseCardID.S22,
    SongBaseCardID.S23,
    SongBaseCardID.S24,
    SongBaseCardID.S25,
    SongBaseCardID.S26,
    SongBaseCardID.S27,
    SongBaseCardID.S28,
    SongBaseCardID.S29,
    SongBaseCardID.S30,
    SongBaseCardID.S31,
    SongBaseCardID.S32,
    SongBaseCardID.S33,
    SongBaseCardID.S34,
    SongBaseCardID.S35,
    SongBaseCardID.S36,
    SongBaseCardID.S37,
    SongBaseCardID.S38,
    SongBaseCardID.S39,
    SongBaseCardID.S40
];
export const SongLateCardID = [
    SongBaseCardID.S41,
    SongBaseCardID.S42,
    SongBaseCardID.S43,
    SongBaseCardID.S44,
    SongBaseCardID.S45,
    SongBaseCardID.S46,
    SongBaseCardID.S47,
    SongBaseCardID.S48,
    SongBaseCardID.S49,
    SongBaseCardID.S50
];


export const enum PlanID {
    J01 = "J01",
    J02 = "J02",
    J03 = "J03",
    J04 = "J04",
    J05 = "J05",
    J06 = "J06",
    J07 = "J07",
    J08 = "J08",
    J09 = "J09",
    J10 = "J10",
    J11 = "J11",
    J12 = "J12",
    J13 = "J13",
    J14 = "J14",
    J15 = "J15",
    J16 = "J16",
    J17 = "J17",
    J18 = "J18",
    J19 = "J19",
    J20 = "J20",
    J21 = "J21",
    J22 = "J22",
    J23 = "J23",
    J24 = "J24"
}

export const EarlyPlanID = [
    PlanID.J01,
    PlanID.J02,
    PlanID.J03,
    PlanID.J04,
    PlanID.J05,
    PlanID.J06
];
export const MidPlanID = [
    PlanID.J07,
    PlanID.J08,
    PlanID.J09,
    PlanID.J10,
    PlanID.J11,
    PlanID.J12,
    PlanID.J13,
    PlanID.J14,
    PlanID.J15,
    PlanID.J16,
    PlanID.J17,
    PlanID.J18
];
export const LatePlanID = [
    PlanID.J19,
    PlanID.J20,
    PlanID.J21,
    PlanID.J22,
    PlanID.J23,
    PlanID.J24
];

export type SJEventCardID = SongBaseCardID | JinnBaseCardID;

export enum GeneralStatus {
    PRE,
    TROOP,
    READY,
    REMOVED
}

export const enum SongGeneral {
    ZongZe = 0,
    YueFei = 1,
    HanShiZhong = 2,
    LiXianZhong = 3,
    WuJie = 4,
    WuLin = 5
}

export const enum JinnGeneral {
    WoLiBu = 0,
    ZhanHan = 1,
    LouShi = 2,
    WuZhu = 3,
    YinShuKe = 4,
    BenZhu = 5
}

export type General = SongGeneral | JinnGeneral;

export const enum EventDuration {
    INSTANT = "INSTANT",
    CONTINUOUS = "CONTINUOUS"
}

export enum SongUnit {
    Bu,
    Gong,
    Qi,
    Pao,
    Chuan,
    Bei
}

export enum JinnUnit {
    Bu = 0,
    Guai = 1,
    Tie = 2,
    ErChe = 3,
    Chuan = 4,
    Qian = 5,
    Qi = 6
}

export interface LetterOfCredence {
    nation: NationID;
    card: SJEventCardID;
}

export enum CityID {
    DaTong = "大同",
    DaDing = "大定",
    LiaoYang = "辽阳",
    XiJin = "析津",
    YangQu = "阳曲",
    LinFen = "临汾",
    ShangDang = "上党",
    ZhenDing = "真定",
    AnXi = "安喜",
    HeJian = "河间",
    YuanCheng = "元城",
    LiCheng = "历城",
    XuCheng = "须城",
    SongCheng = "宋城",
    Fushi = "肤施",
    TianXing = "天兴",
    ChangAn = "长安",
    LuoYang = "洛阳",
    WanQiu = "宛丘",
    XiangYang = "襄阳",
    KaiFeng = "开封",
    JiangDu = "江都",
    XiaCai = "下蔡",
    NanZhen = "南郑",
    ChengDu = "成都",
    QiXian = "郪县",
    JiangLing = "江陵",
    AnLu = "安陆",
    ChangSha = "长沙",
    JiangNing = "江宁",
    NanChang = "南昌",
    DanTu = "丹徒",
    WuXian = "吴县",
    QianTang = "钱塘",
    MinXian = "闽县",
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

export enum ProvinceID {
    XIJINGLU = "西京路",
    BEIJINGLU = "北京路",
    YANJINGLU = "燕京路",
    DONGJINGLU = "东京路",
    HEDONGLU = "河东路",
    HEBEILIANGLU = "河北两路",
    JINGDONGLIANGLU = "京东两路",
    JINGXILIANGLU = "京西两路",
    JINGJILU = "京畿路",
    HUAINANLIANGLU = "淮南两路",
    CHUANSHANSILU = "川陕四路",
    JINHULIANGLU = "荆湖两路",
    JIANGNANLIANGLU = "江南两路",
    LIANGZHELU = "两浙路",
    FUJIANLU = "福建路",
    SHANXILIULU = "陕西六路"
}

export const provinceToRegion = {
    [ProvinceID.XIJINGLU]: [RegionID.R01, RegionID.R02, RegionID.R03],
    [ProvinceID.BEIJINGLU]: [RegionID.R01, RegionID.R02, RegionID.R03],
    [ProvinceID.YANJINGLU]: [RegionID.R01, RegionID.R02, RegionID.R03],
}
