import {CardCategory, CardType, cost, IEra, Region} from "../../types/core";

const SCORE_CARDS = {
    "V111": {
        cost :cost(0,0,0),
        era: IEra.ONE,
        region: Region.NA,
        name: "V111",
        cardId: "V111",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 1,
        vp: 9,
        industry: 1,
        aesthetics: 0,
    },
    "V112": {
        cost :cost(0,0,0),
        era: IEra.ONE,
        region: Region.NA,
        name: "V112",
        cardId: "V112",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 2,
        vp: 6,
        industry: 0,
        aesthetics: 0,
    },
    "V113": {
        cost :cost(0,0,0),
        era: IEra.ONE,
        region: Region.NA,
        name: "V113",
        cardId: "V113",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 3,
        vp: 3,
        industry: 0,
        aesthetics: 0,
    },
    "V121": {
        cost :cost(0,0,0),
        era: IEra.ONE,
        region: Region.WE,
        name: "V121",
        cardId: "V121",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 1,
        vp: 11,
        industry: 0,
        aesthetics: 1,
    },
    "V122": {
        cost :cost(0,0,0),
        era: IEra.ONE,
        region: Region.WE,
        name: "V122",
        cardId: "V122",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 2,
        vp: 8,
        industry: 0,
        aesthetics: 0,
    },
    "V123": {
        cost :cost(0,0,0),
        era: IEra.ONE,
        region: Region.WE,
        name: "V123",
        cardId: "V123",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 3,
        vp: 5,
        industry: 0,
        aesthetics: 0,
    },
    "V131": {
        cost :cost(0,0,0),
        era: IEra.ONE,
        region: Region.EE,
        name: "V131",
        cardId: "V131",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 1,
        vp: 6,
        industry: 0,
        aesthetics: 0,
    },
    "V132": {
        cost :cost(0,0,0),
        era: IEra.ONE,
        region: Region.EE,
        name: "V132",
        cardId: "V132",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 2,
        vp: 3,
        industry: 0,
        aesthetics: 0,
    },
    "V211": {
        cost :cost(0,0,0),
        era: IEra.TWO,
        region: Region.NA,
        name: "V211",
        cardId: "V211",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 1,
        vp: 14,
        industry: 1,
        aesthetics: 0,
    },
    "V212": {
        cost :cost(0,0,0),
        era: IEra.TWO,
        region: Region.NA,
        name: "V212",
        cardId: "V212",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 2,
        vp: 10,
        industry: 1,
        aesthetics: 0,
    },
    "V213": {
        cost :cost(0,0,0),
        era: IEra.TWO,
        region: Region.NA,
        name: "V213",
        cardId: "V213",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 3,
        vp: 6,
        industry: 0,
        aesthetics: 0,
    },
    "V221": {
        cost :cost(0,0,0),
        era: IEra.TWO,
        region: Region.WE,
        name: "V221",
        cardId: "V221",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 1,
        vp: 14,
        industry: 0,
        aesthetics: 1,
    },
    "V222": {
        cost :cost(0,0,0),
        era: IEra.TWO,
        region: Region.WE,
        name: "V222",
        cardId: "V222",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 2,
        vp: 10,
        industry: 0,
        aesthetics: 1,
    },
    "V223": {
        cost :cost(0,0,0),
        era: IEra.TWO,
        region: Region.WE,
        name: "V223",
        cardId: "V223",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 3,
        vp: 6,
        industry: 0,
        aesthetics: 0,
    },
    "V231": {
        cost :cost(0,0,0),
        era: IEra.TWO,
        region: Region.EE,
        name: "V231",
        cardId: "V231",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 1,
        vp: 9,
        industry: 1,
        aesthetics: 0,
    },
    "V232": {
        cost :cost(0,0,0),
        era: IEra.TWO,
        region: Region.EE,
        name: "V232",
        cardId: "V232",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 2,
        vp: 5,
        industry: 0,
        aesthetics: 0,
    },
    "V241": {
        cost :cost(0,0,0),
        era: IEra.TWO,
        region: Region.ASIA,
        name: "V241",
        cardId: "V241",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 1,
        vp: 11,
        industry: 0,
        aesthetics: 1,
    },
    "V242": {
        cost :cost(0,0,0),
        era: IEra.TWO,
        region: Region.ASIA,
        name: "V242",
        cardId: "V242",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 2,
        vp: 7,
        industry: 0,
        aesthetics: 0,
    },
    "V243": {
        cost :cost(0,0,0),
        era: IEra.TWO,
        region: Region.ASIA,
        name: "V243",
        cardId: "V243",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 3,
        vp: 3,
        industry: 0,
        aesthetics: 0,
    },
    "V311": {
        era: IEra.THREE,
        region: Region.NA,
        name: "V311",
        cardId: "V311",
        cost :cost(0,0,0),
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 1,
        vp: 20,
        industry: 1,
        aesthetics: 0,
    },
    "V312": {
        era: IEra.THREE,
        region: Region.NA,
        name: "V312",
        cardId: "V312",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 2,
        vp: 15,
        cost :cost(0,0,0),
        industry: 1,
        aesthetics: 0,
    },
    "V313": {
        era: IEra.THREE,
        region: Region.NA,
        name: "V313",
        cardId: "V313",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 3,
        vp: 10,
        industry: 1,
        aesthetics: 0,
    },
    "V321": {
        cost :cost(0,0,0),
        era: IEra.THREE,
        region: Region.WE,
        name: "V321",
        cardId: "V321",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 1,
        vp: 16,
        industry: 0,
        aesthetics: 1,
    },
    "V322": {
        era: IEra.THREE,
        region: Region.WE,
        name: "V322",
        cardId: "V322",
        cost :cost(0,0,0),
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 2,
        vp: 12,
        industry: 0,
        aesthetics: 1,
    },
    "V323": {
        era: IEra.THREE,
        region: Region.WE,
        name: "V323",
        cardId: "V323",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 3,
        vp: 8,
        cost :cost(0,0,0),
        industry: 0,
        aesthetics: 1,
    },
    "V331": {
        era: IEra.THREE,
        region: Region.EE,
        name: "V331",
        cardId: "V331",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 1,
        vp: 15,
        industry: 1,
        cost :cost(0,0,0),
        aesthetics: 0,
    },
    "V332": {
        cost :cost(0,0,0),
        era: IEra.THREE,
        region: Region.EE,
        name: "V332",
        cardId: "V332",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 2,
        vp: 10,
        industry: 1,
        aesthetics: 0,
    },
    "V333": {
        cost :cost(0,0,0),
        era: IEra.THREE,
        region: Region.EE,
        name: "V333",
        cardId: "V333",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 3,
        vp: 5,
        industry: 1,
        aesthetics: 0,
    },
    "V341": {
        cost :cost(0,0,0),
        era: IEra.THREE,
        region: Region.ASIA,
        name: "V341",
        cardId: "V341",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 1,
        vp: 16,
        industry: 0,
        aesthetics: 1,
    },
    "V342": {
        cost :cost(0,0,0),
        era: IEra.THREE,
        region: Region.ASIA,
        name: "V342",
        cardId: "V342",
        category: CardCategory.SCORE,
        type: CardType.V,
        rank: 2,
        vp: 11,
        industry: 0,
        aesthetics: 1,
    },
}

export const scoreCardCount = (r:Region,era:IEra):number=>{
    let cards = Object.entries(SCORE_CARDS)
    return  cards.filter(e=>e[1].region===r&&e[1].era===era).length;
}

export const getScoreCard=(r:Region,era:IEra,rank:number)=>{
    let cards = Object.entries(SCORE_CARDS)
    return  cards.filter(e=>e[1].region===r&&e[1].era===era&&e[1].rank===rank)[0][1];
}

export const getScoreCardByID = (id:string)=>{
    // @ts-ignore
    return SCORE_CARDS[id];
}
