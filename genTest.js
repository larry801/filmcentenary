const {Pool, Client} = require('pg')
const connectionString = 'postgresql://bgio:aJP7wrd6BuQ9XQmhcPyGbug4@49.232.162.167:5436/bgio'
const matchID = 'iyM2J3pSu';
const pool = new Pool({
    connectionString,
})
// const query = `SELECT state#>'{plugins,random,data,seed}' FROM "public"."Games" WHERE id = '${matchID}' LIMIT 1;`
const query = `SELECT log FROM "public"."Games" WHERE id = '${matchID}' LIMIT 1;`
pool.query(query, (err, res) => {
    // console.log(res.rows[0]['?column?'])
    console.log(res)
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
