import path from 'path';
import * as Koa from "koa"
import serve from 'koa-static';
import KoaRatelimit from 'koa-ratelimit';
import { v4 as uuidv4 } from 'uuid';
import {FilmCentenaryGame} from "./src/Game";
import {log} from "winston";

const Server = require('boardgame.io/server').Server;
const server = Server({ games: [FilmCentenaryGame], generateCredentials: () => uuidv4() });

const PORT = process.env.PORT || 3000;
const { app } = server;

const FRONTEND_PATH = path.join(__dirname);
app.use(
    serve(FRONTEND_PATH, {
        setHeaders: (res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
        },
    })
);

function randomString(length:number, chars:string) {
    let result = '';
    // @ts-ignore
    for (let i = length; i > 0; --i)
        result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

// rate limiter
const db = new Map();
app.use(
    KoaRatelimit({
        driver: 'memory',
        db: db,
        // 1 min window
        duration: 6000,
        errorMessage: 'Too many requests',
        id: (ctx:Koa.Context) => ctx.ip,
        max: 36,
    })
);

server.run(
    {
        port: PORT,
        lobbyConfig: { uuid: () => "password"},
    },
    () => {
        // rewrite rule for catching unresolved routes and redirecting to index.html
        // for client-side routing
        server.app.use(async (ctx:Koa.Context, next:Koa.Next) => {
            console.log(ctx.ip + JSON.stringify(ctx.ips))
            await serve("build")(
                Object.assign(ctx, { path: 'index.html' }),
                next
            );
        });
    }
);
