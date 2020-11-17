import React from "react";

import {Client} from "boardgame.io/react";
import {FilmCentenaryGame} from "../../Game";
import {FilmCentenaryBoard} from "../board";
import Grid from "@material-ui/core/Grid"
import {Local} from "boardgame.io/multiplayer";
import {Loading} from "../join/multiplayer";

const FilmClient2p = Client({
    board: FilmCentenaryBoard,
    debug: true,
    game: FilmCentenaryGame,
    loading: Loading,
    multiplayer: Local(),
    numPlayers: 2,
});
const TwoPlayerLocal = () => <Grid container>
    <Grid item> <FilmClient2p playerID='0'/></Grid>
    <Grid item> <FilmClient2p playerID='1'/></Grid>
</Grid>

export default TwoPlayerLocal;
