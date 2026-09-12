import {Ctx, PlayerID} from 'boardgame.io';
import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer';
import {FilmCentenaryGame} from '../src/Game';
import {IG} from '../src/types/setup';
import {enumerateMoves} from '../src/game/ai';
import {activePlayer, drawForRegion} from '../src/game/util';
import {CardCategory, getCardById, IEra, valid_regions} from '../src/types/core';
import {seqFromActivePlayer} from '../src/game/util';
import {makeLateGame} from './late-state';

const numPlayers = 4;
const gameWithSeed = (seed: string) => ({...FilmCentenaryGame, seed});

/** The previous playerView implementation, kept here as the reference. */
const referencePlayerView = (G: IG, ctx: Ctx, playerID: PlayerID | null): IG => {
    let r = JSON.parse(JSON.stringify(G));
    r.eventDeckLength = G.secretInfo.events.length;
    valid_regions.forEach(region => {
        r.regions[region].legendDeckLength = G.secretInfo.regions[region].legendDeck.length;
        r.regions[region].normalDeckLength = G.secretInfo.regions[region].normalDeck.length;
    })
    r.twoPlayer.schoolDeckLength = G.secretInfo.twoPlayer.school.length;
    r.twoPlayer.filmDeckLength = G.secretInfo.twoPlayer.film.length;
    let newPlayerObj: any[] = [];
    for (let p = 0; p < r.player.length; p++) {
        let oldPlayerPrivateInfo = G.player[p];
        let isEmpty = G.secretInfo.playerDecks[p].length === 0 && G.pub[p].discard.length === 0;
        // @ts-ignore - same helper the game uses
        require('../src/game/util').getExtraScoreForFinal(r, ctx, p.toString());
        r.pub[p].handSize = oldPlayerPrivateInfo.hand.length;
        if (p.toString() !== playerID) {
            newPlayerObj.push({
                hand: oldPlayerPrivateInfo.hand,
                handSize: oldPlayerPrivateInfo.hand.length,
                cardsToPeek: oldPlayerPrivateInfo.cardsToPeek,
                competitionCards: oldPlayerPrivateInfo.competitionCards,
                deckEmpty: isEmpty,
                classicFilmAutoMove: oldPlayerPrivateInfo.classicFilmAutoMove,
            });
        } else {
            newPlayerObj.push({
                hand: oldPlayerPrivateInfo.hand,
                cardsToPeek: oldPlayerPrivateInfo.cardsToPeek,
                competitionCards: oldPlayerPrivateInfo.cardsToPeek,
                handSize: oldPlayerPrivateInfo.hand.length,
                deckEmpty: isEmpty,
                classicFilmAutoMove: oldPlayerPrivateInfo.classicFilmAutoMove,
            });
        }
    }
    r.player = newPlayerObj;
    if (r.secretInfo !== undefined) {
        delete r.secretInfo;
    }
    return r;
};

let rngState = 987654321;
const rand = (n: number) => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState % n;
};

it('playerView produces the same view as before (and much faster)', () => {
    const spec = {numPlayers, game: gameWithSeed('view-equiv'), multiplayer: Local()};
    const clients: any[] = [];
    for (let i = 0; i < numPlayers; i++) {
        clients.push(Client({...spec, playerID: i.toString()} as any) as any);
    }
    clients.forEach(c => c.start());
    const master = clients[0].transport.master;
    const fetchRaw = () => master.storageAPI.fetch(clients[0].matchID, {state: true}).state;

    // Play a while so the state is not the trivial initial one.
    for (let step = 0; step < 60; step++) {
        const state = fetchRaw();
        if (state.ctx.gameover) break;
        const pid = activePlayer(state.ctx);
        let moves: any[];
        try {
            moves = enumerateMoves(state.G, state.ctx, pid) as any;
        } catch (e) {
            break;
        }
        if (!moves || moves.length === 0) break;
        const pick = moves[rand(moves.length)];
        try {
            const client = clients[parseInt(pid)];
            pick.args && pick.args.length > 0
                ? (client.moves as any)[pick.move](...pick.args)
                : (client.moves as any)[pick.move]();
        } catch (e) {
            break;
        }
    }

    const states: any[] = [fetchRaw()];
    // plus a synthetic late game state
    const late = makeLateGame(states[0].G, states[0].ctx, {logLength: 0});

    const check = (label: string, G: IG, ctx: Ctx) => {
        for (let p = 0; p < numPlayers; p++) {
            const playerID = p.toString();
            const expected = referencePlayerView(G, ctx, playerID);
            const actual = FilmCentenaryGame.playerView(G, ctx, playerID);
            expect(JSON.parse(JSON.stringify(actual))).toEqual(expected);
            expect(JSON.stringify(actual)).toEqual(JSON.stringify(expected));
        }
        const spectator = referencePlayerView(G, ctx, null);
        expect(JSON.parse(JSON.stringify(FilmCentenaryGame.playerView(G, ctx, null)))).toEqual(spectator);
        console.log(`view equivalence ok: ${label}`);
    };

    check('played state', states[0].G, states[0].ctx);
    check('synthetic late game', late.G, late.ctx);

    // two-player mode too (different region/2p branches)
    const spec2 = {numPlayers: 2, game: gameWithSeed('view-equiv-2p'), multiplayer: Local()};
    const two: any[] = [];
    for (let i = 0; i < 2; i++) {
        two.push(Client({...spec2, playerID: i.toString()} as any) as any);
    }
    two.forEach(c => c.start());
    const raw2 = two[0].transport.master.storageAPI.fetch(two[0].matchID, {state: true}).state;
    const late2 = makeLateGame(raw2.G, raw2.ctx, {logLength: 0});
    valid_regions.forEach(r => drawForRegion(late2.G, late2.ctx, r, IEra.THREE));
    check('2p state', raw2.G, raw2.ctx);

    const late3 = makeLateGame(states[0].G, states[0].ctx, {logLength: 0});
    // The helpers that the board calls the most must keep returning the same
    // values as the straightforward implementations they replaced.
    const referenceLegendCount = (G: IG, r: any, e: any, p: any): number =>
        G.pub[parseInt(p)].allCards
            .filter(c => {
                const card = getCardById(c);
                return card.category === CardCategory.LEGEND && card.region === r && card.era === e;
            })
            .length;
    const referenceInferredHand = (G: IG, pid: string): string[] => {
        const pub = G.pub[parseInt(pid)];
        const result = [...pub.allCards];
        const remove = (cards: string[]) => cards.forEach(c => {
            const idx = result.indexOf(c);
            if (idx !== -1) result.splice(idx, 1);
        });
        remove(pub.discard);
        remove(pub.playedCardInTurn);
        if (pub.school !== null) {
            const sIndex = result.indexOf(pub.school);
            if (sIndex !== -1) result.splice(sIndex, 1);
        }
        remove(pub.archive);
        return result;
    };
    const referenceRanker = (G: IG, ctx: Ctx, r: any, era: any) => (a: any, b: any): number => {
        const p1 = G.pub[parseInt(a)];
        const p2 = G.pub[parseInt(b)];
        if (p1.shares[r] > p2.shares[r]) return -1;
        if (p1.shares[r] < p2.shares[r]) return 1;
        const ca = referenceLegendCount(G, r, era, a);
        const cb = referenceLegendCount(G, r, era, b);
        if (ca > cb) return -1;
        if (ca < cb) return 1;
        const curPos = seqFromActivePlayer(G, ctx);
        const pa = curPos.indexOf(a);
        const pb = curPos.indexOf(b);
        if (pa > pb) return 1;
        if (pa < pb) return -1;
        return a < b ? -1 : 1;
    };
    const referenceRegionRank = (G: IG, ctx: Ctx, r: any): string[] => {
        const era = G.regions[r].era;
        const players: string[] = [];
        G.order.forEach((_i, idx) => {
            if (G.pub[idx].shares[r] !== 0) players.push(idx.toString());
        });
        return players.sort(referenceRanker(G, ctx, r, era));
    };

    const {legendCount, legendCountsByRegion, getRegionRank} = require('../src/game/util');
    const {getPlayerInferredHand} = require('../src/game/board-util');
    const {CardCategory} = require('../src/types/core');

    for (const [label, game] of [['late', late3], ['played', {G: states[0].G, ctx: states[0].ctx}]] as any[]) {
        for (let p = 0; p < numPlayers; p++) {
            valid_regions.forEach((r: any) => {
                expect(legendCount(game.G, r, game.G.regions[r].era, p.toString()))
                    .toEqual(referenceLegendCount(game.G, r, game.G.regions[r].era, p.toString()));
            });
            const counts = legendCountsByRegion(game.G, p.toString());
            valid_regions.forEach((r: any) => {
                expect(counts[r]).toEqual(referenceLegendCount(game.G, r, game.G.regions[r].era, p.toString()));
            });
            expect(getPlayerInferredHand(game.G, p.toString())).toEqual(referenceInferredHand(game.G, p.toString()));
            valid_regions.forEach((r: any) => {
                expect(getRegionRank(game.G, game.ctx, r)).toEqual(referenceRegionRank(game.G, game.ctx, r));
            });
        }
        console.log(`helper equivalence ok: ${label}`);
    }

    // timing on a late-game state
    const time = (fn: () => void) => {
        fn();
        const t0 = process.hrtime();
        for (let i = 0; i < 20; i++) fn();
        return +((process.hrtime(t0)[0] * 1e3 + process.hrtime(t0)[1] / 1e6) / 20).toFixed(3);
    };
    // How much the (now skipped) log building inside the final scoring used to cost.
    const {logger} = require('../src/game/logger');
    const {getExtraScoreForFinal} = require('../src/game/util');
    const quietDebug = logger.debug;
    logger.setEnabled(false);
    const noLogMs = time(() => getExtraScoreForFinal(late3.G, late3.ctx, '0', true));
    logger.setEnabled(true);
    logger.debug = () => undefined;
    const withLogMs = time(() => getExtraScoreForFinal(late3.G, late3.ctx, '0', true));
    logger.debug = quietDebug;
    logger.setEnabled(false);
    console.log(`getExtraScoreForFinal: without log building=${noLogMs}ms with=${withLogMs}ms`);
    const newMs = time(() => FilmCentenaryGame.playerView(late3.G, late3.ctx, '0'));
    const oldMs = time(() => referencePlayerView(late3.G, late3.ctx, '0'));
    console.log(`playerView per call: old=${oldMs}ms new=${newMs}ms (state ${(JSON.stringify(late3.G).length / 1024).toFixed(1)}KB)`);

    clients.forEach(c => c.stop());
    two.forEach(c => c.stop());
}, 900000);
