export enum Region {
    NA,
    WE,
    EE,
    ASIA,
    NONE,
}

export enum CardType {
    E,//event
    F,//film
    S,//school
    P,//people
    V,//scoring
}

export interface ICardSlot {
    region: Region,
    isLegend:boolean,
    card:INormalOrLegendCard|null
    comment: IBasicCard|null,
}

export enum IEra {
    ONE,
    TWO,
    THREE,
}

export interface IEffect {

}

export interface IBuyInfo {
    buyer: string,
    target: ICard,
    resource: number,
    deposit: number,
    helper: ICard[],
}

export enum CardCategory {
    SCORE,
    BASIC,
    NORMAL,
    LEGEND,
}

export interface ICard {
    cost:ICost,
    cardId: string,
    name: string,
    region:Region,
    type: CardType,
    category: CardCategory,
}

export function cost(r:number, i:number, a:number): ICost{
    return {
        res:r,
        industry:i,
        aesthetics:a,
    }
}

export interface INormalOrLegendCard extends ICard{
    readonly category: CardCategory,
    readonly type: CardType,
    cost: ICost,
    vp: number,
    industry: number,
    aesthetics: number,
    region: Region,
    era: IEra,
}

export interface IBasicCard extends ICard{
    readonly category: CardCategory.BASIC,
    cost: ICost,
    vp: number,
    industry: number,
    aesthetics: number,
}
export interface ISchoolCard extends INormalOrLegendCard{
    readonly type: CardType.S,
}
export interface IFilmCard extends INormalOrLegendCard {
    readonly type: CardType.F,
}


export enum EventCardID{
    "E01"="E01",
    "E02"="E02",
    "E03"="E03",
    "E04"="E04",
    "E05"="E05",
    "E06"="E06",
    "E07"="E07",
    "E08"="E08",
    "E09"="E09",
    "E10"="E10",
    "E11"="E11",
    "E12"="E12",
    "E13"="E13",
    "E14"="E14",
}
export enum NormalOrLegendCardID{
    "p1101"="1101"
}

export enum BasicCardID{
    "B01"="B01",
    "B02"="B02",
    "B03"="B03",
    "B04"="B04",
    "B05"="B05",
    "B06"="B06",
    "B07"="B07",
}
export interface IEventCard extends ICard {
    era: IEra,
    effect: IEffect,
}

export interface IPersonCard extends INormalOrLegendCard {
    readonly type:CardType.P,
}

export interface ICost {
    res: number,
    industry: number,
    aesthetics: number,
}

export interface IScoreCard extends ICard {
    era:IEra,
    region:Region,
}

export interface IPlayerShare {
    0: number,
    1: number,
    2: number,
    3: number,
}

export interface Champion{
    era:IEra,
    region:Region,
}
export enum MainAction {
    play,
    breakthrough,
    buyCard,
    drawCard,
    scoring,
}
export interface IPubInfo {
    discardInSettle:boolean,
    scoreEvents:EventCardID[],
    vpAward:{
        v60:boolean,
        v90:boolean,
        v120:boolean,
        v150:boolean,
    },
    champions:Champion[],
    building:{
        cinemaBuilt:boolean,
        studioBuilt:boolean,
    }
    action: number,
    deposit: number,
    resource: number,
    archive: ICard[],
    allCards: ICard[],
    discard: ICard[],
    revealedHand: ICard[],
    playedCardInTurn: ICard[],
    industry: number,
    aesthetics: number,
    school: ISchoolCard | null,
    vp: number,
    shares: IPlayerShare,
    tempStudios:Region[],
    respondMark:{
        tempStudioRespond:boolean,
        eventRespond: boolean,
    }
}

export interface IPrivateInfo {
    hand: ICard[],
    handSize:number,
    finalScoringExtraVp:number,
    cardsToPeek:ICard[],
    competitionCards:ICard[]
}

export interface IBuildingSlot {
    region:Region,
    content:string,
    isCinema:boolean
    activated: boolean,
    owner: string,
}

export interface IRegionInfo {
    completedModernScoring:boolean,
    era: IEra,
    buildings: IBuildingSlot[],
    share: number,
    legend: ICardSlot,
    normal: ICardSlot[],
}

export interface IRegionPrivate {
    legendDeck:INormalOrLegendCard[],
    normalDeck:INormalOrLegendCard[],
}


export enum ScoreCardID {
    'V111'='V111',
    'V112'='V112',
    'V113'='V113',
    'V121'='V121',
    'V122'='V122',
    'V123'='V123',
    'V131'='V131',
    'V132'='V132',
    'V211'='V211',
    'V212'='V212',
    'V213'='V213',
    'V221'='V221',
    'V222'='V222',
    'V223'='V223',
    'V231'='V231',
    'V232'='V232',
    'V241'='V241',
    'V242'='V242',
    'V243'='V243',
    'V311'='V311',
    'V312'='V312',
    'V313'='V313',
    'V321'='V321',
    'V322'='V322',
    'V323'='V323',
    'V331'='V331',
    'V332'='V332',
    'V333'='V333',
    'V341'='V341',
    'V342'='V342',
}

export enum NoneBasicCardID {
    'P1101'='P1101',
    'P1102'='P1102',
    'F1103'='F1103',
    'F1104'='F1104',
    'F1105'='F1105',
    'F1106'='F1106',
    'F1107'='F1107',
    'F1108'='F1108',
    'F1109'='F1109',
    'F1110'='F1110',
    'P1201'='P1201',
    'P1202'='P1202',
    'S1203'='S1203',
    'S1204'='S1204',
    'F1205'='F1205',
    'F1206'='F1206',
    'F1207'='F1207',
    'F1208'='F1208',
    'F1209'='F1209',
    'F1210'='F1210',
    'F1211'='F1211',
    'S1301'='S1301',
    'P1302'='P1302',
    'S1303'='S1303',
    'F1304'='F1304',
    'F1305'='F1305',
    'F1306'='F1306',
    'F1307'='F1307',
    'S2101'='S2101',
    'P2102'='P2102',
    'P2103'='P2103',
    'F2104'='F2104',
    'P2105'='P2105',
    'F2106'='F2106',
    'F2107'='F2107',
    'F2108'='F2108',
    'F2109'='F2109',
    'F2110'='F2110',
    'F2111'='F2111',
    'F2112'='F2112',
    'F2113'='F2113',
    'F2114'='F2114',
    'S2201'='S2201',
    'P2202'='P2202',
    'P2203'='P2203',
    'S2204'='S2204',
    'P2205'='P2205',
    'F2206'='F2206',
    'F2207'='F2207',
    'F2208'='F2208',
    'F2209'='F2209',
    'F2210'='F2210',
    'F2211'='F2211',
    'F2212'='F2212',
    'F2213'='F2213',
    'F2214'='F2214',
    'S2301'='S2301',
    'P2302'='P2302',
    'F2303'='F2303',
    'F2304'='F2304',
    'F2305'='F2305',
    'F2306'='F2306',
    'F2307'='F2307',
    'F2308'='F2308',
    'F2309'='F2309',
    'P2401'='P2401',
    'P2402'='P2402',
    'F2403'='F2403',
    'F2404'='F2404',
    'F2405'='F2405',
    'F2406'='F2406',
    'F2407'='F2407',
    'F2408'='F2408',
    'F2409'='F2409',
    'F2410'='F2410',
    'S3101'='S3101',
    'P3102'='P3102',
    'F3103'='F3103',
    'F3104'='F3104',
    'S3105'='S3105',
    'F3106'='F3106',
    'F3107'='F3107',
    'F3108'='F3108',
    'F3109'='F3109',
    'F3110'='F3110',
    'F3111'='F3111',
    'F3112'='F3112',
    'F3113'='F3113',
    'F3114'='F3114',
    'F3115'='F3115',
    'F3116'='F3116',
    'S3201'='S3201',
    'P3202'='P3202',
    'P3203'='P3203',
    'S3204'='S3204',
    'F3205'='F3205',
    'F3206'='F3206',
    'F3207'='F3207',
    'F3208'='F3208',
    'F3209'='F3209',
    'F3210'='F3210',
    'F3211'='F3211',
    'F3212'='F3212',
    'F3213'='F3213',
    'P3301'='P3301',
    'P3302'='P3302',
    'F3303'='F3303',
    'F3304'='F3304',
    'F3305'='F3305',
    'F3306'='F3306',
    'F3307'='F3307',
    'F3308'='F3308',
    'F3309'='F3309',
    'F3310'='F3310',
    'F3311'='F3311',
    'F3312'='F3312',
    'P3401'='P3401',
    'P3402'='P3402',
    'P3403'='P3403',
    'F3404'='F3404',
    'F3405'='F3405',
    'F3406'='F3406',
    'F3407'='F3407',
    'F3408'='F3408',
    'F3409'='F3409',
    'F3410'='F3410',
    'F3411'='F3411',
    'F3412'='F3412',
    'F3413'='F3413',
    'F3414'='F3414',
}
export type validRegion = Region.NA | Region.WE| Region.EE| Region.ASIA;
export const ValidRegions:validRegion[] = [Region.NA, Region.WE, Region.EE, Region.ASIA];

export const ShareOnBoard = {
    0:[6,9,12],
    1:[6,9,10],
    2:[4,6,8],
    3:[0,6,10],
}
export const LegendCardCountInUse = {
    0:[1,2,3],
    1:[1,1,2],
    2:[1,1,2],
    3:[0,1,2],
}
export const NormalCardCountInUse = {
    0:[5,7,9],
    1:[5,7,8],
    2:[3,5,6],
    3:[0,5,8],
}
