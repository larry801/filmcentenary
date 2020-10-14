import React from "react";

import {Client} from "boardgame.io/react";
import {FilmCentenaryGame} from "../../Game";
import {FilmCentenaryBoard} from "../board";
import Grid from "@material-ui/core/Grid"

const FilmClient3pSingle = Client(
    {
        numPlayers: 3,
        game: FilmCentenaryGame,
        board: FilmCentenaryBoard,
        debug: true,
    })

const SinglePlayer3p = () => <Grid container>
    <Grid item> <FilmClient3pSingle playerID='0'/></Grid>
</Grid>

export default SinglePlayer3p;
