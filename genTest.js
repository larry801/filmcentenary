const {Pool, Client} = require('pg');
const fs = require('fs');
const connectionString = 'postgresql://bgio:aJP7wrd6BuQ9XQmhcPyGbug4@49.232.162.167:5436/bgio'
const matchID = 'iyM2J3pSu';

let mid2 = 'FNhRme54O'; // competition bug
let mid3 = 'jYFjTuCzX'; // No era 3 events
const pool = new Pool({
    connectionString,
})
// const query = `SELECT state#>'{plugins,random,data,seed}' AS seed FROM "public"."Games" WHERE id = '${matchID}' LIMIT 1;`
const query = `SELECT log FROM "public"."Games" WHERE id = '${mid3}' LIMIT 1;`
pool.query(query, (err, res) => {
    const log = res.rows[0]['log'].filter(l => l.type !== 'GAME_EVENT').map(l => {
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
    // console.log(res.rows[0]['seed'])
    // console.log(log)
    fs.writeFile(`${mid3}.test.js`, log, function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("The file was saved!");
    });
    pool.end()
})
// const client = new Client({
//     connectionString,
// })
// client.connect()
// client.query('SELECT NOW()', (err, res) => {
//     console.log(err, res)
//     client.end()
// })
