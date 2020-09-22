import {TurnConfig, PhaseConfig, StageConfig}from 'boardgame.io/src/types';
import {IG} from "../types/setup";
import {Ctx} from "boardgame.io";
import {TurnOrder} from "boardgame.io/core";
import {confirmRespond, initialSetup, moveBlocker} from "./moves";

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
    }
}

export const NormalPhase :PhaseConfig ={
    start:true,
    turn:NormalTurn,

}

export const CheckPhase :PhaseConfig ={
    onBegin:(G:IG,ctx:Ctx)=>{

    },
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

