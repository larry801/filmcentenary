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
    initialSetup,
    moveBlocker, peek,
    playCard,
    requestEndTurn,
    updateSlot
} from "./game/moves";
import {InitPhase, NormalPhase} from "./game/config";
import {Region} from "./types/core";
// eslint-disable-next-line
import {getExtraScoreForFinal} from "./game/util";

export const FilmCentenaryGame: Game<IG> = {
    setup: setup,
    name: "FilmCentenary",
    phases: {
        InitPhase: InitPhase,
        NormalPhase: NormalPhase,
    },
    minPlayers: 3,
    maxPlayers: 4,
    playerView: (G:IG, ctx:Ctx, playerID:PlayerID) => {
        let r = {...G};
        let newPlayerObj = []
        for (let p = 0; p < r.player.length; p++) {
            let oldPlayerPrivateInfo = G.player[p];
            if (p.toString() !== playerID) {
                newPlayerObj.push({
                    hand :[],
                    handSize: oldPlayerPrivateInfo.hand.length,
                    // TODO test strip on server
                    //finalScoringExtraVp:getExtraScoreForFinal(G,ctx,p.toString()),
                    finalScoringExtraVp:0,
                    cardsToPeek :[],
                    competitionCards:[],
                });
            }else {
                newPlayerObj.push({
                    hand:oldPlayerPrivateInfo.hand,
                    cardsToPeek :oldPlayerPrivateInfo.cardsToPeek,
                    competitionCards :oldPlayerPrivateInfo.cardsToPeek,
                    handSize: G.player[p].hand.length,
                    //finalScoringExtraVp:getExtraScoreForFinal(G,ctx,p.toString()),
                    finalScoringExtraVp:0,
                });
            }
        }
        r.player = newPlayerObj;
        if (r.secret !== undefined) {
            delete r.secret;
        }
        return r;
    },
    moves: {
        initialSetup: initialSetup,
        drawCard: drawCard,
        buyCard: buyCard,
        playCard: playCard,
        breakthrough: breakthrough,
        moveBlocker: moveBlocker,
        chooseTarget: chooseTarget,
        chooseHand: chooseHand,
        chooseEvent: chooseEvent,
        chooseEffect: chooseEffect,
        competitionCard: competitionCard,
        requestEndTurn: requestEndTurn,
        updateSlot: updateSlot,
        comment: comment,
        chooseRegion: chooseRegion,
        peek:peek,
    },

    endIf: (G: IG, ctx: Ctx) => {
        let championRequiredForAutoWin = ctx.numPlayers > 3 ? 6 : 5;
        Array(ctx.numPlayers).fill(1).map((i, idx) => idx.toString()).forEach(
            p => {
                if (G.pub[parseInt(p)].champions.length === championRequiredForAutoWin) {
                    return {winner: p,reason:"championCountAutoWin"}
                }
                if(G.pub[parseInt(p)].champions
                    .filter(c => c.region === Region.NA)
                    .length === 3){
                    return {winner: p,reason:"threeNAChampionAutoWin"}
                }
            }
        )
    },
}
