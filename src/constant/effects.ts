import {IG} from "../types/setup";
import {Ctx} from "boardgame.io";
import {EventCardID, IEra, Region, ScoreCardID} from "../types/core";
import {logger} from "../game/util";

const noEff = {e: "none", a: 1};
const noResponse = {pre: noEff, effect: noEff};

export function getEvent(id: EventCardID) {
    return eventEffects[id];

}

const SCORE_EFFECT = {
    canBuy: (G: IG, ctx: Ctx) => true,
    buy: noEff,
    canPlay: (G: IG, ctx: Ctx) => true,
    play: {e: "res", a: 1},
    canArchive: (G: IG, ctx: Ctx) => true,
    archive: noEff,
}

export function getCardEffect(id: string): any {
    if (id in effects) {
        // @ts-ignore
        return effects[id]
    }else {
        if(id in ScoreCardID){
            return SCORE_EFFECT
        }else {
            logger.debug("Unknown id" + id);
        }
    }
}

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

export const eventEffects = {
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
        ]
    },
    "E03": {e: "Avant-grade", a: "E03"},
    "E04": {
        e: "step",
        a: [
            {e: "everyPlayer", a: {e: "buy", a: "B05"}},
            {e: "playerVpChampion", a: {e: "buyCardToHand", a: "B02"}},
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

export const effects = {
    "B01": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
    },
    "B02": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
    },
    "B03": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "pay", a: {
                cost: {e: "vp", a: 1}, eff: {
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
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "loseVp", a: 2},
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
                {e: "industryLevelUp", a: 1},
                {e: "buy", a: "1103"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "update", a: 1},
                {e: "noStudio", a: {e: "discardNormalOrLegend", a: 1}},
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
                {e: "industryLevelUp", a: 1},
                {e: "buy", a: "1104"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "noStudio", a: {e: "loseDeposit", a: 1}},
                {e: "studio", a: {e: "deposit", a: 1}},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: {
            pre: {e: "event", a: "E02"},
            effect: {
                e: "optional", a: {
                    e: "step", a: [
                        {e: "searchAndArchive", a: "1102"},
                        {e: "vp", a: 2}
                    ]
                }
            },
        },
    },
    "1103": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era", a: [
                {e: "step", a: [{e: "res", a: 2}, {e: "shareToVp", a: Region.NA}]},
                {e: "deposit", a: 1},
                {e: "vp", a: 2},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,

    },
    "1104": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {e: "deposit", a: 1},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "optional", a: {e: "alternative", a: {e: "buy", a: "2107"}}},
    },
    "1105": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.NA].era !== IEra.THREE,
        play: {
            e: "era", a: [
                {
                    e: "step", a: [
                        {e: "res", a: 1},
                        {e: "draw", a: 1},
                    ]
                },
                {
                    e: "step", a: [
                        {e: "deposit", a: 1},
                    ]
                },
                noEff,
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
                {e: "step", a: [{e: "res", a: 1}, {e: "draw", a: 1}]},
                {e: "step", a: [{e: "res", a: 1}, {e: "draw", a: 1}]},
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
                {e: "step", a: [{e: "res", a: 2}, {e: "vp", a: 1}]},
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
        archive: {e: "pay", a: {cost: {e: "deposit", a: 1}, eff: {e: "breakthroughPrevent", a: "1108"}}},
    },
    "1109": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "era", a: [
                {e: "step", a: [{e: "res", a: 2}, {e: "shareNA", a: 1}]},
                {e: "step", a: [{e: "deposit", a: 1}, {e: "vp", a: 1},]},
                {e: "step", a: [{e: "deposit", a: 1}, {e: "vp", a: 1},]},
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
                {e: "aestheticsLevelUp", a: 1},
                {e: "buy", a: "1207"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "vp", a: 2},
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
                {e: "industryLevelUp", a: 1},
                {e: "buy", a: "1210"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "noStudio", a: {e: "discardAesthetics", a: 1}},
                {e: "studio", a: {e: "buy", a: "B01"}},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: {
            pre: {e: "event", a: "E02"},
            effect: {e: "optional", a: {e: "step", a: [{e: "searchAndArchive", a: "1102"}, {e: "vp", a: 2}]}},
        },
    },
    "1203": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        school: {
            hand: 4,
            action: 1,
        },
        response: {
            pre: {e: "lose", a: "1203"},
            effect: {e: "aestheticsLevelUp", a: 1},
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
            pre: {e: "atBreakthrough"},
            effect: {e: "res", a: 1},
        },
    },
    "1205": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
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
                {e: "step", a: [{e: "draw", a: 1}, {e: "shareWE", a: 1}]},
                {e: "step", a: [{e: "vp", a: 2}, {e: "comment", a: 1}]},
                {e: "step", a: [{e: "vp", a: 2}, {e: "comment", a: 1}]},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {e: "archive", a: 1},
        response: noResponse,
    },
    "1207": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.WE].era !== IEra.THREE,
        play: {
            e: "era", a: [
                {e: "step", a: [{e: "resFromIndustry", a: 1}, {e: "draw", a: 1}]},
                {e: "step", a: [{e: "deposit", a: 1}, {e: "vp", a: 1}]},
                noEff,
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => G.regions[Region.NA].era !== IEra.ONE,
        archive: noEff,
        response: noResponse,
    },
    "1208": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "deposit", a: 1},
                {e: "shareToVp", a: Region.WE},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {
            e: "choice", a: [
                {e: "industryBreakthrough", a: 1},
                {e: "aestheticsBreakthrough", a: 1},
            ]
        },
        response: noResponse
    },
    "1209": {
        buy: noEff,
        canBuy: (G: IG, ctx: Ctx) => true,
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "pay", a: {
                cost: {e: "res", a: 1},
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
        response: noResponse,
    },
    "1211": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => G.regions[Region.WE].era !== IEra.THREE,
        play: {
            e: "era", a: [
                {e: "res", a: 2},
                {e: "step", a: [{e: "vp", a: 1}, {e: "comment", a: 1}]},
                noEff,
            ],
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,

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
            pre: {e: "turnStart"},
            effect: {e: "step", a: [{e: "vp", a: 1}, {e: "draw", a: 1}, {e: "discard", a: 1}]},
        },
    },
    "1302": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "aestheticsLevelUp", a: 1},
                {e: "buy", a: "1305"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "vp", a: 1},
                {
                    e: "studio", a: {
                        e: "step", a: [{e: "draw", a: 1}, {e: "archive", a: 1}
                        ]
                    }
                },
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
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
            pre: {e: "othersBuySchool"},
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
                {e: "archive", a: 1},
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
        response: {
            pre: {e: "competitionStart"}, effect: {e: "competitionBonus", a: 1}
        },
        school: {
            hand: 6,
            action: 2,
        },
    },
    "2102": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryLevelUp", a: 1},
                {e: "buy", a: "2107"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => true,
        play: {
            e: "step", a: [
                {e: "noStudio", a: {e: "discardIndustry", a: 1}},
                {e: "studio", a: {e: "buyCardToHand", a: "B02"}},
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
                {e: "industryLevelUp", a: 1},
                {e: "buy", a: "2114"},
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
                }, {e: "studio", a: {e: "aesAward", a: 1}}
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
            pre: {e: "loseVpRespond"},
            effect: {e: "res", a: 1},
        },
    },
    "2105": {
        buy: {
            e: "choice", a: [
                {e: "aestheticsLevelUp", a: 1},
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
                {e: "step", a: [{e: "res", a: 4}, {e: "shareNA", a: 1}]},
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
                noEff,
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
            e: "era", a: [
                noEff,
                {e: "res", a: 3},
                {e: "res", a: 1},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: {
            e: "alternative", a: {e: "buy", a: "3111"},
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
                        {
                            e: "optional", a: {
                                e: "competition", a: {
                                    bonus: 0,
                                    onWin: noEff,
                                },
                            }
                        }
                    ]
                },
                {
                    e: "step", a: [
                        {e: "res", a: 2},
                        {
                            e: "optional", a: {
                                e: "competition", a: {
                                    bonus: 0,
                                    onWin: noEff,
                                },
                            }
                        }
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
        archive: noEff,
        response: {
            pre: {e: "multiple", a: 2},
            effect: [
                {pre: {e: "buyAesthetics"}, effect: {e: "deductRes", a: 2}},
                {
                    pre: {e: "atBreakthrough"}, effect:
                        {
                            e: "step", a: [
                                {e: "deposit", a: 2},
                                {e: "vp", a: 1},
                            ]
                        }
                },
            ]
        },
        school: {
            hand: 5,
            action: 2,
        },
    },
    "2202": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryLevelUp", a: 1},
                {e: "buy", a: "2209"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "breakthroughResDeduct", a: 2},
                {e: "noStudio", a: {e: "loseVp", a: 3}},
                {e: "studio", a: {e: "aesAward", a: 1}}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2203": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryLevelUp", a: 1},
                {e: "buy", a: "2214"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a:
                [
                    {
                        e: "choice", a: [
                            {e: "shareNA", a: 1}, {e: "shareWE", a: 1}
                        ]
                    },
                    {e: "noStudio", a: {e: "loseAnyRegionShare", a: 1}},
                    {e: "studio", a: {e: "industryAward", a: 1}}
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
            pre: {e: "onYourComment"}, effect: {
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
                {e: "noStudio", a: {e: "buy", a: "B04"}},
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
            e: "era", a:
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
            e: "era", a:
                [
                    noEff,
                    {
                        e: "step", a:
                            [
                                {e: "res", a: 2},
                                {e: "deposit", a: 1},
                            ]
                    },
                    {e: "breakthroughResDeduct", a: 2},
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
            e: "choice", a:
                [
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
        play: {
            e: "era", a: [
                noEff,
                {
                    e: "step", a: [
                        {e: "res", a: 2},
                        {e: "shareWE", a: 1},
                    ]
                },
                {
                    e: "step", a: [
                        {e: "res", a: 2},
                        {e: "aesAward", a: 1},
                    ]
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2210": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "choice", a: [
                {e: "draw", a: 2},
                {e: "breakthroughResDeduct", a: 2},
            ]
        },
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
        archive: {
            e: "step", a: [
                {e: "comment", a: 1},
                {e: "loseVp", a: 2},
            ]
        },
        response: noResponse,
    },
    "2212": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "res", a: 2},
                {e: "comment", a: 1},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2213": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a: [
                noEff,
                {
                    e: "step", a: [
                        {e: "res", a: 2},
                        {e: "draw", a: 1},
                        {e: "loseVp", a: 1},
                    ]
                },
                {
                    e: "step", a: [
                        noEff,
                        {e: "draw", a: 1},
                        {e: "loseVp", a: 1},
                    ]
                },
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2214": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a: [
                noEff,
                {
                    e: "step", a: [
                        {e: "res", a: 3},
                        {e: "shareToVp", a: Region.WE},
                    ]
                },
                {
                    e: "step", a: [
                        {e: "vp", a: 2},
                        {e: "draw", a: 2},
                    ]
                },
            ]
        },
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
        school: {
            hand: 5,
            action: 3,
        },
        response: {
            pre: {e: "buyNoneEEFilm"}, effect: {e: "extraVp", a: 1},
        }
    },
    "2302": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "aestheticsLevelUp", a: 1},
                {e: "buy", a: 2305},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [{e: "draw", a: 1},
                {e: "studio", a: {e: "handToOthers", a: 1}},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2303": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a: [
                noEff,
                {
                    e: "step", a: [
                        {e: "res", a: 2},
                        {e: "deposit", a: 1},
                        {e: "draw", a: 1}
                    ]
                },
                {
                    e: "step", a: [{e: "draw", a: 2},
                        {e: "discard", a: 2}]
                },
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2304": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a: [
                noEff,
                {e: "step", a: [{e: "res", a: 1}, {e: "draw", a: 2}]},
                {e: "draw", a: 2}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2305": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a: [noEff, {e: "step", a: [{e: "res", a: 2}, {e: "draw", a: 1}]},
                {e: "step", a: [{e: "vp", a: 2}, {e: "draw", a: 1}]}]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2306": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a: [noEff, {e: "step", a: [{e: "res", a: 2}, {e: "archive", a: 1}]},
                {e: "archive", a: 1}]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2307": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a: [
                noEff,
                {e: "step", a: [{e: "vp", a: 3}, {e: "draw", a: 1}]},
                {e: "step", a: [{e: "vp", a: 3}, {e: "comment", a: 1}]}

            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2308": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a: [
                noEff,
                {e: "step", a: [{e: "res", a: 3}, {e: "shareToVp", a: Region.EE}]},
                {e: "res", a: 3}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2309": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a: [noEff, {e: "draw", a: 1}, {
                e: "step", a: [
                    {e: "draw", a: 3},
                    {e: "discard", a: 2},
                ]
            }]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2401": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryLevelUp", a: 1},
                {e: "buy", a: "2406"}
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "deposit", a: 1},
                {e: "noStudio", a: {e: "discard", a: 1}},
                {
                    e: "studio", a: {
                        e: "peek", a: {
                            count: 3, target: "hand", filter: {e: "choice", a: 1},
                        }
                    }
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2402": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "aestheticsLevelUp", a: 1},
                {e: "buy", a: "2404"}
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "shareASIA", a: 1}, {e: "noStudio", a: {e: "buy", a: "B04"}}, {e: "studio", a: {e: "draw", a: 1}}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2403": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a: [noEff,
                {
                    e: "step", a: [
                        {e: "res", a: 2},
                        {e: "peek", a: {count: 3, target: "hand", filter: {e: "aesthetics", a: "all"}}},
                    ]
                },
                {
                    e: "step", a: [{
                        e: "vp", a: 2
                    },
                        {e: "peek", a: {count: 3, target: "hand", filter: {e: "aesthetics", a: "all"}}},
                    ]
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2404": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a: [noEff,
                {e: "step", a: [{e: "res", a: 3}, {e: "vp", a: 1}]},
                {
                    e: "step",
                    a: [{e: "vp", a: 2}, {e: "peek", a: {count: 3, target: "hand", filter: {e: "asia", a: "all"}}}]
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2405": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "choice", a: [
                {e: "step", a: [{e: "res", a: 1}, {e: "update", a: 1}]},
                {e: "breakthroughResDeduct", a: 2},
            ]
        },
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
                {e: "peek", a: {count: 3, target: "hand", filter: {e: "industry", a: "all"}}},
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
        play: {
            e: "era", a: [
                noEff,
                {e: "res", a: 3},
                {
                    e: "step", a: [
                        {e: "res", a: 1},
                        {e: "vp", a: 2}
                    ]
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2408": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a: [noEff,
                {e: "step", a: [{e: "res", a: 2}, {e: "update", a: 1}]},
                {
                    e: "step", a: [
                        {e: "comment", a: 1},
                        {e: "peek", a: {count: 2, target: "hand", filter: {e: "aesthetics", a: "all"}}},
                    ]
                },

            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2409": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a: [
                noEff,
                {
                    e: "step", a: [
                        {e: "res", a: 2}, {e: "vp", a: 2},
                    ]
                },
                {
                    e: "step", a: [
                        {e: "res", a: 1}, {e: "update", a: 1}
                    ]
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "2410": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "era", a: [
                noEff,
                {e: "step", a: [{e: "res", a: 1}, {e: "deposit", a: 1}]},
                {e: "peek", a: {count: 2, target: "hand", filter: {e: "era", a: IEra.TWO}}}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3101": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: {
            pre: {e: "multiple", a: 2}, effect: [
                {
                    pre: {e: "obtainNormalOrLegendFilm"},
                    effect: {
                        e: "optional", a: {
                            e: "pay", a: {
                                cost: {e: "deposit", a: 1},
                                eff: {e: "anyRegionShare", a: 1}
                            }
                        }
                    }
                }, {pre: {e: "competitionStart"}, effect: {e: "competitionBonus", a: 1}}
            ]
        },
        school: {
            hand: 7,
            action: 2,
        }
    },
    "3102": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryLevelUp", a: 1},
                {e: "buy", a: 3113},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "noStudio", a: {e: "loseAnyRegionShare", a: 1}},
                {e: "studio", a: {e: "deposit", a: 2}},
                {e: "anyRegionShare", a: 1},
                {
                    e: "optional", a: {
                        e: "competition", a: {
                            bonus: 1,
                            onWin: noEff,
                        }
                    }
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
        scoring: {e: "industryNormalOrLegend", a: 2}
    },
    "3103": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "aesAward", a: 2},
                {e: "industryAward", a: 2},

            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3104": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "industryAward", a: 1},
                {e: "deposit", a: 3},
                {
                    e: "optional", a: {
                        e: "competition", a: {
                            bonus: 1,
                            onWin: {e: "anyRegionShare", a: 1},
                        }
                    }
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3105": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: {pre: {e: "turnStart"}, effect: {e: "NewYorkSchool"}},
        school: {
            hand: 5,
            action: 2,
        },
    },
    "3106": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryLevelUp", a: 1},
                {e: "buy", a: 3112},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "draw", a: 2},
                {
                    e: "noStudio", a: {
                        e: "step", a: [
                            {e: "discard", a: 2}, {e: "loseVp", a: 2}
                        ]
                    }
                },
                {e: "studio", a: {e: "archive", a: 1}}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
        scoring: {e: "northAmericaFilm", a: 2},
    },
    "3107": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "shareNA", a: 1},
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "deposit", a: 2},
                {
                    e: "noStudio", a: {
                        e: "step", a: [
                            {e: "buy", a: "B03"},
                            {e: "buy", a: "B04"},
                        ]
                    }
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
        scoring: {e: "threeCards", a: 1}
    },
    "3108": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "anyRegionShare", a: 1},
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "draw", a: 1},
                {
                    e: "choice", a: [
                        {e: "res", a: 6},
                        {
                            e: "step", a: [
                                {e: "anyRegionShare", a: 1},
                                {e: "competition", a: {bonus: 3, onWin: noEff}}
                            ]
                        }
                    ]
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3109": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "res", a: 3},
                {e: "industryToVp", a: 1}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3110": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "res", a: 4}, {
                    e: "optional", a: {
                        e: "competition", a: {
                            bonus: 1,
                            onWin: {e: "shareNA", a: 1}
                        }
                    }
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3111": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "res", a: 3},
                {
                    e: "choice", a: [
                        {e: "draw", a: 1},
                        {e: "shareToVp", a: Region.NA}
                    ]
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3112": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "res", a: 4},
                {e: "aesAward", a: 1}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3113": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "pay", a: {
                cost: {e: "deposit", a: 1},
                eff: {e: "resFromIndustry", a: 1}
            }
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3114": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "res", a: 4},
                {e: "vp", a: 1},
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3115": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "res", a: 3},
                {e: "industryAward", a: 1}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3116": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "step", a: [{e: "draw", a: 4}, {e: "discard", a: 3}]},
                {e: "step", a: [{e: "draw", a: 1}, {e: "update", a: 1}]}
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3201": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        school: {
            hand: 6, action: 3,
        },
        response: {
            pre: {e: "multiple", a: 2},
            effect: [
                {
                    pre: {e: "discardInSettle", a: 1},
                    effect: {e: "step", a: [{e: "draw", a: 1}, {e: "vp", a: 1}]}
                },
                {
                    pre: {e: "doNotLoseVpAfterCompetition", a: 1}, effect: noEff
                }
            ]
        },
    },
    "3202": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryLevelUp", a: 1},
                {e: "buy", a: "3209"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "draw", a: 2},
                {e: "noStudio", a: {e: "loseDeposit", a: 4}},
                {e: "studio", a: {e: "aesAward", a: 2}}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },

    "3203": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "aestheticsLevelUp", a: 1},
                {e: "buy", a: "3212"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "vp", a: 3},
                {e: "noStudio", a: {e: "loseVpForEachHand", a: 1}},
                {e: "buy", a: "B05"}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3204": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: {
            pre: {e: "multiple", a: 2}, effect: [
                {
                    pre: {e: "onAnyOneComment"},
                    effect: {e: "draw", a: 1},
                }, {
                    pre: {e: "doNotLoseVpAfterCompetition", a: 1}, effect: noEff,
                }
            ]
        },
        school: {
            hand: 5, action: 2,
        }
    },
    "3205": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "res", a: 3},
                {
                    e: "choice", a: [
                        {e: "deposit", a: 2},
                        {e: "anyRegionShare", a: 1}
                    ]
                }
            ]
        },
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
    "3207": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "comment", a: 1},
                {
                    e: "choice", a: [
                        {e: "aesAward", a: 2},
                        {e: "breakthroughResDeduct", a: 2},

                    ]
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3208": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "draw", a: 1}, {e: "aesAward", a: 2}, {e: "everyOtherCompany", a: {e: "buy", a: "B04"}}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3209": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "res", a: 3},
                {e: "aesAward", a: 1},
                {e: "update", a: 1}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3210": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "res", a: 2},
                {e: "deposit", a: 2},
                {
                    e: "optional", a: {
                        e: "competition", a: {
                            bonus: 1,
                            onWin: {e: "shareWE", a: 1}
                        }
                    }
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3211": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "step", a: [
                {e: "vp", a: 4}, {e: "aesAward", a: 1}
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3212": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "res", a: 2}, {e: "draw", a: 3}, {e: "discard", a: 3}, {e: "aesAward", a: 1}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3213": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "res", a: 3}, {e: "vp", a: 2}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3301": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "aestheticsLevelUp", a: 1}, {e: "buy", a: "3309"},
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "vp", a: 3}, {e: "noStudio", a: {e: "discardLegend", a: 1}},
                {
                    e: "studio", a: {
                        e: "step", a: [
                            {e: "draw", a: 3}, {e: "handToOthers", a: 1}
                        ]
                    }
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3302": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {
            e: "choice", a: [
                {e: "industryLevelUp", a: 1}, {e: "buy", a: "3304"}
            ]
        },
        canPlay: (G: IG, ctx: Ctx) => false,
        play: noEff,
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3303": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "draw", a: 1}, {
                    e: "choice", a: [
                        {e: "resFromAesthetics", a: 1},
                        {e: "playedCardInTurnEffect", a: 1}
                    ]
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3304": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "resFromIndustry", a: 1}, {
                    e: "optional", a: {
                        e: "competition", a: {
                            bonus: 1,
                            onWin: {e: "shareEE", a: 1}
                        }
                    }
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3305": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "res", a: 3}, {e: "draw", a: 2}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3306": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "res", a: 4}, {e: "shareToVp", a: Region.EE}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3307": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "res", a: 3}, {e: "shareEE", a: 1}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3308": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "vp", a: 3}, {e: "update", a: 1}, {e: "handToOthers", a: 1}, {e: "loseShareEE", a: 1}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3309": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "draw", a: 2}, {e: "aesAward", a: 1}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3310": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e: "step", a: [{e: "res", a: 2}, {e: "draw", a: 1}, {e: "vp", a: 2}]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3311": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e: "res", a: 4},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3312": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e: "step", a: [{e: "res", a: 2}, {e: "handToOthers", a: 1}]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3401": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "choice", a: [{e: "industryLevelUp", a: 1}, {e: "buy", a: "3408"}]},
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "deposit", a: 2}, {e: "noStudio", a: {e: "discardIndustry", a: 2}},
                {e: "studio", a: {e: "peek", a: {count: 4, filter: {e: "hand", a: 2,}}}}
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
        scoring: {e: "personCard", a: 4}
    },
    "3402": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "choice", a: [{e: "aestheticsLevelUp", a: 1}, {e: "buy", a: "3405"}]},
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [
                {e: "vp", a: 3}, {e: "noStudio", a: {e: "discardAesthetics", a: 2}},
                {
                    e: "studio", a: {
                        e: "peek", a: {
                            count: 4, filter: {e: "aesthetics", a: "all"}
                        }
                    }
                }
            ]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
        scoring: {e: "asiaFilm", a: 2}
    },
    "3403": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: {e: "choice", a: [{e: "aestheticsLevelUp", a: 1}, {e: "buy", a: "3414"}]},
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [{e: "draw", a: 2}, {e: "noStudio", a: {e: "loseVp", a: 4}},
                {e: "studio", a: {e: "aesAward", a: 2}}]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3404": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [{e: "shareToVp", a: Region.ASIA}, {
                e: "peek", a: {
                    count: 4, filter: {e: "choice", a: 2}
                }
            }]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3405": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [{e: "draw", a: 1}, {
                e: "choice", a: [
                    {
                        e: "step", a: [
                            {e: "res", a: 2}, {e: "aesAward", a: 1},
                        ]
                    }, {e: "breakthroughResDeduct", a: 2}
                ]
            }]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3406": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [{e: "res", a: 4}, {
                e: "optional", a: {
                    e: "competition", a: {
                        bonus: 1, onWin: {e: "shareASIA", a: 1}
                    }
                }
            }]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3407": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step", a: [{e: "draw", a: 2}, {
                e: "choice", a: [
                    {e: "deposit", a: 2}, {e: "shareASIA", a: 1}
                ]
            }]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3408": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e: "step", a: [{e: "res", a: 2}, {e: "breakthroughResDeduct", a: 2}]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3409": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e: "step", a: [{e: "vp", a: 2}, {e: "draw", a: 3}, {e: "discard", a: 1}]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3410": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e: "step", a: [{e: "industryAward", a: 1}, {e: "aesAward", a: 1}]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3411": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e: "step", a: [{e: "draw", a: 2}, {e: "update", a: 1}]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3412": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e: "step", a: [{e: "draw", a: 2}, {e: "vp", a: 2}]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3413": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {e: "step", a: [{e: "res", a: 3}, {e: "comment", a: 1}]},
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
    "3414": {
        canBuy: (G: IG, ctx: Ctx) => true,
        buy: noEff,
        canPlay: (G: IG, ctx: Ctx) => false,
        play: {
            e: "step",
            a: [{e: "vp", a: 3}, {e: "update", a: 1}, {
                e: "peek",
                a: {count: 3, filter: {e: "choice", a: 1}}
            }, {e: "loseShareASIA", a: 1}]
        },
        canArchive: (G: IG, ctx: Ctx) => true,
        archive: noEff,
        response: noResponse,
    },
}

