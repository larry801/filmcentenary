import {CardCategory, CardType, cost, ICheck, ICost, IEffect, IEra, IEventCard, IFilmCard, IPersonCard} from "./core";


interface IArgFilmCard{
    name:string,
    cardId:string,
    cost:ICost,
    canArchive: ICheck | boolean,
    playable: ICheck | boolean,
    vp:number,
    category:CardCategory,
    industry: number,
    aesthetics: number,
}
interface IArgEvent{
    name:string,
    id:string,
    effect:IEffect,
    era:IEra,
}

export function filmCard(arg:IArgFilmCard
): IFilmCard{
    return {
        cost: arg.cost,
        canArchive: arg.canArchive,
        aesthetics: arg.aesthetics,
        cardId: arg.cardId,
        category: arg.category,
        industry: arg.industry,
        name: arg.name,
        playable: arg.playable,
        type: CardType.F,
        vp: arg.vp,
    }
}

export function personCard(arg:IArgFilmCard):IPersonCard{
    return {
        type:CardType.P, industry: arg.industry,
        vp: arg.vp,
        playable: arg.playable,
        canArchive: arg.canArchive,
        cost: arg.cost,
        name:arg.name,
        cardId: arg.cardId,
        category: arg.category,
        aesthetics:arg.aesthetics
    }
}

export function eventCard(arg:IArgEvent): IEventCard{
    return {
        cost: cost(0,0,0),
        category: CardCategory.BASIC,
        era:arg.era,
        name:arg.name,
        effect:arg.effect,
        type:CardType.E,
        cardId:arg.id
    }
}
