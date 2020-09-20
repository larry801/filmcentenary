import {CardCategory, cost, ICard, IEffect, IFilmCard, IPersonCard, Region} from "../../types/core";
import {filmCard, personCard} from "../../types//cards";
import {IG} from "../../types/setup";
import {Ctx} from "boardgame.io";

const p1102: IPersonCard = personCard({
    aesthetics: 0, industry: 0,
    category: CardCategory.LEGEND,
    cardId: "1102",
    cost: cost(5, 2, 0),
    name: "Thomas Edison",
    playable: true,
    canArchive: true,
    vp: 0,
});

const f1103: IFilmCard = filmCard({
    aesthetics: 0, industry: 1,
    category: CardCategory.NORMAL,
    cardId: "",
    cost: cost(4, 1, 1),
    name: "Intolerance",
    playable: true,
    canArchive: true,
    vp: 2,
})
const eff: IEffect = {
    pre: (G: IG, ctx: Ctx) => true,
    choices: [{
        pre: (G: IG, ctx: Ctx) => true,
        eff: 'industryLevelUp', args: 1
    }, {
        pre: (G: IG, ctx: Ctx) => true,
        eff: 'buyCardForFree', args: f1103
    }]
};

const playEff: IEffect = {
    steps:[
        {type:"update",arg:Region.NA},
        {type:"update",arg:Region.NA},
        {type:"update",arg:Region.NA},
    ]
}
const p1101 = personCard({
    aesthetics: 0, industry: 0,
    cardId: "1101",
    name: "D.W.Griffith",
    vp: 0,
    playable: true,
    canArchive: true,
    cost: cost(5, 2, 0),
    category: CardCategory.LEGEND,
});
const f1104: IFilmCard = filmCard({
    aesthetics: 0, industry: 1,
    category: CardCategory.NORMAL,
    cardId: "1104",
    cost: cost(5, 0, 0),
    name: "The Great Train Robbery",
    playable: true,
    canArchive: true,
    vp: 1,
})
const f1105: IFilmCard = filmCard({
    aesthetics: 0, industry: 0,
    category: CardCategory.NORMAL,
    cardId: "1105",
    cost: cost(3, 2, 0),
    name: "The General",
    playable: true,
    canArchive: true,
    vp: 3,
})
const f1106: IFilmCard = filmCard({
    aesthetics: 0, industry: 0,
    category: CardCategory.NORMAL,
    cardId: "1106",
    cost: cost(3, 1, 0),
    name: "The Jazz Singer",
    playable: true,
    canArchive: true,
    vp: 2,
})
const f1107: IFilmCard = filmCard({
    aesthetics: 0, industry: 0,
    category: CardCategory.NORMAL,
    cardId: "1107",
    cost: cost(2, 0, 1),
    name: "The Gold Rush",
    playable: true,
    canArchive: true,
    vp: 2,
})
const f1108: IFilmCard = filmCard({
    aesthetics: 1, industry: 1,
    category: CardCategory.NORMAL,
    cardId: "1108",
    cost: cost(2, 1, 0),
    name: "Nanook of the North",
    playable: true,
    canArchive: true,
    vp: 2,
})
const f1109: IFilmCard = filmCard({
    aesthetics: 0, industry: 1,
    category: CardCategory.NORMAL,
    cardId: "1109",
    cost: cost(3, 3, 0),
    name: "King Kong",
    playable: true,
    canArchive: true,
    vp: 4,
})
const f1110: IFilmCard = filmCard({
    aesthetics: 1, industry: 0,
    category: CardCategory.NORMAL,
    cardId: "1110",
    cost: cost(0, 0, 3),
    name: "Greed",
    playable: true,
    canArchive: true,
    vp: 4,
})
export const NACards: ICard[][] = [[
    p1101, p1102, f1103, f1104, f1105, f1106, f1107, f1108, f1109, f1110
], [], []
]
