import React from "react";

import {Client} from "boardgame.io/react";
import {FilmCentenaryGame} from "../../Game";
import {FilmCentenaryBoard} from "../board";
import Grid from "@mui/material/Grid"
import {Local} from "boardgame.io/multiplayer"

const FilmClient2pSingle = Client({
    numPlayers: 2,
    game: FilmCentenaryGame,
    board: FilmCentenaryBoard,
    multiplayer: Local(),
    debug: true,
});

const SinglePlayer = () => <Grid container>
    <Grid> <FilmClient2pSingle playerID='0'/></Grid>
    <Grid> <FilmClient2pSingle playerID='1'/></Grid>
</Grid>

export default SinglePlayer;
