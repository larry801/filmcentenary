import {Ctx} from "boardgame.io";
import {shuffle} from "../../game/util";

export const MAX_ROUND = 8;
export const MAX_DICES = 30;

export enum PendingEvents {
    XiJunQuDuan = "西军曲端",
    MengAnMouKe = "猛安谋克",
    FuHaiTaoSheng = "浮海逃生",
    HanFang = "韩昉",
    JiaBeng = "金太宗驾崩",
    WeiQi = "废黜伪齐",
    ZhangZhaoZhiZheng = "张赵之争",
    BingShi = "病逝",
    LoseCorruption = "丢失国力",
    MergeORSiege = "会战攻城",
    HuFuXiangBing = "胡服乡兵",
    YueFeiZhuDuiShi = "岳飞",
    JianSunZhuDuiShi = "减损",

}

export enum MarchDstStatus {
    INVALID = "无法进军",
    SIEGE = "攻城",
    JIE_DAO = "借道",
    YE_ZHAN = "野战",
    HUI_ZHAN = "会战",
    XIAO_MIE = "直接消灭",
    YI_DONG = "移动",
    HE_BING = "合兵",
    SIEGE_ATTACK = "围困/攻城",
    FIELD_OR_NOT = "对方选择接野",
}

export enum ActiveEvents {
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
    LiuJiaShenBing = "六甲神兵",
    HeMianFengDong = "河面封冻",
    LueDuo = "掠夺",
    LiaoGuoJiuBu = "辽国旧部",
    MengAnMouKe = "猛安谋克",
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
    SearchCard = "检索",
    TwoPlan = "可选两张计划",
    FourDevelopPoint = "四点发展",
}

export interface Troop {
    p: TroopPlace,
    c: CityID | null,
    u: number[],
    g: Country
}

//
// export enum MarchResult {
//     MOVE,
//     MERGE,
//     OVERFLOW,
//     JOINT,
//     ELIMINATE,
//     RIVER,
// }

export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const enum VictoryReason {
    ShaoXingHeYi = "绍兴和议",
    PowerOfNation = "国力",
    StrategicPlan = "作战计划",
    WuShanLiMa = "吴山立马",
    HuanWoHeShan = "还我河山",
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

export const enum CityState {
    SONG = "受金控制",
    JINN = "受宋控制",
    NEUTRAL = "无人控制"
}

export const enum ProvinceState {
    SONG = "宋控制",
    JINN = "金控制",
    NEUTRAL = "战争状态"
}

export const enum NationState {
    SONG = "盟金",
    JINN = "盟宋",
    NEUTRAL = "中立"
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
    POLICY_UP = "提升政策",
    POLICY_DOWN = "降低政策",
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
    FLATLAND = "平原",
    HILLS = "丘陵",
    MOUNTAINS = "山地",
    SWAMP = "水泽",
    RAMPART = "城墙",
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

export const OptJinnLateCardID = [
    JinnBaseCardID.J41,
    JinnBaseCardID.J42,
    OptionalJinnCardID.X07,
    JinnBaseCardID.J44,
    JinnBaseCardID.J45,
    JinnBaseCardID.J46,
    JinnBaseCardID.J47,
    OptionalJinnCardID.X06,
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

export const OptSongEarlyCardID = [
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
    SongBaseCardID.S16,
    OptionalSongCardID.X08,
    OptionalSongCardID.X11
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

export const OptSongMidCardID = [
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
    SongBaseCardID.S40,
    OptionalSongCardID.X09
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

export const OptSongLateCardID =
    [
    SongBaseCardID.S41,
    SongBaseCardID.S42,
    SongBaseCardID.S43,
    SongBaseCardID.S44,
    SongBaseCardID.S45,
    OptionalSongCardID.X10,
    OptionalSongCardID.X12,
    SongBaseCardID.S47,
    SongBaseCardID.S48,
    SongBaseCardID.S49,
    SongBaseCardID.S50
];


export enum PlanID {
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

export const SpecialPlan = [PlanID.J23, PlanID.J24];

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

export enum SongGeneral {
    ZongZe = 0,
    YueFei = 1,
    HanShiZhong = 2,
    LiXianZhong = 3,
    WuJie = 4,
    WuLin = 5
}

export enum JinnGeneral {
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
    R02DaTonFu,
    WuShuo2Zhou03,
    R04,
    R05,
    R06,
    R07,
    R08,
    R09,
    R10,
    R11PingYangFu,
    R12LongDeFu,
    R13,
    R14ZhongShanFu,
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


export interface SJPubInfo {
    lodNations: NationID[],
    specialPlan: number,
    generalSkill: boolean[],
    generalPlace: TroopPlace[],
    dices: number [][],
    troopIdx: number,
    cities: CityID[],
    civil: Level,
    maxCivil: Level,
    completedPlan: PlanID[],
    corruption: number;
    nations: NationID[];
    develop: SJEventCardID[],
    discard: SJEventCardID[],
    effect: PlayerPendingEffect[],
    emperor: CityID | null,
    generals: GeneralStatus[],
    maxMilitary: Level,
    military: Level,
    plan: PlanID[],
    provinces: ProvinceID[],
    ready: number[],
    remove: SJEventCardID[],
    standby: number[],
    troops: Troop[],
    usedDevelop: number,
    handCount: number
}


export const enum CombatType {
    SIEGE = "攻城",
    RESCUE = "解围",
    FIELD = "野战",
    BREAKOUT = "突围"
}


export interface CountryCombatInfo {
    troop: Troop,
    combatCard: SJEventCardID[],
    choice: BeatGongChoice,
    damageLeft: number,
}

export const enum BeatGongChoice {
    CONTINUE = "继续",
    STALEMATE = "相持",
    RETREAT = "撤退",
    NO_FORCE_ROUND_TWO = "不强制第二轮"
}

export interface CombatInfo {
    phase: CombatPhase,
    atk: Country,
    type: CombatType,
    pass: MountainPassID | null,
    region: RegionID | null,
    city: CityID | null,
    song: CountryCombatInfo,
    jinn: CountryCombatInfo,
    roundTwo: boolean,
    ongoing: boolean
}


export function emptySongTroop(): Troop {
    return {
        p: RegionID.R01,
        g: Country.SONG,
        c: null,
        u: [0, 0, 0, 0, 0, 0]
    }
}

export function emptyJinnTroop(): Troop {
    return {
        p: RegionID.R01,
        g: Country.JINN,
        c: null,
        u: [0, 0, 0, 0, 0, 0, 0]
    }
}

export enum CombatPhase {
    JieYe = "接野",
    WeiKun = "围困",
    YunChou = "运筹",
    ZhuDuiShiY = "驻队矢远程",
    YuanCheng = "远程",
    YuanChengDamage = "远程受创",
    WuLin = "吴璘",
    ZhuDuiShiJFSong = "驻队矢交锋",
    ZhuDuiShiJ2 = "驻队矢交锋2",
    JiaoFeng = "交锋",
    JiaoFengDamage = "交锋受创",
    MingJin = "鸣金",
}

export function emptyCombatInfo(): CombatInfo {
    return {
        phase: CombatPhase.JieYe,
        atk: Country.JINN,
        type: CombatType.FIELD,
        region: null,
        pass: null,
        city: null,
        ongoing: false,
        roundTwo: false,
        song: {
            choice: BeatGongChoice.CONTINUE,
            troop: emptySongTroop(),
            combatCard: [],
            damageLeft: 0,
        },
        jinn: {
            choice: BeatGongChoice.CONTINUE,
            troop: emptyJinnTroop(),
            combatCard: [],
            damageLeft: 0,
        }
    }
}

export const initialJinnPub: SJPubInfo = {
    lodNations: [],
    maxCivil: 2,
    maxMilitary: 3,
    specialPlan: 0,
    generalSkill: [true, true, true, false, false, true],
    generalPlace: [RegionID.R20, RegionID.R37, RegionID.R11PingYangFu, RegionID.R01, RegionID.R01, RegionID.R01],
    dices: [],
    troopIdx: -1,
    develop: [],
    usedDevelop: 0,
    troops: [
        {u: [1, 2, 1, 0, 1, 0, 0], p: RegionID.R20, c: null, g: Country.JINN},
        {u: [2, 0, 0, 0, 0, 0, 0], p: RegionID.R11PingYangFu, c: CityID.LinFen, g: Country.JINN},
        {u: [2, 2, 1, 0, 0, 0, 0], p: RegionID.R37, c: CityID.LuoYang, g: Country.JINN},

        {u: [1, 0, 1, 0, 1, 0, 0], p: RegionID.R06, c: CityID.LiaoYang, g: Country.JINN},

        {u: [0, 0, 0, 0, 0, 1, 0], p: RegionID.R10, c: CityID.YangQu, g: Country.JINN},
        {u: [0, 0, 0, 0, 0, 1, 0], p: RegionID.R12LongDeFu, c: CityID.ShangDang, g: Country.JINN},
        {u: [0, 0, 0, 0, 0, 1, 0], p: RegionID.R13, c: CityID.AnXi, g: Country.JINN},

        {u: [0, 0, 0, 0, 0, 1, 0], p: RegionID.R14ZhongShanFu, c: CityID.ZhenDing, g: Country.JINN},
        {u: [0, 0, 0, 0, 0, 1, 0], p: RegionID.R15, c: CityID.HeJian, g: Country.JINN},


        {u: [4, 0, 0, 0, 0, 0, 0], p: RegionID.R18, c: CityID.YuanCheng, g: Country.JINN},
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
        ProvinceID.YANJINGLU,
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
    ],
    handCount: 0
}
export const initialSongPub: SJPubInfo = {
    lodNations: [],
    maxCivil: 3,
    maxMilitary: 2,
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
        ProvinceID.JINGJILU,
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
        {u: [2, 2, 0, 0, 0, 0], p: RegionID.R19, c: null, g: Country.SONG},
        {u: [2, 3, 0, 0, 0, 0], p: RegionID.R43, c: CityID.KaiFeng, g: Country.SONG},
        {u: [0, 1, 0, 0, 0, 0], p: RegionID.R21, c: CityID.LiCheng, g: Country.SONG},
        {u: [0, 1, 0, 0, 0, 0], p: RegionID.R28, c: CityID.SongCheng, g: Country.SONG},

        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R32, c: CityID.Fushi, g: Country.SONG},
        {u: [0, 1, 0, 0, 0, 0], p: RegionID.R33, c: CityID.TianXing, g: Country.SONG},

        {u: [1, 1, 1, 0, 0, 0], p: RegionID.R36, c: CityID.ChangAn, g: Country.SONG},
        {u: [2, 1, 0, 0, 0, 0], p: RegionID.R42, c: CityID.XiangYang, g: Country.SONG},

        {u: [0, 0, 0, 1, 0, 0], p: RegionID.R72, c: CityID.DanTu, g: Country.SONG},
        {u: [1, 0, 0, 1, 0, 0], p: RegionID.R46, c: CityID.JiangDu, g: Country.SONG},
        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R48, c: CityID.XiaCai, g: Country.SONG},
        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R54, c: CityID.ChengDu, g: Country.SONG},

        {u: [0, 0, 0, 1, 0, 0], p: RegionID.R60, c: CityID.JiangLing, g: Country.SONG},
        {u: [0, 1, 0, 0, 0, 0], p: RegionID.R66, c: CityID.JiangNing, g: Country.SONG},
        {u: [1, 0, 0, 0, 0, 0], p: RegionID.R77, c: CityID.MinXian, g: Country.SONG},

    ],
    usedDevelop: 0,
    handCount: 0
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
    matchID: string,
    mode: boolean[],
    pending: {
        events: PendingEvents[],
        regions: RegionID[],
        cities: CityID[],
        places: TroopPlace[],
        generals: General[],
        cards: SJEventCardID[],
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
    combat: CombatInfo,
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
        matchID: "default",
        mode: [false, false, false],
        pending: {
            events: [],
            regions: [],
            cities: [],
            places: [],
            generals: [],
            cards: [],
        },
        qi: [],
        op: 0,
        plans: [],
        dices: [],
        removedNation: [],
        // start from action phase for debugging
        order: [SJPlayer.P1, SJPlayer.P2],
        // order: [SJPlayer.P1],
        combat: emptyCombatInfo(),
        events: [],
        round: 1,
        turn: 1,
        first: SJPlayer.P1,
        policy: -2,
        colony: 0,
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
    G.player[SJPlayer.P2].hand = jinnDeck.slice(-6);
    G.secret.songDeck = songDeck.slice(0, 7);
    G.secret.jinnDeck = jinnDeck.slice(0, 10);
    console.log(G.secret.songDeck.toString());
    console.log(G.secret.jinnDeck.toString());
    // //
    // G.player['1'].hand.push(JinnBaseCardID.J17);
    // G.player['1'].hand.push(JinnBaseCardID.J03);
    // G.player['0'].hand.push(SongBaseCardID.S17);
    // G.player['0'].hand.push(SongBaseCardID.S30);

    return G;
}