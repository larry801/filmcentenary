import { Ctx, PhaseConfig, StageConfig, TurnConfig } from "boardgame.io";
import { TurnOrder } from "boardgame.io/core";
import {
    adjustNation,
    breakout,
    cardEvent,
    checkProvince,
    chooseFirst,
    choosePlan,
    chooseProvince,
    chooseRegion,
    chooseTop,
    combatCard,
    confirmRespond,
    controlCity,
    controlProvince,
    deploy,
    deployGeneral,
    develop,
    developCard,
    discard,
    down,
    drawExtraCard,
    emperor,
    emptyRound,
    endRound,
    freeHeYi,
    generalSkill,
    heYi,
    jianLiDaQi,
    letter,
    loseCity,
    loseProvince,
    march, modifyGameState,
    moveGeneral,
    moveTroop,
    op,
    opponentMove,
    placeTroop,
    placeUnit,
    recruitPuppet,
    recruitUnit,
    removeCompletedPlan,
    removeNation,
    removeOwnGeneral,
    removeReadyUnit,
    removeUnit,
    rescueGeneral,
    retreat,
    returnToHand,
    rollDices,
    search,
    searchFirst,
    showCC,
    showLetters,
    showPlan,
    siege,
    takeDamage,
    takePlan,
    tieJun

} from "../moves";
import { ActiveEvents, PlanID, PlayerPendingEffect, ProvinceID, SJPlayer, SongJinnGame } from "./general";
import { logger } from "../../game/logger";
import {
    canChoosePlan,
    changeDiplomacyByLOD,
    currentProvStatus,
    drawPhaseForJinn,
    drawPhaseForSong,
    drawPlanForPlayer,
    endTurnCheck,
    getJinnPower,
    getLeadingPlayer,
    getSongPower,
    pid2pub,
    playerById
} from "../util";

const moves = {
    modifyGameState: modifyGameState,
    returnToHand: returnToHand,
    retreat: retreat,
    removeReadyUnit: removeReadyUnit,
    drawExtraCard: drawExtraCard,
    siege: siege,
    checkProvince: checkProvince,
    removeOwnGeneral: removeOwnGeneral,
    breakout: breakout,
    confirmRespond: confirmRespond,
    showCC: showCC,
    discard: discard,
    moveGeneral: moveGeneral,
    deployGeneral: deployGeneral,
    emptyRound: emptyRound,
    op: op,
    recruitUnit: recruitUnit,
    cardEvent: cardEvent,
    developCard: developCard,
    letter: letter,
    freeHeYi: freeHeYi,
    heYi: heYi,
    tieJun: tieJun,
    endRound: endRound,
    combatCard: combatCard,

    generalSkill: generalSkill,
    rescueGeneral: rescueGeneral,
    removeUnit: removeUnit,
    placeUnit: placeUnit,
    moveTroop: moveTroop,


    recruitPuppet: recruitPuppet,
    deploy: deploy,
    opponentMove: opponentMove,
    march: march,
    takeDamage: takeDamage,

    rollDices: rollDices,
    loseCity: loseCity,
    loseProvince: loseProvince,
    controlCity: controlCity,
    controlProvince: controlProvince,
    placeTroop: placeTroop,
    down: down,

    removeNation: removeNation,
    adjustNation: adjustNation,

    develop: develop,
    emperor: emperor,
}

export const EmperorStageConfig: StageConfig<SongJinnGame> = {
    moves: {
        emperor: emperor
    }
}
export const ConfirmRespondStageConfig: StageConfig<SongJinnGame> = {
    moves: {
        confirmRespond: confirmRespond,
    }
}

export const ChooseProvinceStageConfig: StageConfig<SongJinnGame> = {
    moves: {
        chooseProvince: chooseProvince,
    }
}

export const ChooseRegionsStageConfig: StageConfig<SongJinnGame> = {
    moves: {
        chooseRegion: chooseRegion,
    }
}
export const ReactStageConfig: StageConfig<SongJinnGame> = {
    moves: moves
}

export const NormalTurnConfig: TurnConfig<SongJinnGame> = {
    order: TurnOrder.CUSTOM_FROM("order"),
    stages: {
        confirmRespond: ConfirmRespondStageConfig,
        react: ReactStageConfig
    }
}

const StagedTurnConfig: TurnConfig<SongJinnGame> = {
    order: TurnOrder.CUSTOM_FROM("order"),
    stages: {
        react: ReactStageConfig,
        emperor: EmperorStageConfig,
        confirmRespond: ConfirmRespondStageConfig,
        jianLiDaQi: {
            moves: {
                jianLiDaQi: jianLiDaQi,
            }
        },
        combatCard: {
            moves: {
                combatCard: combatCard,
                showCC: showCC
            }
        },
        rescueGeneral: {
            moves: {
                rescueGeneral: rescueGeneral
            }
        },
        showCC: {
            moves: {
                showCC: showCC
            }
        },
        takeDamage: {
            moves: moves
        },
        freeHeYi: {
            moves: {
                freeHeYi: freeHeYi,
            }
        }
    },
};


export const TurnEndPhaseConfig: PhaseConfig<SongJinnGame> = {
    onBegin: (G, ctx) => {
        const log = [`turnEndPhase|onBegin|${G.order}`];
        G.song.corruption = 0;
        G.jinn.corruption = 0;
        G.round = 1;
        if (G.events.includes(ActiveEvents.XiJunQuDuan)) {
            // changePlayerStage(G,ctx,'placeUnit',SJPlayer.P1);
        } else {
            ctx.events?.setPhase('draw');
            // 先自觉检索算了
            // if (G.jinn.effect.includes(PlayerPendingEffect.SearchCard)) {
            //     // 目前不可能 因为只有京畿计划有检索
            //      G.jinn.effect.splice( G.jinn.effect.indexOf(PlayerPendingEffect.SearchCard),1);
            //      G.song.effect.splice( G.song.effect.indexOf(PlayerPendingEffect.SearchCard),1);
            // } else {
            //      G.song.effect.splice( G.song.effect.indexOf(PlayerPendingEffect.SearchCard),1);
            // }
            // if (G.song.effect.includes(PlayerPendingEffect.SearchCard)) {
            //
            //
            // }else{
            //
            // }
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    },
    onEnd: (G, ctx) => endTurnCheck(G, ctx),
    moves: moves,
    next: 'draw'
}

export const DrawPhaseConfig: PhaseConfig<SongJinnGame> = {
    onBegin: (G, ctx: Ctx) => {
        const log = [`draw|onBegin|${G.order}`]
        drawPhaseForSong(G, ctx);
        drawPhaseForJinn(G, ctx);
        const songPower = getSongPower(G);
        const songCorruptionLimit = G.song.civil >= 5 ? 8 : 7;
        G.song.corruption = songPower > songCorruptionLimit ? songPower - songCorruptionLimit : 0;
        log.push(`|${songPower}songPower`);
        log.push(`|${songCorruptionLimit}songCorruptionLimit`);
        log.push(`|${G.song.corruption}G.song.corruption`);
        if (G.events.includes(ActiveEvents.QinHuiDuXiang)) {
            G.song.corruption++;
        }

        const jinnPower = getJinnPower(G);
        const jinnCorruptionLimit = G.jinn.civil >= 5 ? 8 : 7;
        G.jinn.corruption = jinnPower > jinnCorruptionLimit ? jinnPower - jinnCorruptionLimit : 0;
        log.push(`|${jinnPower}jinnPower`);
        log.push(`|${jinnCorruptionLimit}jinnCorruptionLimit`);
        log.push(`|${G.jinn.corruption}G.jinn.corruption`);
        // const firstPlayer = G.order[0];
        // cannot import PlanID here
        // if(){
        //
        // }else{
        //     drawPhaseForSong(G,ctx);
        // }
        logger.debug(`${log.join('')}`);
    },
    moves: {
        down: down,
        searchFirst: searchFirst,
        search: search,
        discard: discard,
        endRound: endRound,
        opponentMove: opponentMove,
        drawExtraCard: drawExtraCard,
        develop: develop,
    },
    next: (G:SongJinnGame,ctx:Ctx)=>{
        const log = [`drawPhase|next`];
        if (G.song.civil === G.jinn.civil) {
            G.order = [SJPlayer.P1, SJPlayer.P2];
            log.push(`|civil|same|order:${G.order.toString()}`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return 'choosePlan';
        }else{
            G.order = [getLeadingPlayer(G)]
            log.push(`${G.order.toString()}`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return 'chooseFirst';
        }
    }
}

export const DevelopPhaseConfig: PhaseConfig<SongJinnGame> = {
    moves: moves,
    onEnd: (G, _ctx) => {
        G.song.usedDevelop = 0;
        G.jinn.usedDevelop = 0;
    },
    turn: StagedTurnConfig,
    next: 'deploy'
}
export const ChoosePlanPhaseConfig: PhaseConfig<SongJinnGame> = {
    onBegin: (G, ctx) => {
        const log = [`choosePlan|phase|onBegin|${G.order}`]
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
        logger.debug(`${G.matchID}|${log.join('')}`);
    },
    onEnd: (G, _ctx) => {
        const log = [`choosePlan|phase|onEnd|${G.order}`]
        switch (G.first) {
            case SJPlayer.P1:
                G.order = [SJPlayer.P1, SJPlayer.P2];
                break
            case SJPlayer.P2:
                G.order = [SJPlayer.P2, SJPlayer.P1];
                break
        }
        log.push(`|resetOrder${JSON.stringify(G.order)}`)
        logger.debug(`${G.matchID}|${log.join('')}`);
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
    start: true
}


export const ActionPhaseConfig: PhaseConfig<SongJinnGame> = {
    // start: true,
    turn: StagedTurnConfig,
    moves: moves,
}

export const ResolvePlanPhaseConfig: PhaseConfig<SongJinnGame> = {
    // start: true,
    onBegin: (G, ctx) => {
        const log = [`resolvePlanPhase|onBegin|${G.order}`];
        // add two plan and search here
        const currentPlans = [...G.song.plan, ...G.jinn.plan];
        if (currentPlans.includes(PlanID.J21)) {
            const status = currentProvStatus(G, ProvinceID.HUAINANLIANGLU);
            switch (status) {
                case "金控制":
                    G.jinn.effect.push(PlayerPendingEffect.TwoPlan)
                    break;
                case "宋控制":
                    G.song.effect.push(PlayerPendingEffect.TwoPlan)
                    break;
                case "战争状态":
                    break;
            }
        }
        // TODO wu shan li ma / huan wo he shan scores
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
        G.jinn.plan = [];
        G.song.plan = [];
        if (G.plans.length === 0) {
            // debug helper usually no use in real game
            log.push(`|no|plans|endPhase`);
            ctx.events?.endPhase();
        }
        logger.info(`${log.join('')}`);
    },
    moves: moves,
    turn: StagedTurnConfig,
    next: 'diplomacy'
}

export const DiplomacyPhaseConfig: PhaseConfig<SongJinnGame> = {
    onBegin: (G, _ctx) => {
        const log = [`diplomacy|onBegin`];
        log.push(`|before|${G.song.nations}|${G.jinn.nations}`);
        changeDiplomacyByLOD(G);
        log.push(`|after|${G.song.nations}|${G.jinn.nations}`);
        // ctx.events?.endPhase();
        logger.info(`${log.join('')}`);
    },
    turn: StagedTurnConfig,
    next: 'develop',
    moves: {
        showLetters: showLetters,
        endRound: endRound
    }
}
export const DeployPhaseConfig: PhaseConfig<SongJinnGame> = {
    onEnd: (G, _ctx) => {
        const log = [`deployPhase|onEnd`];
        log.push(`|clean ready units`);
        log.push(`|${G.song.ready}song.ready`);
        log.push(`|${G.song.standby}G.song.standby`);
        for (let i = 0; i < G.song.ready.length; i++) {
            G.song.standby[i] += G.song.ready[i];
            G.song.ready[i] = 0;
        }
        G.jinn.usedDevelop = 0;
        G.song.usedDevelop = 0;
        log.push(`|${G.song.ready}song.ready`);
        log.push(`|${G.song.standby}G.song.standby`);

        log.push(`|${G.jinn.ready}jinn.ready`);
        log.push(`|${G.jinn.standby}G.jinn.standby`);
        for (let i = 0; i < G.jinn.ready.length; i++) {
            G.jinn.standby[i] += G.jinn.ready[i];
            G.jinn.ready[i] = 0;
        }
        G.op = 0;
        log.push(`|${G.jinn.ready}jinn.ready`);
        log.push(`|${G.jinn.standby}G.jinn.standby`);
        logger.info(`${G.matchID}|${log.join('')}`);
    },
    turn: {
        onBegin: (G: SongJinnGame, ctx: Ctx) => {
            const log = [`deployPhaseTurn|onBegin`];
            const pid = ctx.currentPlayer;
            const pub = pid2pub(G, pid);
            G.op += pub.nations.length;
            log.push(`|${G.op}G.op`);
            if (pid === SJPlayer.P2) {
                if (G.events.includes(ActiveEvents.JinTaiZong)) {
                    log.push(`|jinTaiZong`);
                    G.op++;
                    log.push(`|${G.op}G.op`);
                }
            }
            logger.info(`${log.join('')}`);
        },
        ...StagedTurnConfig
    },
    moves: moves,
    next: 'turnEnd'
}