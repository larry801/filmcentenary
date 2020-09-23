export enum Region {
    NA,
    WE,
    EE,
    ASIA,
    NONE,
}

export enum CardType {
    E,
    F,
    S,
    P,
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
    cash: number,
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
    "E01"="E01"
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

export interface IPubInfo {
    action: number,
    cash: number,
    resource: number,
    archive: ICard[],
    allCards: ICard[],
    discard: ICard[],
    revealedHand: ICard[],
    industry: number,
    aesthetics: number,
    school: ICard | null,
    vp: number,
    shares: IPlayerShare,
    tempStudios:Region[],
    respondMark:{
        tempStudioRespond:boolean,
    }
}

export interface IPrivateInfo {
    hand: ICard[],
    filmAwardCandidate: ICard | null,
}

export interface IBuildingSlot {
    region:Region,
    content:string,
    activated: boolean,
    owner: string,
}

export interface IRegionInfo {
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


