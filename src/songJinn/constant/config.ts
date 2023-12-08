import {PhaseConfig, StageConfig, TurnConfig} from "boardgame.io";
import {SongJinnGame} from "./setup";
import {TurnOrder} from "boardgame.io/core";
import {
    cardEvent,
    chooseFirst,
    choosePlan,
    chooseTop, combatCard, deploy,
    develop,
    developCard,
    discard, down, emptyRound,
    endRound,
    heYi,
    letter, loseCity, loseProvince, march, moveTroop,
    op, opponentMove, placeTroop,
    placeUnit, recruitPuppet, recruitUnit, removeUnit,
    returnToHand,
    rollDices,
    search,
    searchFirst,
    showPlan, takeDamage,
    takePlan,
    tieJun
} from "../moves";
import {playerById} from "../util/fetch";
import {drawPlanForPlayer, rm} from "../util/card";
import {ActiveEvents, PlayerPendingEffect, SJPlayer} from "./general";
import {logger} from "../../game/logger";
import {getLeadingPlayer} from "../util/calc";
import {canChoosePlan} from "../util/check";
import {changeDiplomacyByLOD} from "../util/change";

export const NormalTurnConfig: TurnConfig<SongJinnGame> = {
    order: TurnOrder.CUSTOM_FROM("order"),
}

export const ReactStageConfig: StageConfig<SongJinnGame> = {
    moves: {
        discard: discard,
        deploy: deploy,
        opponentMove: opponentMove,
        march: march,
        moveTroop: moveTroop,
        takeDamage: takeDamage,
        removeUnit: removeUnit,
        placeUnit: placeUnit,
        rollDices: rollDices,
        //
        down: down,

        placeTroop: placeTroop,
    }
}

const StagedTurnConfig = {
    order: TurnOrder.CUSTOM_FROM("order"),
    stages: {
        react: ReactStageConfig,
    },
};
export const DiscardStageConfig: StageConfig<SongJinnGame> = {
    moves: {
        discard: discard
    }
}


export const TurnEndPhaseConfig: PhaseConfig<SongJinnGame> = {
    onBegin: (G, ctx) => {
        const log = [`turnEndPhase|onBegin|${G.order}`];
        if (G.events.includes(ActiveEvents.XiJunQuDuan)) {
            ctx.events?.setStage('placeUnit');
        } else {
            if (G.song.effect.includes(PlayerPendingEffect.SearchCard)) {
                if (G.jinn.effect.includes(PlayerPendingEffect.SearchCard)) {
                    // 目前不可能 因为只有京畿计划有检索
                    rm(PlayerPendingEffect.SearchCard, G.jinn.effect);
                    rm(PlayerPendingEffect.SearchCard, G.song.effect);
                    ctx.events?.setPhase('placeUnit');

                } else {

                }
            }
            G.order = [getLeadingPlayer(G)];
            ctx.events?.setPhase('chooseFirst');
        }
        logger.debug(log.join(''));
    },
    moves: {
        placeUnit: placeUnit
    }
}

export const DrawPhaseConfig: PhaseConfig<SongJinnGame> = {
    onBegin: (G, ctx) => {
        const log = [`draw|onBegin|${G.order}`]
        const firstPlayer = G.order[0];
    },
    moves: {
        searchFirst: searchFirst,
        search: search,
        discard: discard
    }
}

export const DevelopPhaseConfig: PhaseConfig<SongJinnGame> = {
    moves: {
        develop: develop,
        returnToHand: returnToHand
    }
}
export const ChoosePlanPhaseConfig: PhaseConfig<SongJinnGame> = {
    onBegin: (G, ctx) => {
        const log = [`choosePlan|onBegin|${G.order}`]
        const firstPid = G.order[0];
        drawPlanForPlayer(G, firstPid);
        const player = playerById(G, firstPid);
        log.push(`|p${firstPid}|${player.plans}`);
        if (player.plans.filter((pid) => canChoosePlan(G, ctx, firstPid, pid)).length === 0) {
            log.push(`|cannot chose`)
            G.secret.planDeck.concat(player.plans);
            player.plans = [];
            const secondPid = G.order[1];
            drawPlanForPlayer(G, secondPid);
            const secondPlayer = playerById(G, secondPid);
            log.push(`|p${secondPid}|${secondPlayer.plans}`);
            if (secondPlayer.plans.filter((p) => canChoosePlan(G, ctx, secondPid, p))) {
                G.secret.planDeck.concat(secondPlayer.plans);
                secondPlayer.plans = [];
                log.push(`|cannot|chose|goto|action`);
                ctx.events?.setPhase('showPlan');
            } else {
                log.push(`|let|p${secondPid}choosePlan`);
                G.order = [secondPid];
            }
        }
        logger.debug(log.join(''));
    },
    onEnd: (G, ctx) => {
        const log = [`choosePlan|onEnd|${G.order}`]
        switch (G.first) {
            case SJPlayer.P1:
                G.order = [SJPlayer.P1, SJPlayer.P2];
                break
            case SJPlayer.P2:
                G.order = [SJPlayer.P2, SJPlayer.P1];
                break
        }
        log.push(`|resetOrder${JSON.stringify(G.order)}`)
        logger.debug(log.join(''));
    },
    turn: NormalTurnConfig,
    moves: {
        choosePlan: choosePlan
    },
    next: 'showPlan'
}

export const ShowPlanPhaseConfig: PhaseConfig<SongJinnGame> = {
    turn: NormalTurnConfig,
    moves: {
        showPlan: showPlan
    },
    next: 'action'
}

export const ChooseFirstPhaseConfig: PhaseConfig<SongJinnGame> = {
    moves: {
        chooseFirst: chooseFirst
    },
    next: 'choosePlan',
    start: true,
    // turn: NormalTurnConfig
}


export const ActionPhaseConfig: PhaseConfig<SongJinnGame> = {
    start: true,
    turn: StagedTurnConfig,
    moves: {
        emptyRound: emptyRound,

        op: op,
        recruitUnit: recruitUnit,
        cardEvent: cardEvent,
        developCard: developCard,
        letter: letter,
        heYi: heYi,
        tieJun: tieJun,
        combatCard:combatCard,

        recruitPuppet: recruitPuppet,
        endRound: endRound,


        deploy: deploy,
        opponentMove: opponentMove,
        march: march,
        moveTroop: moveTroop,
        takeDamage: takeDamage,
        removeUnit: removeUnit,
        placeUnit: placeUnit,
        rollDices: rollDices,
        loseCity: loseCity,
        loseProvince: loseProvince,
        placeTroop: placeTroop,
        down: down,
    },
}

export const ResolvePlanPhaseConfig: PhaseConfig<SongJinnGame> = {
    // start: true,
    onBegin: (G, ctx) => {
        const log = [`resolvePlanPhase|onBegin|${G.order}`];
        G.plans = G.plans.concat(G.song.plan);
        log.push(`|${G.plans}`);
        G.plans = G.plans.concat(G.jinn.plan);
        log.push(`|${G.plans}`);
        if (G.song.completedPlan.length > 0 && !G.events.includes(ActiveEvents.YanJingYiNan)) {
            const songTop = G.song.completedPlan.pop();
            log.push(`songTop|${songTop}`);
            if (songTop !== undefined) {
                G.plans.push(songTop);
                log.push(`|${G.plans}`);

            }
        }
        if (G.jinn.completedPlan.length > 0) {
            const jinnTop = G.jinn.completedPlan.pop();
            log.push(`jinnTop|${jinnTop}`);
            if (jinnTop !== undefined) {
                G.plans.push(jinnTop);
            }
        }
        log.push(`|${G.plans}`);
        G.song.plan = [];
        G.jinn.plan = [];
        logger.info(`${log.join('')}`);
    },
    moves: {
        recruitPuppet: recruitPuppet,
        endRound: endRound,


        deploy: deploy,
        opponentMove: opponentMove,
        march: march,
        moveTroop: moveTroop,
        takeDamage: takeDamage,
        removeUnit: removeUnit,
        placeUnit: placeUnit,
        rollDices: rollDices,
        loseCity: loseCity,
        loseProvince: loseProvince,
        placeTroop: placeTroop,
        down: down,
        takePlan: takePlan,
        chooseTop: chooseTop,
        //
    },
    turn: StagedTurnConfig,
}

export const DiplomacyPhaseConfig: PhaseConfig<SongJinnGame> = {
    onBegin: (G, ctx) => {
        changeDiplomacyByLOD(G);
    },
    turn: StagedTurnConfig,
    next: 'develop',
}
export const DeployPhaseConfig: PhaseConfig<SongJinnGame> = {
    onBegin: (G, ctx) => {
        G.song.nations.length;
    },
    turn: StagedTurnConfig,
    moves:{
        recruitPuppet: recruitPuppet,
        endRound: endRound,
        deploy: deploy,
        opponentMove: opponentMove,
        march: march,
        moveTroop: moveTroop,
        takeDamage: takeDamage,
        removeUnit: removeUnit,
        placeUnit: placeUnit,
        rollDices: rollDices,
        loseCity: loseCity,
        loseProvince: loseProvince,
        placeTroop: placeTroop,
        down: down,
    }
}
export const EPhaseConfig: PhaseConfig<SongJinnGame> = {}
export const EmptyPhaseConfig: PhaseConfig<SongJinnGame> = {}