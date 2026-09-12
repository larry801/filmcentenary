/**
 * Manual tool: renders the board (and its dialogs) to HTML so two revisions can
 * be compared byte for byte. Not an assertion - it just writes a file:
 *
 *   HTML_OUT=/tmp/before.html npx jest --config perf/jest.config.js perf/html-dump.test.tsx
 *   git stash push -- src/ && HTML_OUT=/tmp/after.html npx jest --config perf/jest.config.js perf/html-dump.test.tsx && git stash pop
 *   cmp /tmp/before.html /tmp/after.html
 */
import fs from 'fs';
import path from 'path';

let JSDOM: any = null;
try {
    JSDOM = require('jsdom').JSDOM;
} catch (e) {
    // jsdom is only needed by the DOM benchmarks: npm i --no-save jsdom@24
}

const maybe = JSDOM ? it : it.skip;

const numPlayers = 4;
const gameWithSeed = (seed: string) => ({...FilmCentenaryGame, seed});

/* eslint-disable @typescript-eslint/no-var-requires */
const React = require('react');
const {Client} = require('boardgame.io/client');
const {Local} = require('boardgame.io/multiplayer');
const {FilmCentenaryGame} = require('../src/Game');
const {FilmCentenaryBoard} = require('../src/components/board');
const {makeLateGame} = require('./late-state');

const startFreshState = () => {
    const spec = {numPlayers, game: gameWithSeed('html-dump'), multiplayer: Local()};
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
    moves: new Proxy({}, {get: () => () => undefined}),
    events: {}, undo: () => undefined, redo: () => undefined, reset: () => undefined,
    matchData: undefined, matchID: 'html-dump', G, ctx, log, playerID,
    isActive: true, isMultiplayer: true, isConnected: true, plugins: {},
});

maybe('dumps board html (server render)', () => {
    const {renderToString} = require('react-dom/server');
    const {state, stop} = startFreshState();
    const late = makeLateGame(state.G, state.ctx, {logLength: 240});
    const parts: string[] = [];
    const dump = (label: string, G: any, ctx: any, log: any[], playerID: string | null) => {
        parts.push(`<!-- ${label} -->`);
        parts.push(renderToString(React.createElement(FilmCentenaryBoard, boardProps(G, ctx, log, playerID))));
    };
    dump('late-player0', late.G, late.ctx, late.log, '0');
    dump('late-player2', late.G, late.ctx, late.log, '2');
    dump('late-spectator', late.G, late.ctx, late.log, null);
    dump('fresh-player0', state.G, state.ctx, [], '0');
    write(outPath('board.html'), parts.join('\n'));
    stop();
}, 900000);

maybe('dumps board html with dialogs open (client render)', () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
        pretendToBeVisual: true,
        url: 'http://localhost/',
    });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).navigator = dom.window.navigator;
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).Element = dom.window.Element;
    (global as any).Node = dom.window.Node;
    (global as any).ShadowRoot = dom.window.ShadowRoot;
    (global as any).DocumentFragment = dom.window.DocumentFragment;
    (global as any).getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
    (global as any).HTMLInputElement = dom.window.HTMLInputElement;
    (global as any).MutationObserver = dom.window.MutationObserver;
    (global as any).requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
    (global as any).cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
    (global as any).Audio = class {
        play() {
            return Promise.resolve();
        }
    };
    (global as any).ResizeObserver = class {
        observe() {
        }

        unobserve() {
        }

        disconnect() {
        }
    };
    (dom.window.Element.prototype as any).scrollIntoView = () => undefined;
    (global as any).IS_REACT_ACT_ENVIRONMENT = true;

    const {createRoot} = require('react-dom/client');
    const {flushSync} = require('react-dom');
    const {state, stop} = startFreshState();
    const late = makeLateGame(state.G, state.ctx, {logLength: 120});
    const container = dom.window.document.getElementById('root')!;
    const root = createRoot(container);
    flushSync(() => root.render(React.createElement(FilmCentenaryBoard, boardProps(late.G, late.ctx, late.log, '0'))));

    const click = (selector: (b: any) => boolean) => {
        const button = (Array.from(container.querySelectorAll('button')) as any[]).find(selector);
        if (button) {
            flushSync(() => button.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true})));
            return true;
        }
        return false;
    };
    const snap = () => dom.window.document.body.innerHTML.replace(/class="[^"]*"/g, 'class=""');
    const parts: string[] = ['<!-- after mount -->', snap()];

    if (click(b => !b.getAttribute('aria-label') && (b.textContent || '').includes('购买'))) {
        parts.push('<!-- buy dialog open -->', snap());
        click(b => (b.textContent || '').includes('取消'));
    }
    if (click(b => /查看弃牌|查看档案馆|查看所有卡牌|查看出牌区|牌堆|展示手牌|discard|archive/i.test(b.getAttribute('aria-label') || ''))) {
        parts.push('<!-- card list dialog open -->', snap());
    }
    write(outPath('dialogs.html'), parts.join('\n'));
    flushSync(() => root.unmount());
    stop();
}, 900000);

/** HTML_OUT may be a file (single test) or a directory prefix. */
const outPath = (name: string) => {
    const base = process.env.HTML_OUT;
    if (!base) return path.join(__dirname, 'out', name);
    return base.includes('.html') ? base.replace(/\.html$/, `-${name}`) : path.join(base, name);
};

const write = (target: string, content: string) => {
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, content);
    console.log(`wrote ${target} (${content.length} chars)`);
};
