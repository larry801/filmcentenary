import path from 'path';
import * as Koa from "koa"
import serve from 'koa-static';
import {FilmCentenaryGame} from "./src/Game";
import {Server, FlatFile} from "boardgame.io/server";
import RedisStorage from "./ioredis-stroage";
import {PostgresStore} from "bgio-postgres"
import {SongJinnGameDef} from "./src/songJinn/game";
import {VirginQueenGameDef} from "./src/virginQueen/game";
import fs from 'fs';

const DB_DIR = process.env.DB_DIR || process.env.FILE_DB_DIR;
if (DB_DIR) {
    fs.mkdirSync(DB_DIR, {recursive: true});
}

const server = process.env.REDIS_URL ? Server({
    games: [FilmCentenaryGame,SongJinnGameDef,VirginQueenGameDef],
    db: new RedisStorage(process.env.REDIS_URL),
    origins: [
        // Allow any domain connect.
        '*'
    ]
}) : process.env.POSTGRES_URL ? Server({
    games: [FilmCentenaryGame,SongJinnGameDef,VirginQueenGameDef],
    db: new PostgresStore(
        process.env.POSTGRES_URL,
        {
            logging: false,
            timezone: '+08:00'
        }
    ),
    origins: [
        // Allow any domain connect.
        '*'
    ]
}) : DB_DIR ? Server({
    games: [FilmCentenaryGame,SongJinnGameDef,VirginQueenGameDef],
    db: new FlatFile({
        dir: DB_DIR,
        logging: false,
    }),
    origins: [
        // Allow any domain connect.
        '*'
    ]
}) : Server({
    games: [FilmCentenaryGame,SongJinnGameDef,VirginQueenGameDef],
    origins: [
        // Allow any domain connect.
        '*'
    ]
});


const PORT = process.env.PORT || "3000";
const {app} = server;

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
