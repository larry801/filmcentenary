import { Client } from "boardgame.io/react";
import { DemoGame } from "./Game";
import { DemoBoard } from "./Board";

export default Client({ game: DemoGame, board: DemoBoard });
