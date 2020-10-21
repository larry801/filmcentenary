import {PlayerID} from "boardgame.io";

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
export type CardID = BasicCardID|ClassicCardID|ScoreCardID|EventCardID;
export interface ICardSlot {
    region: Region,
    isLegend:boolean,
    card: ClassicCardID|null
    comment: BasicCardID|null,
}

export enum IEra {
    ONE,
    TWO,
    THREE,
}

export interface IEffect {
    e:EffectNames,
    a:number|CardID|IEffect[]
}

export interface IBuyInfo {
    buyer: PlayerID,
    target: CardID,
    resource: number,
    deposit: number,
    helper: CardID[],
}

export enum CardCategory {
    SCORE,
    BASIC,
    NORMAL,
    LEGEND,
}

export interface ICard {
    cost:ICost,
    cardId: CardID,
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

export type EffectNames  = SimpleEffectNames|ScoringEffectNames|NoExecutorEffectNames|InteractiveEffectNames;
export enum InteractiveEffectNames {
    aestheticsLevelUpCost="aestheticsLevelUpCost",
    industryLevelUpCost="industryLevelUpCost",
    payAdditionalCost="payAdditionalCost",
    buildingNA="buildingNA",
    era="era",
    breakthroughResDeduct="breakthroughResDeduct",
    alternative="alternative",
    competition="competition",
    loseAnyRegionShare="loseAnyRegionShare",
    anyRegionShare="anyRegionShare",
    anyRegionShareCentral="anyRegionShareCentral",
    noBuildingEE="noBuildingEE",
    vpNotHighestPlayer="vpNotHighestPlayer",
    highestVpPlayer="highestVpPlayer",
    aesLowest="aesLowest",
    industryLowest="industryLowest",
    handToOthers="handToOthers",
    industryOrAestheticsBreakthrough="industryOrAestheticsBreakthrough",
    peek="peek",
    everyOtherCompany="everyOtherCompany",
    everyPlayer="everyPlayer",
    noStudio="noStudio",
    studio="studio",
    step="step",
    discardNormalOrLegend="discardNormalOrLegend",
    discardLegend="discardLegend",
    discardAesthetics="discardAesthetics",
    discardIndustry="discardIndustry",
    refactor="refactor",
    archive="archive",
    discard="discard",
    choice="choice",
    update="update",
    comment="comment",
    pay="pay",
    optional="optional",
    industryOrAestheticsLevelUp="industryOrAestheticsLevelUp",
    archiveToEEBuildingVP="archiveToEEBuildingVP",
}

export enum BuildingType {
    cinema="cinema",
    studio="studio",
}

export enum VictoryType {
    threeNAChampionAutoWin="threeNAChampionAutoWin",
    championCountAutoWin="championCountAutoWin",
    finalScoring="finalScoring",
}

export enum MoveNames {
    requestEndTurn="requestEndTurn",
    showBoardStatus = "showBoardStatus",
    chooseEffect = "chooseEffect",
    chooseEvent = "chooseEvent",
    chooseHand = "chooseHand",
    chooseRegion = "chooseRegion",

}
export enum SimpleEffectNames {
    shareToVp= "shareToVp",
    none="none",
    "skipBreakthrough"="skipBreakthrough",
    "loseVpForEachHand"="loseVpForEachHand",
    aestheticsToVp="aestheticsToVp",
    industryToVp="industryToVp",
    resFromIndustry="resFromIndustry",
    enableHollywood="enableHollywood",
    enableBollywood="enableBollywood",
    loseVp="loseVp",
    loseShareNA="loseShareNA",
    shareNA="shareNA",
    loseShareWE="loseShareWE",
    shareWE="shareWE",
    loseShareEE="loseShareEE",
    shareEE="shareEE",
    loseShareASIA="loseShareASIA",
    shareASIA="shareASIA",
    deposit="deposit",
    res="res",
    vp="vp",
    addVp="addVp",
    addExtraVp="addExtraVp",
    draw="draw",
    buy="buy",
    buyCardToHand="buyCardToHand",
    aestheticsLevelUp="aestheticsLevelUp",
    industryLevelUp="industryLevelUp",
    industryAward="industryAward",
    aesAward="aesAward",

}
export enum ScoringEffectNames {
    threeCards="threeCards",
    aesClassic="aesClassic",
    northAmericaFilm="northAmericaFilm",
    asiaFilm="asiaFilm",
    industryNormalOrLegend="industryNormalOrLegend",
    westEuropeCard="westEuropeCard",
    eastEuropeFilm="eastEuropeFilm",
    industryLevel="industryLevel",
    aestheticsLevel="aestheticsLevel",
    personCard="personCard",
    allNoStudioPlayer = "allNoStudioPlayer",

}
export enum NoExecutorEffectNames {
    onYourComment="onYourComment",
    playedCardInTurnEffect="playedCardInTurnEffect",
    doNotLoseVpAfterCompetition="doNotLoseVpAfterCompetition",
    NewYorkSchool = "NewYorkSchool",
    obtainNormalOrLegendFilm = "obtainNormalOrLegendFilm",
    atBreakthrough = "atBreakthrough",
    buyNoneEEFilm = "buyNoneEEFilm",
    extraVp = "extraVp",
    breakthroughPrevent="breakthroughPrevent",
    searchAndArchive = "searchAndArchive",
    deductRes = "deductRes",
    buyAesthetics = "buyAesthetics",
    extraEffect = "extraEffect",
    loseVpRespond = "loseVpRespond",
    othersBuySchool = "othersBuySchool",
    turnStart = "turnStart",

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
    effect: any,
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
    finalScoring:{
        card:number,
        building:number,
        industryAward:number,
        aestheticsAward:number,
        archive:number,
        events:number,
        total:number,
    },
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
    archive: CardID[],
    allCards: CardID[],
    discard: CardID[],
    revealedHand: CardID[],
    playedCardInTurn: CardID[],
    industry: number,
    aesthetics: number,
    school: SchoolCardID | null,
    vp: number,
    shares: IPlayerShare,
    tempStudios:Region[],
    respondMark:{
        tempStudioRespond:boolean,
        eventRespond: boolean,
    }
}

export interface IPrivateInfo {
    hand: CardID[],
    handSize:number,
    finalScoringExtraVp:number,
    cardsToPeek:CardID[],
    competitionCards:CardID[],
    deckEmpty:boolean,
}

export interface IBuildingSlot {
    region:Region,
    building:BuildingType|null,
    activated: boolean,
    owner: PlayerID,
}

export interface IRegionInfo {
    completedModernScoring:boolean,
    era: IEra,
    buildings: IBuildingSlot[],
    share: number,
    legend: ICardSlot,
    legendDeckLength:number,
    normal: ICardSlot[],
    normalDeckLength:number,
}

export interface IRegionPrivate {
    legendDeck:ClassicCardID[],
    normalDeck:ClassicCardID[],
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

export const SimpleRuleNumPlayers = 1;

export enum SchoolCardID {
    'S1203'='S1203',
    'S1204'='S1204',
    'S1301'='S1301',
    'S1303'='S1303',
    'S2101'='S2101',
    'S2104'='S2104',
    'S2201'='S2201',
    'S2204'='S2204',
    'S2301'='S2301',
    'S3101'='S3101',
    'S3105'='S3105',
    'S3201'='S3201',
    'S3204'='S3204',
}
export enum PersonCardID {
    'P1101'='P1101',
    'P1102'='P1102',
    'P1201'='P1201',
    'P1202'='P1202',
    'P1302'='P1302',
    'P2102'='P2102',
    'P2103'='P2103',
    'P2105'='P2105',
    'P2202'='P2202',
    'P2203'='P2203',
    'P2205'='P2205',
    'P2302'='P2302',
    'P2401'='P2401',
    'P2402'='P2402',
    'P3102'='P3102',
    'P3202'='P3202',
    'P3203'='P3203',
    'P3301'='P3301',
    'P3302'='P3302',
    'P3401'='P3401',
    'P3402'='P3402',
    'P3403'='P3403',
}
export enum FilmCardID {
    'F1103'='F1103',
    'F1104'='F1104',
    'F1105'='F1105',
    'F1106'='F1106',
    'F1107'='F1107',
    'F1108'='F1108',
    'F1109'='F1109',
    'F1110'='F1110',
    'F1205'='F1205',
    'F1206'='F1206',
    'F1207'='F1207',
    'F1208'='F1208',
    'F1209'='F1209',
    'F1210'='F1210',
    'F1211'='F1211',
    'F1304'='F1304',
    'F1305'='F1305',
    'F1306'='F1306',
    'F1307'='F1307',
    'F2106'='F2106',
    'F2107'='F2107',
    'F2108'='F2108',
    'F2109'='F2109',
    'F2110'='F2110',
    'F2111'='F2111',
    'F2112'='F2112',
    'F2113'='F2113',
    'F2114'='F2114',
    'F2206'='F2206',
    'F2207'='F2207',
    'F2208'='F2208',
    'F2209'='F2209',
    'F2210'='F2210',
    'F2211'='F2211',
    'F2212'='F2212',
    'F2213'='F2213',
    'F2214'='F2214',
    'F2303'='F2303',
    'F2304'='F2304',
    'F2305'='F2305',
    'F2306'='F2306',
    'F2307'='F2307',
    'F2308'='F2308',
    'F2309'='F2309',
    'F2403'='F2403',
    'F2404'='F2404',
    'F2405'='F2405',
    'F2406'='F2406',
    'F2407'='F2407',
    'F2408'='F2408',
    'F2409'='F2409',
    'F2410'='F2410',
    'F3103'='F3103',
    'F3104'='F3104',
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
    'F3205'='F3205',
    'F3206'='F3206',
    'F3207'='F3207',
    'F3208'='F3208',
    'F3209'='F3209',
    'F3210'='F3210',
    'F3211'='F3211',
    'F3212'='F3212',
    'F3213'='F3213',
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
export const AllClassicCards = {
    ...SchoolCardID,
    ...PersonCardID,
    ...FilmCardID
}

export type ClassicCardID = SchoolCardID|PersonCardID|FilmCardID


export type validRegion = Region.NA | Region.WE| Region.EE| Region.ASIA;
export const ValidRegions:validRegion[] = [Region.NA, Region.WE, Region.EE, Region.ASIA];

export const twoPlayerCardOnBoard = {
    0:{school:2,film:11},
    1:{school:3,film:18},
    2:{school:2,film:12},
}

export const ShareOnBoard = {
    0:[6,9,12],
    1:[6,9,10],
    2:[4,6,8],
    3:[0,6,10],
}
export const LegendCardCountInUse = {
    0:[1,2,3],
    1:[1,2,2],
    2:[1,1,2],
    3:[0,1,2],
}
export const NormalCardCountInUse = {
    0:[5,7,9],
    1:[5,7,8],
    2:[3,5,6],
    3:[0,5,8],
}
