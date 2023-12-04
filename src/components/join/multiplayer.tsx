import React from "react";
import {SocketIO} from 'boardgame.io/multiplayer';
import {Client} from 'boardgame.io/react';
import {FilmCentenaryGame, Player} from "../../Game";
import {FilmCentenaryBoard} from "../board";
import CircularProgress from "@material-ui/core/CircularProgress";
import {SongJinnGameDef} from "../../songJinn/game";
import {SongJinnBoard} from "../../songJinn/components/board";

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

export const Spectate = ({matchID, server, gameName}: ISpectateProps) => {
    const SpectateClient = gameName === 'film' ? Client({
        game:FilmCentenaryGame,
        board: FilmCentenaryBoard,
        multiplayer: SocketIO({ server: server }),
        loading: Loading,
    }) : Client({
        game: SongJinnGameDef,
        board: SongJinnBoard,
        multiplayer: SocketIO({ server: server }),
        loading: Loading,
    })
    return <SpectateClient matchID={matchID}/>
}

export const MultiPlayer = ({matchID,serverURL,credentials,player,gameName}:MultiplayerProps) =>{

    const MultiplayerClient = gameName === 'film' ? Client({
        game:FilmCentenaryGame,
        board: FilmCentenaryBoard,
        multiplayer: SocketIO({ server: serverURL }),
        loading: Loading,
    }) : Client({
        game: SongJinnGameDef,
        board: SongJinnBoard,
        multiplayer: SocketIO({ server: serverURL }),
        loading: Loading,
    })

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
