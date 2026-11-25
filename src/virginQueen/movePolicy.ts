import {VQGame} from "./constant/general";
import {isActivatedMajor} from "./ownership";
import {tutorialActionError} from "./tutorial";
import {LEADER_BY_ID} from "./constant/leaders";

export const moveError = (G: VQGame, move: string, args?: unknown): string | undefined => {
    if ((G.pendingNavalMoves || G.pendingNavalOrder) && !["chooseBattle", "playVirginQueenCombat", "playCard", "chooseInterception", "respondBeaconFires", "chooseInterceptionOrder", "autoInterceptionOrder", "chooseNavalOrder"].includes(move)) {
        return "请先完成当前海军行动的拦截与战斗。";
    }
    if (G.pendingWithdraw && move !== "chooseWithdraw") return "请先决定是否退入要塞。";
    if (G.pendingContinue && !["continueMove", "stopContinue"].includes(move)) return "请先完成撤退后的移动选择。";
    // Rule 15.2: after a lost relief battle the relief power must choose how
    // many units stay inside.  The choice is mandatory, so it cannot be left
    // for a later phase by passing or ending the impulse.
    if (G.pendingReliefSplit !== undefined && move !== "chooseReliefSplit") {
        return "请先决定解围战败后留在城内的单位数。";
    }
    if (G.pendingEspionage && move !== "chooseEspionage") return "请先完成当前谍报结算。";
    if (G.pendingCardEvent && move !== "chooseCardEvent") return "请先完成当前事件响应。";
    if (G.pendingRebelMove && move !== "chooseRebelMove") return "请先完成叛军移动。";
    // Rule 23.7: the affected power (not necessarily the event player) must
    // commit its foreign-war force before the impulse can continue.  The event
    // player may end that impulse to fall back to the automatic selection.
    if (G.pendingForeignWar !== undefined && move !== "commitForeignWarForce" &&
        !((move === "endImpulse" || move === "pass") && G.pendingForeignWar.power !== G.activePower)) {
        return "请先完成境外战争的部队选择。";
    }
    if (G.pendingAbjuration && move !== "chooseAbjuration") return "请先完成誓绝法案的提议选择。";
    if (G.pendingTribute && move !== "chooseTribute") return "请先完成奥斯曼贡金的纳贡选择。";
    if (G.pendingCityRebels && move !== "chooseCityRebelsLoss") return "请先完成城邦起义的损失选择。";
    if (G.pendingScienceTreasure !== undefined && move !== "chooseScienceTreasureBonus") {
        return "请先选择科学奖励宝藏带来的科学奖励。";
    }
    if (G.pendingConversion !== undefined && move !== "chooseConversionNullify") {
        return "请先决定是否用 6 换 5 取消 1 个动荡。";
    }
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
    if (G.orangeArrivalPending && G.activePower === "protestant" &&
        !["chooseOrangePlacement", "chooseHomeCard", "chooseHreReligiousPreference", "endPhaseTurn"].includes(move)) {
        return "请先决定威廉·奥兰治的位置。";
    }
    // Winter loss confirmations and the rule 20.1 Morisco unrest placement
    // block other moves; return revisions are optional (the automatic move is
    // already a legal result) and are simply offered during the Card Draw
    // stage.  Ending the turn accepts every automatic result.
    const winterChoiceMoves = ["chooseWinterLoss", "chooseWinterNavalLoss", "chooseWinterReturn",
        "chooseWinterNavalReturn", "chooseMoriscoUnrest", "endPhaseTurn"];
    if ((G.winterLossChoices?.some((entry) => entry.power === G.activePower) ||
        G.winterNavalLossChoices?.some((entry) => entry.power === G.activePower)) &&
        !winterChoiceMoves.includes(move)) {
        return "请先确认冬季损失的单位类型。";
    }
    if (G.pendingMoriscoUnrest !== undefined && G.pendingMoriscoUnrest.power === G.activePower &&
        !winterChoiceMoves.includes(move)) {
        return "请先决定摩尔人起义的冬季骚动地点。";
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
    // #59 John Hawkins: the 5 CP England gains are for building naval units
    // (including expeditions), naval movement, and piracy actions only.
    // Playing a card or treasure does not spend that CP, so those stay open.
    if (G.hawkinsBonus === true && !["buildNaval", "buildExpedition", "moveNaval", "navalTransport", "piracy", "worldPiracy", "playCard", "playTreasure", "pass", "endImpulse"].includes(move)) {
        return "John Hawkins 的 CP 仅可用于建造海军、海军移动、海盗行动或探险。";
    }
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
