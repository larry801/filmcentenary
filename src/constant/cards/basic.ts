import {CardCategory, CardType, cost, IBasicCard} from "../../types/core";

export const B01:IBasicCard={
    aesthetics: 1, cardId: "B01",
    cost: cost(2,0,0),
    industry: 0,
    type: CardType.F,
    vp: 0,
    name:"Literary Film",
    category:CardCategory.BASIC
}
export const B02:IBasicCard={
    aesthetics: 0, cardId: "B02",
    cost: cost(2,0,0),
    industry: 1,
    type: CardType.F,
    vp: 0,
    name:"Commercial Film",
    category:CardCategory.BASIC
}
export const B03:IBasicCard={
    aesthetics: 0, cardId: "B03",
    cost: cost(2,0,0),
    industry: 0,
    type: CardType.F,
    vp: 0,
    name:"B-Movie",
    category:CardCategory.BASIC
}
export const B04:IBasicCard={
    aesthetics: 0, cardId: "B04",
    cost: cost(0,0,0),
    industry: 0,
    type: CardType.F,
    vp: -3,
    name:"Bad Film",
    category:CardCategory.BASIC
}
export const B05:IBasicCard={
    aesthetics: 1, cardId: "B05",
    cost: cost(6,1,1),
    industry: 1,
    type: CardType.F,
    vp: 3,
    name:"Classic Film",
    category:CardCategory.BASIC
}
export const B07:IBasicCard={
    aesthetics: 0, cardId: "B07",
    cost: cost(0,0,0),
    industry: 0,
    vp: 0,
    name:"Fund",
    type:CardType.F,
    category:CardCategory.BASIC
}
