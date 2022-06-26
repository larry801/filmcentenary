import React from "react";

import {Client} from "boardgame.io/react";
import {FilmCentenaryGame} from "../../Game";
import {FilmCentenaryBoard} from "../board";
import Grid from "@material-ui/core/Grid"

const FilmClient4pSingle = Client({
    numPlayers: 4,
    game: FilmCentenaryGame,
    board: FilmCentenaryBoard,
    debug: false,
    // debug: true,
});

const single4PMatchId = "single_4p"

const SinglePlayer4p = () => <Grid container>
    <Grid item> <FilmClient4pSingle playerID='0' credentials={'1'} matchID={single4PMatchId} debug={false}/></Grid>
    <Grid item> <FilmClient4pSingle playerID='1' credentials={'1'} matchID={single4PMatchId} debug={false}/></Grid>
    <Grid item> <FilmClient4pSingle playerID='2' credentials={'1'} matchID={single4PMatchId} debug={false}/></Grid>
    <Grid item> <FilmClient4pSingle playerID='3' credentials={'1'} matchID={single4PMatchId} debug={false}/></Grid>
</Grid>

export default SinglePlayer4p;
