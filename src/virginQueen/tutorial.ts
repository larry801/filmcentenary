import {Power, VQGame} from "./constant/general";
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

export interface TutorialLesson {
    title: string;
    instruction: string;
    power: Power;
}

export const tutorialLesson = (G: VQGame, phase: string): TutorialLesson | undefined => {
    if (G.scenario !== "tutorial") return undefined;
    if (G.pendingIntercept) return {
        title: "响应：选择是否拦截",
        instruction: "先在行动面板选择是否拦截。响应处理完毕后，才会继续原来的行动。",
        power: G.pendingIntercept.defender,
    };
    if (G.pendingAction) return {
        title: "响应：使用响应牌或放行",
        instruction: "在行动面板选择可用的响应牌，或选择放行；不必等待自己的正常行动轮次。",
        power: G.pendingAction.power === "ottoman" ? "spain" : "ottoman",
    };
    if (G.pendingPiracy) return {
        title: "响应：结算海盗行动",
        instruction: "按行动面板的选项分配损失或奖励，直到海盗行动结算完成。",
        power: G.pendingPiracy.step === "losses" ? G.pendingPiracy.power : G.pendingPiracy.target,
    };
    if (G.pendingTutorialEvent) return {
        title: "响应：完成事件选择",
        instruction: "事件正在等待选择。请在行动面板选择目标或效果，完成后再继续行动。",
        power: G.pendingTutorialEvent.responding,
    };
    if (G.pendingBattle) return {
        title: "响应：完成战斗选择",
        instruction: "依次在行动面板处理避战、战斗牌、损失或撤退等当前可用选项；系统会切换需要回应的玩家。",
        power: G.pendingBattle.responding,
    };
    const power = G.activePower;
    if (phase === "cardDraw") return {
        title: "第 1 步：确认手牌",
        instruction: "系统已自动发牌。打开手牌卡牌查看详情与 CP，然后点击对应国家的抽牌确认按钮。双方都确认后进入春季部署，教学局跳过外交。",
        power,
    };
    if (phase === "spring") return {
        title: "第 2 步：春季部署",
        instruction: "如需选择本国牌，请先点击“保留”。然后可在行动下拉框选择“春季部署”，点击首都、调整部队并点击目的地；也可直接点击“结束春季部署”。",
        power,
    };
    if (phase !== "action") return undefined;
    if (!G.powers[power].cardPlayed) return {
        title: "第 3 步：先打出一张牌",
        instruction: "打开手牌详情，选择“作为 CP”来获得行动点，或选择可用的事件／本国牌能力。每个行动轮次先出一张牌；没有必须打出的强制事件时，也可以点击“跳过”。",
        power,
    };
    return G.powers[power].cp > 0 ? {
        title: "第 3 步：使用行动点",
        instruction: "在行动下拉框选择征募、陆军移动或海军移动等操作，再点击地图目标。移动需先选起点、调整部队，再选目的地。完成后点击“结束冲动”交出行动权，剩余 CP 不会保留。",
        power,
    } : {
        title: "第 3 步：交给另一位玩家",
        instruction: "本次出牌已结算，且没有剩余 CP。点击“结束冲动”交给对方；双方连续跳过后自动进行冬季结算并进入下一回合，或结束对局。",
        power,
    };
};
