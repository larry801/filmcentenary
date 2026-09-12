import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer';
import {FilmCentenaryGame} from '../src/Game';
import {enumerateMoves} from '../src/game/ai';
import {activePlayer} from '../src/game/util';
import {createPatch} from 'rfc6902';
import crypto from 'crypto';

const numPlayers = 4;
const MAX_STEPS = Number(process.env.BENCH_STEPS ?? 400);

const gameWithSeed = (seed: string) => ({...FilmCentenaryGame, seed});

const applyPlayerView = (state: any, pid: string) => ({
    ...state,
    G: FilmCentenaryGame.playerView(state.G, state.ctx, pid),
});

let rngState = 12345;
const rand = (n: number) => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState % n;
};

const ms = (t: [number, number]) => (t[0] * 1e3 + t[1] / 1e6);

it('bench late game', () => {
    const spec = {
        numPlayers,
        game: gameWithSeed('bench-seed-1'),
        multiplayer: Local(),
    };
    const clients: any[] = [];
    for (let i = 0; i < numPlayers; i++) {
        clients.push(Client({...spec, playerID: i.toString()} as any) as any);
    }
    // Raw (unfiltered, authoritative) state straight from the local master.
    const master = clients[0].transport.master;
    let raw: any = null;
    master.subscribe((s: any) => {
        raw = s.state;
    });
    clients.forEach(c => c.start());
    const fetchRaw = () => {
        const r = master.storageAPI.fetch(clients[0].matchID, {state: true});
        raw = r.state;
        return raw;
    };

    const report = (step: number, moveMs: number) => {
        const state = fetchRaw();
        const G = state.G;
        const size = JSON.stringify(G).length;
        const logLen = state.log ? state.log.length : 0;
        const deltalog = state.deltalog ? state.deltalog.length : 0;

        // playerView cost for every player (server-side filter cost)
        let pv = 0;
        const views: any[] = [];
        for (let p = 0; p < numPlayers; p++) {
            const t0 = process.hrtime();
            const v = applyPlayerView(state, p.toString());
            pv += ms(process.hrtime(t0));
            views.push(v);
        }
        // patch cost between two views of the same state (what master does per player)
        const t1 = process.hrtime();
        for (let p = 0; p < numPlayers; p++) {
            createPatch(views[p], views[p]);
        }
        const patchMs = ms(process.hrtime(t1));

        // bot enumerate cost
        const pid = activePlayer(state.ctx);
        const t2 = process.hrtime();
        let moveCount = 0;
        try {
            moveCount = enumerateMoves(G, state.ctx, pid).length;
        } catch (e) {
            moveCount = -1;
        }
        const enumMs = ms(process.hrtime(t2));

        console.log(JSON.stringify({
            step,
            moveMs: +moveMs.toFixed(1),
            gKB: +(size / 1024).toFixed(1),
            logLen,
            deltalog,
            pvMs: +pv.toFixed(1),
            patchMs: +patchMs.toFixed(1),
            enumMs: +enumMs.toFixed(1),
            moveCount,
            turn: state.ctx.turn,
            phase: state.ctx.phase,
        }));
    };

    report(0, 0);

    for (let step = 1; step <= MAX_STEPS; step++) {
        const state = raw;
        if (state.ctx.gameover) {
            console.log(`GAMEOVER at step ${step}: ${JSON.stringify(state.ctx.gameover)}`);
            break;
        }
        const pid = activePlayer(state.ctx);
        let moves: Array<{ move: string; args?: any[] }>;
        try {
            moves = enumerateMoves(state.G, state.ctx, pid) as any;
        } catch (e) {
            console.log(`enumerate threw at step ${step}: ${e}`);
            break;
        }
        if (!moves || moves.length === 0) {
            console.log(`no moves at step ${step} stage=${(state.G as any).stage} ctx=${JSON.stringify(state.ctx)}`);
            break;
        }
        const pick = moves[rand(moves.length)];
        const client = clients[parseInt(pid)];
        const t0 = process.hrtime();
        try {
            if (pick.args && pick.args.length > 0) {
                (client.moves as any)[pick.move](...pick.args);
            } else {
                (client.moves as any)[pick.move]();
            }
        } catch (e) {
            console.log(`move threw at step ${step} ${pick.move}: ${e}`);
            break;
        }
        const moveMs = ms(process.hrtime(t0));
        if (step % 25 === 0) {
            report(step, moveMs);
        }
    }
    const finalState = fetchRaw();
    const digest = crypto.createHash('sha1').update(JSON.stringify(finalState.G)).digest('hex');
    console.log('DIGEST ' + JSON.stringify({
        digest,
        turn: finalState.ctx.turn,
        phase: finalState.ctx.phase,
        gameover: finalState.ctx.gameover ?? null,
        gKB: +(JSON.stringify(finalState.G).length / 1024).toFixed(2),
    }));
    clients.forEach(c => c.stop());
}, 600000);
