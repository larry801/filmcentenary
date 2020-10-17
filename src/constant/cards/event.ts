import {eventCard} from '../../types/cards'
import {IEventCard, IEra, EventCardID} from "../../types/core";

const E01:IEventCard=eventCard({
    era:IEra.ONE,
    name:"",
    effect:{}, id: EventCardID.E01
})
const E02:IEventCard=eventCard({
    era:IEra.ONE,
    name:"Edison Litigation",
    effect:{}, id: EventCardID.E02
})
const E03:IEventCard=eventCard({
    era:IEra.ONE,
    name:"Avant-garde",
    effect:{}, id: EventCardID.E03
})
const E04:IEventCard=eventCard({
    era:IEra.ONE,
    name:"Academy Award",
    effect:{}, id: EventCardID.E04
})
const E05:IEventCard=eventCard({
    era:IEra.ONE,
    name:"Paramount Judgement",
    effect:{}, id: EventCardID.E05
})
const E06: IEventCard = eventCard({
    era: IEra.TWO,
    name: "Cannes International Film  Festival",
    effect: {}, id: EventCardID.E06
})

const E07: IEventCard = eventCard({
    era: IEra.TWO,
    name: "LES CHAIERS DU CINEMA",
    effect: {}, id: EventCardID.E07
})

const E08: IEventCard = eventCard({
    era: IEra.TWO,
    name: `Khrushchev's "unfreeze"`,
    effect: {}, id: EventCardID.E08
})
const E09: IEventCard = eventCard({
    era: IEra.TWO,
    name: "Rising of Bollywood",
    effect: {}, id: EventCardID.E09
})

const E10: IEventCard = eventCard({
    era: IEra.THREE,
    name: "Dismantling of HAYS CODE",
    effect: {}, id: EventCardID.E10
})
const E11: IEventCard = eventCard({
    era: IEra.TWO,
    name: "Film Authorship",
    effect: {}, id: EventCardID.E11
})

const E12: IEventCard = eventCard({
    era: IEra.THREE,
    name: "New Wave of Film",
    effect: {}, id: EventCardID.E12
})
const E13: IEventCard = eventCard({
    era: IEra.THREE,
    name: "Globalization",
    effect: {}, id: EventCardID.E13
})
const E14: IEventCard = eventCard({
    era: IEra.TWO,
    name: "New Media",
    effect: {}, id: EventCardID.E14
})


const EVENT_CARDS = [E01,E02,E03,E04,E05,E06,E07,E08,E09,E10,E11,E12,E13,E14]
const EVENT_ERA = [[E01,E02,E03,E04,],[E05,E06,E07,E08,E09,],[E10,E11,E12,E13,E14]]
let idToCard = new Map();
EVENT_CARDS.forEach((v:IEventCard)=>{
    idToCard.set(v.cardId,v);
})
export const eventCardByEra = (era:IEra):IEventCard[]=>EVENT_ERA[era];
export const eventCardById = (id:EventCardID):IEventCard[] => idToCard.get(id);
