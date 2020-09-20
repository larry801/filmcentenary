import {eventCard} from '../../types/cards'
import {IEventCard, IEra} from "../../types/core";

const E01:IEventCard=eventCard({
    era:IEra.ONE,
    name:"",
    effect:{}, id: "E01"
})
const E02:IEventCard=eventCard({
    era:IEra.ONE,
    name:"Edison Litigation",
    effect:{}, id: "E02"
})
const E03:IEventCard=eventCard({
    era:IEra.ONE,
    name:"Avant-garde",
    effect:{}, id: "E03"
})
const E04:IEventCard=eventCard({
    era:IEra.ONE,
    name:"Academy Award",
    effect:{}, id: "E04"
})
const E05:IEventCard=eventCard({
    era:IEra.ONE,
    name:"Paramount Judgement",
    effect:{}, id: "E05"
})
const E06: IEventCard = eventCard({
    era: IEra.TWO,
    name: "Cannes International Film  Festival",
    effect: {}, id: "E06"
})

const E07: IEventCard = eventCard({
    era: IEra.TWO,
    name: "LES CHAIERS DU CINEMA",
    effect: {}, id: "E07"
})

const E08: IEventCard = eventCard({
    era: IEra.TWO,
    name: `Khrushchev's "unfreeze"`,
    effect: {}, id: "E08"
})
const E09: IEventCard = eventCard({
    era: IEra.TWO,
    name: "Rising of Bollywood",
    effect: {}, id: "E09"
})

const E10: IEventCard = eventCard({
    era: IEra.THREE,
    name: "Dismantling of HAYS CODE",
    effect: {}, id: "E10"
})
const E11: IEventCard = eventCard({
    era: IEra.TWO,
    name: "Film Authorship",
    effect: {}, id: "E11"
})

const E12: IEventCard = eventCard({
    era: IEra.THREE,
    name: "New Wave of Film",
    effect: {}, id: "E12"
})
const E13: IEventCard = eventCard({
    era: IEra.THREE,
    name: "Globalization",
    effect: {}, id: "E13"
})
const E14: IEventCard = eventCard({
    era: IEra.TWO,
    name: "New Media",
    effect: {}, id: "E14"
})


const EVENT_CARDS = [E01,E02,E03,E04,E05,E06,E07,E08,E09,E10,E11,E12,E13,E14]
let idToCard = new Map();
let nameToCard = new Map();
EVENT_CARDS.forEach((v:IEventCard)=>{
    idToCard.set(v.cardId,v);
    nameToCard.set(v.name,v);
})
export const eventCardByName = (name:string, locale:string) => nameToCard.get(name);

export const eventCardById = (id:string) => idToCard.get(id);
