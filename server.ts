import path from 'path';
import * as Koa from "koa"
import serve from 'koa-static';
import {FilmCentenaryGame} from "./src/Game";
import {Server} from "boardgame.io/server";
import {PostgresStore} from "bgio-postgres";

const pgURL = process.env.POSTGRES_URL ? process.env.POSTGRES_URL : "postgresql://bgio:aJP7wrd6BuQ9XQmhcPyGbug4@49.232.162.167:5436/bgio";

const db = new PostgresStore(
    pgURL,
    {
        logging: false,
        timezone: '+08:00'
    }
);

const server = Server({
    games: [FilmCentenaryGame],
    db,
    // generateCredentials:()=>"generateCredentials",
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
            console.log(`${ctx.method}|${ctx.url}|${ctx.ip}|${JSON.stringify(ctx.ips)}`)
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
