import React from "react";

import {Client} from "boardgame.io/react";
import Grid from "@material-ui/core/Grid"
import {Local} from "boardgame.io/multiplayer"
import {SJPlayer} from "../constant/general";
import {SongJinnGameDef} from "../game";
import {SongJinnBoard} from "./board";

const SongJinnLocal = Client({
    numPlayers: 2,
    game: SongJinnGameDef,
    board: SongJinnBoard,
    multiplayer: Local(),
    debug: true,
});

const SinglePlayer = () => <Grid container>
    <Grid item> <SongJinnLocal matchID={'local'} playerID={SJPlayer.P1}/></Grid>
    <Grid item> <SongJinnLocal matchID={'local'} playerID={SJPlayer.P2}/></Grid>
</Grid>

export default SinglePlayer;
