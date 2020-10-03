import * as React from "react";
import { render } from "react-dom";

import {Client} from "boardgame.io/react";
import {FilmCentenaryGame} from "./Game";
import {FilmCentenaryBoard} from "./components/board";
import {Grid} from "@material-ui/core";
import { Local} from "boardgame.io/multiplayer";
import Lobby from './components/lobby'

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

     {true?<Lobby/>:<></>}
 </div>, rootElement
);
