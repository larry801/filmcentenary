import * as React from "react";
import { render } from "react-dom";

import {Client} from "boardgame.io/react";
import {FilmCentenaryGame} from "./Game";
import {FilmCentenaryBoard} from "./components/board";
import {Grid} from "@material-ui/core";
const FilmClient = Client(
    {game: FilmCentenaryGame, board: FilmCentenaryBoard}
);
const rootElement = document.getElementById("root");
render(
 <div>
        <Grid container>
            <Grid item> <FilmClient playerID='0'/></Grid>
            <Grid item> <FilmClient playerID='1'/></Grid>
        </Grid>
    </div>, rootElement
);
