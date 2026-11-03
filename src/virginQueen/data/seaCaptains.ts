import {SeaCaptain} from "./types";

/**
 * Sea Captain Table (Scenario Book page 32).
 *
 * `power` is the printed availability.  France/Protestant captains are
 * available on a first-come, first-served basis to either power.
 */
export const SEA_CAPTAINS: SeaCaptain[] = [
    {
        id: "muratReis",
        nameEn: "Murat Reis",
        nameZh: "穆拉特·雷斯",
        turn: 1,
        power: "ottoman",
        piracy: 1,
        navigation: 1,
        bonus: "Never dies from navigation rolls; if eliminated by navigation, re-enters next turn.",
    },
    {
        id: "hawkins",
        nameEn: "Hawkins",
        nameZh: "霍金斯",
        turn: 1,
        power: "england",
        piracy: 1,
        navigation: 1,
        bonus:
            "Creates race-built galleons: starting Turn 3, galleons built in London are placed race-built if Hawkins is there.",
    },
    {
        id: "leTestu",
        nameEn: "le Testu",
        nameZh: "勒泰斯蒂",
        turn: 1,
        power: "france",
        piracy: 1,
        navigation: 2,
        bonus: "May instead be used as a scientist.",
    },
    {
        id: "villegaignon",
        nameEn: "Villegaignon",
        nameZh: "维尔加尼翁",
        turn: 1,
        power: "france",
        piracy: 1,
        navigation: 1,
        bonus: "Free colonist: add a colony marker to his expedition without paying the usual extra CP.",
    },
    {
        id: "deSores",
        nameEn: "de Sores",
        nameZh: "德索雷斯",
        turn: 1,
        power: "france/protestant",
        piracy: 1,
        navigation: 1,
        bonus: "Fortresses do not roll against him; available to France or the Protestant, first come first served.",
    },
    {
        id: "leClerc",
        nameEn: "le Clerc",
        nameZh: "勒克莱尔",
        turn: 1,
        power: "france/protestant",
        piracy: 1,
        navigation: 1,
        bonus: "P2 in the Antilles; available to France or the Protestant, first come first served.",
    },
    {
        id: "henszlein",
        nameEn: "Henszlein",
        nameZh: "亨斯莱因",
        turn: 1,
        power: "hre",
        piracy: 0,
        navigation: 0,
        bonus: "Costs 2 CP to Build Expedition; the HRE has no colonies, so none may be added.",
    },
    {
        id: "laudonniere",
        nameEn: "Laudonniere",
        nameZh: "洛多尼耶",
        turn: 1,
        power: "protestant",
        piracy: 0,
        navigation: 1,
        bonus: "Free colonist: add a colony marker to his expedition without paying the usual extra CP.",
    },
    {
        id: "drake",
        nameEn: "Drake",
        nameZh: "德雷克",
        turn: 3,
        power: "england",
        piracy: 2,
        navigation: 3,
        bonus:
            "England chooses the piracy reward; Drake may spend a piracy hit to repair his damaged expedition.",
    },
    {
        id: "frobisher",
        nameEn: "Frobisher",
        nameZh: "弗罗比舍",
        turn: 4,
        power: "england",
        piracy: 1,
        navigation: 2,
        bonus: "Special Northwest Passage effects: his expedition is cancelled by that event but he is never killed.",
    },
    {
        id: "raleigh",
        nameEn: "Raleigh",
        nameZh: "罗利",
        turn: 5,
        power: "england",
        piracy: 1,
        navigation: 1,
        bonus: "Free colonist: add a colony marker to his expedition without paying the usual extra CP.",
    },
    {
        id: "cavendish",
        nameEn: "Cavendish",
        nameZh: "卡文迪什",
        turn: 5,
        power: "england",
        piracy: 1,
        navigation: 3,
        bonus: "P2 in the Mexican and Chilean Coasts.",
    },
    {
        id: "vanNoort",
        nameEn: "van Noort",
        nameZh: "范努尔特",
        turn: 5,
        power: "protestant",
        piracy: 1,
        navigation: 2,
        bonus: "P2 in the Mexican and Chilean Coasts.",
    },
];

export const SEA_CAPTAIN_BY_ID: Record<string, SeaCaptain> = Object.fromEntries(
    SEA_CAPTAINS.map((c) => [c.id, c]),
);

export const seaCaptainById = (id: string): SeaCaptain => {
    const c = SEA_CAPTAIN_BY_ID[id];
    if (c === undefined) {
        throw new Error(`unknown sea captain: ${id}`);
    }
    return c;
};

const at = (id: string, power: SeaCaptain["power"]): SeaCaptain => {
    const c = SEA_CAPTAIN_BY_ID[id];
    if (c === undefined) {
        throw new Error(`unknown sea captain: ${id}`);
    }
    return {...c, power};
};

/** Tournament "Out of Game" sea captains. */
export const OUT_OF_GAME_SEA_CAPTAINS = {
    campaign: [] as string[],
    tournament: ["villegaignon", "leClerc"],
} as const;

/** Campaign "Sea Captains Available" boxes (page 6-7). */
export const CAMPAIGN_SEA_CAPTAINS = {
    ottoman: [at("muratReis", "ottoman")],
    spain: [],
    england: [at("hawkins", "england")],
    france: [at("leTestu", "france"), at("villegaignon", "france")],
    hre: [at("henszlein", "hre")],
    protestant: [at("laudonniere", "protestant")],
    shared: [at("deSores", "france/protestant"), at("leClerc", "france/protestant")],
} as const;

/** Tournament "Sea Captains Available" boxes (page 8-9). */
export const TOURNAMENT_SEA_CAPTAINS = {
    ottoman: [at("muratReis", "ottoman")],
    spain: [],
    england: [at("hawkins", "england"), at("drake", "england")],
    france: [at("leTestu", "france")],
    hre: [at("henszlein", "hre")],
    protestant: [at("laudonniere", "protestant")],
    shared: [at("deSores", "france/protestant")],
} as const;
