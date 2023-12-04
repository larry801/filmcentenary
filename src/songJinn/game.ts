import {Ctx, Game, PlayerID} from "boardgame.io";
import {setupSongJinn, SongJinnGame} from "./constant/setup";
import {PlayerView} from "boardgame.io/core";

export const SongJinnGameDef: Game<SongJinnGame> = {
    setup: setupSongJinn,
    name: "songjinn",
    minPlayers: 2,
    maxPlayers: 2,
    playerView: PlayerView.STRIP_SECRETS,

}