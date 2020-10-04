import * as React from "react";
import { render } from "react-dom";

import {Client} from "boardgame.io/react";
import {FilmCentenaryGame} from "./Game";
import {FilmCentenaryBoard} from "./components/board";
import {Grid} from "@material-ui/core";
import { Local} from "boardgame.io/multiplayer";
// eslint-disable-next-line
import Lobby from './components/lobby'
// eslint-disable-next-line
import {DenseTable} from "./components/cardreference";

const FilmClient = Client(
    {
        numPlayers: 3,
        game: FilmCentenaryGame,
        board: FilmCentenaryBoard,
        debug: false,
        // @ts-ignore
        multiplayer:Local(),
    }
);
const rootElement = document.getElementById("root");
render(
 <div>
     {/*<DenseTable/>*/}
     {/*<Grid container*/}
     {/*      direction="column"*/}
     {/*      justify="space-evenly"*/}
     {/*      alignItems="baseline">*/}
     {/*    <Grid item> <FilmClient playerID='0'/></Grid>*/}
     {/*    <Grid item> <FilmClient playerID='1'/></Grid>*/}
     {/*    <Grid item> <FilmClient playerID='2'/></Grid>*/}
     {/*</Grid>*/}
    <Lobby/>
 </div>, rootElement
);
