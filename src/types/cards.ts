import {
    BasicCardID,
    CardCategory, CardID,
    CardType,
    cost, EventCardID, FilmCardID,
    ICost,
    IEra,
    IEventCard,
    IFilmCard,
    INormalOrLegendCard,
    IPersonCard,
    ISchoolCard, PersonCardID,
    Region, SchoolCardID, ScoreCardID
} from "./core";
import {getBasicCard} from "../constant/cards/basic";
import {eventCardById} from "../constant/cards/event";
import {getScoreCardByID} from "../constant/cards/score";


interface IArgFilmCard {
    era: IEra,
    region: Region,
    name: string,
    cardId: CardID,
    cost: ICost,
    vp: number,
    category: CardCategory,
    industry: number,
    aesthetics: number,
}

interface IArgEvent {
    name: string,
    id: EventCardID,
    effect: any,
    era: IEra,
}

export function filmCard(arg: IArgFilmCard
): IFilmCard {
    return {
        cost: arg.cost,
        aesthetics: arg.aesthetics,
        cardId: arg.cardId,
        category: arg.category,
        industry: arg.industry,
        name: arg.name,
        type: CardType.F, era: arg.era, region: arg.region,
        vp: arg.vp
    }
}

export function personCard(arg: IArgFilmCard): IPersonCard {
    return {
        type: CardType.P, era: arg.era, region: arg.region,
        industry: arg.industry,
        vp: arg.vp,
        cost: arg.cost,
        name: arg.name,
        cardId: arg.cardId,
        category: arg.category,
        aesthetics: arg.aesthetics
    }
}

export function schoolCard(arg: IArgFilmCard): ISchoolCard {
    return {
        era: arg.era, region: arg.region,
        type: CardType.S,
        industry: arg.industry,
        vp: arg.vp,
        cost: arg.cost,
        name: arg.name,
        cardId: arg.cardId,
        category: arg.category,
        aesthetics: arg.aesthetics
    }
}

export function eventCard(arg: IArgEvent): IEventCard {
    return {
        region: Region.NONE,
        cost: cost(0, 0, 0),
        category: CardCategory.BASIC,
        type: CardType.E,
        era: arg.era,
        name: arg.name,
        effect: arg.effect,
        cardId: arg.id
    }
}

const NoneBasicCards = {
    "P1101": personCard({
        era: IEra.ONE,
        region: Region.NA,
        name: "D.W.Griffith",
        cardId: PersonCardID.P1101,
        cost: cost(5, 0, 2),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "P1102": personCard({
        era: IEra.ONE,
        region: Region.NA,
        name: "Thomas Edison",
        cardId: PersonCardID.P1102,
        cost: cost(5, 2, 0),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "F1103": filmCard({
        era: IEra.ONE,
        region: Region.NA,
        name: "Intolerance",
        cardId: FilmCardID.F1103,
        cost: cost(4, 1, 1),
        vp: 2,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F1104": filmCard({
        era: IEra.ONE,
        region: Region.NA,
        name: "The Great Train Robbery",
        cardId: FilmCardID.F1104,
        cost: cost(5, 0, 0),
        vp: 1,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F1105": filmCard({
        era: IEra.ONE,
        region: Region.NA,
        name: "The Jazz Singer",
        cardId: FilmCardID.F1105,
        cost: cost(3, 2, 0),
        vp: 3,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F1106": filmCard({
        era: IEra.ONE,
        region: Region.NA,
        name: "The General",
        cardId: FilmCardID.F1106,
        cost: cost(3, 1, 0),
        vp: 2,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 0,
    }),
    "F1107": filmCard({
        era: IEra.ONE,
        region: Region.NA,
        name: "The Gold Rush",
        cardId: FilmCardID.F1107,
        cost: cost(2, 0, 1),
        vp: 2,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 0,
    }),
    "F1108": filmCard({
        era: IEra.ONE,
        region: Region.NA,
        name: "Nanook of the North",
        cardId: FilmCardID.F1108,
        cost: cost(3, 1, 1),
        vp: 2,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F1109": filmCard({
        era: IEra.ONE,
        region: Region.NA,
        name: "King Kong",
        cardId: FilmCardID.F1109,
        cost: cost(3, 3, 0),
        vp: 4,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F1110": filmCard({
        era: IEra.ONE,
        region: Region.NA,
        name: "Greed",
        cardId: FilmCardID.F1110,
        cost: cost(0, 0, 3),
        vp: 4,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "P1201": personCard({
        era: IEra.ONE,
        region: Region.WE,
        name: "Georges Méliès",
        cardId: PersonCardID.P1201,
        cost: cost(5, 2, 0),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "P1202": personCard({
        era: IEra.ONE,
        region: Region.WE,
        name: "Lumière Brothers",
        cardId: PersonCardID.P1202,
        cost: cost(5, 2, 0),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "S1203": schoolCard({
        era: IEra.ONE,
        region: Region.WE,
        name: "Expressionism",
        cardId: SchoolCardID.S1203,
        cost: cost(4, 0, 1),
        vp: 2,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "S1204": schoolCard({
        era: IEra.ONE,
        region: Region.WE,
        name: "Swedish School",
        cardId: SchoolCardID.S1204,
        cost: cost(4, 2, 2),
        vp: 3,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F1205": filmCard({
        era: IEra.ONE,
        region: Region.WE,
        name: "Nosferatu",
        cardId: FilmCardID.F1205,
        cost: cost(2, 1, 0),
        vp: 2,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F1206": filmCard({
        era: IEra.ONE,
        region: Region.WE,
        name: "The Passion of the Joan of Arc",
        cardId: FilmCardID.F1206,
        cost: cost(2, 0, 3),
        vp: 4,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F1207": filmCard({
        era: IEra.ONE,
        region: Region.WE,
        name: "A Trip to the Moon",
        cardId: FilmCardID.F1207,
        cost: cost(4, 0, 0),
        vp: 1,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F1208": filmCard({
        era: IEra.ONE,
        region: Region.WE,
        name: "Metropolis",
        cardId: FilmCardID.F1208,
        cost: cost(3, 2, 2),
        vp: 3,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F1209": filmCard({
        era: IEra.ONE,
        region: Region.WE,
        name: "The Phantom Carriage",
        cardId: FilmCardID.F1209,
        cost: cost(2, 1, 1),
        vp: 2,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F1210": filmCard({
        era: IEra.ONE,
        region: Region.WE,
        name: "Existing the Factory",
        cardId: FilmCardID.F1210,
        cost: cost(3, 0, 0),
        vp: 1,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 0,
    }),
    "F1211": filmCard({
        era: IEra.ONE,
        region: Region.WE,
        name: "The Assassination of the Duke of Guise",
        cardId: FilmCardID.F1211,
        cost: cost(3, 0, 0),
        vp: 1,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "S1301": schoolCard({
        era: IEra.ONE,
        region: Region.EE,
        name: "Montage School",
        cardId: SchoolCardID.S1301,
        cost: cost(4, 1, 3),
        vp: 4,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 1,
    }),
    "P1302": personCard({
        era: IEra.ONE,
        region: Region.EE,
        name: "Sergei M. Eisenstein",
        cardId: PersonCardID.P1302,
        cost: cost(5, 0, 2),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "S1303": schoolCard({
        era: IEra.ONE,
        region: Region.EE,
        name: "Kino Eye",
        cardId: SchoolCardID.S1303,
        cost: cost(1, 3, 1),
        vp: 4,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 0,
    }),
    "F1304": filmCard({
        era: IEra.ONE,
        region: Region.EE,
        name: "Mother",
        cardId: FilmCardID.F1304,
        cost: cost(3, 0, 2),
        vp: 3,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F1305": filmCard({
        era: IEra.ONE,
        region: Region.EE,
        name: "Battleship Potemkin",
        cardId: FilmCardID.F1305,
        cost: cost(3, 1, 3),
        vp: 4,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F1306": filmCard({
        era: IEra.ONE,
        region: Region.EE,
        name: "Man with a Movie Camera",
        cardId: FilmCardID.F1306,
        cost: cost(3, 1, 0),
        vp: 2,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F1307": filmCard({
        era: IEra.ONE,
        region: Region.EE,
        name: "Father Sergius",
        cardId: FilmCardID.F1307,
        cost: cost(3, 0, 0),
        vp: 1,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 0,
    }),
    "S2101": schoolCard({
        era: IEra.TWO,
        region: Region.NA,
        name: "Classic Hollywood",
        cardId: SchoolCardID.S2101,
        cost: cost(7, 6, 2),
        vp: 8,
        category: CardCategory.LEGEND,
        industry: 2,
        aesthetics: 0,
    }),
    "P2102": personCard({
        era: IEra.TWO,
        region: Region.NA,
        name: "John Ford",
        cardId: PersonCardID.P2102,
        cost: cost(8, 5, 1),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "P2103": personCard({
        era: IEra.TWO,
        region: Region.NA,
        name: "Alfred Hitchcock",
        cardId: PersonCardID.P2103,
        cost: cost(8, 4, 2),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "S2104": schoolCard({
        era: IEra.TWO,
        region: Region.NA,
        name: "Film Noir",
        cardId: SchoolCardID.S2104,
        cost: cost(6, 4, 2),
        vp: 6,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "P2105": personCard({
        era: IEra.TWO,
        region: Region.NA,
        name: "Orson Welles",
        cardId: PersonCardID.P2105,
        cost: cost(6, 0, 4),
        vp: 0,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 0,
    }),
    "F2106": filmCard({
        era: IEra.TWO,
        region: Region.NA,
        name: "Gone With the Wind",
        cardId: FilmCardID.F2106,
        cost: cost(7, 6, 0),
        vp: 8,
        category: CardCategory.NORMAL,
        industry: 2,
        aesthetics: 0,
    }),
    "F2107": filmCard({
        era: IEra.TWO,
        region: Region.NA,
        name: "Stagecoach",
        cardId: FilmCardID.F2107,
        cost: cost(5, 5, 1),
        vp: 7,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F2108": filmCard({
        era: IEra.TWO,
        region: Region.NA,
        name: "Singin' in the Rain",
        cardId: FilmCardID.F2108,
        cost: cost(5, 3, 3),
        vp: 5,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F2109": filmCard({
        era: IEra.TWO,
        region: Region.NA,
        name: "Citizen Kane",
        cardId: FilmCardID.F2109,
        cost: cost(7, 0, 3),
        vp: 2,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 2,
    }),
    "F2110": filmCard({
        era: IEra.TWO,
        region: Region.NA,
        name: "White Heat",
        cardId: FilmCardID.F2110,
        cost: cost(5, 4, 0),
        vp: 6,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F2111": filmCard({
        era: IEra.TWO,
        region: Region.NA,
        name: "Sunset Blvid",
        cardId: FilmCardID.F2111,
        cost: cost(4, 4, 2),
        vp: 6,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F2112": filmCard({
        era: IEra.TWO,
        region: Region.NA,
        name: "Ben-hur",
        cardId: FilmCardID.F2112,
        cost: cost(6, 6, 0),
        vp: 8,
        category: CardCategory.NORMAL,
        industry: 2,
        aesthetics: 0,
    }),
    "F2113": filmCard({
        era: IEra.TWO,
        region: Region.NA,
        name: "The Maltese Falcon",
        cardId: FilmCardID.F2113,
        cost: cost(5, 3, 1),
        vp: 5,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F2114": filmCard({
        era: IEra.TWO,
        region: Region.NA,
        name: "Vertigo",
        cardId: FilmCardID.F2114,
        cost: cost(4, 0, 4),
        vp: 6,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "S2201": schoolCard({
        era: IEra.TWO,
        region: Region.WE,
        name: "Neorealism",
        cardId: SchoolCardID.S2201,
        cost: cost(8, 0, 6),
        vp: 8,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 1,
    }),
    "P2202": personCard({
        era: IEra.TWO,
        region: Region.WE,
        name: "Federico Fellini",
        cardId: PersonCardID.P2202,
        cost: cost(8, 1, 5),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "P2203": personCard({
        era: IEra.TWO,
        region: Region.WE,
        name: "David Lean",
        cardId: PersonCardID.P2203,
        cost: cost(7, 5, 3),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "S2204": schoolCard({
        era: IEra.TWO,
        region: Region.WE,
        name: "Poetic Realism",
        cardId: SchoolCardID.S2204,
        cost: cost(7, 2, 4),
        vp: 6,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 2,
    }),
    "P2205": personCard({
        era: IEra.TWO,
        region: Region.WE,
        name: "Jean Renoir",
        cardId: PersonCardID.P2205,
        cost: cost(7, 0, 4),
        vp: 0,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 0,
    }),
    "F2206": filmCard({
        era: IEra.TWO,
        region: Region.WE,
        name: "The Rules of the Game",
        cardId: FilmCardID.F2206,
        cost: cost(6, 0, 4),
        vp: 6,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F2207": filmCard({
        era: IEra.TWO,
        region: Region.WE,
        name: "The Bicycle Thieves",
        cardId: FilmCardID.F2207,
        cost: cost(8, 2, 2),
        vp: 4,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F2208": filmCard({
        era: IEra.TWO,
        region: Region.WE,
        name: "M",
        cardId: FilmCardID.F2208,
        cost: cost(6, 4, 0),
        vp: 6,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F2209": filmCard({
        era: IEra.TWO,
        region: Region.WE,
        name: "The Road",
        cardId: FilmCardID.F2209,
        cost: cost(5, 1, 5),
        vp: 7,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F2210": filmCard({
        era: IEra.TWO,
        region: Region.WE,
        name: "Diary of a Country Priest",
        cardId: FilmCardID.F2210,
        cost: cost(4, 0, 6),
        vp: 8,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F2211": filmCard({
        era: IEra.TWO,
        region: Region.WE,
        name: "Napoleon",
        cardId: FilmCardID.F2211,
        cost: cost(4, 2, 2),
        vp: 4,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F2212": filmCard({
        era: IEra.TWO,
        region: Region.WE,
        name: "Daybreak",
        cardId: FilmCardID.F2212,
        cost: cost(4, 0, 4),
        vp: 6,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F2213": filmCard({
        era: IEra.TWO,
        region: Region.WE,
        name: "The Wages of Fear",
        cardId: FilmCardID.F2213,
        cost: cost(5, 3, 3),
        vp: 5,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F2214": filmCard({
        era: IEra.TWO,
        region: Region.WE,
        name: "Lawrence of Arabia",
        cardId: FilmCardID.F2214,
        cost: cost(5, 5, 3),
        vp: 6,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "S2301": schoolCard({
        era: IEra.TWO,
        region: Region.EE,
        name: "Socialist Realism",
        cardId: SchoolCardID.S2301,
        cost: cost(8, 4, 4),
        vp: 6,
        category: CardCategory.LEGEND,
        industry: 1,
        aesthetics: 1,
    }),
    "P2302": personCard({
        era: IEra.TWO,
        region: Region.EE,
        name: "Mikhail Kalatozov",
        cardId: PersonCardID.P2302,
        cost: cost(8, 3, 3),
        vp: 5,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "F2303": filmCard({
        era: IEra.TWO,
        region: Region.EE,
        name: "Chapaev",
        cardId: FilmCardID.F2303,
        cost: cost(7, 1, 1),
        vp: 3,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F2304": filmCard({
        era: IEra.TWO,
        region: Region.EE,
        name: "Ballad of a Solider",
        cardId: FilmCardID.F2304,
        cost: cost(6, 2, 4),
        vp: 6,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 2,
    }),
    "F2305": filmCard({
        era: IEra.TWO,
        region: Region.EE,
        name: "The Cranes are Flying",
        cardId: FilmCardID.F2305,
        cost: cost(6, 2, 2),
        vp: 4,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F2306": filmCard({
        era: IEra.TWO,
        region: Region.EE,
        name: "Canal",
        cardId: FilmCardID.F2306,
        cost: cost(7, 3, 2),
        vp: 5,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F2307": filmCard({
        era: IEra.TWO,
        region: Region.EE,
        name: "Shadows of Forgotten Ancestors",
        cardId: FilmCardID.F2307,
        cost: cost(4, 0, 6),
        vp: 8,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 2,
    }),
    "F2308": filmCard({
        era: IEra.TWO,
        region: Region.EE,
        name: "Quiet Flows the Don",
        cardId: FilmCardID.F2308,
        cost: cost(6, 4, 4),
        vp: 6,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F2309": filmCard({
        era: IEra.TWO,
        region: Region.EE,
        name: "Earth",
        cardId: FilmCardID.F2309,
        cost: cost(6, 0, 3),
        vp: 4,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 2,
    }),
    "P2401": personCard({
        era: IEra.TWO,
        region: Region.ASIA,
        name: "Akira Kurosawa",
        cardId: PersonCardID.P2401,
        cost: cost(8, 3, 3),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "P2402": personCard({
        era: IEra.TWO,
        region: Region.ASIA,
        name: "Chusheng Cai",
        cardId: PersonCardID.P2402,
        cost: cost(6, 4, 4),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "F2403": filmCard({
        era: IEra.TWO,
        region: Region.ASIA,
        name: "Spring in a small town",
        cardId: FilmCardID.F2403,
        cost: cost(6, 0, 5),
        vp: 7,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F2404": filmCard({
        era: IEra.TWO,
        region: Region.ASIA,
        name: "The Spring River Flows East",
        cardId: FilmCardID.F2404,
        cost: cost(7, 2, 0),
        vp: 4,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F2405": filmCard({
        era: IEra.TWO,
        region: Region.ASIA,
        name: "Tokyo Story",
        cardId: FilmCardID.F2405,
        cost: cost(6, 0, 4),
        vp: 6,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F2406": filmCard({
        era: IEra.TWO,
        region: Region.ASIA,
        name: "Seven Samurai",
        cardId: FilmCardID.F2406,
        cost: cost(6, 4, 0),
        vp: 6,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F2407": filmCard({
        era: IEra.TWO,
        region: Region.ASIA,
        name: "Pather Panchali",
        cardId: FilmCardID.F2407,
        cost: cost(6, 1, 1),
        vp: 3,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 0,
    }),
    "F2408": filmCard({
        era: IEra.TWO,
        region: Region.ASIA,
        name: "The Goddess",
        cardId: FilmCardID.F2408,
        cost: cost(5, 0, 4),
        vp: 6,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F2409": filmCard({
        era: IEra.TWO,
        region: Region.ASIA,
        name: "The Human Condition",
        cardId: FilmCardID.F2409,
        cost: cost(4, 3, 3),
        vp: 5,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F2410": filmCard({
        era: IEra.TWO,
        region: Region.ASIA,
        name: "This Life of Mine",
        cardId: FilmCardID.F2410,
        cost: cost(5, 2, 0),
        vp: 4,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "S3101": schoolCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "New Hollywood",
        cardId: SchoolCardID.S3101,
        cost: cost(10, 10, 2),
        vp: 13,
        category: CardCategory.LEGEND,
        industry: 2,
        aesthetics: 2,
    }),
    "P3102": personCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "Steven Spielberg",
        cardId: PersonCardID.P3102,
        cost: cost(9, 9, 5),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "F3103": filmCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "The Godfather",
        cardId: FilmCardID.F3103,
        cost: cost(10, 8, 8),
        vp: 11,
        category: CardCategory.LEGEND,
        industry: 1,
        aesthetics: 2,
    }),
    "F3104": filmCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "Star War",
        cardId: FilmCardID.F3104,
        cost: cost(9, 10, 0),
        vp: 13,
        category: CardCategory.LEGEND,
        industry: 3,
        aesthetics: 0,
    }),
    "S3105": schoolCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "New York School",
        cardId: SchoolCardID.S3105,
        cost: cost(9, 4, 4),
        vp: 7,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 4,
    }),
    "F3106": filmCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "Martin Scorsese",
        cardId: FilmCardID.F3106,
        cost: cost(10, 5, 5),
        vp: 0,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 0,
    }),
    "F3107": filmCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "Roger Corman",
        cardId: FilmCardID.F3107,
        cost: cost(10, 6, 0),
        vp: 0,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 0,
    }),
    "F3108": filmCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "Titanic",
        cardId: FilmCardID.F3108,
        cost: cost(9, 12, 0),
        vp: 15,
        category: CardCategory.NORMAL,
        industry: 2,
        aesthetics: 0,
    }),
    "F3109": filmCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "2001: A Space Odyssey",
        cardId: FilmCardID.F3109,
        cost: cost(8, 7, 7),
        vp: 10,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 2,
    }),
    "F3110": filmCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "The Exorcist",
        cardId: FilmCardID.F3110,
        cost: cost(8, 8, 2),
        vp: 11,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F3111": filmCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "Bonnie and Clyde",
        cardId: FilmCardID.F3111,
        cost: cost(10, 5, 4),
        vp: 8,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F3112": filmCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "Taxi Driver",
        cardId: FilmCardID.F3112,
        cost: cost(8, 5, 5),
        vp: 8,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 2,
    }),
    "F3113": filmCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "Raiders of the Lost Ark",
        cardId: FilmCardID.F3113,
        cost: cost(9, 10, 0),
        vp: 13,
        category: CardCategory.NORMAL,
        industry: 2,
        aesthetics: 0,
    }),
    "F3114": filmCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "The Longest Yard",
        cardId: FilmCardID.F3114,
        cost: cost(9, 10, 0),
        vp: 9,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F3115": filmCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "Butch Cassidy and the Sundance Kid",
        cardId: FilmCardID.F3115,
        cost: cost(8, 6, 2),
        vp: 9,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F3116": filmCard({
        era: IEra.THREE,
        region: Region.NA,
        name: "The Shining",
        cardId: FilmCardID.F3116,
        cost: cost(8, 4, 6),
        vp: 9,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 2,
    }),
    "S3201": schoolCard({
        era: IEra.THREE,
        region: Region.WE,
        name: "New Wave",
        cardId: SchoolCardID.S3201,
        cost: cost(9, 4, 10),
        vp: 3,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 3,
    }),
    "P3202": personCard({
        era: IEra.THREE,
        region: Region.WE,
        name: "Francois Truffaut",
        cardId: PersonCardID.P3202,
        cost: cost(10, 5, 7),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "P3203": personCard({
        era: IEra.THREE,
        region: Region.WE,
        name: "Ingmar Bergman",
        cardId: PersonCardID.P3203,
        cost: cost(10, 0, 10),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "S3204": schoolCard({
        era: IEra.THREE,
        region: Region.WE,
        name: "Left Bank Group",
        cardId: SchoolCardID.S3204,
        cost: cost(7, 8, 0),
        vp: 11,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 3,
    }),
    "F3205": filmCard({
        era: IEra.THREE,
        region: Region.WE,
        name: "The Godsun",
        cardId: FilmCardID.F3205,
        cost: cost(8, 6, 8),
        vp: 11,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F3206": filmCard({
        era: IEra.THREE,
        region: Region.WE,
        name: "Fitzcarraldo",
        cardId: FilmCardID.F3206,
        cost: cost(8, 8, 2),
        vp: 11,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F3207": filmCard({
        era: IEra.THREE,
        region: Region.WE,
        name: "Last Year at Marienbad",
        cardId: FilmCardID.F3207,
        cost: cost(9, 0, 10),
        vp: 11,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 3,
    }),
    "F3208": filmCard({
        era: IEra.THREE,
        region: Region.WE,
        name: "Eight and a Half",
        cardId: FilmCardID.F3208,
        cost: cost(8, 0, 12),
        vp: 13,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 3,
    }),
    "F3209": filmCard({
        era: IEra.THREE,
        region: Region.WE,
        name: "Jules and Jim",
        cardId: FilmCardID.F3209,
        cost: cost(7, 4, 9),
        vp: 15,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F3210": filmCard({
        era: IEra.THREE,
        region: Region.WE,
        name: "Golden Eye",
        cardId: FilmCardID.F3210,
        cost: cost(9, 9, 0),
        vp: 12,
        category: CardCategory.NORMAL,
        industry: 2,
        aesthetics: 0,
    }),
    "F3211": filmCard({
        era: IEra.THREE,
        region: Region.WE,
        name: "The Adventure",
        cardId: FilmCardID.F3211,
        cost: cost(8, 0, 9),
        vp: 12,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F3212": filmCard({
        era: IEra.THREE,
        region: Region.WE,
        name: "Persona",
        cardId: FilmCardID.F3212,
        cost: cost(6, 3, 9),
        vp: 12,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 2,
    }),
    "F3213": filmCard({
        era: IEra.THREE,
        region: Region.WE,
        name: "Kes",
        cardId: FilmCardID.F3213,
        cost: cost(7, 4, 6),
        vp: 9,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "P3301": personCard({
        era: IEra.THREE,
        region: Region.EE,
        name: "Andrei Tarkovsky",
        cardId: PersonCardID.P3301,
        cost: cost(9, 4, 10),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "P3302": personCard({
        era: IEra.THREE,
        region: Region.EE,
        name: "Sergi Bondarchuk",
        cardId: PersonCardID.P3302,
        cost: cost(9, 10, 4),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "F3303": filmCard({
        era: IEra.THREE,
        region: Region.EE,
        name: "Three Colors: Blue",
        cardId: FilmCardID.F3303,
        cost: cost(9, 0, 11),
        vp: 14,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 2,
    }),
    "F3304": filmCard({
        era: IEra.THREE,
        region: Region.EE,
        name: "War and Peace",
        cardId: FilmCardID.F3304,
        cost: cost(8, 10, 4),
        vp: 13,
        category: CardCategory.LEGEND,
        industry: 2,
        aesthetics: 0,
    }),
    "F3305": filmCard({
        era: IEra.THREE,
        region: Region.EE,
        name: "Underground",
        cardId: FilmCardID.F3305,
        cost: cost(9, 4, 6),
        vp: 9,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F3306": filmCard({
        era: IEra.THREE,
        region: Region.EE,
        name: "Most",
        cardId: FilmCardID.F3306,
        cost: cost(8, 9, 3),
        vp: 12,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F3307": filmCard({
        era: IEra.THREE,
        region: Region.EE,
        name: "Office Romance",
        cardId: FilmCardID.F3307,
        cost: cost(9, 3, 5),
        vp: 8,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 0,
    }),
    "F3308": filmCard({
        era: IEra.THREE,
        region: Region.EE,
        name: "The Red and the White",
        cardId: FilmCardID.F3308,
        cost: cost(8, 3, 6),
        vp: 9,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F3309": filmCard({
        era: IEra.THREE,
        region: Region.EE,
        name: "Solaris",
        cardId: FilmCardID.F3309,
        cost: cost(6, 4, 8),
        vp: 11,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F3310": filmCard({
        era: IEra.THREE,
        region: Region.EE,
        name: "Triumph Over Violence",
        cardId: FilmCardID.F3310,
        cost: cost(8, 3, 5),
        vp: 8,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F3311": filmCard({
        era: IEra.THREE,
        region: Region.EE,
        name: "The Diamond Arm",
        cardId: FilmCardID.F3311,
        cost: cost(7, 4, 4),
        vp: 7,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 0,
    }),
    "F3312": filmCard({
        era: IEra.THREE,
        region: Region.EE,
        name: "Marketa Lazarova",
        cardId: FilmCardID.F3312,
        cost: cost(9, 7, 4),
        vp: 10,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "P3401": personCard({
        era: IEra.THREE,
        region: Region.ASIA,
        name: "Zhang Yimou",
        cardId: PersonCardID.P3401,
        cost: cost(10, 5, 5),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "P3402": personCard({
        era: IEra.THREE,
        region: Region.ASIA,
        name: "Kar Wai Wong",
        cardId: PersonCardID.P3402,
        cost: cost(9, 4, 7),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "P3403": personCard({
        era: IEra.THREE,
        region: Region.ASIA,
        name: "Abbas Kiarostami",
        cardId: PersonCardID.P3403,
        cost: cost(10, 0, 9),
        vp: 0,
        category: CardCategory.LEGEND,
        industry: 0,
        aesthetics: 0,
    }),
    "F3404": filmCard({
        era: IEra.THREE,
        region: Region.ASIA,
        name: "Farwell My Concubine",
        cardId: FilmCardID.F3404,
        cost: cost(8, 4, 9),
        vp: 12,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 2,
    }),
    "F3405": filmCard({
        era: IEra.THREE,
        region: Region.ASIA,
        name: "Chungking Express",
        cardId: FilmCardID.F3405,
        cost: cost(8, 4, 6),
        vp: 9,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F3406": filmCard({
        era: IEra.THREE,
        region: Region.ASIA,
        name: "A Better Tomorrow",
        cardId: FilmCardID.F3406,
        cost: cost(8, 8, 3),
        vp: 11,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F3407": filmCard({
        era: IEra.THREE,
        region: Region.ASIA,
        name: "Tora-san",
        cardId: FilmCardID.F3407,
        cost: cost(8, 6, 2),
        vp: 9,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 0,
    }),
    "F3408": filmCard({
        era: IEra.THREE,
        region: Region.ASIA,
        name: "Red Sorghum",
        cardId: FilmCardID.F3408,
        cost: cost(7, 4, 7),
        vp: 10,
        category: CardCategory.NORMAL,
        industry: 1,
        aesthetics: 1,
    }),
    "F3409": filmCard({
        era: IEra.THREE,
        region: Region.ASIA,
        name: "Hibiscus Town",
        cardId: FilmCardID.F3409,
        cost: cost(8, 2, 7),
        vp: 10,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F3410": filmCard({
        era: IEra.THREE,
        region: Region.ASIA,
        name: "A Touch of Zen",
        cardId: FilmCardID.F3410,
        cost: cost(6, 4, 7),
        vp: 10,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 8,
    }),
    "F3411": filmCard({
        era: IEra.THREE,
        region: Region.ASIA,
        name: "Seopyeonje",
        cardId: FilmCardID.F3411,
        cost: cost(7, 3, 7),
        vp: 10,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F3412": filmCard({
        era: IEra.THREE,
        region: Region.ASIA,
        name: "A Story of the Cruelties of Youth",
        cardId: FilmCardID.F3412,
        cost: cost(7, 0, 6),
        vp: 9,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 0,
    }),
    "F3413": filmCard({
        era: IEra.THREE,
        region: Region.ASIA,
        name: "The Boys from Fengkuei",
        cardId: FilmCardID.F3413,
        cost: cost(8, 0, 6),
        vp: 9,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
    "F3414": filmCard({
        era: IEra.THREE,
        region: Region.ASIA,
        name: "Taste of Cherry",
        cardId: FilmCardID.F3414,
        cost: cost(7, 0, 7),
        vp: 10,
        category: CardCategory.NORMAL,
        industry: 0,
        aesthetics: 1,
    }),
}

export function getCardById(id: string): INormalOrLegendCard {
    if (id in NoneBasicCards) {
        // @ts-ignore
        return NoneBasicCards[id];
    } else {
        if (id in BasicCardID) {
            // @ts-ignore
            return getBasicCard(id as BasicCardID);
        } else {
            if (id in EventCardID) {
                return eventCardById(id as EventCardID) as unknown as INormalOrLegendCard;
            } else {
                if (id in ScoreCardID) {
                    return getScoreCardByID(id);
                } else {
                    throw new Error("No such card id " + id)
                }
            }
        }
    }
}

export function schoolCardsByEra(e: IEra) {
    let cards = Object.entries(NoneBasicCards);
    let res = cards.filter(c => c[1].era === e).filter(c => c[1].type === CardType.S)
    return res.map(c => c[1]);
}

export function filmCardsByEra(e: IEra) {
    let cards = Object.entries(NoneBasicCards);
    let res = cards.filter(c => c[1].era === e).filter(c => c[1].type === CardType.F)
    return res.map(c => c[1]);
}

export function cardsByCond(r: Region, e: IEra, isLegend: boolean = false): INormalOrLegendCard[] {
    let cards = Object.entries(NoneBasicCards);
    let res = cards.filter(c => c[1].era === e).filter(c => c[1].region === r)

    if (isLegend) {
        res = res.filter(c => c[1].category === CardCategory.LEGEND)
    } else {
        res = res.filter(c => c[1].category === CardCategory.NORMAL)
    }
    return res.map(c => c[1]);
}
