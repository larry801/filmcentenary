import path from 'path';
import * as Koa from "koa"
import serve from 'koa-static';
import {FilmCentenaryGame} from "./src/Game";
import {Server, FlatFile} from "boardgame.io/server";


const server = Server({
    games: [FilmCentenaryGame],
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
            console.log(ctx.ip + JSON.stringify(ctx.ips))
            await serve("build")(
                Object.assign(ctx, {path: 'index.html'}),
                next
            );
        });
    }
)
