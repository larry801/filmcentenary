import React from "react";

import { Lobby } from 'boardgame.io/react';
import { FilmCentenaryBoard } from './board';
import {FilmCentenaryGame} from "../Game";
import {SongJinnGameDef} from "../songJinn/game";
import {SongJinnBoard} from "../songJinn/components/board";

const server = `${window.location.protocol}//${window.location.host}`;
const importedGames = [
    { game: FilmCentenaryGame, board: FilmCentenaryBoard },
    { game: SongJinnGameDef, board: SongJinnBoard},
];

export default  () => (
    <div>
        <Lobby
            gameServer={server} lobbyServer={server} gameComponents={importedGames}
            refreshInterval={5000}
        />
    </div>
);
