import {Ctx, Game, PlayerID} from "boardgame.io";
import {TurnOrder} from "boardgame.io/core";
import {POWER_INDEX, POWERS, Power, VQGame, powerAt} from "./constant/general";
import {arriveLeaders, checkVictory, dealYear, setupGame, winter} from "./util";
import {
    assault,
    betroth,
    ransom,
    buildFortress,
    buildNaval,
    claimSeaCaptain,
    controlSpace,
    declareWar,
    declareWarMinor,
    endImpulse,
    endPhaseTurn,
    formAlliance,
    influence,
    makePeace,
    moveLand,
    moveNaval,
    pass,
    patronize,
    piracy,
    playCard,
    playTreasure,
    preach,
    rebellion,
    recruit,
    springDeploy,
    suppress,
} from "./moves";

const turnBegin = (G: VQGame, ctx: Ctx): void => {
    G.activePower = powerAt(ctx.currentPlayer);
    if (ctx.phase === "action") {
        const p = G.activePower;
        G.impulse += 1;
        G.powers[p].cp = 0;
        G.powers[p].cardPlayed = false;
        G.powers[p].treasurePlayed = false;
        G.powers[p].passed = false;
    }
};

export const VirginQueenGameDef: Game<VQGame> = {
    name: "virginQueen",
    setup: (ctx: Ctx, setupData?: {scenario?: "campaign" | "tournament"}) => setupGame(ctx, setupData),
    minPlayers: 6,
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
        r.handCounts = {};
        const viewer = playerID === null ? undefined : powerAt(playerID);
        for (const p of POWERS) {
            r.handCounts[p] = G.powers[p].cards.length;
            if (viewer !== p) {
                r.powers[p].cards = [];
                r.powers[p].treasures = [];
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
                G.turnsCompleted = 0;
                G.consecutivePasses = 0;
                if (G.dealtYear !== G.year) {
                    dealYear(G, ctx);
                }
            },
            turn: {order: TurnOrder.ONCE, onBegin: turnBegin},
            next: "diplomacy",
        },
        diplomacy: {
            turn: {order: TurnOrder.ONCE, onBegin: turnBegin},
            next: "spring",
        },
        spring: {
            onBegin: (G: VQGame) => {
                G.turnsCompleted = 0;
                G.springDone = [];
                arriveLeaders(G);
            },
            turn: {order: TurnOrder.ONCE, onBegin: turnBegin},
            next: "action",
        },
        action: {
            onBegin: (G: VQGame) => {
                G.turnsCompleted = 0;
                G.consecutivePasses = 0;
            },
            turn: {order: TurnOrder.RESET, onBegin: turnBegin},
            endIf: (G: VQGame) => G.consecutivePasses >= 6,
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
        claimSeaCaptain,
        declareWar,
        declareWarMinor,
        makePeace,
        formAlliance,
        betroth,
        ransom,
        springDeploy,
        recruit,
        buildNaval,
        buildFortress,
        influence,
        patronize,
        moveLand,
        moveNaval,
        controlSpace,
        assault,
        preach,
        suppress,
        rebellion,
        piracy,
    },
    endIf: (G: VQGame) => {
        const v = checkVictory(G);
        if (v !== undefined) {
            return {winner: String(POWER_INDEX[v.winner]), reason: v.reason};
        }
        return undefined;
    },
};
