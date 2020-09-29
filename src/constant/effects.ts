import {IG} from "../types/setup";
import {Ctx} from "boardgame.io";
import {EventCardID, IEra, Region} from "../types/core";

export function getEvent(id: EventCardID) {
    return eventEffects[id];
}

export function getCardEffect(id: string): any {
    // @ts-ignore
    return effects[id]
}

const noEff = {e: "none", a: ""};
const noResponse = {pre: "none", effect: noEff};

export interface CardEffect {
    canBuy: (G: IG, ctx: Ctx) => boolean,
    canArchive: (G: IG, ctx: Ctx) => boolean,
    canPlay: (G: IG, ctx: Ctx) => boolean,
    play: IEff,
    archive: IEff,
    buy: IEff,
}

export interface IEff {
    e: string,
    a: IEff[] | number | string,
}

const eventEffects = {
    "E01": {
        e: "step",
        a: [
            {e: "enableHollywood", a: 1},
            {e: "everyPlayer", a: {e: "industryOrAestheticsLevelUp", a: 1}}
        ]
    },
    "E02": {
        e: "step",
        a: [
            {e: "everyPlayer", a: {e: "deposit", a: 2}},
            {e: "everyPlayer", a: {e: "discard", a: 1}},
            {e: "respond", a: {e: "discard", a: 1}},
        ]
    },
    "E03": {e: "active", a: "E03"},
    "E04": {
        e: "step",
        a: [
            {e: "everyPlayer", a: {e: "buy", a: "B05"}},
            {e: "playerVpChampion", a: {e: "optional", a: {e: "discard", a: 1}}},
        ]
    },
    "E05": {
        e: "step",
        a: [
            {e: "everyPlayer", a: {e: "deposit", a: 3}},
            {e: "buildingNA", a: {e: "discard", a: 2}},
        ]
    },
    "E06": {
        e: "step",
        a: [
            {e: "everyPlayer", a: {e: "buy", a: "B05"}},
            {e: "playerVpChampion", a: {e: "aestheticsLevelUp", a: 1}},

        ]
    },
    "E07": {
        e: "step",
        a: [
            {e: "everyPlayer", a: {e: "industryOrAestheticsLevelUp", a: 1}},
            {e: "playerNotVpChampion", a: {e: "buy", a: "B04"}},
        ]
    },
    "E08": {
        e: "step",
        a: [
            {e: "everyPlayer", a: {e: "archiveToEEBuildingVP", a: 1}},
            {e: "noBuildingEE", a: {e: "buy", a: "B04"}},
        ]
    },
    "E09": {
        e: "step",
        a: [
            {e: "enableBollywood", a: 1},
            {e: "aesLowest", a: {e: "aestheticsLevelUp", a: 1}},
            {e: "industryLowest", a: {e: "industryLevelUp", a: 1}},
        ]
    },
    "E10": {
        e: "toPlayerArchive", a: 1,
    },
    "E11": {
        e: "toPlayerArchive", a: 1,
    },
    "E12": {
        e: "toPlayerArchive", a: 1,
    },
    "E13": {
        e: "toPlayerArchive", a: 1,
    },
    "E14": {
        e: "toPlayerArchive", a: 1,
    },
}

const effects = {
    "B01": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {e: "res", a: 1},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
    },
    "B02": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {e: "res", a: 1},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
    },
    "B03": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "pay", a: {
                cost: {e: "vp", a: 2}, eff: {
                    e: "step", a: [
                        {e: "res", a: 1},
                        {e: "deposit", a: 1},
                    ]
                }
            }
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
    },
    "B04": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e: "res", a: 1},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "pay", a: {pay: {e: "vp", a: 2}}},
    },
    "B05": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "choice", a: [
                {e: "draw", a: 1},
                {e: "aesAward", a: 1}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
    },
    "B07": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {e: "res", a: 1},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
    },
    "1101": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryUp", a: 1},
                {e: "buy", a: "1103"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "update", a: 1},
                {e: "noStudio", a: {e: "discard", a: 1}},
                {e: "studio", a: {e: "draw", a: 1}},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,

    },
    "1102": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryUp", a: 1},
                {e: "buy", a: "1104"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "update", a: 1},
                {e: "noStudio", a: {e: "loseCash", a: 1}},
                {e: "studio", a: {e: "deposit", a: 1}},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: {
            pre: {type: "eventCard", a: "E02"},
            effect: {
                o: true, e: "step", a: [
                    {e: "searchAndArchive", a: "1102"},
                    {e: "addVp", a: 2}
                ]
            },
        },
    },
    "1103": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era", a: [
                {e: "step", a: [{e: "res", a: 1}, {e: "shareToVp", a: Region.NA}]},
                {e: "deposit", a: 1},
                {e: "vp", a: 2},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "update", a: 1},
        response: noResponse,

    },
    "1104": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {e: "deposit", a: 1},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "alternative", a: {e: "buy", a: "2107"}, o: true},
    },
    "1105": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.NA].era !== IEra.THREE,
        play: {
            e: "era", a: [
                {
                    e: "step", a: [
                        {e: "deposit", a: 1},
                        {e: "draw", a: 1},
                    ]
                },
                {
                    e: "step", a: [
                        {e: "deposit", a: 1},
                        {e: "draw", a: 1},
                    ]
                },
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        response: noResponse,
        archive: noEff,
    },
    "1106": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.NA].era !== IEra.THREE,
        play: {
            e: "era", a: [
                {e: "step", a: [{e: "deposit", a: 1}, {e: "draw", a: 1}]},
                {e: "step", a: [{e: "deposit", a: 1}, {e: "draw", a: 1}]},
                noEff,
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        response: noResponse,
        archive: noEff,
    },
    "1107": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era", a: [
                {e: "step", a: [{e: "deposit", a: 2}, {e: "vp", a: 1}]},
                {e: "aesAward", a: 1},
                {e: "aesAward", a: 1},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => G.regions[Region.NA].era !== IEra.ONE,
        response: noResponse,
        archive: {
            e: "era", a: [
                noEff,
                {e: "aestheticsBreakthrough", a: 1},
                {e: "aestheticsBreakthrough", a: 1},
            ]
        },
    },
    "1108": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        response: noResponse,
        archive: {e: "pay", a: {pay: {e: "deposit", a: 1}}},
    },
    "1109": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era", a: [
                {e: "step", a: [{e: "res", a: 2}, {e: "share", a: 1}]},
                {e: "deposit", a: 1}, {e: "vp", a: 1},
                {e: "deposit", a: 1}, {e: "vp", a: 1},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        response: noResponse,
        archive: noEff,
    },
    "1110": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era", a: [
                {e: "vp", a: 1},
                {e: "vp", a: 2},
                {e: "vp", a: 3},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        response: noResponse,
        archive: noEff,
    },
    "1201": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "aestheticsUp", a: 1},
                {e: "buy", a: "1207"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "comment", a: 1},
                {e: "noStudio", a: {e: "discardIndustry", a: 1}},
                {e: "studio", a: {e: "deposit", a: 1}},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        response: noResponse,
        archive: noEff,
    },
    "1202": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryUp", a: 1},
                {e: "buy", a: "1210"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "update", a: 1},
                {e: "noStudio", a: {e: "discardAesthetics", a: 1}},
                {e: "studio", a: {e: "literary", a: 1}},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: {
            pre: {type: "eventCard", a: "E02"},
            effect: {o: true, e: "step", a: [{e: "searchAndArchive", a: "1102"}, {e: "addVp", a: 2}]},
        },
    },
    "1203": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        "school": {
            hand: 4,
            action: 1,
        },
        response: {
            pre: {type: "loseSchool"},
            effect: {e: "aestheticsUp", a: 1},
        },
    },
    "1204": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        "school": {
            hand: 4,
            action: 2,
        },
        response: {
            pre: {type: "breakthrough"},
            effect: {e: "deposit", a: 1},
        },
    },
    "1205": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryUp", a: 1},
                {e: "buy", a: "1104"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era", a: [
                {e: "res", a: 2},
                {e: "deposit", a: 1},
                {e: "deposit", a: 1},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,

    },
    "1206": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era", a: [
                {e: "step", a: [{e: "card", a: 1}, {e: "share", a: 1}]},
                {e: "step", a: [{e: "vp", a: 2}, {e: "comment", a: 1}]},
                {e: "step", a: [{e: "vp", a: 2}, {e: "comment", a: 1}]},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => G.regions[Region.WE].era !== IEra.ONE,
        archive: {
            e: "era", a: [
                noEff,
                {e: "othersBuy", a: "B04"},
                {e: "othersBuy", a: "B04"},
            ]
        },
        response: noResponse,
    },
    "1207": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.WE].era !== IEra.THREE,
        play: {
            e: "era", a: [
                {e: "step", a: [{e: "resFromIndustry", a: 1}, {e: "card", a: 1}]},
                {e: "step", a: [{e: "deposit", a: 1}, {e: "vp", a: 1}]},
                noEff,
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => G.regions[Region.NA].era !== IEra.ONE,
        archive: {
            e: "era", a: [
                noEff,
                {e: "aestheticsBreakthrough", a: 1},
                {e: "aestheticsBreakthrough", a: 1},
            ]
        },
        response: noResponse,
    },
    "1208": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "deposit", a: 1},
                {e: "shareToVp", a: 1},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "1209": {
        buy: noEff,
        canBuy: (G: IG, ctx: Ctx) => true,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "pay", a: {
                pay: {e: "res", a: 1},
                eff: {e: "draw", a: 2}
            },
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "1210": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.WE].era === IEra.ONE,
        play: {
            e: "era", a: [
                {e: "res", a: 2},
                noEff,
                noEff,
            ],
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "step", a: [{e: "vp", a: 5}, {e: "deposit", a: 2}]},
        response: {
            pre: {type: "none", a: "E02"},
            effect: noEff,
        },
    },
    "1211": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.WE].era !== IEra.THREE,
        play: {
            e: "era", a: [
                {e: "res", a: 2},
                {e: "comment", a: 1},
                noEff,
            ],
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: {pre: {type: "discard"}, effect: {e: "deposit", a: 1}},

    },
    "1301": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        "school": {
            hand: 4,
            action: 2,
        },
        response: {
            pre: {type: "turnStart"},
            effect: {e: "step", a: [{e: "vp", a: 1}, {e: "discardAndDraw", a: 1}]},
        },
    },
    "1302": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "aestheticsUp", a: 1},
                {e: "buy", a: "1305"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "vp", a: 1},
                {e: "studio", a: {e: "draw", a: 1}},
                {e: "studio", a: {e: "archiveHand", a: 1}},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: {
            pre: {type: "none", a: "E02"},
            effect: noEff,
        },
    },
    "1303": {
        "school": {
            hand: 4,
            action: 2,
        },
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: {
            pre: {type: "othersBuySchool"},
            effect: {e: "step", a: [{e: "deposit", a: 1}, {e: "vp", a: 1}]},
        },
    },
    "1304": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.WE].era !== IEra.THREE,
        play: {
            e: "era", a: [
                {e: "step", a: [{e: "res", a: 2}, {e: "vp", a: 1}]},
                {e: "step", a: [{e: "deposit", a: 1}, {e: "vp", a: 2}]},
                noEff,
            ],
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "comment", a: 1},
        response: noResponse,
    },
    "1305": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era", a: [
                {e: "draw", a: 2},
                {e: "archiveHand", a: 1},
                {e: "vp", a: 2},
            ],
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,

    },
    "1306": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.WE].era !== IEra.THREE,
        play: {
            e: "era", a: [
                {e: "step", a: [{e: "res", a: 1}, {e: "draw", a: 1}]},
                {e: "res", a: 1},
                noEff,
            ],
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "1307": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {e: "step", a: [{e: "draw", a: 1}, {e: "vp", a: 1}]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2101": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
        school: {
            hand: 6,
            action: 2,
        },
    },
    "2102": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryUp", a: 1},
                {e: "buy", a: "2114"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "noStudio", a: {e: "discardIndustry", a: 1}},
                {e: "studio", a: {e: "buyCardIntoHand", a: "B02"}},
                {e: "draw", a: 1},
                {
                    e: "optional", a: {
                        e: "competition", a: {
                            bonus: 0,
                            onWin: noEff,
                        }
                    }
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2103": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryUp", a: 1},
                {e: "buy", a: "2107"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "buyCardToHand", a: "B05"},
                {
                    e: "noStudio", a: {
                        e: "step", a: [
                            {e: "discard", a: 1},
                            {e: "buyCardToHand", a: "B04"},
                        ]
                    }
                },
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2104": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        "school": {
            hand: 5,
            action: 2,
        },
        response: {
            pre: {type: "loseVp"},
            effect: {e: "res", a: 1},
        },
    },
    "2105": {
        buy: {
            e: "choice", a: [
                {e: "aestheticsUp", a: 1},
                {e: "buy", a: "2109"},
            ]
        },
        play: {
            e: "step",
            a: [
                {e: "comment", a: 1},
                {e: "buy", a: "B01"},
                {e: "noStudio", a: {e: "buy", a: "B04"}},
                {e: "studio", a: {e: "draw", a: 1}},
            ]
        }
    },
    "2106": {
        play: {
            e: "era", a: [
                noEff,
                {e: "step", a: [{e: "res", a: 4}, {e: "share", a: 1}]},
                {
                    e: "step", a: [
                        {e: "deposit", a: 2},
                        {e: "vp", a: 2},
                    ]
                }
            ]
        },
    },
    "2107": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "buy", a: "B02"},
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era", a: [
                {e: "res", a: 3},
                {
                    e: "step", a: [
                        {e: "vp", a: 2},
                        {e: "res", a: 2},
                    ]
                },
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2108": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                noEff,
                {
                    e: "step", a: [
                        {e: "res", a: 2},
                        {e: "deposit", a: 1},]
                }, {
                    e: "step", a: [
                        {e: "draw", a: 1},
                        {e: "vp", a: 2},
                    ]
                },
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2109": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era", a: [
                noEff,
                {e: "draw", a: 2},
                {e: "buy", a: "B05"},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {
            e: "step", a: [
                {e: "vp", a: 5},
                {e: "archive", a: 1},
            ]
        },
        response: noResponse,
    },
    "2110": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                noEff,
                {e: "res", a: 3},
                {e: "res", a: 1},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {
            e: "choice", a: [
                {e: "industryBreakthrough", a: 1},
                {e: "buy", a: "3111"},
            ]
        },
        response: noResponse,
    },
    "2111": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step",
            a: [
                {e: "loseVp", a: 1},
                {
                    e: "choice", a: [
                        {e: "aesAward", a: 1},
                        {e: "industryAward", a: 1},]
                },
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2112": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era",
            a: [
                noEff,
                {
                    e: "step", a: [
                        {e: "res", a: 3},
                        {e: "shareToVp", a: Region.NA},
                        {e: "optional", a: {e: "competition", a: 0,}}
                    ]
                },
                {
                    e: "step", a: [
                        {e: "res", a: 2},
                        {e: "optional", a: {e: "competition", a: 0,}}
                    ]
                },
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2113": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era",
            a: [
                noEff,
                {
                    e: "step", a: [
                        {e: "res", a: 3},
                        {e: "loseVp", a: 1},
                    ]
                },
                {
                    e: "pay", a: {
                        cost: {e: "vp", a: 1},
                        eff: {
                            e: "step", a: [
                                {e: "deposit", a: 1},
                                {e: "vp", a: 3},
                            ]
                        }
                    }
                },
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2114": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era",
            a: [
                noEff,
                {
                    e: "step", a: [
                        {e: "res", a: 2},
                        {e: "buy", a: "B01"},
                    ]
                },
                {
                    e: "step", a: [
                        {e: "deposit", a: 1},
                        {e: "comment", a: 1},
                    ]
                },
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "aesAward", a: 2},
        response: noResponse,
    },
    "2201": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {
            e: "step", a: [
                {e: "deposit", a: 1},
                {e: "vp", a: 2},
            ]
        },
        response: {
            type: "buyAesthetics",
        },
        school: {
            hand: 5,
            action: 2,
        },
    },
    "2202": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2203": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryLevelUp", a: 1},
                {e: "buy", a: "2209"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a:
                [
                    {e: "res", a: 3},
                    {e: "vp", a: 3},
                    {e: "discard", a: {e: "loseVp", a: 2}},
                ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2204": {
        school: {
            hand: 5,
            action: 2,
        },
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: {
            e: "comment", a: {
                e: "step", a:
                    [
                        {e: "res", a: 1},
                        {e: "vp", a: 1},
                    ]
            }
        },
    },
    "2205": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "aestheticsLevelUp", a: 1},
                {e: "buy", a: "2206"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "comment", a: 1},
                {e: "draw", a: 1},
                {e: "noStudio", a: {e: "buy", a: "B03"}},
                {e: "studio", a: {e: "vp", a: 3}},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2206": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a:
                [
                    noEff,
                    {
                        e: "step", a: [
                            {e: "deposit", a: 1},
                            {e: "loseVp", a: 1},
                        ]
                    },
                    {
                        e: "step", a: [
                            {e: "draw", a: 2},
                            {e: "aesAward", a: 1},
                            {e: "comment", a: 1},
                        ]
                    },
                ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2207": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "choice", a:
                [
                    noEff,
                    {
                        e: "choice", a:
                            [
                                {e: "res", a: 2},
                                {e: "deposit", a: 1},
                            ]
                    },
                    {e:"breakthrough",a:{e:"resDeduct",a:2}},
                ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2208": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a:
                [
                    noEff,
                    {
                        e: "step", a:
                            [
                                {e: "res", a: 1},
                                {e: "draw", a: 2},
                            ]
                    },
                    {
                        e: "step", a: [
                            {e: "res", a: 1},
                            {e: "draw", a: 1},
                        ]
                    },
                ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2209": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a:[
                noEff,
                {e:"step",a: [
                        {e: "res", a: 2},
                        {e: "share", a: 1},
                    ]},
                {e:"step",a: [
                        {e: "res", a: 2},
                        {e: "aesAward", a: 1},
                    ]}
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2210": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"choice",a: [
                {e: "draw", a: 2},
                {e:"breakthrough",a:{e:"resDeduct",a:2}},
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2211": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e:"step",a: [
                {e: "comment", a: 1},
                {e: "loseVp", a: 2},
            ]},
        response: noResponse,
    },
    "2212": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"step",a: [
                {e: "res", a: 2},
                {e: "comment", a: 1},
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2213": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a: [
                noEff,
                {e: "step", a: [
                        {e: "res", a: 2},
                        {e: "draw", a: 1},
                        {e: "loseVp", a: 1},
                    ]},
                {e: "step", a: [
                        noEff,
                        {e: "draw", a: 1},
                        {e: "loseVp", a: 1},
                    ]},
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2214": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a: [
                noEff,
                {e: "step", a: [
                        {e: "res", a: 3},
                        {e: "shareToVp", a: 1},
                    ]},
                {e: "step", a: [
                        {e: "res", a: 2},
                        {e: "draw", a: 2},
                    ]},
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2301": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
        school:{
            hand: 5,
            action: 3,
        },
        continuous:{
          response:{
              e:"buyNoneEEFilm",a:{e:"extraVp",a:1},
          }
        },
    },
    "2302": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e:"choice",a: [
            {e: "aestheticsLevelUp", a: 1},
                {e: "buy", a: 2305},
            ]},
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"step",a: [{e: "draw", a: 1},
                {e: "studio", a: {e:"handToOthers",a:1}},
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2303": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a: [
                noEff,
                {e: "step", a: [
                        {e: "res", a: 2},
                        {e: "deposit", a: 1},
                        {e:"draw",a:1}
                    ]},
                {e: "step", a: [{e:"draw",a:2},
                    {e:"discard",a:2}]},
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2304": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a:[
            noEff,
                {e:"step",a:[{e:"res",a:1},{e:"draw",a:2}]},
                {e:"draw",a:2}
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2305": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a:[noEff,{e:"step",a:[{e:"res",a:2},{e:"draw",a:1}]},
            {e:"step",a:[{e:"vp",a:2},{e:"draw",a:1}]}]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2306": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a:[noEff,{e:"step",a:[{e:"res",a:2},{e:"archive",a:1}]},
            {e:"archive",a:1}]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2307": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a:[
            noEff,
                {e:"step",a:[{e:"vp",a:3},{e:"draw",a:1}]},
                {e:"step",a:[{e:"vp",a:3},{e:"comment",a:1}]}

            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2308": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a:[noEff,{e:"step",a:[
            noEff,
            {e:"step",a:[{e:"res",a:3},{e:"shareToVp",a:1}]},
                    {e:"res",a:3}
                ]}]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2309": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a:[noEff,{e:"draw",a:1},{e:"step",a:[
            {e:"draw",a:3},
            {e:"discard",a:2},
                ]}]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2401": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e:"choice",a:[
            {e:"industryLevelUp",a:1},
                {e:"buy",a:"2406"}
            ]},
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"step",a:[
            {e:"deposit",a:1},
                {e:"noStudio",a:{e:"discard",a:1}},
                {e:"studio",a:{e:"peek",a:{
                    count:3,hand:1,
                        }}}
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2402": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e:"choice",a:[
                {e:"aestheticsLevelUp",a:1},
                {e:"buy",a:"2404"}
            ]},
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"step",a:[
            {e:"share",a:1},{e:"noStudio",a:{e:"buy",a:"B04"}},{e:"studio",a:{e:"draw",a:1}}
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2403": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a:[noEff,
            {e:"step",a:[{e:"res",a:2},
                    {e:"peekAesthetics",a:{count:3}},]},
            {e:"step",a:[{e:"vp",a:2},{e:"peekAesthetics",a:{count:3}},]}
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2404": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a:[noEff,
            {e:"step",a:[{e:"res",a:3},{e:"vp",a:1}]},
                {e:"step",a:[{e:"vp",a:2},{e:"peekAsia",a:{count:3}}]}
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2405": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"choice",a:[
            {e:"step",a:[{e:"res",a:1},{e:"update",a:1}]},
                {e:"breakthrough",a:{e:"resDeduct",a:2}},
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2406": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a: [
                noEff,
                {
                    e: "step", a:
                        [
                            {e: "res", a: 2},
                            {e: "deposit", a: 1},
                        ]
                },
                {e: "peekIndustry", a: {count:3}},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2407": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a:[
            noEff,
                {e:"res",a:3},
                {e:"step",a:[
                        {e:"res",a:1},
                        {e:"vp",a:2}
                    ]}
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2408": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a:[noEff,
            {e:"step",a:[{e:"res",a:3},{e:"update",a:1}]},
            {e:"step",a:[
                {e:"comment",a:1},
                    {e:"peekAesthetics",a:{count:2}},
            ]},

            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2409": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a:[
            noEff,
                {e:"step",a:[
                    {e:"res",a:2},{e:"vp",a:2},
                    ]},
                {e:"step",a:[
                    {e:"res",a:1},{e:"update",a:1}
                    ]}
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2410": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e:"era",a:[
            noEff,
                {e:"step",a:[{e:"res",a:1},{e:"deposit",a:1}]},
                {e:"peek",a:{count:2,a:{era:IEra.TWO}}}
            ]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3206":
        {
            canBuy: (G: IG, ctx: Ctx) => true,
            buy: noEff, canPlay: (G: IG, ctx: Ctx) => true,
            play: {
                e: "step", a:
                    [
                        {e: "res", a: 3},
                        {e: "vp", a: 3},
                        {e: "discard", a: 1},
                    ]
            },
            canArchive: (G: IG, ctx: Ctx) => true,
            archive: noEff,
            response: noResponse,
        },
}
