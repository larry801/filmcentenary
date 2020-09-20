import {CardCategory, cost, IFilmCard,
    IPersonCard} from "../../types/core";
import {filmCard, personCard} from "../../types/cards";
const s1301:IFilmCard=filmCard({
    name:"",
    aesthetics: 1,
    canArchive: true,
    cardId: "1301",
    category: CardCategory.LEGEND,
    cost: cost(4,1,3),
    industry: 0,
    playable: true,
    vp: 4,
})
const p1302:IPersonCard=personCard({
    name:"Lumière Brothers",
    cardId:"1302",
    cost:cost(5,0,2),
    vp:0, aesthetics: 0, canArchive: true, category: CardCategory.LEGEND, industry: 0, playable: true
})
const s1303:IFilmCard=filmCard({
    name:"",
    aesthetics: 0,
    canArchive: true,
    cardId: "1303",
    category: CardCategory.NORMAL,
    cost: cost(1,2,2),
    industry: 0,
    playable: true,
    vp: 3,
})
const f1304:IFilmCard=filmCard({
    name:"",
    aesthetics: 1,
    canArchive: true,
    cardId: "1304",
    category: CardCategory.NORMAL,
    cost: cost(3,0,2),
    industry: 0,
    playable: true,
    vp:3,
})
const f1305:IFilmCard=filmCard({
    name:"",
    aesthetics: 1,
    canArchive: true,
    cardId: "1305",
    category: CardCategory.NORMAL,
    cost: cost(3,1,3),
    industry: 0,
    playable: true,
    vp:4,
})
const f1306:IFilmCard=filmCard({
    name:"",
    aesthetics: 0,
    canArchive: true,
    cardId: "1306",
    category: CardCategory.NORMAL,
    cost: cost(3,0,1),
    industry: 1,
    playable: true,
    vp:2,
})
const f1307:IFilmCard=filmCard({
    name:"",
    aesthetics: 0,
    canArchive: true,
    cardId: "1307",
    category: CardCategory.NORMAL,
    cost: cost(3,0,0),
    industry: 0,
    playable: true,
    vp:1,
})
