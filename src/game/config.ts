import {TurnConfig, PhaseConfig, StageConfig, Ctx} from 'boardgame.io';
import {TurnOrder} from "boardgame.io/core";
import {breakthrough, buyCard, confirmRespond, drawCard, initialSetup, moveBlocker, playCard} from "./moves";
import {IG} from "../types/setup";
import {autoEventsOnMove} from "./logFix";

export const tempStudioRespond: StageConfig = {
    moves: {
        confirmRespond: confirmRespond,
    }
}

export const moveBlockerStage: StageConfig = {
    moves: {
        moveBlocker: moveBlocker,
    }
}

export const NormalTurn: TurnConfig = {
    order: TurnOrder.CUSTOM_FROM("order"),
    stages: {
        tempStudioRespond: tempStudioRespond,
        moveBlockerStage: moveBlockerStage
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
    turn: {
        order: TurnOrder.CUSTOM_FROM("order"),
        stages: {
            setupStage: setupStage
        },
        onMove: (G: IG, ctx: Ctx) => {
            autoEventsOnMove(G,ctx);
        }
    },
    next:"NormalPhase",
}

