// const {Pool} = require('pg');
// const fs = require('fs');
// const connectionString = process.env.POSTGRES_URL;
// const matchID = 'iyM2J3pSu';
// let mid3 = '2ZvEje8DpEI'; // LES_CHAIERS_DU_CINEMA
// const pool = new Pool({
//     connectionString,
// });
// const query = `SELECT log,state#>'{ctx,numPlayers}' AS num,state#>'{plugins,random,data,seed}' AS seed FROM "public"."Games" WHERE id = '${mid3}' LIMIT 1;`
// pool.query(query, (err, res) => {
//     if (err) {
//         console.log(err);
//     } else {
//         console.log(res.rows[0]['seed']);
//         console.log(res.rows[0]['num']);
//         const log = res.rows[0]['log'].filter(l => l.type !== 'GAME_EVENT').map(l => {
//             const pid = l.action.payload.playerID
//
//             switch (l.action.type) {
//                 case "MAKE_MOVE":
//                     const moveName = l.action.payload.type
//                     if (moveName === 'requestEndTurn') {
//                         return `p${pid}.moves.requestEndTurn("${pid}");`
//                     } else {
//                         if (l.action.payload.args === null) {
//                             return `p${pid}.moves.${moveName}([]);`
//                         } else {
//                             return `p${pid}.moves.${moveName}(${JSON.stringify(l.action.payload.args[0])});`
//                         }
//                     }
//                 case "UNDO":
//                     return `p${pid}.undo();`
//                 case "REDO":
//                     return `p${pid}.redo();`
//                 default:
//                     return ""
//             }
//         }).join("\r\n");
//         fs.writeFile(`${mid3}.test.js`, log, function (err) {
//             if (err) {
//                 return console.log(err);
//             }
//             console.log("The file was saved!");
//         });
//     }
//     pool.end()
// })

// const client = new Client({
//     connectionString,
// })
// client.connect()
// client.query('SELECT NOW()', (err, res) => {
//     console.log(err, res)
//     client.end()
// })
const redisURL = process.env.REDIS_URL;
const matchPrefix = 'match:'
const matchID = '4hl2A-9WqnQ';
const Redis = require("ioredis");
const redis = new Redis(redisURL);
redis.get(`${matchPrefix}${matchID}:state`, (err, result) => {
    if (err) {
        console.error(err);
    } else {
        console.log(result); // Prints "value"
    }
});
redis.lrange(`${matchPrefix}${matchID}:log`, 0, -1, (err, result) => {
    if (err) {
        console.error(err);
    } else {
        console.log(result); // Prints "value"
    }
});
redis.get(`${matchPrefix}${matchID}:metadata`, (err, result) => {
    if (err) {
        console.error(err);
    } else {
        console.log(result); // Prints "value"
    }
});
redis.get(`${matchPrefix}${matchID}:initialState`, (err, result) => {
    if (err) {
        console.error(err);
    } else {
        console.log(result); // Prints "value"
    }
});
redis.quit();
