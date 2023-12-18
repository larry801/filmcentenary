const redisURL = process.env.REDIS_URL;
const matchPrefix = 'match:'
const matchID = 'YLFh9qMbn8_';
const Redis = require("ioredis");
const redis = new Redis(redisURL);
const fs = require('node:fs');

function fn(content) {
    try {
        fs.writeFile(`./src/songJinn/${matchID}.test.ts`,
            content, { flag: 'a+' },
                err => {
            console.log(err);
        });
    } catch (err) {
        console.log(err);
    }
}

let seed = '';
redis.get(`${matchPrefix}${matchID}:state`, (err, result) => {
    if (err) {
        console.error(err);
    } else {
        // console.log(result); // Prints "value"
        const r = JSON.parse(result);
        console.log(JSON.stringify(r.ctx))
        seed = r.plugins.random.data.seed;
        console.log(seed);
    }
});
redis.lrange(`${matchPrefix}${matchID}:log`, 0, -1, (err, result) => {
    if (err) {
        console.error(err);
    } else {
        // console.log(result); // Prints "value"
        const a = result.map(l => JSON.parse(l)).filter(l => l.type !== 'GAME_EVENT').map(l => {
            const pid = l.action.payload.playerID

            switch (l.action.type) {
                case "MAKE_MOVE":
                    const moveName = l.action.payload.type
                    if (moveName === 'requestEndTurn') {
                        return `p${pid}.moves.requestEndTurn("${pid}");`
                    } else {
                        if (l.action.payload.args === null) {
                            return `p${pid}.moves.${moveName}([]);`
                        } else {
                            return `p${pid}.moves.${moveName}(${JSON.stringify(l.action.payload.args[0])});`
                        }
                    }
                case "UNDO":
                    return `p${pid}.undo();`
                case "REDO":
                    return `p${pid}.redo();`
                default:
                    return ""
            }
        }).join("\r\n");
        const content = `import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer'
import {SongJinnGameDef} from './game';
import {SongJinnGame} from "./constant/general";
import {Ctx} from "boardgame.io";

const gameWithSeed = (seed: string) => ({
    ...SongJinnGameDef,
    seed
});

// @ts-ignore
it('${matchID}', () => {
    const spec = {
        numPlayers: 2,
        game: gameWithSeed("${seed}"),
        multiplayer: Local(),
    };
    const p0 = Client<SongJinnGame, Ctx>({...spec, playerID: '0'} as any) as any;
    const p1 = Client<SongJinnGame, Ctx>({...spec, playerID: '1'} as any) as any;
    p0.start();
    p1.start();
    ${a}
    p0.stop();
    p1.stop();
});`;
        fn(content);
    }
});
// redis.get(`${matchPrefix}${matchID}:metadata`, (err, result) => {
//     if (err) {
//         console.error(err);
//     } else {
//         console.log(result); // Prints "value"
//
//     }
// });
// redis.get(`${matchPrefix}${matchID}:initialState`, (err, result) => {
//     if (err) {
//         console.error(err);
//     } else {
//         console.log(result); // Prints "value"
//     }
// });
redis.quit();
