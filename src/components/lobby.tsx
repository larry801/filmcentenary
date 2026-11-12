import React from "react";

import { Lobby } from 'boardgame.io/react';
import { FilmCentenaryBoard } from './board';
import {FilmCentenaryGame} from "../Game";
import {SongJinnGameDef} from "../songJinn/game";
import {SongJinnBoard} from "../songJinn/components/board";
import {ImperialElegyGameDef} from "../imperialElegy/game";
import {ImperialElegyBoard} from "../imperialElegy/components/board";

const server = `${window.location.protocol}//${window.location.host}`;
const importedGames = [
    { game: FilmCentenaryGame, board: FilmCentenaryBoard },
    { game: SongJinnGameDef, board: SongJinnBoard},
    { game: ImperialElegyGameDef, board: ImperialElegyBoard},
];

export default  () => (
    <div>
        <Lobby
            gameServer={server} lobbyServer={server} gameComponents={importedGames}
            refreshInterval={5000}
        />
    </div>
);
