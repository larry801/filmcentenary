import {OfficialLeader} from "./types";

/**
 * Leaders referenced by the Campaign and Tournament setups, plus the entries
 * on the Leader Entry Table (Scenario Book page 31).  No combat ratings are
 * invented here; the official counters are not part of the supplied PDFs.
 */
export const OFFICIAL_LEADERS: OfficialLeader[] = [
    // Ottoman
    {
        id: "mehmed",
        nameEn: "Mehmed Pasha",
        nameZh: "穆罕默德帕夏",
        power: "ottoman",
        kind: "army",
        source: "scenario-book",
    },
    {
        id: "piyale",
        nameEn: "Piyale Pasha",
        nameZh: "皮雅利帕夏",
        power: "ottoman",
        kind: "naval",
        source: "scenario-book",
    },
    {
        id: "dragut",
        nameEn: "Dragut",
        nameZh: "德拉加特",
        power: "ottoman",
        kind: "naval",
        source: "scenario-book",
    },
    {
        id: "uluchAli",
        nameEn: "Uluch Ali",
        nameZh: "乌卢奇·阿里",
        power: "ottoman",
        kind: "naval",
        source: "scenario-book",
        notes: "Enters the following turn when Dragut Falls is resolved (card #11).",
    },

    // Spain
    {
        id: "alba",
        nameEn: "Duke of Alva",
        nameZh: "阿尔瓦公爵",
        power: "spain",
        kind: "army",
        source: "scenario-book",
    },
    {
        id: "donJohn",
        nameEn: "Don John of Austria",
        nameZh: "奥地利的唐·约翰",
        power: "spain",
        kind: "both",
        source: "leader-entry-table",
        entryTurn: 2,
    },
    {
        id: "santaCruz",
        nameEn: "Marquis of Santa Cruz",
        nameZh: "圣克鲁斯侯爵",
        power: "spain",
        kind: "naval",
        source: "leader-entry-table",
        entryTurn: 4,
    },
    {
        id: "parma",
        nameEn: "Duke of Parma",
        nameZh: "帕尔马公爵",
        power: "spain",
        kind: "army",
        source: "leader-entry-table",
        entryTurn: 4,
    },

    // England
    {
        id: "leicester",
        nameEn: "Earl of Leicester",
        nameZh: "莱斯特伯爵",
        power: "england",
        kind: "army",
        source: "leader-entry-table",
        entryTurn: 2,
    },
    {
        id: "norreys",
        nameEn: "John Norreys",
        nameZh: "约翰·诺里斯",
        power: "england",
        kind: "army",
        source: "leader-entry-table",
        entryTurn: 4,
    },

    // France
    {
        id: "montmorency",
        nameEn: "Anne de Montmorency",
        nameZh: "安妮·德·蒙莫朗西",
        power: "france",
        kind: "army",
        source: "scenario-book",
    },
    {
        id: "henryIII",
        nameEn: "Henry III",
        nameZh: "亨利三世",
        power: "france",
        kind: "army",
        source: "leader-entry-table",
        entryTurn: 2,
    },

    // Holy Roman Empire
    {
        id: "schwendi",
        nameEn: "Lazarus von Schwendi",
        nameZh: "拉扎鲁斯·冯·施文迪",
        power: "hre",
        kind: "army",
        source: "scenario-book",
    },
    {
        id: "zrinyi",
        nameEn: "Nikola Zrinyi",
        nameZh: "尼古拉·兹里尼",
        power: "hre",
        kind: "army",
        source: "scenario-book",
    },

    // Protestant
    {
        id: "coligny",
        nameEn: "Gaspard de Coligny",
        nameZh: "加斯帕尔·德·科利尼",
        power: "protestant",
        kind: "army",
        source: "scenario-book",
    },
    {
        id: "orange",
        nameEn: "William of Orange",
        nameZh: "奥兰治的威廉",
        power: "protestant",
        kind: "army",
        source: "leader-entry-table",
        entryTurn: 2,
    },
    {
        id: "navarre",
        nameEn: "Henry of Navarre",
        nameZh: "纳瓦拉的亨利",
        power: "protestant",
        kind: "army",
        source: "leader-entry-table",
        entryTurn: 4,
    },
    {
        id: "maurice",
        nameEn: "Maurice of Nassau",
        nameZh: "拿骚的莫里斯",
        power: "protestant",
        kind: "army",
        source: "leader-entry-table",
        entryTurn: 5,
    },
];

export const OFFICIAL_LEADER_BY_ID: Record<string, OfficialLeader> = Object.fromEntries(
    OFFICIAL_LEADERS.map((l) => [l.id, l]),
);

export const leaderOrThrow = (id: string): OfficialLeader => {
    const l = OFFICIAL_LEADER_BY_ID[id];
    if (l === undefined) {
        throw new Error(`unknown leader: ${id}`);
    }
    return l;
};

/** Leaders that begin the Campaign/Tournament outside the map or off-map. */
export const OFF_MAP_LEADERS = {
    campaign: ["coligny"],
    tournament: ["orange"],
} as const;

export const OUT_OF_GAME_LEADERS = {
    campaign: [] as string[],
    tournament: ["montmorency", "zrinyi"],
} as const;
