import {VQGame} from "./constant/general";
import {SPACE_BY_ID} from "./mapData";

export const TUTORIAL_POWER_CARDS = {
    ottoman: {draw: [0, 2, 2, 2, 3, 3, 4, 4, 5, 5], vp: [0, 1, 3, 5, 7, 9, 11, 13, 15, 17], military: 10},
    spain: {draw: [0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6], vp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], military: 14},
};

export const TUTORIAL_KEYS = ["istanbul", "salonika", "athens", "belgrade", "buda", "algiers", "madrid", "barcelona", "seville", "milan", "genoa", "rome", "naples", "malta", "vienna", "prague", "augsburg", "frankfurt", "venice", "tunis"];
export const TUTORIAL_FORTRESSES = ["scutari", "tripoli", "oran", "candia", "corfu", "cyprus", "zara", "szigetvar", "florence"];

export const tutorialSpaceAllowed = (id: string): boolean => {
    const space = SPACE_BY_ID[id];
    return !!space && id !== "metz" &&
        !["england", "scotland", "netherlands", "france"].includes(space.area ?? "") &&
        !["england", "france", "protestant", "scotland", "portugal"].includes(space.home);
};

export const TUTORIAL_DISABLED_MOVES = [
    "playTreasure", "buildFortress", "claimSeaCaptain", "declareWar", "declareWarMinor", "makePeace", "formAlliance",
    "proposeBetroth", "acceptBetroth", "rejectBetroth", "preach", "suppress", "rebellion", "patronize",
    "plantInformant", "gainIntelligence", "assassinate", "buildExpedition", "moveExpedition", "settleColony",
    "commitForeignWarForce", "fightForeignWar", "reinforceForeignWar",
];

export const tutorialActionError = (G: VQGame, move: string, args?: unknown): string | undefined => {
    if (G.scenario !== "tutorial") return undefined;
    if (TUTORIAL_DISABLED_MOVES.includes(move)) return "教学剧本未使用此规则。";
    if (args && typeof args === "object") {
        for (const [key, value] of Object.entries(args)) {
            if (["space", "from", "to", "port", "target"].includes(key) && typeof value === "string" &&
                SPACE_BY_ID[value] && !tutorialSpaceAllowed(value)) return "教学剧本禁止进入该地区。";
        }
    }
    return undefined;
};

export const tutorialFortressVp = (G: VQGame): number => Object.entries(G.spaces)
    .filter(([id, space]) => TUTORIAL_FORTRESSES.includes(id) &&
        space.control === "ottoman" && !space.unrest).length;
