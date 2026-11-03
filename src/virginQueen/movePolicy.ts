import {VQGame} from "./constant/general";
import {isActivatedMajor} from "./ownership";
import {tutorialActionError} from "./tutorial";
import {LEADER_BY_ID} from "./constant/leaders";

export const moveError = (G: VQGame, move: string, args?: unknown): string | undefined => {
    if (G.pendingEspionage && move !== "chooseEspionage") return "请先完成当前谍报结算。";
    if (G.pendingCardEvent && move !== "chooseCardEvent") return "请先完成当前事件响应。";
    if (G.pendingAbjuration && move !== "chooseAbjuration") return "请先完成誓绝法案的提议选择。";
    if (G.pendingBeacon && move !== "respondBeaconFires") return "请先完成烽火响应。";
    if ((G.pendingBattle || G.pendingTutorialEvent || G.pendingActivation || G.pendingPiracy || G.pendingAction || G.pendingIntercept) && !["chooseBattle", "chooseTutorialEvent", "chooseMajorActivation", "choosePiracy", "respondAction", "chooseInterception"].includes(move)) return "请先完成当前响应。";
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
