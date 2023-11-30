import {Ctx, PhaseConfig, StageConfig, TurnConfig} from 'boardgame.io';
import {TurnOrder} from "boardgame.io/core";
import {
    breakthrough,
    buyCard,
    changePlayerSetting,
    chooseEffect,
    chooseEvent,
    chooseHand,
    chooseRegion,
    chooseTarget,
    comment,
    competitionCard, concedeMove,
    confirmRespond, drawCard,
    moveBlocker,
    payAdditionalCost,
    peek, playCard, requestEndTurn, setupGameMode,
    showBoardStatus,
    showCompetitionResult,
    updateSlot,
} from "./moves";
import {IG} from "../types/setup";
import {changePlayerStage, cleanPendingSignal} from "./logFix";
import {
    addCompetitionPower,
    addVp,
    aesAward,
    curPub,
    drawCardForPlayer,
    industryAward,
    loseVp
} from "./util";
import {ItrEffects, SchoolCardID, SimpleEffectNames} from "../types/core";
import {logger} from "./logger";

export const payAdditionalCostStage: StageConfig = {
    moves: {
        payAdditionalCost: payAdditionalCost,
    }
}

export const chooseEffectStage: StageConfig = {
    moves: {
        chooseEffect: chooseEffect
    }
}
export const chooseEventStage: StageConfig = {
    moves: {
        chooseEvent: chooseEvent
    }
}
export const competitionCardStage: StageConfig = {
    moves: {
        competitionCard: competitionCard
    }
}

export const confirmRespondStage: StageConfig = {
    moves: {
        confirmRespond: confirmRespond,
    }
}

export const chooseHandStage: StageConfig = {
    moves: {
        chooseHand: chooseHand,
    }
}

export const chooseTargetStage: StageConfig = {
    moves: {
        chooseTarget: chooseTarget,
    }
}

export const moveBlockerStage: StageConfig = {
    moves: {
        moveBlocker: moveBlocker,
    }
}
export const updateSlotStage: StageConfig = {
    moves: {
        updateSlot: updateSlot,
    }
}
export const commentStage: StageConfig = {
    moves: {
        comment: comment,
    }
}
export const chooseRegionStage: StageConfig = {
    moves: {
        chooseRegion: chooseRegion,
    }
}

export const peekStage: StageConfig = {
    moves: {
        peek: peek,
    }
}

export const showCompetitionResultStage: StageConfig = {
    moves: {
        showCompetitionResult: showCompetitionResult,
    }
}

export const setupStage: StageConfig = {
    moves: {
        setupGameMode: setupGameMode,
        showBoardStatus: showBoardStatus,
    }
}

const noEff = {e: "none", a: 1};

export const NormalTurn: TurnConfig = {
    onBegin: (G: IG, ctx: Ctx) => {
        cleanPendingSignal(G);
        let p = ctx.currentPlayer;
        const log = [`onBegin|p${p}`];
        if (G.order.includes(p)) {
            const pub = curPub(G, ctx);
            pub.handsize_startturn = G.player[parseInt(p)].hand.length;
            if (pub.school === SchoolCardID.S1301) {
                log.push(`|montage`);
                addVp(G, ctx, p, 1);
                drawCardForPlayer(G, ctx, p);
                G.e.stack.push({e:ItrEffects.discard,a:1})
                changePlayerStage(G, ctx, "chooseHand", p);
            }
            if (pub.school === SchoolCardID.S2101) {
                log.push(`|classicHollywood`);
                G.e.stack.push({
                    e: ItrEffects.choice, a: [
                        {e: SimpleEffectNames.addCompetitionPower, a: 1},
                        {
                            e: "optional", a: {
                                e: "competition", a: {
                                    bonus: 0,
                                    onWin: noEff,
                                }
                            }
                        }
                    ]
                })
            }
            if (pub.school === SchoolCardID.S3101) {
                log.push(`|newHollywood`);
                addCompetitionPower(G, ctx, p, 1);
            }
            if (pub.school === SchoolCardID.S3105) {
                log.push(`|newYork`);
                if (pub.aesthetics >= pub.industry) {
                    log.push(`|aesAward`);
                    aesAward(G, ctx, p);
                }
                if (pub.industry >= pub.aesthetics) {
                    log.push(`|industryAward`);
                    industryAward(G, ctx, p);
                }
            }
            //此处添加流派扩内容
            if (pub.school === SchoolCardID.S4001) {
                log.push(`|"French Impressionism`);
                if (pub.aesthetics === pub.industry) {
                    pub.action++;
                }
            }
            if (pub.school === SchoolCardID.S4003) {
                log.push(`|"American Independent Film`);
                // console.log(pub.building.cinemaBuilt, pub.building.studioBuilt);
                if (pub.building.cinemaBuilt){
                    G.e.stack.push({e: "discard", a: 1});
                    changePlayerStage(G, ctx, "chooseHand", p);
                }
                if (pub.building.studioBuilt){
                    G.e.stack.push({e: "discard", a: 1});
                    changePlayerStage(G, ctx, "chooseHand", p);
                }
            }
            if (pub.school === SchoolCardID.S4006) {
                log.push(`|"Third Cinema`);
                if (pub.aesthetics > pub.industry) {
                    drawCardForPlayer(G, ctx, p);
                    pub.deposit += 2
                }
            }
            if (pub.school === SchoolCardID.S4007) {
                const playerHandLength =  G.player[parseInt(p)].hand.length;
                log.push(`|Kitchen Sink Film|playerHandLength${playerHandLength}`);
                loseVp(G, ctx, p, playerHandLength);
                let drawCount = 0;
                G.order.forEach((pid)=>{
                    const otherPlayerHandLength = G.player[parseInt(pid)].hand.length;
                    log.push(`|p${pid}|hand${otherPlayerHandLength}`)
                    if (otherPlayerHandLength > playerHandLength){
                        drawCount++;
                        log.push(`|drawCount${drawCount}`);
                    }
                });
                for (let i = 0; i < drawCount; i++) {
                    drawCardForPlayer(G, ctx, p);
                }
            }
        } else {
            log.push(`|playerConceded|endTurn`);
            ctx?.events?.endTurn?.();
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    },
    order: TurnOrder.CUSTOM_FROM("order"),
    stages: {
        showCompetitionResult: showCompetitionResultStage,
        showBoard: setupStage,
        chooseEffect: chooseEffectStage,
        chooseEvent: chooseEventStage,
        chooseHand: chooseHandStage,
        chooseRegion: chooseRegionStage,
        chooseTarget: chooseTargetStage,
        comment: commentStage,
        competitionCard: competitionCardStage,
        confirmRespond: confirmRespondStage,
        moveBlockerStage: moveBlockerStage,
        updateSlot: updateSlotStage,
        peek: peekStage,
        payAdditionalCost: payAdditionalCostStage,
    }
}

export const NormalPhase: PhaseConfig = {
    next: "NormalPhase",
    turn: NormalTurn,
    moves: {
        changePlayerSetting: changePlayerSetting,
        drawCard: drawCard,
        buyCard: buyCard,
        playCard: playCard,
        breakthrough: breakthrough,
        chooseTarget: chooseTarget,
        chooseHand: chooseHand,
        chooseEvent: chooseEvent,
        chooseEffect: chooseEffect,
        chooseRegion: chooseRegion,
        competitionCard: competitionCard,
        requestEndTurn: requestEndTurn,
        updateSlot: updateSlot,
        comment: comment,
        peek: peek,
        concede: concedeMove,
    },
}

export const InitPhase: PhaseConfig = {
    start: true,
    turn: {
        stages: {
            setupStage: setupStage
        },
    },
    moves: {
        setupGameMode: setupGameMode,
        showBoardStatus: showBoardStatus,
    },
    next: "NormalPhase",
}

