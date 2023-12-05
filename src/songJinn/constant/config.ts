import {PhaseConfig, TurnConfig} from "boardgame.io";
import {SongJinnGame} from "./setup";
import {TurnOrder} from "boardgame.io/core";
import {chooseFirst, choosePlan, searchFirst, showPlan} from "../moves";
import {getStateById, playerById} from "../util/fetch";
import {addLateTermCard, addMidTermCard, drawPlanForPlayer} from "../util/card";
import {getPlanById} from "./plan";
import {ActiveEvents, SJPlayer} from "./general";
import {logger} from "../../game/logger";

export const NormalTurnConfig: TurnConfig<SongJinnGame> = {
    order: TurnOrder.CUSTOM_FROM("order"),
}

export const TurnEndPhaseConfig: PhaseConfig<SongJinnGame> = {
    onBegin: (G, ctx) => {
        const log = [`turnEndPhase|onBegin|${G.order}`];
        if (G.turn === 2) {
            addMidTermCard(G, ctx);
        }
        if (G.turn === 6) {
            addLateTermCard(G, ctx);
        }
        if (G.events.includes(ActiveEvents.YueShuaiZhiLai)) {
            log.push(`|RemoveYueShuaiZhiLai|${G.events.toString()}`);
            G.events.splice(G.events.indexOf(ActiveEvents.YueShuaiZhiLai), 1);
            log.push(`|after|${G.events.toString()}`);
        }
        G.turn++;
        if (G.events.includes(ActiveEvents.XiJunQuDuan)) {
            //TODO
        }
        logger.debug(log.join(''));
    },
    moves: {
        searchFirst: searchFirst,

    }

}

export const DrawPhaseConfig: PhaseConfig<SongJinnGame> = {
    onBegin: (G, ctx) => {
        const log = [`choosePlan|onBegin|${G.order}`]
        const firstPlayer = G.order[0];
    },
    moves: {
        searchFirst: searchFirst,

    }

}
export const ChoosePlanPhaseConfig: PhaseConfig<SongJinnGame> = {
    onBegin: (G, ctx) => {
        const log = [`choosePlan|onBegin|${G.order}`]
        const firstPlayer = G.order[0];
        drawPlanForPlayer(G, firstPlayer);
        const pub = getStateById(G, firstPlayer);
        const player = playerById(G, firstPlayer);
        log.push(`|p${firstPlayer}|${player.plans}`);
        if (player.plans.filter((pid) => pub.military >= getPlanById(pid).level).length === 0) {
            log.push(`|cannot chose`)
            G.secret.planDeck.concat(player.plans);
            player.plans = [];
            const secondPid = G.order[1];
            drawPlanForPlayer(G, secondPid);
            const secondPlayer = playerById(G, secondPid);
            const secondPub = getStateById(G, secondPid);
            log.push(`|p${secondPid}|${secondPlayer.plans}`);
            if (secondPlayer.plans.filter((p) => secondPub.military >= getPlanById(p).level).length === 0) {
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
    turn: NormalTurnConfig
}

export const ActionPhaseConfig: PhaseConfig<SongJinnGame> = {
    moves: {},
}
