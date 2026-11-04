import React from "react";
import {BoardProps} from "boardgame.io/react";
import {VQGame} from "../../../constant/general";
import {controlledPowers, ownerOf, isActivatedMajor} from "../../../ownership";
import {actionWindowResponders, actionResponderChoices} from "../../board";

export const useVQGameState = ({G, ctx, playerID}: Pick<BoardProps<VQGame>, "G" | "ctx" | "playerID">) => {
    const owned = controlledPowers(G, playerID);
    
    const piracyResponder = G.pendingPiracy && (G.pendingPiracy.step === "losses" ? G.pendingPiracy.power : G.pendingPiracy.target);
    const actionResponders = actionWindowResponders(G);
    const myActionChoices = actionResponderChoices(G, playerID);
    const myActionResponders = myActionChoices.map((choice) => choice.responder);
    
    return {
        owned,
        piracyResponder,
        actionResponders,
        myActionChoices,
        myActionResponders,
    };
};

export const useVQPlayerState = (
    {G, ctx, playerID}: Pick<BoardProps<VQGame>, "G" | "ctx" | "playerID">,
    selectedActionResponder: string | undefined,
    setSelectedActionResponder: (p: any) => void,
    viewPower: any
) => {
    const owned = controlledPowers(G, playerID);
    const piracyResponder = G.pendingPiracy && (G.pendingPiracy.step === "losses" ? G.pendingPiracy.power : G.pendingPiracy.target);
    const actionResponders = actionWindowResponders(G);
    const myActionChoices = actionResponderChoices(G, playerID);
    const myActionResponders = myActionChoices.map((choice) => choice.responder);
    
    const actionResponder = (selectedActionResponder !== undefined && myActionResponders.includes(selectedActionResponder as any)
        ? selectedActionResponder : undefined) ?? myActionResponders[0] ?? actionResponders[0];
    
    const responsePower = G.gregorianResponse && ownerOf(G, G.gregorianResponse.responder) === playerID ? G.gregorianResponse.responder :
        G.pendingBeacon && ownerOf(G, G.pendingBeacon.defender) === playerID ? G.pendingBeacon.defender :
        G.pendingInterceptionOrder && ownerOf(G, G.pendingInterceptionOrder.defender) === playerID ? G.pendingInterceptionOrder.defender :
        G.pendingIntercept && ownerOf(G, G.pendingIntercept.defender) === playerID ? G.pendingIntercept.defender :
        G.pendingEspionage && ownerOf(G, G.pendingEspionage.responding) === playerID ? G.pendingEspionage.responding :
        actionResponder && ownerOf(G, actionResponder as any) === playerID ? actionResponder :
        piracyResponder && ownerOf(G, piracyResponder) === playerID ? piracyResponder :
        G.pendingCardEvent && ownerOf(G, G.pendingCardEvent.responding) === playerID ? G.pendingCardEvent.responding :
        G.pendingTutorialEvent && ownerOf(G, G.pendingTutorialEvent.responding) === playerID ? G.pendingTutorialEvent.responding :
        G.pendingCityRebels && isPower(G.pendingCityRebels.controller) && ownerOf(G, G.pendingCityRebels.controller) === playerID ? G.pendingCityRebels.controller :
        G.pendingBattle && ownerOf(G, G.pendingBattle.responding) === playerID ? G.pendingBattle.responding :
        G.pendingBetrothal && ownerOf(G, G.pendingBetrothal.target) === playerID ? G.pendingBetrothal.target : undefined;
    
    const me: any = responsePower ?? (ctx.currentPlayer === playerID ? G.activePower :
        viewPower && owned.includes(viewPower) ? viewPower : owned[0]);
    
    return {
        owned,
        piracyResponder,
        actionResponders,
        myActionChoices,
        myActionResponders,
        actionResponder,
        responsePower,
        me,
    };
};

// Need to import isPower
import {isPower} from "../../../constant/general";
