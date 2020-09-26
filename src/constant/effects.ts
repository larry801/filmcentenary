import {IG} from "../types/setup";
import {Ctx} from "boardgame.io";
import {IEra, Region} from "../types/core";

export function getCardEffect(id: string): any {
    // @ts-ignore
    return effects[id];
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

const eventEffects ={
    "E01":{
        e:"step",
        a:[
            {e:"enableHollyWood",a:1},
            {e:"everyPlayer",a:{e:"industryOrAestheticsLevelUp",a:1}}
        ]
    },
    "E02":{
        e:"step",
        a:[
            {e:"everyPlayer",a:{e:"deposit",a:2}},
            {e:"everyPlayer",a:{e:"discard",a:1}},
            {e:"respond",a:{e:"discard",a:1}},
        ]
    },
    "E03": {e:"active",a:"E03"},
    "E04":{
        e:"step",
        a:[
            {e:"everyPlayer",a:{e:"buyCard",a:"B05"}},
            {e:"playerVpChampion",a:{e:"optional",a:{e:"discard",a:1}}},
        ]
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
        archive: {e: "pay", a: {e: "vp", a: 2}},
    },
    "B05": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "choice", a: [
                {e: "drawCard", a: 1},
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
                {e: "buyCard", a: "1103"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "update", a: 1},
                {e: "noStudio", a: {e: "discard", a: 1}},
                {e: "studio", a: {e: "drawCard", a: 1}},
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
                {e: "buyCard", a: "1104"},
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
        play:
            {
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
        archive: {e: "alternative", a: {e: "buyCard", a: "2107"}, o: true},
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
                        {e: "drawCard", a: 1},
                    ]
                },
                {
                    e: "step", a: [
                        {e: "deposit", a: 1},
                        {e: "drawCard", a: 1},
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
                {e: "step", a: [{e: "deposit", a: 1}, {e: "drawCard", a: 1}]},
                {e: "step", a: [{e: "deposit", a: 1}, {e: "drawCard", a: 1}]},
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
        archive: {e: "pay", a: {e: "deposit", a: 1},},
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
        archive: {e: "none", a: "",},
    },
    "1201": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "aestheticsUp", a: 1},
                {e: "buyCard", a: "1207"},
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
        archive: {e: "none", a: "",},
    },
    "1202": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryUp", a: 1},
                {e: "buyCard", a: "1210"},
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
                {e: "buyCard", a: "1104"},
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
                result: {e: "drawCard", a: 2}
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
                {e: "buyCard", a: "1305"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "vp", a: 1},
                {e: "studio", a: {e: "drawCard", a: 1}},
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
                {e: "drawCard", a: 2},
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
                {e: "step", a: [{e: "res", a: 1}, {e: "drawCard", a: 1}]},
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
        play: {e: "step", a: [{e: "drawCard", a: 1}, {e: "vp", a: 1}]},
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
                {e: "buyCard", a: "2114"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "noStudio", a: {e: "discardIndustry", a: 1}},
                {e: "studio", a: {e: "buyCardIntoHand", a: "B02"}},
                {e: "drawCard", a: 1},
                {
                    e: "optional", a: {
                        e: "competition", a: {
                            bonus: 1,
                            onWin: {e: "share", a: 1}
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
                {e: "buyCard", a: "2107"},
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
        "school": {
            hand: 5,
            action: 2,
        },
        response: {
            pre: {type: "loseVp"},
            effect: {e: "res", a: 1},
        },
    }
}
