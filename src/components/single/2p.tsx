import React from "react";

import {Client} from "boardgame.io/react";
import {FilmCentenaryGame} from "../../Game";
import {FilmCentenaryBoard} from "../board";
import Grid from "@material-ui/core/Grid"

const FilmClient2pSingle = Client({
    numPlayers: 2,
    game: FilmCentenaryGame,
    board: FilmCentenaryBoard,
    debug: true,
});

const SinglePlayer = () => <Grid container>
    <Grid item> <FilmClient2pSingle playerID='0'/></Grid>
</Grid>

export default SinglePlayer;
