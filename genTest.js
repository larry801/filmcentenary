const redisURL = process.env.REDIS_URL;
const matchPrefix = 'match:'
const matchID = 'YLFh9qMbn8_';
const Redis = require("ioredis");
const redis = new Redis(redisURL);
const fs = require('node:fs');

function fn(content) {
    try {
        fs.writeFile(`./src/songJinn/${matchID}.test.ts`,
            content, { flag: 'w+' },
                err => {
            console.log(err);
        });
    } catch (err) {
        console.log(err);
    }
}

let seed = 'lqac5xab';
let r;
redis.get(`${matchPrefix}${matchID}:state`, (err, result) => {
    if (err) {
        console.error(err);
    } else {
        console.log(result); // Prints "value"
        r = JSON.parse(result);
        // console.log(JSON.stringify(r.ctx))
        seed = r.plugins.random.data.seed;
        console.log(seed);
        console.log(JSON.stringify(r.G.secret))
        console.log(JSON.stringify(r.G.player['1']))
        console.log(JSON.stringify(r.G.player['0']))
        console.log(JSON.stringify(r.G.jinn.generalPlace))
        console.log(JSON.stringify(r.G.song.generalPlace))
    }
});
// redis.set(`${matchPrefix}${matchID}:state`,JSON.stringify(r), (err, result) => {
//     if (err) {
//         console.error(err);}else{
//
//         console.log(result);
//     }
// });
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
                        const arg = l.action.payload.args;
                        if (arg === null || arg === undefined || arg.length === 0) {
                            return `p${pid}.moves.${moveName}();`
                        } else {
                            return `p${pid}.moves.${moveName}(${JSON.stringify(arg[0])});`
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

function cs(p0: any) {
    console.log(JSON.stringify(p0.getState().G.combat));
    console.log(JSON.stringify(p0.getState().ctx));
}

const gameWithSeed = (seed: string) => ({
    ...SongJinnGameDef,
    seed
});

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
redis.get(`${matchPrefix}${matchID}:metadata`, (err, result) => {
    if (err) {
        console.error(err);
    } else {
        console.log(result); // Prints "value"
        const res = JSON.parse(result);
        console.log(`http://49.232.162.167:3004/join/songJinn/${matchID}/0/${res.players['0'].credentials}`);
        console.log(`http://49.232.162.167:3004/join/songJinn/${matchID}/1/${res.players['1'].credentials}`);
    }
});
// redis.get(`${matchPrefix}${matchID}:initialState`, (err, result) => {
//     if (err) {
//         console.error(err);
//     } else {
//         console.log(result); // Prints "value"
//     }
// });
redis.quit();
