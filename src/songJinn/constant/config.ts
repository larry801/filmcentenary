import {Ctx, PhaseConfig, StageConfig, TurnConfig} from "boardgame.io";
import {SongJinnGame} from "./setup";
import {TurnOrder} from "boardgame.io/core";
import {
    cardEvent,
    chooseFirst,
    choosePlan,
    chooseProvince,
    chooseRegion,
    chooseTop,
    combatCard,
    deploy,
    develop,
    developCard,
    discard,
    down,
    emperor,
    emptyRound,
    endRound,
    heYi,
    letter,
    loseCity,
    loseProvince,
    march,
    moveTroop,
    op,
    opponentMove,
    placeTroop,
    placeUnit,
    recruitPuppet,
    recruitUnit,
    removeUnit,
    returnToHand,
    rollDices,
    search,
    searchFirst,
    showPlan,
    takeDamage,
    takePlan,
    tieJun
} from "../moves";
import {playerById} from "../util/fetch";
import {drawPhaseForJinn, drawPhaseForSong, drawPlanForPlayer} from "../util/card";
import {ActiveEvents, SJPlayer} from "./general";
import {logger} from "../../game/logger";
import {canChoosePlan, endTurnCheck} from "../util/check";
import {changeDiplomacyByLOD} from "../util/change";
import {getJinnPower, getLeadingPlayer, getSongPower} from "../util/calc";

export const NormalTurnConfig: TurnConfig<SongJinnGame> = {
    order: TurnOrder.CUSTOM_FROM("order"),
}

export const EmperorStageConfig: StageConfig<SongJinnGame> = {
    moves: {
        emperor: emperor
    }
}
// TODO card_1.rm is not a function?
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
    moves: {
        emperor: emperor,

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
        emperor: EmperorStageConfig
    },
};
export const DiscardStageConfig: StageConfig<SongJinnGame> = {
    moves: {
        discard: discard,
        endRound: endRound,
    }
}


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
            //     rm(PlayerPendingEffect.SearchCard, G.jinn.effect);
            //     rm(PlayerPendingEffect.SearchCard, G.song.effect);
            // } else {
            //     rm(PlayerPendingEffect.SearchCard, G.song.effect);
            // }
            // if (G.song.effect.includes(PlayerPendingEffect.SearchCard)) {
            //
            //
            // }else{
            //
            // }
        }
        logger.debug(log.join(''));
    },
    onEnd:(G,ctx)=>endTurnCheck(G,ctx),
    moves: {
        placeUnit: placeUnit,
        endRound: endRound
    },
    next: 'draw'
}

export const DrawPhaseConfig: PhaseConfig<SongJinnGame> = {
    onBegin: (G, ctx: Ctx) => {
        const log = [`draw|onBegin|${G.order}`]
        drawPhaseForSong(G, ctx);
        drawPhaseForJinn(G, ctx);
        const songPower = getSongPower(G);
        G.song.corruption = songPower > 7 ? songPower - 7 : 0;
        const jinnPower = getJinnPower(G);
        G.jinn.corruption = jinnPower > 7 ? jinnPower - 7 : 0;
        // const firstPlayer = G.order[0];
        // cannot import PlanID here
        // if(){
        //
        // }else{
        //     drawPhaseForSong(G,ctx);
        // }
        logger.info(`${log.join('')}`);
    },
    onEnd: (G, ctx) => {
        const log = [`drawPhase|onEnd`]
        G.order = [getLeadingPlayer(G)]
        log.push(`${G.order.toString()}`);
        logger.debug(`${log.join('')}`);
    },
    moves: {
        searchFirst: searchFirst,
        search: search,
        discard: discard,
        endRound: endRound,
    },
    next: 'chooseFirst'
}

export const DevelopPhaseConfig: PhaseConfig<SongJinnGame> = {
    moves: {
        develop: develop,
        returnToHand: returnToHand,
        emperor: emperor,
        opponentMove: opponentMove,
        endRound: endRound
    },
    turn: StagedTurnConfig,
    next: 'deploy'
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
    start: true
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
        combatCard: combatCard,

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
        G.jinn.plan = [];
        G.song.plan = [];
        if (G.plans.length === 0) {
            // debug helper usually no use in real game
            log.push(`|no|plans|endPhase`);
            ctx.events?.endPhase();
        }
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
    next: 'diplomacy'
}

export const DiplomacyPhaseConfig: PhaseConfig<SongJinnGame> = {
    onBegin: (G, ctx) => {
        const log = [`diplomacy|onBegin`];
        log.push(`|before|${G.song.nations}|${G.jinn.nations}`);
        changeDiplomacyByLOD(G);
        log.push(`|after|${G.song.nations}|${G.jinn.nations}`);
        ctx.events?.endPhase();
        logger.info(`${log.join('')}`);
    },
    turn: StagedTurnConfig,
    next: 'develop',
}
export const DeployPhaseConfig: PhaseConfig<SongJinnGame> = {
    onBegin: (G, ctx) => {
        const log = [`developPhase|onBegin`];

        logger.info(`${log.join('')}`);
    },
    turn: StagedTurnConfig,
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
    },
    next: 'turnEnd'
}
export const EPhaseConfig: PhaseConfig<SongJinnGame> = {}
export const EmptyPhaseConfig: PhaseConfig<SongJinnGame> = {}