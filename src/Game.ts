import {Ctx, Game, PlayerID} from "boardgame.io";
import {IG, setup} from "./types/setup";
import {
    breakthrough,
    buyCard,
    chooseEffect,
    chooseEvent,
    chooseHand,
    chooseRegion,
    chooseTarget,
    comment,
    competitionCard,
    drawCard,
    showBoardStatus,
    moveBlocker, peek,
    playCard,
    requestEndTurn,
    updateSlot, concedeMove, setupGameMode
} from "./game/moves";
import {InitPhase, NormalPhase} from "./game/config";
import {Region, valid_regions, VictoryType} from "./types/core";
import {getExtraScoreForFinal} from "./game/util";
import {enumerateMoves} from "./game/ai";

export enum Player {
    'P0' = '0',
    'P1' = '1',
    'P2' = '2',
    'P3' = '3',
    'spectate' = 'spectate',
}

export const nameOf = (p: Player) => {
    switch (p) {
        case Player.P0:
            return "P1"
        case Player.P1:
            return "P2"
        case Player.P2:
            return "P3"
        case Player.P3:
            return "P4"
    }
}

export const FilmCentenaryGame: Game<IG> = {
    ai: {
        enumerate: enumerateMoves
    },
    setup: setup,
    name: "film",
    phases: {
        InitPhase: InitPhase,
        NormalPhase: NormalPhase,
    },
    minPlayers: 2,
    maxPlayers: 4,
    playerView: (G: IG, ctx: Ctx, playerID: PlayerID | null) => {
        let r = JSON.parse(JSON.stringify(G));
        r.eventDeckCount = G.secretInfo.events.length;
        valid_regions.forEach(region=>{
            r.regions[region].legendDeckLength = G.secretInfo.regions[region].legendDeck.length;
            r.regions[region].normalDeckLength = G.secretInfo.regions[region].normalDeck.length;
        })
        r.twoPlayer.schoolDeckLength = G.secretInfo.twoPlayer.school.length;
        r.twoPlayer.filmDeckLength = G.secretInfo.twoPlayer.film.length;
        let newPlayerObj = [];
        for (let p = 0; p < r.player.length; p++) {
            let oldPlayerPrivateInfo = G.player[p];
            let isEmpty = G.secretInfo.playerDecks[p].length === 0 && G.pub[p].discard.length === 0;
            getExtraScoreForFinal(r, ctx, p.toString());
            r.pub[p].handSize = oldPlayerPrivateInfo.hand.length;
            if (p.toString() !== playerID) {
                newPlayerObj.push({
                    hand: oldPlayerPrivateInfo.hand,
                    handSize: oldPlayerPrivateInfo.hand.length,
                    finalScoringExtraVp: 0,
                    cardsToPeek: oldPlayerPrivateInfo.cardsToPeek,
                    competitionCards: oldPlayerPrivateInfo.competitionCards,
                    deckEmpty: isEmpty,
                });
            } else {
                newPlayerObj.push({
                    hand: oldPlayerPrivateInfo.hand,
                    cardsToPeek: oldPlayerPrivateInfo.cardsToPeek,
                    competitionCards: oldPlayerPrivateInfo.cardsToPeek,
                    handSize: oldPlayerPrivateInfo.hand.length,
                    finalScoringExtraVp: 0,
                    deckEmpty: isEmpty,
                });
            }
        }
        r.player = newPlayerObj;
        if (r.secretInfo !== undefined) {
            delete r.secretInfo;
        }
        return r;
    },
    moves: {
        setupGameMode:setupGameMode,
        showBoardStatus: showBoardStatus,
        drawCard: drawCard,
        buyCard: buyCard,
        playCard: playCard,
        breakthrough: breakthrough,
        moveBlocker: moveBlocker,
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

    endIf: (G: IG, ctx: Ctx) => {
        let championRequiredForAutoWin = ctx.numPlayers > 3 ? 5 : 6;
        G.order.forEach(p => {
                if (G.pub[parseInt(p)].champions
                    .filter(c => c.region === Region.NA)
                    .length === 3) {
                    return {winner: p, reason: VictoryType.threeNAChampionAutoWin}
                }
            }
        )
        G.order.forEach(p => {
                if (G.pub[parseInt(p)].champions.length === championRequiredForAutoWin) {
                    return {winner: p, reason: VictoryType.championCountAutoWin}
                }
            }
        )
    },
}
