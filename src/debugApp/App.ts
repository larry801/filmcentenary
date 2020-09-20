import { Client } from "boardgame.io/react";
import { FilmCentenaryGame } from "../Game";
import {FilmCentenaryBoard} from "../components/board";

export default Client({ game: FilmCentenaryGame, board: FilmCentenaryBoard });
