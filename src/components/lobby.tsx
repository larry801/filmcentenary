import React from 'react';
import { Lobby } from 'boardgame.io/react';
import { FilmCentenaryBoard } from './board';
import {FilmCentenaryGame} from "../Game";

const server = `http://${window.location.hostname}:3000`;
const importedGames = [{ game: FilmCentenaryGame, board: FilmCentenaryBoard }];

export default () => (
    <div>
        <h1>Lobby</h1>
        <Lobby gameServer={server} lobbyServer={server} gameComponents={importedGames} />
    </div>
);
