import {Ctx, PhaseConfig, StageConfig, TurnConfig} from 'boardgame.io';
import {TurnOrder} from "boardgame.io/core";
import {
    breakthrough,
    buyCard,
    chooseEffect,
    chooseEvent,
    chooseHand,
    chooseRegion,
    chooseTarget,
    comment,
    competitionCard,
    confirmRespond,
    drawCard,
    moveBlocker, payAdditionalCost,
    peek,
    playCard,
    requestEndTurn,
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
    industryAward,
    logger
} from "./util";
import {SchoolCardID} from "../types/core";

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
        showBoardStatus: showBoardStatus,
    }
}

export const NormalTurn: TurnConfig = {
    onBegin: (G: IG, ctx: Ctx) => {
        cleanPendingSignal(G, ctx)
        let p = ctx.currentPlayer;
        let pub = curPub(G,ctx);
        let log = `onBegin|p${p}`
        if(pub.school === SchoolCardID.S1301){
            log += `|montage`
            addVp(G,ctx,p,1);
            drawCardForPlayer(G,ctx,p);
            G.e.stack.push({e:"discard",a:1})
            changePlayerStage(G,ctx,"chooseHand",p);
        }
        if(pub.school === SchoolCardID.S3105){
            log += `|newYork`
            if(pub.aesthetics <= pub.industry){
                log += `|aesAward`
                aesAward(G,ctx,p);
            }
            if(pub.aesthetics >= pub.industry){
                log += `|industryAward`
                industryAward(G,ctx,p);
            }
        }
        logger.debug(`${G.matchID}|${log}`);
    },
    order: TurnOrder.CUSTOM_FROM("order"),
    stages: {
        showCompetitionResult:showCompetitionResultStage,
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
        payAdditionalCost:payAdditionalCostStage,
    },
    moves: {
        payAdditionalCost:payAdditionalCost,
        drawCard: drawCard,
        buyCard: buyCard,
        playCard: playCard,
        breakthrough: breakthrough,
        moveBlocker: moveBlocker,
        chooseTarget: chooseTarget,
        chooseHand: chooseHand,
        chooseEffect: chooseEffect,
        chooseEvent: chooseEvent,
        competitionCard: competitionCard,
        requestEndTurn: requestEndTurn,
        updateSlot: updateSlot,
        comment: comment,
        chooseRegion: chooseRegion,
        peek: peek,
    }
}

export const NormalPhase: PhaseConfig = {
    turn: NormalTurn,
    start: true,
}

export const InitPhase: PhaseConfig = {
    // start: true,
    turn: {
        order: TurnOrder.CUSTOM_FROM("order"),
        stages: {
            setupStage: setupStage
        },
    },
    moves: {
        showBoardStatus: showBoardStatus,
    },
    next: "NormalPhase",
}

