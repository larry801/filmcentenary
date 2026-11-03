import {VQGame} from "./constant/general";
import {isActivatedMajor} from "./ownership";
import {tutorialActionError} from "./tutorial";
import {LEADER_BY_ID} from "./constant/leaders";

export const moveError = (G: VQGame, move: string, args?: unknown): string | undefined => {
    if (G.pendingEspionage && move !== "chooseEspionage") return "请先完成当前谍报结算。";
    if (G.pendingCardEvent && move !== "chooseCardEvent") return "请先完成当前事件响应。";
    if (G.pendingAbjuration && move !== "chooseAbjuration") return "请先完成誓绝法案的提议选择。";
    if (G.pendingBeacon && move !== "respondBeaconFires") return "请先完成烽火响应。";
    if (G.pendingInterceptionOrder && move !== "chooseInterceptionOrder" && move !== "autoInterceptionOrder") {
        return "请先选择海军拦截顺序。";
    }
    // A pending battle only exposes the battle choices to the responding
    // power; `playCard` stays allowed at the rule layer so that the Virgin
    // Queen (#36) "play the retrieved card immediately" option can register a
    // printed Combat card for the battle that opened the card window.  The
    // boardgame.io turn/stage guard still keeps ordinary clients from playing
    // cards mid-battle (only the responding player is active, in
    // `battleChoice`).
    const battleMoves = ["chooseBattle", "chooseTutorialEvent", "chooseMajorActivation", "choosePiracy", "respondAction", "chooseInterception"];
    if ((G.pendingBattle !== undefined && move !== "playCard" && !battleMoves.includes(move)) ||
        ((G.pendingTutorialEvent || G.pendingActivation || G.pendingPiracy || G.pendingAction || G.pendingIntercept) && !battleMoves.includes(move))) return "请先完成当前响应。";
    if (G.navalLeaderArrivals?.some((entry) => entry.power === G.activePower) &&
        !["chooseNavalLeaderPort", "chooseHomeCard", "chooseHreReligiousPreference", "endPhaseTurn"].includes(move)) {
        return "请先选择返回海军将领的本土港口。";
    }
    if ((G.winterLossChoices?.some((entry) => entry.power === G.activePower) ||
        G.winterNavalLossChoices?.some((entry) => entry.power === G.activePower)) &&
        !["chooseWinterLoss", "chooseWinterNavalLoss", "endPhaseTurn"].includes(move)) {
        return "请先确认冬季损失的单位类型。";
    }
    const tutorialError = tutorialActionError(G, move, args);
    if (tutorialError) return tutorialError;
    const stormImpulse = G.stormImpulse ?? G.tutorialEffects?.stormImpulse;
    const haremImpulse = G.haremImpulse ?? G.tutorialEffects?.haremImpulse;
    const stormMoved = G.stormMoved ?? G.tutorialEffects?.movedAfterStorm;
    if (stormImpulse === G.impulse && ["moveNaval", "assault", "piracy", "navalTransport"].includes(move)) return "暴风雨期间不能进行此行动。";
    if (stormImpulse === G.impulse && move === "moveLand" && stormMoved?.includes((args as {from: string}).from)) return "暴风雨期间同一编队只能移动一次。";
    if (haremImpulse === G.impulse && !["buildNaval", "moveNaval", "piracy", "pass", "endImpulse"].includes(move)) return "Sultan's Harem 的 CP 仅可用于建造海盗船、海军移动或海盗行动。";
    if (haremImpulse === G.impulse && move === "buildNaval" && (args as {kind?: string})?.kind !== "corsair") return "Sultan's Harem 仅可建造海盗船。";
    if (isActivatedMajor(G, G.activePower) && ["patronize", "buildExpedition", "gainIntelligence", "plantInformant", "assassinate", "englishCatholicRebellion"].includes(move)) {
        return "激活强国不能执行赞助、探险或谍报行动。";
    }
    if (move === "assassinate") {
        const target = (args as {target?: string})?.target;
        const leader = target && LEADER_BY_ID[target];
        if (leader && isActivatedMajor(G, leader.power)) return "激活强国的将领不能成为刺杀目标。";
    }
    return undefined;
};
