import {TurnConfig, PhaseConfig, StageConfig}from 'boardgame.io/src/types';
import {IG} from "../types/setup";
import {Ctx} from "boardgame.io";
import {TurnOrder} from "boardgame.io/core";
import {buyCard, confirmRespond, drawCard, initialSetup, moveBlocker, playCard} from "./moves";

export const tempStudioRespond:StageConfig ={
    moves:{
        confirmRespond:confirmRespond,
    }
}

export const moveBlockerStage:StageConfig = {
    moves:{
        moveBlocker:moveBlocker,
    }
}

export const NormalTurn :TurnConfig ={
    order:TurnOrder.CUSTOM_FROM("order"),
    stages:{
        tempStudioRespond:tempStudioRespond,
        moveBlockerStage:moveBlockerStage
    },
    moves:{
        drawCard:drawCard,
        buyCard:buyCard,
        playCard:playCard
    }
}

export const NormalPhase :PhaseConfig ={
    start:true,
    turn:NormalTurn,

}

export const  setupStage:StageConfig ={
    moves:{
        initialSetup:initialSetup,
    }
}

export const InitPhase :PhaseConfig ={
    turn:{
        stages:{
            setupStage:setupStage
        }
    }
}

