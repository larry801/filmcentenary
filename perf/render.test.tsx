import React from 'react';
import {renderToString} from 'react-dom/server';
import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer';
import {FilmCentenaryGame} from '../src/Game';
import {FilmCentenaryBoard} from '../src/components/board';
import {makeLateGame, describeState} from './late-state';
import {IG} from '../src/types/setup';

const numPlayers = 4;

const gameWithSeed = (seed: string) => ({...FilmCentenaryGame, seed});

const ms = (t: [number, number]) => t[0] * 1e3 + t[1] / 1e6;

const timeIt = (label: string, fn: () => void, runs = 3) => {
    fn(); // warm up JIT / module caches
    const samples: number[] = [];
    for (let i = 0; i < runs; i++) {
        const t0 = process.hrtime();
        fn();
        samples.push(ms(process.hrtime(t0)));
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];
    console.log(JSON.stringify({label, medianMs: +median.toFixed(2), samples: samples.map(s => +s.toFixed(1))}));
    return median;
};

const startFreshState = () => {
    const spec = {numPlayers, game: gameWithSeed('render-bench'), multiplayer: Local()};
    const clients: any[] = [];
    for (let i = 0; i < numPlayers; i++) {
        clients.push(Client({...spec, playerID: i.toString()} as any) as any);
    }
    clients.forEach(c => c.start());
    const master = clients[0].transport.master;
    const {state} = master.storageAPI.fetch(clients[0].matchID, {state: true});
    return {state, stop: () => clients.forEach(c => c.stop())};
};

const boardProps = (G: IG, ctx: any, log: any[], playerID: string) => ({
    G,
    ctx,
    log,
    moves: new Proxy({}, {get: () => () => undefined}),
    events: {},
    undo: () => undefined,
    redo: () => undefined,
    reset: () => undefined,
    matchData: undefined,
    matchID: 'perf-match',
    playerID,
    isActive: true,
    isMultiplayer: true,
    isConnected: true,
    plugins: {},
} as any);

it('late game board render cost', () => {
    const {state, stop} = startFreshState();
    const fresh = {G: state.G as IG, ctx: state.ctx as any, log: [] as any[]};
    const early = {...fresh, log: makeLateGame(state.G as IG, state.ctx, {logLength: 120}).log};
    const late = makeLateGame(state.G as IG, state.ctx, {logLength: 1200});
    console.log(JSON.stringify({
        fresh: describeState(fresh.G, fresh.log),
        early: describeState(early.G, early.log),
        late: describeState(late.G, late.log),
    }));

    const renderBoard = (game: any, playerID: string | null) => () => {
        renderToString(React.createElement(FilmCentenaryBoard, boardProps(game.G, game.ctx, game.log, playerID)));
    };

    // Count how many console calls one render performs (the game logs through console).
    const consoleCounts = {log: 0, info: 0, warn: 0, error: 0};
    const original = {log: console.log, info: console.info, warn: console.warn, error: console.error};
    const countConsole = (on: boolean) => {
        (['log', 'info', 'warn', 'error'] as const).forEach(k => {
            (console as any)[k] = on
                ? (...args: any[]) => {
                    consoleCounts[k]++;
                }
                : original[k];
        });
    };
    countConsole(true);
    renderToString(React.createElement(FilmCentenaryBoard, boardProps(late.G, late.ctx, late.log, '0')));
    countConsole(false);
    original.log(JSON.stringify({consoleCallsPerRender: consoleCounts,
        totalConsoleCalls: consoleCounts.log + consoleCounts.info + consoleCounts.warn + consoleCounts.error}));

    timeIt('render fresh turn-1 board ', renderBoard(fresh, '0'));
    timeIt('render early (era1+120log)', renderBoard(early, '0'));
    timeIt('render late  (era3+1200log)', renderBoard(late, '0'));
    timeIt('render late  (spectator) ', renderBoard(late, null));

    // isolate the growing pieces
    timeIt('render late, empty log    ', renderBoard({...late, log: []}, '0'));
    const noPiles = JSON.parse(JSON.stringify(late));
    noPiles.G.pub.forEach((p: any) => {
        p.discard = [];
        p.archive = [];
        p.playedCardInTurn = [];
        p.allCards = p.allCards.slice(0, 8);
        p.champions = [];
    });
    timeIt('render late, empty piles  ', renderBoard({...noPiles, log: []}, '0'));
    stop();
}, 900000);
