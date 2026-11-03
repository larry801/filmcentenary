import {ScienceBonus} from "./types";

/** Science Bonus Table (Scenario Book page 32). */
export const SCIENCE_BONUSES: ScienceBonus[] = [
    {
        id: "coastalFortification",
        nameEn: "Coastal Fortification",
        nameZh: "海岸防御工事",
        description: "Spain may build 2 World Map fortresses per turn (placed on the power card in the Card Draw Phase).",
        eligible: ["spain"],
    },
    {
        id: "cryptography",
        nameEn: "Cryptography",
        nameZh: "密码学",
        description: "Roll 1 extra die in an Espionage attack or defense.",
        eligible: "any",
    },
    {
        id: "dryDock",
        nameEn: "Dry Dock",
        nameZh: "干船坞",
        description: "Naval losses immediately return to the force pool (not for minor-power allies).",
        eligible: "any",
    },
    {
        id: "excavation",
        nameEn: "Excavation",
        nameZh: "发掘",
        description: "+2 to Suez Canal rolls.",
        eligible: ["ottoman"],
    },
    {
        id: "mapProjection",
        nameEn: "Map Projection",
        nameZh: "地图投影",
        description: "+1 to Navigation rolls.",
        eligible: "any-except-spain",
    },
    {
        id: "observatory",
        nameEn: "Observatory",
        nameZh: "天文台",
        description: "+2 to Science rolls; return this scientist to the pool and patronize another in a future turn.",
        eligible: "any",
    },
    {
        id: "plantation",
        nameEn: "Plantation",
        nameZh: "种植园",
        description: "Free colony each expedition; +1 to colony rolls.",
        eligible: ["ottoman", "england", "france", "protestant"],
    },
    {
        id: "ravelin",
        nameEn: "Ravelin",
        nameZh: "棱堡",
        description: "Roll 1 extra die when defending in an Assault.",
        eligible: "any",
    },
    {
        id: "telescope",
        nameEn: "Telescope",
        nameZh: "望远镜",
        description: "+1 to Intercept/Avoid Battle rolls (land and naval); not for minor allies or lent naval units.",
        eligible: "any",
    },
];

export const SCIENCE_BONUS_BY_ID: Record<string, ScienceBonus> = Object.fromEntries(
    SCIENCE_BONUSES.map((b) => [b.id, b]),
);

export const scienceBonusOrThrow = (id: string): ScienceBonus => {
    const b = SCIENCE_BONUS_BY_ID[id];
    if (b === undefined) {
        throw new Error(`unknown science bonus: ${id}`);
    }
    return b;
};
