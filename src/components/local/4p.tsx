import React from "react";

import {Client} from "boardgame.io/react";
import {FilmCentenaryGame} from "../../Game";
import {FilmCentenaryBoard} from "../board";
import Grid from "@material-ui/core/Grid"
import {Local} from "boardgame.io/multiplayer";

const FilmClient4p = Client(
    {
        numPlayers: 4,
        game: FilmCentenaryGame,
        board: FilmCentenaryBoard,
        debug: false,
        // @ts-ignore
        multiplayer: Local(),
    }
);
const FourPlayerLocal = () => <Grid container>
    <Grid item> <FilmClient4p playerID='0'/></Grid>
    <Grid item> <FilmClient4p playerID='1'/></Grid>
    <Grid item> <FilmClient4p playerID='2'/></Grid>
    <Grid item> <FilmClient4p playerID='3'/></Grid>
</Grid>
export default FourPlayerLocal;
