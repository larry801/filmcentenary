import {BasicCardID, CardCategory, CardType, cost, IBasicCard, Region} from "../../types/core";

export const B01:IBasicCard={
    region:Region.NONE,
    aesthetics: 1, cardId: BasicCardID.B01,
    cost: cost(2,0,0),
    industry: 0,
    type: CardType.F,
    vp: 0,
    name:"Literary Film",
    category:CardCategory.BASIC
}
export const B02:IBasicCard={
    region:Region.NONE,
    aesthetics: 0, cardId: BasicCardID.B02,
    cost: cost(2,0,0),
    industry: 1,
    type: CardType.F,
    vp: 0,
    name:"Commercial Film",
    category:CardCategory.BASIC
}
export const B03:IBasicCard={
    aesthetics: 0, cardId: BasicCardID.B03,
    cost: cost(2,0,0),
    region:Region.NONE,
    industry: 0,
    type: CardType.F,
    vp: 0,
    name:"B-Movie",
    category:CardCategory.BASIC
}
export const B04:IBasicCard={
    aesthetics: 0, cardId: BasicCardID.B04,
    cost: cost(0,0,0),
    industry: 0,
    type: CardType.F,
    vp: -3,
    region:Region.NONE,
    name:"Bad Film",
    category:CardCategory.BASIC
}
export const B05:IBasicCard={
    aesthetics: 1, cardId: BasicCardID.B05,
    cost: cost(6,1,1),
    industry: 1,
    type: CardType.F,
    vp: 3,
    name:"Classic Film",
    category:CardCategory.BASIC,
    region:Region.NONE,
}
export const B06:IBasicCard={
    aesthetics: 1, cardId: BasicCardID.B06,
    cost: cost(6,1,1),
    industry: 1,
    type: CardType.F,
    vp: 3,
    name:"Classic Film",
    category:CardCategory.BASIC,
    region:Region.NONE,
}
export const B07:IBasicCard={
    region:Region.NONE,
    aesthetics: 0, cardId: BasicCardID.B07,
    cost: cost(0,0,0),
    industry: 0,
    vp: 0,
    name:"Fund",
    type:CardType.F,
    category:CardCategory.BASIC
}
const BasicCards={
    B01:B01,
    B02:B02,
    B03:B03,
    B04:B04,
    B05:B05,
    B06:B06,
    B07:B07,
}
export function getBasicCard(id:BasicCardID):IBasicCard{
    return BasicCards[id];
}
