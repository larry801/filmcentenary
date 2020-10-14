import React from "react";

import {Client} from "boardgame.io/react";
import {FilmCentenaryGame} from "../../Game";
import {FilmCentenaryBoard} from "../board";
import Grid from "@material-ui/core/Grid"

const FilmClient4pSingle = Client({
    numPlayers: 4,
    game: FilmCentenaryGame,
    board: FilmCentenaryBoard,
    debug: true,
});


const SinglePlayer4p = () => <Grid container>
    <Grid item> <FilmClient4pSingle playerID='0'/></Grid>
</Grid>

export default SinglePlayer4p;
