import React from "react";

import {Client} from "boardgame.io/react";
import {FilmCentenaryGame} from "../../Game";
import {FilmCentenaryBoard} from "../board";
import Grid from "@mui/material/Grid"
import {Local} from "boardgame.io/multiplayer";
import {Loading} from "../join/multiplayer";

const FilmClient4p = Client(
    {
        numPlayers: 4,
        game: FilmCentenaryGame,
        board: FilmCentenaryBoard,
        debug: false,
        loading: Loading,
        multiplayer: Local(),
    }
);
const FourPlayerLocal = () => <Grid container>
    <Grid> <FilmClient4p playerID='0'/></Grid>
    <Grid> <FilmClient4p playerID='1'/></Grid>
    <Grid> <FilmClient4p playerID='2'/></Grid>
    <Grid> <FilmClient4p playerID='3'/></Grid>
</Grid>
export default FourPlayerLocal;
