import {Patron} from "./types";

/**
 * Artists and scientists named by the Campaign and Tournament patronage
 * charts.  The Scenario Book lists only the available pool, not the printed VP
 * value of each patron, so `vp` stays null until the physical patron cards are
 * transcribed.
 */
export const PATRONS: Patron[] = [
    // Artists
    {id: "sinan", nameEn: "Sinan", nameZh: "锡南", kind: "artist", region: "ottoman", vp: null},
    {id: "baki", nameEn: "Baki", nameZh: "巴基", kind: "artist", region: "ottoman", vp: null},
    {id: "titian", nameEn: "Titian", nameZh: "提香", kind: "artist", region: "spain", vp: null},
    {
        id: "bautista",
        nameEn: "Bautista",
        nameZh: "包蒂斯塔",
        kind: "artist",
        region: "spain",
        vp: null,
    },
    {id: "clouet", nameEn: "Clouet", nameZh: "克卢埃", kind: "artist", region: "france", vp: null},
    {
        id: "delorme",
        nameEn: "de L'Orme",
        nameZh: "德洛尔姆",
        kind: "artist",
        region: "france",
        vp: null,
    },
    {id: "ronsard", nameEn: "Ronsard", nameZh: "龙萨", kind: "artist", region: "france", vp: null},
    {
        id: "brueghel",
        nameEn: "Brueghel",
        nameZh: "勃鲁盖尔",
        kind: "artist",
        region: "protestant",
        vp: null,
    },
    {
        id: "marnix",
        nameEn: "Marnix",
        nameZh: "马尼克斯",
        kind: "artist",
        region: "protestant",
        vp: null,
    },
    {
        id: "hilliard",
        nameEn: "Hilliard",
        nameZh: "希利亚德",
        kind: "artist",
        region: "england",
        vp: null,
    },
    {
        id: "arcimboldo",
        nameEn: "Arcimboldo",
        nameZh: "阿尔钦博托",
        kind: "artist",
        region: "hre",
        vp: null,
    },
    {
        id: "spranger",
        nameEn: "Spranger",
        nameZh: "施普兰格",
        kind: "artist",
        region: "hre",
        vp: null,
    },
    {
        id: "palladio",
        nameEn: "Palladio",
        nameZh: "帕拉第奥",
        kind: "artist",
        region: "italy",
        vp: null,
    },
    {
        id: "tintoretto",
        nameEn: "Tintoretto",
        nameZh: "丁托列托",
        kind: "artist",
        region: "italy",
        vp: null,
    },

    // Scientists
    {
        id: "seydiAliReis",
        nameEn: "Seydi Ali Reis",
        nameZh: "赛义迪·阿里·雷斯",
        kind: "scientist",
        region: "ottoman",
        vp: null,
    },
    {
        id: "taqiAlDin",
        nameEn: "Taqi al-Din",
        nameZh: "塔基丁",
        kind: "scientist",
        region: "ottoman",
        vp: null,
    },
    {
        id: "herrera",
        nameEn: "Herrera",
        nameZh: "埃雷拉",
        kind: "scientist",
        region: "spain",
        vp: null,
    },
    {id: "dee", nameEn: "Dee", nameZh: "迪伊", kind: "scientist", region: "england", vp: null},
    {
        id: "leTestu",
        nameEn: "Le Testu",
        nameZh: "勒泰斯蒂",
        kind: "scientist",
        region: "france",
        vp: null,
    },
    {
        id: "mercator",
        nameEn: "Mercator",
        nameZh: "墨卡托",
        kind: "scientist",
        region: "hre",
        vp: null,
    },
    {
        id: "brahe",
        nameEn: "Brahe",
        nameZh: "第谷·布拉赫",
        kind: "scientist",
        region: "hre",
        vp: null,
    },
    {
        id: "kepler",
        nameEn: "Kepler",
        nameZh: "开普勒",
        kind: "scientist",
        region: "hre",
        vp: null,
    },
    {
        id: "leMoyne",
        nameEn: "Le Moyne",
        nameZh: "勒莫因",
        kind: "scientist",
        region: "protestant",
        vp: null,
    },
    {
        id: "bellaso",
        nameEn: "Bellaso",
        nameZh: "贝拉索",
        kind: "scientist",
        region: "italy",
        vp: null,
    },
];

export const PATRON_BY_ID: Record<string, Patron> = Object.fromEntries(
    PATRONS.map((p) => [p.id, p]),
);

export const artists = (): Patron[] => PATRONS.filter((p) => p.kind === "artist");
export const scientists = (): Patron[] => PATRONS.filter((p) => p.kind === "scientist");

export const patronOrThrow = (id: string): Patron => {
    const p = PATRON_BY_ID[id];
    if (p === undefined) {
        throw new Error(`unknown patron: ${id}`);
    }
    return p;
};

/**
 * Patronage charts copied from the two scenarios.  Ids are resolved through
 * PATRON_BY_ID by the data tests, so a typo in either list fails fast.
 */
export const CAMPAIGN_PATRONAGE = {
    artists: ["sinan", "titian", "bautista", "clouet", "delorme", "brueghel", "palladio"],
    scientists: [
        "seydiAliReis",
        "herrera",
        "dee",
        "leTestu",
        "mercator",
        "leMoyne",
        "bellaso",
    ],
} as const;

export const TOURNAMENT_PATRONAGE = {
    artists: [
        "sinan",
        "titian",
        "bautista",
        "hilliard",
        "clouet",
        "ronsard",
        "delorme",
        "arcimboldo",
        "marnix",
        "palladio",
        "tintoretto",
    ],
    scientists: [
        "taqiAlDin",
        "seydiAliReis",
        "herrera",
        "dee",
        "leTestu",
        "brahe",
        "mercator",
        "leMoyne",
        "bellaso",
    ],
} as const;
