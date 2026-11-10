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
        bonusZh: "永不因航行检定死亡；若因航行检定被消灭，下回合重新入场。",
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
        bonusZh: "建造快帆船：从第 3 回合起，霍金斯在伦敦时，在伦敦建造的大帆船以快帆船面放置。",
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
        bonusZh: "也可当作科学家使用。",
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
        bonusZh: "免费殖民者：为其远征添加一个殖民地标记，无需支付额外 CP。",
        freeColonist: true,
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
        bonusZh: "要塞不会向他开火；法国或新教联盟先到先得。",
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
        bonusZh: "在小安的列斯群岛海盗值 P2；法国或新教联盟先到先得。",
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
        bonusZh: "建造远征需 2 CP；神圣罗马帝国没有殖民地，不能添加殖民地。",
        expeditionCost: 2,
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
        bonusZh: "免费殖民者：为其远征添加一个殖民地标记，无需支付额外 CP。",
        freeColonist: true,
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
        bonusZh: "由英格兰选择海盗奖励；德雷克可消耗一次海盗命中修复受损的远征队。",
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
        bonusZh: "西北航道的特殊效果：其远征会被该事件取消，但他永远不会死亡。",
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
        bonusZh: "免费殖民者：为其远征添加一个殖民地标记，无需支付额外 CP。",
        freeColonist: true,
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
        bonusZh: "在墨西哥海岸与智利海岸海盗值 P2。",
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
        bonusZh: "在墨西哥海岸与智利海岸海盗值 P2。",
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
