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
import {arriveLeaders, autoResolvePendingConversion, autoResolveWinterLossChoices, autoResolveWinterNavalLossChoices, autoResolveWinterReturnChoices, checkImmediateVictory, checkVictory, chooseReliefSplit, dealYear, pushLog, resolvePendingCatholicLeague, resolvePendingHreReplacement, restorePatrons, setupGame, winter} from "./util";
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
    placeSeaCaptainLeader,
    setTreasureFleetEscorts,
    chooseHomeCard,
    chooseCatholicLeagueSpace,
    chooseNavalLeaderPort,
    chooseOrangePlacement,
    chooseWinterLoss,
    chooseWinterNavalLoss,
    chooseWinterReturn,
    chooseWinterNavalReturn,
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
    chooseScienceTreasureBonus,
    chooseConversionNullify,
    autoResolvePendingScienceTreasure,
} from "./moves";
import {counterDeal, proposeDeal, respondDeal, withdrawDeal} from "./negotiationMoves";
import {expireOpenOffer, negotiationState} from "./negotiation";

const turnBegin = (G: VQGame, ctx: Ctx): void => {
    // Safety net: an abandoned #18 allocation is completed with the automatic
    // unit order before the next turn begins.
    if (G.pendingCityRebels !== undefined) autoResolveCityRebelsLosses(G);
    autoResolvePendingConversion(G, ctx);
    autoResolvePendingScienceTreasure(G);
    if (ctx.phase === "cardDraw" &&
        ((G.winterLossChoices?.some((entry) => entry.power === G.activePower) ||
            G.winterNavalLossChoices?.some((entry) => entry.power === G.activePower)) ||
            (G.winterReturnChoices?.some((entry) => entry.power === G.activePower) ||
                G.winterNavalReturnChoices?.some((entry) => entry.power === G.activePower)))) {
        // Winter attrition, no-port naval losses, winter ports and return
        // destinations are all resolved before the new year's card draw.
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
    if (ctx.phase === "spring" && G.orangeArrivalPending && G.activePower === "protestant") {
        // Tournament: Protestant must decide where Orange goes before deploying.
        const owner = ownerOf(G, "protestant");
        if (owner !== undefined) {
            ctx.events?.setActivePlayers({value: {[owner]: "orangeArrivalChoice"}});
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
    // Rule 9.1: an unconfirmed offer lapses with the Negotiation Segment.
    if (ctx?.phase !== "diplomacy") expireOpenOffer(G);
    // A #18 choice cannot cross a phase boundary; apply the automatic order.
    if (G.pendingCityRebels !== undefined) autoResolveCityRebelsLosses(G);
    // An abandoned Step 4 conversion choice keeps the Unrest (rule 18.5).
    if (ctx !== undefined) {
        autoResolvePendingConversion(G, ctx);
        autoResolvePendingScienceTreasure(G);
    }
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
    // A power can lose its controlling seat during its own impulse: playing
    // #37 Sublime Porte (or any event that evaluates the Ottoman/HRE track)
    // can hand the status check to the printed "Deactivate" power, which
    // deactivates the acting major.  `activePower` then names a power nobody
    // controls, so every seat is blocked and the Action Phase never ends.
    // Skip forward from that power instead of stalling on it.
    const from = POWERS.indexOf(G.activePower);
    const next = powers.find((power) => POWERS.indexOf(power) > from);
    G.phaseTurns = next === undefined ? 1 : 0;
    G.activePower = next ?? powers[0];
};

const powerOrder = {
    first: (G: VQGame) => Number(ownerOf(G, G.activePower)),
    next: (G: VQGame, ctx: Ctx) => ctx.phase !== "action" && G.phaseTurns > 0
        ? undefined : Number(ownerOf(G, G.activePower)),
};

const conversionChoiceMoves = {chooseConversionNullify, chooseScienceTreasureBonus};

const choiceStages = {
    espionageChoice: {moves: {...conversionChoiceMoves, chooseEspionage}},
    cardEvent: {moves: {...conversionChoiceMoves, chooseCardEvent}},
    activateMajor: {moves: {...conversionChoiceMoves, chooseMajorActivation}},
    abjurationChoice: {moves: {...conversionChoiceMoves, chooseAbjuration}},
    tributeChoice: {moves: {...conversionChoiceMoves, chooseTribute}},
    rebelMoveChoice: {moves: {...conversionChoiceMoves, chooseRebelMove}},
    mutinyChoice: {moves: {...conversionChoiceMoves, chooseMutinyDiscard}},
    polishElectionBid: {moves: {...conversionChoiceMoves, choosePolishBid}},
    // #18 losses: each hit is a separate unit-type choice, with "auto"
    // assigning the rest in the printed fallback order.
    cityRebelsLossChoice: {moves: {...conversionChoiceMoves, chooseCityRebelsLoss}},
    battleChoice: {moves: {...conversionChoiceMoves, chooseBattle, playVirginQueenCombat}},
    tutorialEvent: {moves: {...conversionChoiceMoves, chooseTutorialEvent}},
    piracyChoice: {moves: {...conversionChoiceMoves, choosePiracy}},
    actionResponse: {moves: {...conversionChoiceMoves, respondAction}},
    // Rule 23.7: the affected power selects units immediately, even if
    // another power played the War in Persia / War with Poland event.
    foreignWarSetup: {moves: {...conversionChoiceMoves, commitForeignWarForce}},
    beaconResponse: {moves: {...conversionChoiceMoves, respondBeaconFires}},
    interceptionOrder: {moves: {...conversionChoiceMoves, chooseInterceptionOrder, autoInterceptionOrder}},
    gregorianResponse: {moves: {...conversionChoiceMoves, playCard, declineGregorianCalendar}},
    interceptChoice: {moves: {...conversionChoiceMoves, chooseInterception}},
    withdrawChoice: {moves: {...conversionChoiceMoves, chooseWithdraw}},
    respondBetroth: {moves: {...conversionChoiceMoves, acceptBetroth, rejectBetroth}},
    // Spring-only: choose a returning naval leader's home port. Home card,
    // HRE preference and ending the turn stay available so automated clients
    // (and a power that skips the choice) fall back safely. Keep the redaction
    // wrappers so secret choices are not leaked while this stage is active.
    navalPortChoice: {moves: {...conversionChoiceMoves,
        chooseNavalLeaderPort,
        chooseHomeCard: {move: chooseHomeCard, redact: true as const},
        chooseHreReligiousPreference: {move: chooseHreReligiousPreference, redact: true as const},
        endPhaseTurn,
    }},
    // Tournament: choose whether to place Orange in the capital or hold him
    // back for a rebellion. Home card, HRE preference and ending the turn stay
    // available so automated clients and a skipped choice fall back safely.
    orangeArrivalChoice: {moves: {...conversionChoiceMoves,
        chooseOrangePlacement,
        chooseHomeCard: {move: chooseHomeCard, redact: true as const},
        chooseHreReligiousPreference: {move: chooseHreReligiousPreference, redact: true as const},
        endPhaseTurn,
    }},
    // Winter losses and returns: during Card Draw the owner confirms or swaps
    // the removed unit types, picks between equidistant winter ports and
    // revises a land return's destination or composition.  Ending the turn
    // keeps every automatic result.
    winterLossChoice: {moves: {...conversionChoiceMoves,
        chooseWinterLoss, chooseWinterNavalLoss,
        chooseWinterReturn, chooseWinterNavalReturn,
        endPhaseTurn,
    }},
    // Rule 9.1 negotiation table.  The proposer may withdraw while the other
    // side accepts, declines or counters; each side gets one temporary move.
    dealOffer: {moves: {...conversionChoiceMoves, withdrawDeal: {move: withdrawDeal, redact: true}}},
    dealResponse: {moves: {...conversionChoiceMoves,
        respondDeal: {move: respondDeal, client: false, redact: true},
        counterDeal: {move: counterDeal, client: false, redact: true},
    }},
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
        r.treasureCounts = {};
        r.homeCardSetAsideCounts = {};
        for (const p of POWERS) {
            r.handCounts[p] = G.powers[p].cards.length;
            r.treasureCounts[p] = G.powers[p].treasures.length;
            r.homeCardSetAsideCounts[p] = G.powers[p].homeCardSetAside?.length ?? 0;
            if (playerID === null || ownerOf(G, p) !== playerID) {
                r.powers[p].cards = [];
                r.powers[p].treasures = [];
                // The Spring Home card choice is secret; only its count is public.
                r.powers[p].homeCardSetAside = [];
            }
        }
        // Rule 9.1: negotiations are private.  Other clients receive the public
        // record of concluded deals, but never the open offer or promises.
        if (r.negotiation !== undefined) {
            const involved = (power: Power): boolean => playerID !== null && ownerOf(G, power) === playerID;
            if (r.negotiation.offer !== null && r.negotiation.offer !== undefined &&
                !involved(r.negotiation.offer.from) && !involved(r.negotiation.offer.to)) {
                r.negotiation.offer = null;
            }
            r.negotiation.history = (r.negotiation.history ?? []).map((record) =>
                involved(record.proposer) || involved(record.confirmer)
                    ? record
                    : {...record, promises: []});
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
                // Winter loss and return choices are bounded to Card Draw.
                // Anything still pending keeps its automatic result.
                autoResolveWinterLossChoices(G);
                autoResolveWinterNavalLossChoices(G);
                autoResolveWinterReturnChoices(G);
                G.peaceMadeThisPhase = [];
                G.diplomacyGifts = {};
                negotiationState(G).offer = null;
                phaseBegin(G, ctx);
            },
            onEnd: (G: VQGame, ctx: Ctx) => {
                // Rule 9.1: "Mercenaries for Hire not granted during
                // negotiations are lost; the Holy Roman player should drop the
                // marker to the '0' space ... at the end of the Negotiation
                // Segment."  This runs before the Spring Deployment.
                if ((G.mercenariesForHire ?? 0) > 0) {
                    G.mercenariesForHire = 0;
                    pushLog(G, "Mercenaries for Hire not granted this turn are lost.");
                }
                turnEnd(G, ctx);
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
                // A skipped Card Draw choice keeps the automatic winter losses
                // and return moves.
                autoResolveWinterLossChoices(G);
                autoResolveWinterNavalLossChoices(G);
                autoResolveWinterReturnChoices(G);
                // Clear anything left over from an interrupted Spring, then let
                // naval leaders returning from the pool pick a home port.
                delete G.navalLeaderArrivals;
                delete G.orangeArrivalPending;
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
        chooseOrangePlacement,
        chooseWinterLoss,
        chooseWinterNavalLoss,
        chooseWinterReturn,
        chooseWinterNavalReturn,
        chooseHreReplacement,
        chooseHreReligiousPreference: {move: chooseHreReligiousPreference, redact: true},
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
    chooseScienceTreasureBonus,
    chooseConversionNullify,
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
        // These moves read both hands while validating; the client holds a
        // redacted view, so let the authoritative server run them.
        proposeDeal: {move: proposeDeal, client: false, redact: true},
        respondDeal: {move: respondDeal, client: false, redact: true},
        counterDeal: {move: counterDeal, client: false, redact: true},
        withdrawDeal: {move: withdrawDeal, redact: true},
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
