import React from "react";
import {SocketIO} from 'boardgame.io/multiplayer';
import {Client} from 'boardgame.io/react';
import {FilmCentenaryGame, Player} from "../../Game";
import {FilmCentenaryBoard} from "../board";
import CircularProgress from "@mui/material/CircularProgress";
import {SongJinnGameDef} from "../../songJinn/game";
import {SongJinnBoard} from "../../songJinn/components/board";
import {VirginQueenGameDef} from "../../virginQueen/game";
import {VirginQueenBoard} from "../../virginQueen/components/board";

interface ISpectateProps {
    matchID: string,
    server: string,
    gameName: string,
}

interface MultiplayerProps {
    serverURL: string;
    matchID: string;
    player?: Player;
    credentials?: string;
    gameName: string;
}

export const Loading = () => {
    return <CircularProgress size="20%"/>;
}

const clientFor = (gameName: string, server: string) => {
    if (gameName === 'virginQueen') {
        return Client({
            game: VirginQueenGameDef,
            board: VirginQueenBoard,
            multiplayer: SocketIO({server: server}),
            loading: Loading,
        });
    }
    if (gameName === 'film') {
        return Client({
            game: FilmCentenaryGame,
            board: FilmCentenaryBoard,
            multiplayer: SocketIO({server: server}),
            loading: Loading,
        });
    }
    return Client({
        game: SongJinnGameDef,
        board: SongJinnBoard,
        multiplayer: SocketIO({server: server}),
        loading: Loading,
    });
};

export const Spectate = ({matchID, server, gameName}: ISpectateProps) => {
    const SpectateClient = clientFor(gameName, server);
    return <SpectateClient matchID={matchID}/>;
}

export const MultiPlayer = ({matchID, serverURL, credentials, player, gameName}: MultiplayerProps) => {
    const MultiplayerClient = clientFor(gameName, serverURL);
    return <>
        <MultiplayerClient
            matchID={matchID}
            playerID={player}
            credentials={credentials}
            debug={false}
        />
    </>
}

export default MultiPlayer;
