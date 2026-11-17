import path from 'path';
import fs from 'fs';
import * as Koa from "koa"
import serve from 'koa-static';
import {FilmCentenaryGame} from "./src/Game";
import {Server, FlatFile} from "boardgame.io/server";
import RedisStorage from "./ioredis-stroage";
import {PostgresStore} from "bgio-postgres"
import {SongJinnGameDef} from "./src/songJinn/game";
import {VirginQueenGameDef} from "./src/virginQueen/game";
import {ImperialElegyGameDef} from "./src/imperialElegy/game";
import {createMatchDataStorageWrapper, createInMemoryStorage} from "./src/game/matchStorage";

const DB_DIR = process.env.DB_DIR || process.env.FILE_DB_DIR;
if (DB_DIR) {
    fs.mkdirSync(DB_DIR, {recursive: true});
}

// The match-data wrapper intercepts createMatch / setState so a finished match
// is written to a local JSONL backup with its initialState and full log.
const games = [FilmCentenaryGame, SongJinnGameDef, VirginQueenGameDef, ImperialElegyGameDef];
const db = process.env.REDIS_URL
    ? createMatchDataStorageWrapper(new RedisStorage(process.env.REDIS_URL))
    : process.env.POSTGRES_URL
        ? createMatchDataStorageWrapper(new PostgresStore(
            process.env.POSTGRES_URL,
            {
                logging: false,
                timezone: '+08:00'
            }
        ))
        : DB_DIR
            ? createMatchDataStorageWrapper(new FlatFile({
                dir: DB_DIR,
                logging: false,
            }))
            // No external db: keep the matches in memory, still wrapped so the
            // interception hooks fire for local development.
            : createMatchDataStorageWrapper(createInMemoryStorage());

const server = Server({
    games,
    db,
    origins: [
        // Allow any domain connect.
        '*'
    ]
});


const PORT = process.env.PORT || "3002";
const {app} = server;

/**
 * Full, unredacted match log. boardgame.io strips the args of `redact: true`
 * moves before sending logs to other seats, so hidden choices never reach
 * opponents during play. Once the match is over nothing is secret any more,
 * so this route serves the stored log as-is, and only for finished matches.
 */
server.router.get('/games/:name/:id/log', async (ctx) => {
    const {name, id} = ctx.params;
    const {state, metadata, log} = await server.db.fetch(id, {state: true, metadata: true, log: true});
    if (!metadata || metadata.gameName !== name || !state) {
        ctx.throw(404, 'Match ' + id + ' not found');
    }
    if (state.ctx.gameover === undefined) {
        ctx.throw(403, 'Match ' + id + ' has not ended');
    }
    ctx.body = {
        gameName: name,
        matchID: id,
        gameover: state.ctx.gameover,
        log: log ?? [],
    };
});

const resolveStatsPath = (): string => {
    const configured = process.env.FILM_MATCH_STATS_PATH;
    if (configured && configured.trim().length > 0) {
        return configured;
    }
    const cwd = process.cwd();
    const cwdDataPath = path.resolve(cwd, 'data', 'film-match-stats.jsonl');
    const parentDataPath = path.resolve(cwd, '..', 'data', 'film-match-stats.jsonl');
    if (fs.existsSync(cwdDataPath)) {
        return cwdDataPath;
    }
    if (fs.existsSync(parentDataPath)) {
        return parentDataPath;
    }
    const cwdBaseName = path.basename(path.resolve(cwd));
    if (cwdBaseName.toLowerCase() === 'src') {
        return parentDataPath;
    }
    return cwdDataPath;
}

app.use(async (ctx: Koa.Context, next: Koa.Next) => {
    if (ctx.method === 'GET' && ctx.path === '/api/match-stats') {
        const statsPath = resolveStatsPath();
        if (!fs.existsSync(statsPath)) {
            ctx.status = 200;
            ctx.type = 'text/plain; charset=utf-8';
            ctx.body = '';
            return;
        }
        ctx.status = 200;
        ctx.type = 'text/plain; charset=utf-8';
        ctx.body = fs.readFileSync(statsPath, {encoding: 'utf8'});
        return;
    }
    await next();
});

// 根据 matchID 从本地 JSONL 备份中查找对局完整数据
app.use(async (ctx: Koa.Context, next: Koa.Next) => {
    if (ctx.method === 'GET' && ctx.path.startsWith('/api/match-data/')) {
        const matchID = ctx.path.replace('/api/match-data/', '');
        if (!matchID || matchID.includes('/')) { ctx.status = 400; ctx.body = 'invalid matchID'; return; }
        const dataDir = path.resolve(process.cwd(), 'data', 'film-match');
        if (!fs.existsSync(dataDir)) { ctx.status = 404; ctx.body = 'no match data directory'; return; }
        const files = fs.readdirSync(dataDir).filter(f => /^matches-\d+\.jsonl$/.test(f)).sort().reverse();
        let found: string | null = null;
        for (const file of files) {
            const content = fs.readFileSync(path.resolve(dataDir, file), {encoding: 'utf8'});
            const lines = content.split('\n');
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i].trim();
                if (!line) continue;
                try { const record = JSON.parse(line); if (record.matchID === matchID) { found = line; break; } } catch {}
            }
            if (found) break;
        }
        ctx.status = found ? 200 : 404;
        ctx.type = 'application/json; charset=utf-8';
        ctx.body = found || `match ${matchID} not found`;
        return;
    }
    await next();
});

// 根据玩家名查找其参与的所有对局
app.use(async (ctx: Koa.Context, next: Koa.Next) => {
    if (ctx.method === 'GET' && ctx.path.startsWith('/api/player-matches/')) {
        const playerName = decodeURIComponent(ctx.path.replace('/api/player-matches/', ''));
        if (!playerName || playerName.includes('/')) { ctx.status = 400; ctx.body = 'invalid player name'; return; }
        const ignoredNames = new Set(["0","1","2","3","P1","P2","P3","P4","","玩家0","玩家1","玩家2","玩家3"]);
        if (ignoredNames.has(playerName)) { ctx.status = 200; ctx.type = 'application/json'; ctx.body = '[]'; return; }
        const dataDir = path.resolve(process.cwd(), 'data', 'film-match');
        if (!fs.existsSync(dataDir)) { ctx.status = 200; ctx.type = 'application/json'; ctx.body = '[]'; return; }
        const results: any[] = [];
        const files = fs.readdirSync(dataDir).filter(f => /^matches-\d+\.jsonl$/.test(f)).sort().reverse();
        for (const file of files) {
            const content = fs.readFileSync(path.resolve(dataDir, file), {encoding: 'utf8'});
            const lines = content.split('\n');
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i].trim();
                if (!line) continue;
                try {
                    const record = JSON.parse(line);
                    const meta = record.metadata;
                    if (!meta || !Array.isArray(meta)) continue;
                    if (!meta.some((m: any) => m.name && m.name.toLowerCase().includes(playerName.toLowerCase()))) continue;
                    const G = record.state?.G;
                    const ctx = record.state?.ctx;
                    const gameover = ctx?.gameover;
                    const pn: Record<string,string> = G?.playerNames || {};
                    const rawTurn = ctx?.turn ?? 0;
                    results.push({
                        matchID: record.matchID, exportedAt: record.exportedAt,
                        winner: pn[gameover?.winner] || gameover?.winner,
                        rounds: rawTurn > 0 ? Math.max(0, (rawTurn - 1) / 4) : 0,
                        G, ctx,
                    });
                } catch {}
            }
        }
        ctx.status = 200; ctx.type = 'application/json'; ctx.body = JSON.stringify(results);
        return;
    }
    await next();
});

const FRONTEND_PATH = path.join(__dirname);
app.use(
    serve(FRONTEND_PATH, {
        setHeaders: (res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
        },
    })
);

server.run(
    {
        port: parseInt(PORT),
    },
    () => {
        // rewrite rule for catching unresolved routes and redirecting to index.html
        // for client-side routing
        server.app.use(async (ctx: Koa.Context, next: Koa.Next) => {
            console.log(`${ctx.method}|${ctx.host}${ctx.url}|${ctx.ip}|${JSON.stringify(ctx.ips)}`)
            await serve("build")(
                Object.assign(ctx, {path: 'index.html'}),
                next
            );
        });
    }
).then(
    r => console.log(
        `boardgames server started|${JSON.stringify(r)}`
    )
)
