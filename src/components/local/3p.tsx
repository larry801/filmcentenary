import React from "react";

import {Client} from "boardgame.io/react";
import {FilmCentenaryGame} from "../../Game";
import {FilmCentenaryBoard} from "../board";
import Grid from "@mui/material/Grid"
import {Local} from "boardgame.io/multiplayer";
import {Loading} from "../join/multiplayer";

const FilmClient3p = Client(
    {
        numPlayers: 3,
        game: FilmCentenaryGame,
        board: FilmCentenaryBoard,
        debug: false,
        loading: Loading,
        multiplayer: Local(),
    }
);
const ThreePlayerLocal = () => <Grid container>
    <Grid> <FilmClient3p playerID='0'/></Grid>
    <Grid> <FilmClient3p playerID='1'/></Grid>
    <Grid> <FilmClient3p playerID='2'/></Grid>
</Grid>
export default ThreePlayerLocal;
