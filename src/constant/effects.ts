import {IG} from "../types/setup";
import {Ctx} from "boardgame.io";
import {IEra, Region} from "../types/core";

export function getCardEffect(id: string): any {
    // @ts-ignore
    return effects[id];
}

export interface CardEffect {
    canBuy: (G: IG, ctx: Ctx) => boolean,
    canArchive: (G: IG, ctx: Ctx) => boolean,
    canPlay: (G: IG, ctx: Ctx) => boolean,
    play: IEff,
    archive: IEff,
    buy: IEff,
}

/*
*
*
* */
export interface IEff {
    e: string,
    a: IEff[] | number | string,
}

const effects = {
    "B01": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {e: "res", a: 1},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "none", a: ""},
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
        archive: {e: "none", a: ""},
        response: {pre:"none", effect:{e:"none",a:""},},

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
                {e: "studio", a: {e: "cash", a: 1}},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "none", a: ""},
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
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => true,
        play:
            {
                e: "era", a: [
                    {e: "step", a: [{e: "res", a: 1}, {e: "shareToVp", a: Region.NA}]},
                    {e: "cash", a: 1},
                    {e: "vp", a: 2},
                ]
            },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "update", a: 1},
        response: {pre:"none", effect:{e:"none",a:""},},

    },
    "1104": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {e: "cash", a: 1},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "alternative", a: {e: "buyCard", a: "2107"}, o: true},
    },
    "1105": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.NA].era !== IEra.THREE,
        play: {
            e: "era", a: [
                {
                    e: "step", a: [
                        {e: "cash", a: 1},
                        {e: "drawCard", a: 1},
                    ]
                },
                {
                    e: "step", a: [
                        {e: "cash", a: 1},
                        {e: "drawCard", a: 1},
                    ]
                },
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        response: {pre:"none", effect:{e:"none",a:""},},
        archive: {e: "none", a: ""},
    },
    "1106": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.NA].era !== IEra.THREE,
        play: {
            e: "era", a: [
                {e: "step", a: [{e: "cash", a: 1}, {e: "drawCard", a: 1}]},
                {e: "step", a: [{e: "cash", a: 1}, {e: "drawCard", a: 1}]},
                {e: "none", a: ""},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        response: {pre:"none", effect:{e:"none",a:""},},
        archive: {e: "none", a: ""},
    },
    "1107": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era", a: [
                {e: "step", a: [{e: "cash", a: 2}, {e: "vp", a: 1}]},
                {e: "comment", a: 1},
                {e: "comment", a: 1},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => G.regions[Region.NA].era !== IEra.ONE,
        response: {pre:"none", effect:{e:"none",a:""},},
        archive: {
            e: "era", a: [
                {e: "none", a: ""},
                {e: "aestheticsBreakthrough", a: 1},
                {e: "aestheticsBreakthrough", a: 1},
            ]
        },
    },
    "1108": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e: "none", a: ""},
        canArchive: (G: IG, ctx: Ctx) => true,
        response: {pre:"none", effect:{e:"none",a:""},},
        archive: {e: "pay", a: {e: "cash", a: 1},},
    },
    "1109": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era", a: [
                {e: "step", a: [{e: "res", a: 2}, {e: "share", a: 1}]},
                {e: "choice", a: [{e: "step", a: [{e: "cash", a: 1}, {e: "vp", a: 1}]}, {e: "competition", a: 1},]},
                {e: "choice", a: [{e: "step", a: [{e: "cash", a: 1}, {e: "vp", a: 1}]}, {e: "competition", a: 1},]},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        response: {pre:"none", effect:{e:"none",a:""},},
        archive: {e: "none", a: ""},
    },
    "1110": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era", a: [
                {e: "vp", a: 1},
                {e: "vp", a: 2},
                {e: "vp", a: 3},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        response: {pre:"none", effect:{e:"none",a:""},},
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
                {e: "studio", a: {e: "cash", a: 1}},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        response: {pre:"none", effect:{e:"none",a:""},},
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
        archive: {e: "none", a: ""},
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
            effect: {e: "cash", a: 1},
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
                {e: "cash", a: 1},
                {e: "cash", a: 1},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "none", a: ""},
        response: {pre:"none", effect:{e:"none",a:""},},

    },
    "1206": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
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
                {e: "none", a: ""},
                {e: "othersBuy", a: "B04"},
                {e: "othersBuy", a: "B04"},
            ]
        },
        response: {pre:"none", effect:{e:"none",a:""},},
    },
    "1207": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.WE].era !== IEra.THREE,
        play: {
            e: "era", a: [
                {e: "step", a: [{e: "resFromIndustry", a: 1}, {e: "card", a: 1}]},
                {e: "step", a: [{e: "cash", a: 1}, {e: "vp", a: 1}]},
                {e: "none", a: ""},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => G.regions[Region.NA].era !== IEra.ONE,
        archive: {
            e: "era", a: [
                {e: "none", a: ""},
                {e: "aestheticsBreakthrough", a: 1},
                {e: "aestheticsBreakthrough", a: 1},
            ]
        },
        response: {pre:"none", effect:{e:"none",a:""},},
    },
    "1208": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "cash", a: 1},
                {e: "shareToVp", a: 1},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "none", a: ""},
        response: {pre:"none", effect:{e:"none",a:""},},
    },
    "1209": {
        buy: {e: "none", a: ""},
        canBuy: (G: IG, ctx: Ctx) => true,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "pay", a: {
                pay: {e: "res", a: 1},
                result: {e: "drawCard", a: 2}
            },
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "none", a: ""},
        response: {pre:"none", effect:{e:"none",a:""},},
    },
    "1210":{
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.WE].era===IEra.ONE,
        play: {
            e: "era", a: [
                {e:"res",a:2},
                {e:"none",a:""},
                {e:"none",a:""},
            ],
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "step", a: [{e:"vp",a:5},{e:"cash",a:1}]},
        response: {
            pre:{type:"or",a: [{type:"discard"},{type:"archive"}],},
            effect:{e: "step", a: [{e:"vp",a:5},{e:"cash",a:1}]},
    },
    },
    "1211":{
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.WE].era!==IEra.THREE,
        play: {
            e: "era", a: [
                {e:"res",a:2},
                {e:"comment",a:1},
                {e:"none",a:""},
            ],
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e:"none",a:""},
        response: {pre:{type:"discard"},effect:{e:"cash",a:1}},

    },
    "1301":{
        "school":{
            hand:4,
            action:2,
        },
        response: {
            pre: {type: "turnStart"},
            effect: {e:"step",a:[{e:"vp",a:1},{e: "discardAndDraw", a: 1}]},
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
        archive: {e: "none", a: ""},
        response: {
            pre: {type: "none", a: "E02"},
            effect: {e:"none",a:""},
        },
    },
    "1303": {
        "school":{
            hand:4,
            action:2,
        },
        response: {
            pre: {type: "othersBuySchool"},
            effect: {e:"step",a:[{e:"cash",a:1},{e: "vp", a: 1}]},
        },
    },
    "1304": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.WE].era!==IEra.THREE,
        play: {
            e: "era", a: [
                {e: "step", a: [{e:"res",a:2},{e:"vp",a:1}]},
                {e: "step", a: [{e:"cash",a:1},{e:"vp",a:2}]},
                {e:"none",a:""},
            ],
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "comment", a: 1},
        response: {pre:"none", effect:{e:"none",a:""},},
    },
    "1305": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era", a: [
                {e:"drawCard",a:2},
                {e:"archiveHand",a:1},
                {e:"vp",a:2},
            ],
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "step", a: [{e:"vp",a:5},{e:"cash",a:1}]},
        response: {
            pre:{
                type: "or",
                a: [{e:"discard",},{e:"archive"}]
            },
            effect:{e: "step", a: [{e:"vp",a:5},{e:"cash",a:1}]},
        },

    },
    "1306": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.WE].era!==IEra.THREE,
        play: {
            e: "era", a: [
                {e: "step", a: [{e:"res",a:1},{e:"drawCard",a:1}]},
                {e:"res",a:1},
                {e:"none",a:""},
            ],
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e:"none",a:""},
        response: {pre:"none", effect:{e:"none",a:""},},
    },
    "1307":{
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "none", a: ""},
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {e: "step", a: [{e:"drawCard",a:1},{e:"vp",a:1}]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e:"none",a:""},
        response: {pre:"none", effect:{e:"none",a:""},},
    }
}
