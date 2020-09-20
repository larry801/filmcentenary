import {Ctx} from "boardgame.io";

export enum Region {
    NA,
    WE,
    EE,
    ASIA
}

export enum CardType {
    E,
    F,
    S,
    P,
    B
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

export interface ICheck {
    (g: any, ctx: Ctx, p: string): boolean;
}

export interface IBuyInfo {
    buyer: string,
    target: ICard,
    resource: number,
    cash: number,
    helper: ICard[],
}

export interface IBuyCard {
    (G: any, ctx: Ctx, info: IBuyInfo): boolean;
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
    type: CardType,
    category: CardCategory,
}

export interface IMovieCard extends ICard{
    vp:number,
    cost:ICost,
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
    cost: ICost,
    vp: number,
    effect: any,
    industry: number,
    aesthetics: number,
    region:Region,
}

export interface IBasicCard extends ICard {
    readonly category: CardCategory.BASIC,
    cost: ICost,
    vp: number,
    effect: any,
    industry: number,
    aesthetics: number,
}

export interface IFilmCard extends ICard {
    readonly type: CardType.F,
    vp: number,
    industry: number,
    aesthetics: number,
    playable: ICheck | boolean,
    canArchive: ICheck | boolean,
}

export interface IEventCard extends ICard {
    era: IEra,
    effect: IEffect,
}

export interface IPersonCard extends ICard {
    aesthetics:number,
    industry:number,
    vp: number,
    playable: ICheck | boolean,
    canArchive: ICheck | boolean,
    cost: ICost,
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
    NA: number,
    WE: number,
    EE: number,
    ASIA: number,
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
    legendDeck:ICard[],
    normalDeck:ICard[],
}

export interface Setup {
    pub: IPubInfo[],
    player: IPrivateInfo[],
    eventDeck:IEventCard[],
    secret: {
        eventDeck: IEventCard[],
        regionDeck: any,
    }
}


