import React from 'react';
import {renderToString} from 'react-dom/server';
import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer';
import {FilmCentenaryGame} from '../src/Game';
import {FilmCentenaryBoard} from '../src/components/board';
import {makeLateGame} from './late-state';
import {IG} from '../src/types/setup';

const numPlayers = 4;
const gameWithSeed = (seed: string) => ({...FilmCentenaryGame, seed});

const startFreshState = () => {
    const spec = {numPlayers, game: gameWithSeed('count-bench'), multiplayer: Local()};
    const clients: any[] = [];
    for (let i = 0; i < numPlayers; i++) {
        clients.push(Client({...spec, playerID: i.toString()} as any) as any);
    }
    clients.forEach(c => c.start());
    const master = clients[0].transport.master;
    const {state} = master.storageAPI.fetch(clients[0].matchID, {state: true});
    return {state, stop: () => clients.forEach(c => c.stop())};
};

const boardProps = (G: IG, ctx: any, log: any[], playerID: string | null) => ({
    G, ctx, log,
    moves: new Proxy({}, {get: () => () => undefined}),
    events: {}, undo: () => undefined, redo: () => undefined, reset: () => undefined,
    matchData: undefined, matchID: 'perf-match', playerID,
    isActive: true, isMultiplayer: true, isConnected: true, plugins: {},
} as any);

/** Wrap every exported function of a module with a call counter. */
const counted = new Map<string, number>();
const callers = new Map<string, number>();
let captureCallers = false;
const callerOf = (skip = 3): string => {
    const stack = new Error().stack ?? '';
    const lines = stack.split('\n').slice(skip);
    for (const line of lines) {
        const m = line.match(/(src[\/][^):]+):(\d+)/);
        if (m && !m[1].includes('perf/')) return `${m[1].replace(/\\/g, '/')}:${m[2]}`;
    }
    return 'unknown';
};
const instrument = (mod: any, names: string[]) => {
    names.forEach(name => {
        const original = mod[name];
        if (typeof original !== 'function') return;
        mod[name] = function (...args: any[]) {
            counted.set(name, (counted.get(name) ?? 0) + 1);
            if (captureCallers) {
                const key = `${name} <- ${callerOf()}`;
                callers.set(key, (callers.get(key) ?? 0) + 1);
            }
            return original.apply(this, args);
        };
    });
};

it('count work per board render', () => {
    const {state, stop} = startFreshState();

    // Patch the module exports before the board modules capture them.
    instrument(require('../src/types/core'), ['getCardById', 'getScoreCardByID']);
    instrument(require('../src/game/util'), [
        'resCost', 'canAfford', 'canBuyCard', 'canHelp', 'getPlayerRegionRank', 'getRegionRank',
        'activePlayer', 'actualStage', 'getPlayerAction', 'getPossibleHelper',
    ]);
    instrument(require('../src/game/board-util'), [
        'getValidHelper', 'getChooseHandChoice', 'getHandChoice', 'getPlayerInferredHand', 'getPeekChoices',
    ]);
    instrument(require('../src/components/card'), ['getCardName', 'getEffectTextById', 'effName']);
    instrument(require('../src/components/boards/list-card'), ['getLogText']);

    const fresh = {G: state.G as IG, ctx: state.ctx as any, log: [] as any[]};
    const late = makeLateGame(state.G as IG, state.ctx, {logLength: 1200});

    const render = (game: any, playerID: string | null) => {
        counted.clear();
        renderToString(React.createElement(FilmCentenaryBoard, boardProps(game.G, game.ctx, game.log, playerID)));
        return Object.fromEntries([...counted.entries()].sort((a, b) => b[1] - a[1]));
    };

    const freshCounts = render(fresh, '0');
    const lateCounts = render(late, '0');
    console.log('COUNTS_JSON ' + JSON.stringify({fresh: freshCounts, late: lateCounts}, null, 1));

    // Attribute the hot calls to the component that makes them.
    captureCallers = true;
    callers.clear();
    renderToString(React.createElement(FilmCentenaryBoard, boardProps(late.G, late.ctx, late.log, '0')));
    captureCallers = false;
    const top = [...callers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18)
        .map(([k, v]) => `${v}\t${k}`);
    console.log('CALLERS_JSON\n' + top.join('\n'));

    // Which functions are behind the console traffic?
    const loggerMod = require('../src/game/logger');
    const logCounts = new Map<string, number>();
    const originalLogger = loggerMod.logger;
    const wrapped: any = {};
    (['info', 'debug', 'warn', 'error'] as const).forEach(k => {
        wrapped[k] = (...args: any[]) => {
            const key = `${k} <- ${callerOf(4)}`;
            logCounts.set(key, (logCounts.get(key) ?? 0) + 1);
        };
    });
    loggerMod.logger = wrapped;
    renderToString(React.createElement(FilmCentenaryBoard, boardProps(late.G, late.ctx, late.log, '0')));
    loggerMod.logger = originalLogger;
    console.log('LOGGERS_JSON ' + JSON.stringify(
        [...logCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)));
    stop();
}, 900000);
