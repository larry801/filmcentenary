/**
 * Client-side benchmark: mounts the real board in jsdom and measures what a
 * game state update costs (React work + DOM churn).
 *
 * Needs jsdom, which is not a project dependency:
 *   npm i --no-save jsdom@24.1.3
 */
let JSDOM: any = null;
try {
    JSDOM = require('jsdom').JSDOM;
} catch (e) {
    // handled below: the benchmark skips itself
}

const maybe = JSDOM ? it : it.skip;
const dom = JSDOM
    ? new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
        pretendToBeVisual: true,
        url: 'http://localhost/',
    })
    : null;

if (dom) {
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).navigator = dom.window.navigator;
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).Element = dom.window.Element;
    (global as any).Node = dom.window.Node;
    (global as any).ShadowRoot = dom.window.ShadowRoot;
    (global as any).MutationObserver = dom.window.MutationObserver;
    (global as any).requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
    (global as any).cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
    (global as any).Audio = class {
        play() {
            return Promise.resolve();
        }
    };
}
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

/* eslint-disable @typescript-eslint/no-var-requires */
const React = require('react');
const {createRoot} = require('react-dom/client');
const {flushSync} = require('react-dom');
const {Client} = require('boardgame.io/client');
const {Local} = require('boardgame.io/multiplayer');
const {FilmCentenaryGame} = require('../src/Game');
const {FilmCentenaryBoard} = require('../src/components/board');
const {makeLateGame} = require('./late-state');

const numPlayers = 4;
const gameWithSeed = (seed: string) => ({...FilmCentenaryGame, seed});

const startFreshState = () => {
    const spec = {numPlayers, game: gameWithSeed('client-bench'), multiplayer: Local()};
    const clients: any[] = [];
    for (let i = 0; i < numPlayers; i++) {
        clients.push(Client({...spec, playerID: i.toString()} as any) as any);
    }
    clients.forEach(c => c.start());
    const master = clients[0].transport.master;
    const {state} = master.storageAPI.fetch(clients[0].matchID, {state: true});
    return {state, stop: () => clients.forEach(c => c.stop())};
};

const boardProps = (G: any, ctx: any, log: any[], playerID: string | null) => ({
    G, ctx, log,
    moves: new Proxy({}, {get: () => () => undefined}),
    events: {}, undo: () => undefined, redo: () => undefined, reset: () => undefined,
    matchData: undefined, matchID: 'perf-match', playerID,
    isActive: true, isMultiplayer: true, isConnected: true, plugins: {},
});

/** A state update as the app sees it: same shape, one field changed. */
const tweak = (G: any) => {
    const next = JSON.parse(JSON.stringify(G));
    next.pub[0].vp += 1;
    next.pub[0].resource += 1;
    next.updateCardHistory.push(['B01', 'B02']);
    return next;
};

const stats = (xs: number[]) => {
    const sorted = [...xs].sort((a, b) => a - b);
    return {
        min: +sorted[0].toFixed(1),
        median: +sorted[Math.floor(sorted.length / 2)].toFixed(1),
        max: +sorted[sorted.length - 1].toFixed(1),
    };
};

maybe('client update cost on a late-game board', async () => {
    const {state, stop} = startFreshState();
    const late = makeLateGame(state.G, state.ctx, {logLength: 1200});
    const fresh = {G: state.G, ctx: state.ctx, log: []};

    const container = dom.window.document.getElementById('root')!;
    const root = createRoot(container);

    let added = 0;
    let removed = 0;
    const observer = new dom.window.MutationObserver((records: any[]) => {
        records.forEach(r => {
            added += r.addedNodes.length;
            removed += r.removedNodes.length;
        });
    });
    observer.observe(container, {childList: true, subtree: true});

    const flush = () => new Promise(resolve => dom.window.setTimeout(resolve, 0));

    const render = async (G: any, log: any[]) => {
        added = 0;
        removed = 0;
        const t0 = performance.now();
        flushSync(() => {
            root.render(React.createElement(FilmCentenaryBoard, boardProps(G, state.ctx, log, '0')));
        });
        const ms = performance.now() - t0;
        await flush();
        return {ms: +ms.toFixed(1), domAdded: added, domRemoved: removed};
    };

    const mount = await render(late.G, late.log);
    const updates: any[] = [];
    let G = late.G;
    for (let i = 0; i < 8; i++) {
        G = tweak(G);
        updates.push(await render(G, late.log));
    }

    const freshUpdates: any[] = [];
    let fG = fresh.G;
    await render(fG, fresh.log);
    for (let i = 0; i < 4; i++) {
        fG = tweak(fG);
        freshUpdates.push(await render(fG, fresh.log));
    }

    console.log('CLIENT_JSON ' + JSON.stringify({
        mount,
        lateUpdate: stats(updates.map(u => u.ms)),
        lateDomChurn: {added: updates[0].domAdded, removed: updates[0].domRemoved},
        freshUpdate: stats(freshUpdates.map(u => u.ms)),
        freshDomChurn: {added: freshUpdates[0].domAdded, removed: freshUpdates[0].domRemoved},
        reactEnv: process.env.NODE_ENV,
    }, null, 1));

    observer.disconnect();
    flushSync(() => root.unmount());
    stop();
}, 900000);
