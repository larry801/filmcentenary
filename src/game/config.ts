import {TurnConfig, PhaseConfig, StageConfig, Ctx} from 'boardgame.io';
import {TurnOrder} from "boardgame.io/core";
import {
    breakthrough,
    buyCard,
    chooseEffect, chooseHand, chooseTarget,
    confirmRespond,
    drawCard,
    initialSetup,
    moveBlocker,
    playCard
} from "./moves";
import {IG} from "../types/setup";
import {cleanPendingSignal} from "./logFix";

export const tempStudioRespond: StageConfig = {
    moves: {
        confirmRespond: confirmRespond,
    }
}

export const chooseEffectStage: StageConfig = {
    moves:{
        chooseEffect:chooseEffect
    }
}

export const chooseHandStage: StageConfig = {
    moves:{
        chooseHand:chooseHand,
    }
}

export const  chooseTargetStage: StageConfig = {
    moves:{
        chooseTarget:chooseTarget,
    }
}

export const moveBlockerStage: StageConfig = {
    moves: {
        moveBlocker: moveBlocker,
    }
}

export const NormalTurn: TurnConfig = {
    onBegin:(G:IG,ctx:Ctx)=>cleanPendingSignal(G,ctx),
    order: TurnOrder.CUSTOM_FROM("order"),
    stages: {
        moveBlockerStage: moveBlockerStage,
        chooseEffect:chooseEffectStage,
        chooseHand:chooseHandStage,
        chooseTarget:chooseTargetStage,
    },
    moves: {
        drawCard: drawCard,
        buyCard: buyCard,
        playCard: playCard,
        breakthrough:breakthrough,
    }
}

export const NormalPhase: PhaseConfig = {
    turn: NormalTurn,
    start: true,
}

export const setupStage: StageConfig = {
    moves: {
        initialSetup: initialSetup,
    }
}

export const InitPhase: PhaseConfig = {
    // start: true,
    turn: {
        order: TurnOrder.CUSTOM_FROM("order"),
        stages: {
            setupStage: setupStage
        },

    },
    next:"NormalPhase",
}

