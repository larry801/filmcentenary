import React from "react";

import {Client} from "boardgame.io/react";
import {FilmCentenaryGame} from "../../Game";
import {FilmCentenaryBoard} from "../board";
import Grid from "@mui/material/Grid"
import { Local } from 'boardgame.io/multiplayer';

const FilmClient4pSingle = Client({
    numPlayers: 4,
    game: FilmCentenaryGame,
    board: FilmCentenaryBoard,
    multiplayer: Local(),
    debug: false,
});

const single4PMatchId = "single_4p"

const SinglePlayer4p = () => <Grid container>
    <Grid> <FilmClient4pSingle playerID='0' credentials={'1'} matchID={single4PMatchId} debug={false}/></Grid>
    <Grid> <FilmClient4pSingle playerID='1' credentials={'1'} matchID={single4PMatchId} debug={false}/></Grid>
    <Grid> <FilmClient4pSingle playerID='2' credentials={'1'} matchID={single4PMatchId} debug={false}/></Grid>
    <Grid> <FilmClient4pSingle playerID='3' credentials={'1'} matchID={single4PMatchId} debug={false}/></Grid>
</Grid>

export default SinglePlayer4p;
