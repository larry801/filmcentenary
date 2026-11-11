import {Ctx, Game, PlayerID} from "boardgame.io";
import {TurnOrder} from "boardgame.io/core";
import {POWERS, Power, ScenarioID, VQGame} from "./constant/general";
import {ownerOf, participatingPowers} from "./ownership";
import {validateSetupData} from "./configuration";
import {chooseEspionage} from "./espionage";
import {chooseBattle} from "./combat";
import {chooseTutorialEvent} from "./tutorialEvents";
import {choosePiracy} from "./piracy";
import {chooseInterception} from "./interception";
import {arriveLeaders, autoResolveWinterLossChoices, autoResolveWinterNavalLossChoices, checkImmediateVictory, checkVictory, chooseReliefSplit, dealYear, resolvePendingCatholicLeague, resolvePendingHreReplacement, restorePatrons, setupGame, winter} from "./util";
import {
    assault,
    autoInterceptionOrder,
    chooseInterceptionOrder,
    chooseNavalOrder,
    chooseWithdraw,
    continueMove,
    stopContinue,
    proposeBetroth,
    acceptBetroth,
    rejectBetroth,
    ransom,
    buildFortress,
    buildNaval,
    claimSeaCaptain,
    placeSeaCaptainLeader,
    setTreasureFleetEscorts,
    chooseHomeCard,
    chooseCatholicLeagueSpace,
    chooseNavalLeaderPort,
    chooseWinterLoss,
    chooseWinterNavalLoss,
    chooseHreReplacement,
    chooseHreReligiousPreference,
    controlSpace,
    declareWar,
    declareWarMinor,
    endImpulse,
    endPhaseTurn,
    formAlliance,
    yieldSpace,
    returnCapturedLeader,
    loanNaval,
    dragutFallsRoll,
    chooseAbjuration,
    chooseTribute,
    chooseMutinyDiscard,
    choosePolishBid,
    chooseRebelMove,
    giveTreasure,
    cancelWalsingham,
    scurvyNavigation,
    stormNavigation,
    maryInfluence,
    spanishRoadMove,
    giveRandomCard,
    giveMercenary,
    influence,
    plantInformant,
    gainIntelligence,
    assassinate,
    englishCatholicRebellion,
    buildExpedition,
    moveExpedition,
    settleColony,
    buildPatrol,
    buildWorldFortress,
    worldPiracy,
    upgradeArmada,
    loadArmada,
    armadaTransport,
    unloadArmada,
    commitForeignWarForce,
    fightForeignWar,
    reinforceForeignWar,
    makePeace,
    moveLand,
    moveNaval,
    pass,
    patronize,
    piracy,
    playCard,
    playVirginQueenCombat,
    chooseCardEvent,
    playTreasure,
    preach,
    rebellion,
    recruit,
    springDeploy,
    suppress,
    chooseMajorActivation,
    respondAction,
    navalTransport,
    declineGregorianCalendar,
    respondBeaconFires,
    startActionTurn,
    autoResolveCityRebelsLosses,
    chooseCityRebelsLoss,
} from "./moves";

const turnBegin = (G: VQGame, ctx: Ctx): void => {
    // Safety net: an abandoned #18 allocation is completed with the automatic
    // unit order before the next turn begins.
    if (G.pendingCityRebels !== undefined) autoResolveCityRebelsLosses(G);
    if (ctx.phase === "cardDraw" &&
        (G.winterLossChoices?.some((entry) => entry.power === G.activePower) ||
            G.winterNavalLossChoices?.some((entry) => entry.power === G.activePower))) {
        // Winter attrition and no-port naval losses are confirmed before the
        // new year's card draw.
        const owner = ownerOf(G, G.activePower);
        if (owner !== undefined) {
            ctx.events?.setActivePlayers({value: {[owner]: "winterLossChoice"}});
            return;
        }
    }
    if (ctx.phase === "spring" && G.navalLeaderArrivals?.some((entry) => entry.power === G.activePower)) {
        // Returning naval leaders need a home port before the power can deploy.
        const owner = ownerOf(G, G.activePower);
        if (owner !== undefined) {
            ctx.events?.setActivePlayers({value: {[owner]: "navalPortChoice"}});
            return;
        }
    }
    if (ctx.phase === "action") {
        // #101 opens after a power finishes its turn, before the next action
        // turn starts.  Defer that turn's CP/impulse reset until the holder
        // plays the response or declines it.
        if (G.gregorianResponse !== undefined) {
            const responder = G.gregorianResponse.responder;
            if (G.powers[responder].cards.includes("vq-101") &&
                ownerOf(G, responder) !== undefined) {
                ctx.events?.setActivePlayers({value: {[ownerOf(G, responder)!]: "gregorianResponse"}});
                return;
            }
            delete G.gregorianResponse;
        }
        startActionTurn(G, ctx);
    }
};

const phaseBegin = (G: VQGame, ctx?: Ctx): void => {
    // A #18 choice cannot cross a phase boundary; apply the automatic order.
    if (G.pendingCityRebels !== undefined) autoResolveCityRebelsLosses(G);
    // #95 is only attached for the Diplomacy Phase in which it was played.
    delete G.louiseAttachment;
    restorePatrons(G);
    G.activePower = participatingPowers(G)[0];
    G.phaseTurns = 0;
    G.actionTurnsThisTurn = {};
    G.unionOfArras = false;
    delete G.gregorianResponse;
    // Record where this phase starts so the log can be grouped by turn/phase.
    if (ctx !== undefined) {
        G.logMarks = [...(G.logMarks ?? []), {at: G.log.length, turn: ctx.turn, phase: ctx.phase ?? "", year: G.year}];
    }
};

const turnEnd = (G: VQGame, ctx: Ctx): void => {
    if (ctx.phase === "action") {
        const responder = participatingPowers(G).find((power) => G.powers[power].cards.includes("vq-101"));
        if (responder === undefined) delete G.gregorianResponse;
        else G.gregorianResponse = {after: G.activePower, responder};
    }
    if (G.gregorianNext !== undefined) {
        G.activePower = G.gregorianNext;
        delete G.gregorianNext;
        // #101 resets the action round, so the selected power starts a fresh
        // pass cycle rather than inheriting the previous round's passes.
        G.consecutivePasses = 0;
        G.phaseTurns = 0;
        return;
    }
    const powers = participatingPowers(G);
    const next = powers.find((power) => POWERS.indexOf(power) > POWERS.indexOf(G.activePower));
    G.phaseTurns = next === undefined ? 1 : 0;
    G.activePower = next ?? powers[0];
};

const powerOrder = {
    first: (G: VQGame) => Number(ownerOf(G, G.activePower)),
    next: (G: VQGame, ctx: Ctx) => ctx.phase !== "action" && G.phaseTurns > 0
        ? undefined : Number(ownerOf(G, G.activePower)),
};

const choiceStages = {
    espionageChoice: {moves: {chooseEspionage}},
    cardEvent: {moves: {chooseCardEvent}},
    activateMajor: {moves: {chooseMajorActivation}},
    abjurationChoice: {moves: {chooseAbjuration}},
    tributeChoice: {moves: {chooseTribute}},
    rebelMoveChoice: {moves: {chooseRebelMove}},
    mutinyChoice: {moves: {chooseMutinyDiscard}},
    polishElectionBid: {moves: {choosePolishBid}},
    // #18 losses: each hit is a separate unit-type choice, with "auto"
    // assigning the rest in the printed fallback order.
    cityRebelsLossChoice: {moves: {chooseCityRebelsLoss}},
    battleChoice: {moves: {chooseBattle, playVirginQueenCombat}},
    tutorialEvent: {moves: {chooseTutorialEvent}},
    piracyChoice: {moves: {choosePiracy}},
    actionResponse: {moves: {respondAction}},
    // Rule 23.7: the affected power selects units immediately, even if
    // another power played the War in Persia / War with Poland event.
    foreignWarSetup: {moves: {commitForeignWarForce}},
    beaconResponse: {moves: {respondBeaconFires}},
    interceptionOrder: {moves: {chooseInterceptionOrder, autoInterceptionOrder}},
    gregorianResponse: {moves: {playCard, declineGregorianCalendar}},
    interceptChoice: {moves: {chooseInterception}},
    respondBetroth: {moves: {acceptBetroth, rejectBetroth}},
    // Spring-only: choose a returning naval leader's home port. Home card,
    // HRE preference and ending the turn stay available so automated clients
    // (and a power that skips the choice) fall back safely. Keep the redaction
    // wrappers so secret choices are not leaked while this stage is active.
    navalPortChoice: {moves: {
        chooseNavalLeaderPort,
        chooseHomeCard: {move: chooseHomeCard, redact: true as const},
        chooseHreReligiousPreference: {move: chooseHreReligiousPreference, redact: true as const},
        endPhaseTurn,
    }},
    // Winter attrition losses: the owner confirms or swaps the removed unit
    // type during Card Draw, including the ship types of a no-port naval loss.
    // Ending the turn keeps the safe automatic result.
    winterLossChoice: {moves: {chooseWinterLoss, chooseWinterNavalLoss, endPhaseTurn}},
};

export const VirginQueenGameDef: Game<VQGame> = {
    name: "virginQueen",
    setup: (ctx: Ctx, setupData?: {scenario?: ScenarioID}) => setupGame(ctx, setupData),
    validateSetupData,
    minPlayers: 2,
    maxPlayers: 6,
    playerView: (G: VQGame, _ctx: Ctx, playerID: PlayerID | null) => {
        const r = JSON.parse(JSON.stringify(G)) as VQGame & {
            deckCount?: number;
            futureDeckCount?: number;
            discardCount?: number;
            handCounts?: Partial<Record<Power, number>>;
        };
        r.deckCount = G.deck.length;
        r.futureDeckCount = G.futureDeck.length;
        r.discardCount = G.discard.length;
        if (!G.hreReligiousPreferenceRevealed && (playerID === null || ownerOf(G, "hre") !== playerID)) {
            delete r.hreReligiousPreference;
        }
        if (r.espionage) r.espionage.inspections = r.espionage.inspections.filter((entry) =>
            playerID !== null && ownerOf(G, entry.viewer) === playerID);
        r.handCounts = {};
        r.homeCardSetAsideCounts = {};
        for (const p of POWERS) {
            r.handCounts[p] = G.powers[p].cards.length;
            r.homeCardSetAsideCounts[p] = G.powers[p].homeCardSetAside?.length ?? 0;
            if (playerID === null || ownerOf(G, p) !== playerID) {
                r.powers[p].cards = [];
                r.powers[p].treasures = [];
                // The Spring Home card choice is secret; only its count is public.
                r.powers[p].homeCardSetAside = [];
            }
        }
        r.deck = [];
        r.futureDeck = [];
        r.discard = [];
        return r;
    },
    phases: {
        cardDraw: {
            start: true,
            onBegin: (G: VQGame, ctx: Ctx) => {
                phaseBegin(G, ctx);
                G.turnsCompleted = 0;
                G.consecutivePasses = 0;
                if (G.dealtYear !== G.year) {
                    dealYear(G, ctx);
                }
            },
            turn: {order: powerOrder, onBegin: turnBegin, onEnd: turnEnd, stages: choiceStages},
            next: (G: VQGame) => G.scenario === "tutorial" ? "spring" : "diplomacy",
        },
        diplomacy: {
            onBegin: (G: VQGame, ctx: Ctx) => {
                // Winter loss choices are bounded to Card Draw. Anything still
                // pending keeps its automatic composition.
                autoResolveWinterLossChoices(G);
                autoResolveWinterNavalLossChoices(G);
                G.peaceMadeThisPhase = [];
                G.diplomacyGifts = {};
                phaseBegin(G, ctx);
            },
            turn: {
                order: powerOrder,
                onBegin: turnBegin,
                onEnd: turnEnd,
                stages: choiceStages,
            },
            next: "spring",
        },
        spring: {
            onBegin: (G: VQGame, ctx: Ctx) => {
                phaseBegin(G, ctx);
                G.turnsCompleted = 0;
                G.springDone = [];
                G.navalLost = {};
                resolvePendingCatholicLeague(G);
                resolvePendingHreReplacement(G);
                // A skipped Card Draw choice keeps the automatic winter losses.
                autoResolveWinterLossChoices(G);
                autoResolveWinterNavalLossChoices(G);
                // Clear anything left over from an interrupted Spring, then let
                // naval leaders returning from the pool pick a home port.
                delete G.navalLeaderArrivals;
                arriveLeaders(G, {interactive: true});
            },
            turn: {order: powerOrder, onBegin: turnBegin, onEnd: turnEnd, stages: choiceStages},
            next: "action",
        },
        action: {
            onBegin: (G: VQGame, ctx: Ctx) => {
                phaseBegin(G, ctx);
                G.checkVictory = false;
                G.turnsCompleted = 0;
                G.consecutivePasses = 0;
            },
            turn: {order: powerOrder, onBegin: turnBegin, onEnd: turnEnd, stages: choiceStages},
            endIf: (G: VQGame) => G.consecutivePasses >= participatingPowers(G).length,
            onEnd: (G: VQGame, ctx: Ctx) => {
                // boardgame.io runs the phase's onEnd hook even when the game
                // ends during the Action Phase.  An automatic victory (military,
                // religious or Catholic Rebellion) must end the game immediately,
                // so do not let that hook resolve Winter and advance the year.
                if (checkImmediateVictory(G, "action") !== undefined) return;
                // Winter resolution happens after the last action impulse; give
                // its log lines their own group instead of the previous action.
                G.logMarks = [...(G.logMarks ?? []), {at: G.log.length, turn: ctx.turn, phase: "winter", year: G.year}];
                winter(G, ctx);
            },
            next: "cardDraw",
        },
    },
    moves: {
        playCard,
        playTreasure,
        pass,
        endImpulse,
        endPhaseTurn,
        chooseHomeCard: {move: chooseHomeCard, redact: true},
        chooseCatholicLeagueSpace,
        chooseNavalLeaderPort,
        chooseWinterLoss,
        chooseWinterNavalLoss,
        chooseHreReplacement,
        chooseHreReligiousPreference: {move: chooseHreReligiousPreference, redact: true},
        claimSeaCaptain,
        placeSeaCaptainLeader,
        setTreasureFleetEscorts,
        declareWar,
        declareWarMinor,
        makePeace,
        formAlliance,
        yieldSpace,
        returnCapturedLeader,
        loanNaval,
        dragutFallsRoll,
    chooseAbjuration,
    chooseCityRebelsLoss,
    giveTreasure,
    cancelWalsingham,
    scurvyNavigation,
    stormNavigation,
    maryInfluence,
        spanishRoadMove,
        giveRandomCard,
        giveMercenary,
        proposeBetroth,
        acceptBetroth,
        rejectBetroth,
        ransom,
        springDeploy,
        recruit,
        buildNaval,
        buildFortress,
        influence,
        plantInformant,
        gainIntelligence,
        assassinate,
        englishCatholicRebellion,
        buildExpedition,
        moveExpedition,
        settleColony,
        buildPatrol,
        buildWorldFortress,
        worldPiracy,
        upgradeArmada,
        loadArmada,
        armadaTransport,
        unloadArmada,
        commitForeignWarForce,
        fightForeignWar,
        reinforceForeignWar,
        patronize,
        moveLand,
        moveNaval,
        navalTransport,
        controlSpace,
        assault,
        chooseNavalOrder,
        chooseInterceptionOrder,
        autoInterceptionOrder,
        chooseWithdraw,
        chooseReliefSplit,
    continueMove,
        stopContinue,
        preach,
        suppress,
        rebellion,
        piracy,
    },
    endIf: (G: VQGame, ctx) => {
        const v = checkVictory(G, false, ctx.phase);
        if (v !== undefined) {
            return {winner: ownerOf(G, v.winner), power: v.winner, reason: v.reason};
        }
        return undefined;
    },
};
