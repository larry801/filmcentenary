import {Patron} from "./types";

/**
 * Artists and scientists named by the Campaign and Tournament patronage
 * charts. Ratings and artist categories are transcribed from the counter SVGs
 * in the supplied VASSAL 4.6 module.
 */
export const PATRONS: Patron[] = [
    // Artists
    {id: "sinan", nameEn: "Sinan", nameZh: "锡南", kind: "artist", region: "ottoman", rating: 4, artistType: "architect"},
    {id: "baki", nameEn: "Baki", nameZh: "巴基", kind: "artist", region: "ottoman", rating: 2, artistType: "writer"},
    {id: "titian", nameEn: "Titian", nameZh: "提香", kind: "artist", region: "spain", rating: 2, artistType: "painter"},
    {
        id: "bautista",
        nameEn: "Bautista",
        nameZh: "包蒂斯塔",
        kind: "artist",
        region: "spain",
        rating: 2,
        artistType: "architect",
    },
    {id: "clouet", nameEn: "Clouet", nameZh: "克卢埃", kind: "artist", region: "france", rating: 2, artistType: "painter"},
    {
        id: "delorme",
        nameEn: "de L'Orme",
        nameZh: "德洛尔姆",
        kind: "artist",
        region: "france",
        rating: 2,
        artistType: "architect",
    },
    {id: "ronsard", nameEn: "Ronsard", nameZh: "龙萨", kind: "artist", region: "france", rating: 3, artistType: "writer"},
    {
        id: "brueghel",
        nameEn: "Brueghel",
        nameZh: "勃鲁盖尔",
        kind: "artist",
        region: "protestant",
        rating: 3,
        artistType: "painter",
    },
    {
        id: "marnix",
        nameEn: "Marnix",
        nameZh: "马尼克斯",
        kind: "artist",
        region: "protestant",
        rating: 2,
        artistType: "writer",
    },
    {
        id: "hilliard",
        nameEn: "Hilliard",
        nameZh: "希利亚德",
        kind: "artist",
        region: "england",
        rating: 1,
        artistType: "painter",
    },
    {
        id: "arcimboldo",
        nameEn: "Arcimboldo",
        nameZh: "阿尔钦博托",
        kind: "artist",
        region: "hre",
        rating: 1,
        artistType: "painter",
    },
    {
        id: "spranger",
        nameEn: "Spranger",
        nameZh: "施普兰格",
        kind: "artist",
        region: "hre",
        rating: 2,
        artistType: "painter",
    },
    {
        id: "palladio",
        nameEn: "Palladio",
        nameZh: "帕拉第奥",
        kind: "artist",
        region: "italy",
        rating: 3,
        artistType: "architect",
    },
    {
        id: "tintoretto",
        nameEn: "Tintoretto",
        nameZh: "丁托列托",
        kind: "artist",
        region: "italy",
        rating: 2,
        artistType: "painter",
    },
    {id: "montaigne", nameEn: "Montaigne", kind: "artist", region: "france", rating: 2, artistType: "writer"},
    {id: "daubigne", nameEn: "d'Aubigne", kind: "artist", region: "protestant", rating: 1, artistType: "writer"},
    {id: "elGreco", nameEn: "El Greco", kind: "artist", region: "italy", rating: 4, artistType: "painter"},
    {id: "cervantes", nameEn: "Cervantes", kind: "artist", region: "spain", rating: 4, artistType: "writer"},
    {id: "marlowe", nameEn: "Marlowe", kind: "artist", region: "england", rating: 2, artistType: "writer"},
    {id: "lopeDeVega", nameEn: "Lope de Vega", kind: "artist", region: "spain", rating: 2, artistType: "writer"},
    {id: "shakespeare", nameEn: "Shakespeare", kind: "artist", region: "england", rating: 4, artistType: "writer"},

    // Scientists
    {
        id: "seydiAliReis",
        nameEn: "Seydi Ali Reis",
        nameZh: "赛义迪·阿里·雷斯",
        kind: "scientist",
        region: "ottoman",
        rating: 1,
    },
    {
        id: "taqiAlDin",
        nameEn: "Taqi al-Din",
        nameZh: "塔基丁",
        kind: "scientist",
        region: "ottoman",
        rating: 3,
    },
    {
        id: "herrera",
        nameEn: "Herrera",
        nameZh: "埃雷拉",
        kind: "scientist",
        region: "spain",
        rating: 2,
    },
    {id: "dee", nameEn: "Dee", nameZh: "迪伊", kind: "scientist", region: "england", rating: 3},
    {
        id: "leTestu",
        nameEn: "Le Testu",
        nameZh: "勒泰斯蒂",
        kind: "scientist",
        region: "france",
        rating: 1,
    },
    {
        id: "mercator",
        nameEn: "Mercator",
        nameZh: "墨卡托",
        kind: "scientist",
        region: "hre",
        rating: 2,
    },
    {
        id: "brahe",
        nameEn: "Brahe",
        nameZh: "第谷·布拉赫",
        kind: "scientist",
        region: "hre",
        rating: 3,
    },
    {
        id: "kepler",
        nameEn: "Kepler",
        nameZh: "开普勒",
        kind: "scientist",
        region: "hre",
        rating: 4,
    },
    {
        id: "leMoyne",
        nameEn: "Le Moyne",
        nameZh: "勒莫因",
        kind: "scientist",
        region: "protestant",
        rating: 1,
    },
    {
        id: "bellaso",
        nameEn: "Bellaso",
        nameZh: "贝拉索",
        kind: "scientist",
        region: "italy",
        rating: 2,
    },
    {id: "galileo", nameEn: "Galileo", kind: "scientist", region: "italy", rating: 4},
    {id: "stevin", nameEn: "Stevin", kind: "scientist", region: "protestant", rating: 3},
    {id: "bruno", nameEn: "Bruno", kind: "scientist", region: "italy", rating: 2},
    {id: "gilbert", nameEn: "Gilbert", kind: "scientist", region: "england", rating: 2},
    {id: "jansen", nameEn: "Jansen", kind: "scientist", region: "protestant", rating: 2},
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
