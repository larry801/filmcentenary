import React from 'react';

import { Lobby } from 'boardgame.io/react';
import { FilmCentenaryBoard } from './board';
import {FilmCentenaryGame} from "../Game";

const server = `${window.location.protocol}://${window.location.hostname}:${window.location.port}`;
const importedGames = [{ game: FilmCentenaryGame, board: FilmCentenaryBoard }];

export const MUILobby = ()=>{

}

export default () => (
    <div>
        <h1>Lobby</h1>
        <Lobby gameServer={server} lobbyServer={server} gameComponents={importedGames} />
    </div>
);
