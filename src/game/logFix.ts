import {Stage} from "boardgame.io/core";
import {Ctx, PlayerID} from "boardgame.io";
import {IG} from "../types/setup";

export function signalEndStage(G: IG, ctx: Ctx): void {
    ctx?.events?.endStage?.();
    // if (G.logDiscrepancyWorkaround) {
    //     G.pending.endStage = true;
    // } else {
    //     ctx?.events?.endStage?.();
    // }
}

export function cleanPendingSignal(G: IG): void {
    G.pending = {
        ...G.pending,
        endActivePlayer: false,
        endTurn: false,
        endPhase: false,
        endStage: false,
    }
}

export function signalEndTurn(G: IG, ctx: Ctx): void {
    if (G.logDiscrepancyWorkaround) {
        G.pending.endTurn = true;
    } else {
        ctx.events?.endTurn?.();
    }
}

export function signalEndPhase(G: IG, ctx: Ctx): void {
    if (G.logDiscrepancyWorkaround) {
        G.pending.endPhase = true;
    } else {
        ctx.events?.endPhase?.();
    }
}

export function changeStage(G: IG, ctx: Ctx, stage: string): void {
    ctx?.events?.setStage?.(stage);
}


export function changeBothStage(G: IG, ctx: Ctx, stage: string): void {
    if (G.logDiscrepancyWorkaround) {
        ctx.events?.setActivePlayers?.({
            all: Stage.NULL
        })
    } else {
        ctx.events?.setActivePlayers?.({
            all: stage
        })
    }
}

export function changePlayerStage(G: any, ctx: Ctx, stage: string, p: PlayerID): void {
    ctx.events?.setActivePlayers?.({
        value: {
            [p]: {stage: stage},
        }
    })
}


export function changePhase(G: IG, ctx: Ctx, phase: string) {
    if (G.logDiscrepancyWorkaround) {
        ctx.events?.setPhase?.(phase);
    } else {
        ctx.events?.setPhase?.(phase);
    }
}

export const autoEventsOnMove = (G: IG, ctx: Ctx): void => {
    if (G.pending.endTurn) {
        ctx.events?.endTurn?.();
    }
    if (G.pending.endPhase) {
        ctx.events?.endPhase?.();
    }
    if (G.pending.endActivePlayer) {
        ctx.events?.setActivePlayers?.({currentPlayer: Stage.NULL});
    }
}
