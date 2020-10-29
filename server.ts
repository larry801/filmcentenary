import path from 'path';
import * as Koa from "koa"
import serve from 'koa-static';
import KoaRatelimit from 'koa-ratelimit';
import {v4 as uuidv4} from 'uuid';
import {FilmCentenaryGame} from "./src/Game";

import {Server, FlatFile} from "boardgame.io/server";

export class NoWipeFlatFile extends FlatFile {
    async wipe(id: string) {
        console.log(`tryingToWipe|${id}`)
    }
}

const server = Server({
    games: [FilmCentenaryGame],
    generateCredentials: () => uuidv4(),
    db: new NoWipeFlatFile({
        dir: '/app/store',
        logging: true,
        ttl: false,
    }),
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

// rate limiter
const db = new Map();
app.use(
    KoaRatelimit({
        driver: 'memory',
        db: db,
        // 1 min window
        duration: 6000,
        errorMessage: 'Too many requests',
        id: (ctx: Koa.Context) => ctx.ip,
        max: 36,
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
            console.log(ctx.ip + JSON.stringify(ctx.ips))
            await serve("build")(
                Object.assign(ctx, {path: 'index.html'}),
                next
            );
        });
    }
)
