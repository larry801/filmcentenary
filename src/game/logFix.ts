import {Stage} from "boardgame.io/core";
import {Ctx, PlayerID} from "boardgame.io";
import {IG} from "../types/setup";
import {calcCardEfficiency, calcRoundFromTurn} from "./statMetrics";

const nowMs = (): number => Date.now();

const actingPlayer = (ctx: Ctx): PlayerID | null => {
    if (ctx.activePlayers === null) {
        return ctx.currentPlayer;
    }
    const players = Object.keys(ctx.activePlayers) as PlayerID[];
    if (players.length === 0) {
        return ctx.currentPlayer;
    }
    if (players.length === 1) {
        return players[0];
    }
    const others = players.filter((p) => p !== ctx.currentPlayer);
    if (others.length === 1) {
        return others[0];
    }
    return players[0] ?? ctx.currentPlayer;
};

const ensureTimeTracking = (G: IG, ctx: Ctx): void => {
    if (!G.timeTracking) {
        G.timeTracking = {
            hasStartedTiming: false,
            currentRound: 0,
            currentTurnPlayer: null,
            currentTurnStartedAtMs: 0,
            serverNowMs: 0,
            roundTimeMsByPlayer: {},
            totalTimeMsByPlayer: {},
        };
    }
    if (typeof G.timeTracking.currentRound !== "number" || !Number.isFinite(G.timeTracking.currentRound) || G.timeTracking.currentRound < 0) {
        const turn = typeof ctx.turn === "number" && Number.isFinite(ctx.turn) ? ctx.turn : 0;
        G.timeTracking.currentRound = calcRoundFromTurn(turn, G.playerCount || G.order.length || 1);
    }
    G.order.forEach((p) => {
        if (typeof G.timeTracking.roundTimeMsByPlayer[p] !== "number") {
            G.timeTracking.roundTimeMsByPlayer[p] = 0;
        }
        if (typeof G.timeTracking.totalTimeMsByPlayer[p] !== "number") {
            G.timeTracking.totalTimeMsByPlayer[p] = 0;
        }
    });
    if (!G.timeTracking.currentTurnPlayer) {
        G.timeTracking.currentTurnPlayer = ctx.currentPlayer ?? G.order[0] ?? null;
    }
    if (!Number.isFinite(G.timeTracking.currentTurnStartedAtMs) || G.timeTracking.currentTurnStartedAtMs < 0) {
        G.timeTracking.currentTurnStartedAtMs = 0;
    }
    if (!Number.isFinite(G.timeTracking.serverNowMs) || G.timeTracking.serverNowMs < 0) {
        G.timeTracking.serverNowMs = 0;
    }
};

const addElapsedToPlayer = (G: IG, player: PlayerID, elapsedMs: number): void => {
    const elapsed = Math.max(0, elapsedMs);
    G.timeTracking.roundTimeMsByPlayer[player] = (G.timeTracking.roundTimeMsByPlayer[player] || 0) + elapsed;
    G.timeTracking.totalTimeMsByPlayer[player] = (G.timeTracking.totalTimeMsByPlayer[player] || 0) + elapsed;
};

const initialTimerPlayer = (G: IG, ctx: Ctx): PlayerID | null => {
    // During InitPhase, ctx.currentPlayer is often still the default player (P1).
    // Timer should start from the actual first player in current order.
    if (ctx.phase === "InitPhase") {
        return G.order[0] ?? actingPlayer(ctx) ?? null;
    }
    return actingPlayer(ctx) ?? G.order[0] ?? null;
};

const startTimingIfNeeded = (G: IG, ctx: Ctx): void => {
    ensureTimeTracking(G, ctx);
    if (G.timeTracking.hasStartedTiming) {
        return;
    }
    G.timeTracking.hasStartedTiming = true;
    G.timeTracking.currentTurnPlayer = initialTimerPlayer(G, ctx);
    const now = nowMs();
    G.timeTracking.currentTurnStartedAtMs = now;
    G.timeTracking.serverNowMs = now;
};

const syncTimerToActingPlayer = (G: IG, ctx: Ctx): void => {
    ensureTimeTracking(G, ctx);
    if (!G.timeTracking.hasStartedTiming) {
        startTimingIfNeeded(G, ctx);
        return;
    }
    const tracking = G.timeTracking;
    const actor = actingPlayer(ctx);
    const now = nowMs();
    if (!tracking.currentTurnPlayer) {
        tracking.currentTurnPlayer = actor;
        tracking.currentTurnStartedAtMs = now;
        tracking.serverNowMs = now;
        return;
    }
    if (actor && tracking.currentTurnPlayer !== actor) {
        const elapsed = Math.max(0, now - tracking.currentTurnStartedAtMs);
        const prev = tracking.currentTurnPlayer;
        addElapsedToPlayer(G, prev, elapsed);
        tracking.currentTurnPlayer = actor;
        tracking.currentTurnStartedAtMs = now;
    }
    tracking.serverNowMs = now;
};

const switchTimerToPlayerNow = (G: IG, player: PlayerID): void => {
    ensureTimeTracking(G, {
        currentPlayer: player,
    } as Ctx);
    if (!G.timeTracking.hasStartedTiming) {
        G.timeTracking.hasStartedTiming = true;
        const now = nowMs();
        G.timeTracking.currentTurnPlayer = player;
        G.timeTracking.currentTurnStartedAtMs = now;
        G.timeTracking.serverNowMs = now;
        return;
    }
    const tracking = G.timeTracking;
    const now = nowMs();
    const prev = tracking.currentTurnPlayer;
    if (!prev) {
        tracking.currentTurnPlayer = player;
        tracking.currentTurnStartedAtMs = now;
        tracking.serverNowMs = now;
        return;
    }
    if (prev === player) {
        tracking.serverNowMs = now;
        return;
    }
    const elapsed = Math.max(0, now - tracking.currentTurnStartedAtMs);
    addElapsedToPlayer(G, prev, elapsed);
    tracking.currentTurnPlayer = player;
    tracking.currentTurnStartedAtMs = now;
    tracking.serverNowMs = now;
};

const finalizeCurrentPlayerTurnTime = (G: IG, ctx: Ctx): void => {
    ensureTimeTracking(G, ctx);
    if (!G.timeTracking.hasStartedTiming) {
        startTimingIfNeeded(G, ctx);
        return;
    }
    const tracking = G.timeTracking;
    const player = tracking.currentTurnPlayer;
    if (!player) {
        return;
    }
    const now = nowMs();
    const elapsed = Math.max(0, now - tracking.currentTurnStartedAtMs);
    addElapsedToPlayer(G, player, elapsed);
    tracking.serverNowMs = now;
};

export const stopTimingForGameEnd = (G: IG, ctx: Ctx): void => {
    ensureTimeTracking(G, ctx);
    const tracking = G.timeTracking;
    if (!tracking.hasStartedTiming) {
        return;
    }
    const now = nowMs();
    if (tracking.currentTurnPlayer && tracking.currentTurnStartedAtMs > 0) {
        const elapsed = Math.max(0, now - tracking.currentTurnStartedAtMs);
        addElapsedToPlayer(G, tracking.currentTurnPlayer, elapsed);
    }
    tracking.serverNowMs = now;
    tracking.hasStartedTiming = false;
    tracking.currentTurnPlayer = null;
    tracking.currentTurnStartedAtMs = 0;
};

const resetRoundTimerIfCrossRound = (G: IG, ctx: Ctx): void => {
    ensureTimeTracking(G, ctx);
    const tracking = G.timeTracking;
    const turn = typeof ctx.turn === "number" && Number.isFinite(ctx.turn) ? ctx.turn : 0;
    const playerCount = G.playerCount || G.order.length || 1;
    const currentRound = calcRoundFromTurn(turn, playerCount);
    const nextRound = calcRoundFromTurn(turn + 1, playerCount);
    if (nextRound > currentRound) {
        G.order.forEach((p) => {
            tracking.roundTimeMsByPlayer[p] = 0;
        });
        tracking.currentRound = nextRound;
        return;
    }
    tracking.currentRound = currentRound;
};

const computeNextPlayer = (G: IG, ctx: Ctx): PlayerID | null => {
    const playOrder = (Array.isArray(ctx.playOrder) && ctx.playOrder.length > 0 ? ctx.playOrder : G.order) as PlayerID[];
    if (!Array.isArray(playOrder) || playOrder.length === 0) {
        return null;
    }
    const current = ctx.currentPlayer;
    const currentIndex = current !== null ? playOrder.indexOf(current) : -1;
    if (currentIndex < 0) {
        return playOrder[0] ?? null;
    }
    return playOrder[(currentIndex + 1) % playOrder.length] ?? null;
};

const beginNextTurnTimer = (G: IG, ctx: Ctx): void => {
    ensureTimeTracking(G, ctx);
    if (!G.timeTracking.hasStartedTiming) {
        return;
    }
    G.timeTracking.currentTurnPlayer = computeNextPlayer(G, ctx) ?? actingPlayer(ctx);
    const now = nowMs();
    G.timeTracking.currentTurnStartedAtMs = now;
    G.timeTracking.serverNowMs = now;
};

const calcEraRatio = (G: IG, ctx: Ctx, playerIndex: number): number => {
    return calcCardEfficiency(G, playerIndex);
}

const recordSettlementTimeline = (G: IG, ctx: Ctx): void => {
    ensureTimeTracking(G, ctx);
    const turn = typeof ctx.turn === "number" && Number.isFinite(ctx.turn) ? ctx.turn : 0;
    const round = calcRoundFromTurn(turn, G.playerCount || G.order.length || 1);
    const snapshot = {
        turn,
        round,
        players: G.pub.map((p, idx) => {
            const playerID = idx.toString();
            return {
            industry: p.industry || 0,
            aesthetics: p.aesthetics || 0,
            score: (p.finalScoring?.total || 0) > 0 ? (p.finalScoring?.total || 0) : (p.vp || 0),
            eraRatio: calcEraRatio(G, ctx, idx),
            roundTimeMs: G.timeTracking.roundTimeMsByPlayer[playerID] || 0,
            totalTimeMs: G.timeTracking.totalTimeMsByPlayer[playerID] || 0,
        }}),
    };

    const idx = G.settlementTimeline.findIndex(s => s.turn === turn);
    if (idx >= 0) {
        G.settlementTimeline[idx] = snapshot;
    } else {
        G.settlementTimeline.push(snapshot);
        G.settlementTimeline.sort((a, b) => a.turn - b.turn);
    }
}

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
    syncTimerToActingPlayer(G, ctx);
    finalizeCurrentPlayerTurnTime(G, ctx);
    recordSettlementTimeline(G, ctx);
    resetRoundTimerIfCrossRound(G, ctx);
    beginNextTurnTimer(G, ctx);
    if (G.logDiscrepancyWorkaround) {
        G.pending.endTurn = true;
    } else {
        ctx.events?.endTurn?.();
    }
}

export function signalEndPhase(G: IG, ctx: Ctx): void {
    startTimingIfNeeded(G, ctx);
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
    //console.log("changePlayerStage: ", G.secretInfo);
    switchTimerToPlayerNow(G, p);
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
    syncTimerToActingPlayer(G, ctx);
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
