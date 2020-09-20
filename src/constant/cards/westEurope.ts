import {CardCategory, cost, IEffect, IFilmCard, IPersonCard} from "../../types/core";
import {filmCard, personCard} from "../../types/cards";
const p1201:IPersonCard=personCard({
    name: "Georges Méliès",
    cardId: "1201",
    cost:cost(5,2,0),
    vp:0,
    industry:0,
    aesthetics:0,
    playable:true,
    canArchive:true,
    category: CardCategory.LEGEND,
});

const p1202:IPersonCard=personCard({
    name:"Lumière Brothers",
    cardId:"1202",
    cost:cost(5,0,2),
    vp:0, aesthetics: 0, canArchive: true, category: CardCategory.LEGEND, industry: 0, playable: true
})

const f1203:IFilmCard=filmCard({
    name:"",
    aesthetics: 1,
    canArchive: true,
    cardId: "1203",
    category: CardCategory.NORMAL,
    cost: cost(4,0,1),
    industry: 0,
    playable: true,
    vp: 2,
})

const s1204:IFilmCard=filmCard({
    name:"",
    aesthetics: 1,
    canArchive: true,
    cardId: "1204",
    category: CardCategory.NORMAL,
    cost: cost(4,0,1),
    industry: 0,
    playable: true,
    vp: 3,
})

const s1205:IFilmCard=filmCard({
    name:"",
    aesthetics: 1,
    canArchive: true,
    cardId: "1204",
    category: CardCategory.NORMAL,
    cost: cost(4,0,1),
    industry: 0,
    playable: true,
    vp: 2,
})

const f1206:IFilmCard=filmCard({
    name:"",
    aesthetics: 1,
    canArchive: true,
    cardId: "1206",
    category: CardCategory.NORMAL,
    cost: cost(2,0,3),
    industry: 0,
    playable: true,
    vp: 4,
})

const f1207:IFilmCard=filmCard({
    name:"",
    aesthetics: 0,
    canArchive: true,
    cardId: "1207",
    category: CardCategory.NORMAL,
    cost: cost(4,0,0),
    industry: 1,
    playable: true,
    vp: 1,
})

const f1208:IFilmCard=filmCard({
    name:"",
    aesthetics: 1,
    canArchive: true,
    cardId: "1208",
    category: CardCategory.NORMAL,
    cost: cost(3,2,2),
    industry: 1,
    playable: true,
    vp: 3,
})
const f1209:IFilmCard=filmCard({
    name:"",
    aesthetics: 1,
    canArchive: true,
    cardId: "1209",
    category: CardCategory.NORMAL,
    cost: cost(3,2,2),
    industry: 1,
    playable: true,
    vp: 3,
})
const f1210:IFilmCard=filmCard({
    name:"",
    aesthetics: 0,
    canArchive: true,
    cardId: "1210",
    category: CardCategory.NORMAL,
    cost: cost(3,0,0),
    industry: 0,
    playable: true,
    vp: 1,
})
const f1211:IFilmCard=filmCard({
    name:"",
    aesthetics: 1,
    canArchive: true,
    cardId: "1211",
    category: CardCategory.NORMAL,
    cost: cost(3,0,0),
    industry: 0,
    playable: true,
    vp: 1,
})
