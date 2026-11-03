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
import {arriveLeaders, checkVictory, dealYear, resolvePendingCatholicLeague, resolvePendingHreReplacement, setupGame, winter} from "./util";
import {
    assault,
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
    chooseHreReplacement,
    chooseHreReligiousPreference,
    controlSpace,
    declareWar,
    declareWarMinor,
    endImpulse,
    endPhaseTurn,
    formAlliance,
    loanNaval,
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
} from "./moves";

const turnBegin = (G: VQGame, ctx: Ctx): void => {
    if (ctx.phase === "action") {
        const p = G.activePower;
        if (G.tutorialEffects?.skip.includes(p)) {
            G.tutorialEffects.skip.splice(G.tutorialEffects.skip.indexOf(p), 1);
            ctx.events?.endTurn();
            return;
        }
        G.impulse += 1;
        G.powers[p].cp = 0;
        G.powers[p].cardPlayed = false;
        G.powers[p].treasurePlayed = false;
        G.powers[p].passed = false;
    }
};

const phaseBegin = (G: VQGame): void => {
    G.activePower = participatingPowers(G)[0];
    G.phaseTurns = 0;
};

const turnEnd = (G: VQGame): void => {
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
    battleChoice: {moves: {chooseBattle}},
    tutorialEvent: {moves: {chooseTutorialEvent}},
    piracyChoice: {moves: {choosePiracy}},
    actionResponse: {moves: {respondAction}},
    interceptChoice: {moves: {chooseInterception}},
    respondBetroth: {moves: {acceptBetroth, rejectBetroth}},
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
                phaseBegin(G);
                G.turnsCompleted = 0;
                G.consecutivePasses = 0;
                if (G.dealtYear !== G.year) {
                    dealYear(G, ctx);
                }
            },
            turn: {order: powerOrder, onBegin: turnBegin, onEnd: turnEnd},
            next: (G: VQGame) => G.scenario === "tutorial" ? "spring" : "diplomacy",
        },
        diplomacy: {
            onBegin: phaseBegin,
            turn: {
                order: powerOrder,
                onBegin: turnBegin,
                onEnd: turnEnd,
                stages: choiceStages,
            },
            next: "spring",
        },
        spring: {
            onBegin: (G: VQGame) => {
                phaseBegin(G);
                G.turnsCompleted = 0;
                G.springDone = [];
                resolvePendingCatholicLeague(G);
                resolvePendingHreReplacement(G);
                arriveLeaders(G);
            },
            turn: {order: powerOrder, onBegin: turnBegin, onEnd: turnEnd, stages: choiceStages},
            next: "action",
        },
        action: {
            onBegin: (G: VQGame) => {
                phaseBegin(G);
                G.checkVictory = false;
                G.turnsCompleted = 0;
                G.consecutivePasses = 0;
            },
            turn: {order: powerOrder, onBegin: turnBegin, onEnd: turnEnd, stages: choiceStages},
            endIf: (G: VQGame) => G.consecutivePasses >= participatingPowers(G).length,
            onEnd: (G: VQGame, ctx: Ctx) => {
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
        chooseHreReplacement,
        chooseHreReligiousPreference: {move: chooseHreReligiousPreference, redact: true},
        claimSeaCaptain,
        placeSeaCaptainLeader,
        setTreasureFleetEscorts,
        declareWar,
        declareWarMinor,
        makePeace,
        formAlliance,
        loanNaval,
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
        chooseWithdraw,
    continueMove,
        stopContinue,
        preach,
        suppress,
        rebellion,
        piracy,
    },
    endIf: (G: VQGame) => {
        const v = checkVictory(G);
        if (v !== undefined) {
            return {winner: ownerOf(G, v.winner), power: v.winner, reason: v.reason};
        }
        return undefined;
    },
};
