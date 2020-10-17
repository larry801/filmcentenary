import React from "react";
import {SocketIO} from 'boardgame.io/multiplayer';
import {Client} from 'boardgame.io/react';
import {FilmCentenaryGame, Player} from "../../Game";
import {FilmCentenaryBoard} from "../board";
import CircularProgress from "@material-ui/core/CircularProgress";
import { Debug } from 'boardgame.io/debug';

interface ISpectateProps {
    matchID: string,
    server: string,
}

interface MultiplayerProps {
    serverURL: string;
    matchID: string;
    player?: Player;
    credentials?: string;
}

export const Loading = () => {
    return <CircularProgress/>;
}

export const Spectate = ({matchID, server}: ISpectateProps) => {
    const SpectateClient = Client({
        game: FilmCentenaryGame,
        board: FilmCentenaryBoard,
        multiplayer: SocketIO({server: server}),
        loading: Loading,
    });
    return <SpectateClient matchID={matchID}/>
}

export const MultiPlayer = ({matchID,serverURL,credentials,player}:MultiplayerProps) =>{

    const MultiplayerClient = Client({
        game:FilmCentenaryGame,
        board: FilmCentenaryBoard,
        multiplayer: SocketIO({ server: serverURL }),
        debug: { impl: Debug }
    });

    return <>
        <MultiplayerClient
            matchID={matchID}
            playerID={player}
            credentials={credentials}
            debug={true}/>
    </>
}
