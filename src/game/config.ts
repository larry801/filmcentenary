import {Ctx, PhaseConfig, StageConfig, TurnConfig} from 'boardgame.io';
import {TurnOrder} from "boardgame.io/core";
import {
    breakthrough,
    buyCard,
    changePlayerSetting,
    chooseEffect,
    chooseEvent,
    chooseHand,
    chooseRegion,
    chooseTarget,
    comment,
    competitionCard, concedeMove,
    confirmRespond, drawCard,
    moveBlocker,
    payAdditionalCost,
    peek, playCard, requestEndTurn, setupGameMode,
    showBoardStatus,
    showCompetitionResult,
    updateSlot,
} from "./moves";
import {IG} from "../types/setup";
import {changePlayerStage, cleanPendingSignal} from "./logFix";
import {
    addVp,
    aesAward,
    curPub,
    drawCardForPlayer,
    industryAward
} from "./util";
import {ItrEffects, SchoolCardID, SimpleEffectNames} from "../types/core";
import {logger} from "./logger";

export const payAdditionalCostStage: StageConfig = {
    moves: {
        payAdditionalCost: payAdditionalCost,
    }
}

export const chooseEffectStage: StageConfig = {
    moves: {
        chooseEffect: chooseEffect
    }
}
export const chooseEventStage: StageConfig = {
    moves: {
        chooseEvent: chooseEvent
    }
}
export const competitionCardStage: StageConfig = {
    moves: {
        competitionCard: competitionCard
    }
}

export const confirmRespondStage: StageConfig = {
    moves: {
        confirmRespond: confirmRespond,
    }
}

export const chooseHandStage: StageConfig = {
    moves: {
        chooseHand: chooseHand,
    }
}

export const chooseTargetStage: StageConfig = {
    moves: {
        chooseTarget: chooseTarget,
    }
}

export const moveBlockerStage: StageConfig = {
    moves: {
        moveBlocker: moveBlocker,
    }
}
export const updateSlotStage: StageConfig = {
    moves: {
        updateSlot: updateSlot,
    }
}
export const commentStage: StageConfig = {
    moves: {
        comment: comment,
    }
}
export const chooseRegionStage: StageConfig = {
    moves: {
        chooseRegion: chooseRegion,
    }
}

export const peekStage: StageConfig = {
    moves: {
        peek: peek,
    }
}

export const showCompetitionResultStage: StageConfig = {
    moves: {
        showCompetitionResult: showCompetitionResult,
    }
}

export const setupStage: StageConfig = {
    moves: {
        setupGameMode: setupGameMode,
        showBoardStatus: showBoardStatus,
    }
}

const noEff = {e: "none", a: 1};

export const NormalTurn: TurnConfig = {
    onBegin: (G: IG, ctx: Ctx) => {
        cleanPendingSignal(G);
        let p = ctx.currentPlayer;
        const log = [`onBegin|p${p}`];
        if (G.order.includes(p)) {
            const pub = curPub(G, ctx);
            if (pub.school === SchoolCardID.S2201) {
                log.push(`|neoRealism`);
                G.e.stack.push({
                    e: ItrEffects.choice, a: [
                        {e: SimpleEffectNames.addCompetitionPower, a: 1},
                        {
                            e: "optional", a: {
                                e: "competition", a: {
                                    bonus: 0,
                                    onWin: {e: SimpleEffectNames.addCompetitionPower, a: 1},
                                }
                            }
                        }
                    ]
                });
            }
            if (pub.school === SchoolCardID.S1301) {
                log.push(`|montage`);
                addVp(G, ctx, p, 1);
                G.e.stack.push({
                    e: "optional", a: {
                        e: "step", a: [
                            {e: "draw", a: 1},
                            {e: "discard", a: 1},
                        ]
                    }
                });
                changePlayerStage(G, ctx, "confirmRespond", p);
            }
            if (pub.school === SchoolCardID.S2101) {
                log.push(`|classicHollywood`);
                G.e.stack.push({
                    e: ItrEffects.choice, a: [
                        {e: SimpleEffectNames.addCompetitionPower, a: 1},
                        {
                            e: "optional", a: {
                                e: "competition", a: {
                                    bonus: 0,
                                    onWin: noEff,
                                }
                            }
                        }
                    ]
                })
            }
            if (pub.school === SchoolCardID.S3101) {
                log.push(`|newHollywood`);
                G.e.choices.push({e: SimpleEffectNames.draw, a: 1});
                G.e.choices.push({e: SimpleEffectNames.addCompetitionPower, a: 1});
                changePlayerStage(G, ctx, "chooseEffect", p);
            }
            if (pub.school === SchoolCardID.S3105) {
                log.push(`|newYork`);
                if (pub.aesthetics >= pub.industry) {
                    log.push(`|aesAward`);
                    aesAward(G, ctx, p);
                }
                if (pub.industry >= pub.aesthetics) {
                    log.push(`|industryAward`);
                    industryAward(G, ctx, p);
                }
            }
        } else {
            log.push(`|playerConceded|endTurn`);
            ctx?.events?.endTurn?.();
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    },
    order: TurnOrder.CUSTOM_FROM("order"),
    stages: {
        showCompetitionResult: showCompetitionResultStage,
        showBoard: setupStage,
        chooseEffect: chooseEffectStage,
        chooseEvent: chooseEventStage,
        chooseHand: chooseHandStage,
        chooseRegion: chooseRegionStage,
        chooseTarget: chooseTargetStage,
        comment: commentStage,
        competitionCard: competitionCardStage,
        confirmRespond: confirmRespondStage,
        moveBlockerStage: moveBlockerStage,
        updateSlot: updateSlotStage,
        peek: peekStage,
        payAdditionalCost: payAdditionalCostStage,
    },
    moves: {
        changePlayerSetting: changePlayerSetting,
        drawCard: drawCard,
        buyCard: buyCard,
        playCard: playCard,
        breakthrough: breakthrough,
        chooseTarget: chooseTarget,
        chooseHand: chooseHand,
        chooseEvent: chooseEvent,
        chooseEffect: chooseEffect,
        chooseRegion: chooseRegion,
        competitionCard: competitionCard,
        requestEndTurn: requestEndTurn,
        updateSlot: updateSlot,
        comment: comment,
        peek: peek,
        concede: concedeMove,
    },
}

export const NormalPhase: PhaseConfig = {
    next: "NormalPhase",
    turn: NormalTurn,
}

export const InitPhase: PhaseConfig = {
    start: true,
    turn: {
        stages: {
            setupStage: setupStage
        },
    },
    moves: {
        setupGameMode: setupGameMode,
        showBoardStatus: showBoardStatus,
    },
    next: "NormalPhase",
}

