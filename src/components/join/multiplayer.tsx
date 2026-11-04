import React from "react";
import {SocketIO} from 'boardgame.io/multiplayer';
import {Client} from 'boardgame.io/react';
import type {Player} from "../../Game";
import CircularProgress from "@mui/material/CircularProgress";

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

type GameClient = React.ComponentType<any>;

const buildClient = async (gameName: string, server: string): Promise<GameClient> => {
    if (gameName === 'virginQueen') {
        const [{VirginQueenGameDef}, {VirginQueenBoard}] = await Promise.all([
            import("../../virginQueen/game"),
            import("../../virginQueen/components/board"),
        ]);
        return Client({
            game: VirginQueenGameDef,
            board: VirginQueenBoard,
            multiplayer: SocketIO({server: server}),
            loading: Loading,
        });
    }
    if (gameName === 'film') {
        const [{FilmCentenaryGame}, {FilmCentenaryBoard}] = await Promise.all([
            import("../../Game"),
            import("../board"),
        ]);
        return Client({
            game: FilmCentenaryGame,
            board: FilmCentenaryBoard,
            multiplayer: SocketIO({server: server}),
            loading: Loading,
        });
    }
    const [{SongJinnGameDef}, {SongJinnBoard}] = await Promise.all([
        import("../../songJinn/game"),
        import("../../songJinn/components/board"),
    ]);
    return Client({
        game: SongJinnGameDef,
        board: SongJinnBoard,
        multiplayer: SocketIO({server: server}),
        loading: Loading,
    });
};

// Cache the promise so each game is imported once per server, even when both
// the player and spectator views mount at the same time.
const clientCache = new Map<string, Promise<GameClient>>();

const clientFor = (gameName: string, server: string) => {
    const key = `${gameName}|${server}`;
    let client = clientCache.get(key);
    if (!client) {
        client = buildClient(gameName, server);
        clientCache.set(key, client);
    }
    return client;
};

const useGameClient = (gameName: string, server: string) => {
    const [gameClient, setGameClient] = React.useState<GameClient | null>(null);
    const [error, setError] = React.useState("");
    React.useEffect(() => {
        let active = true;
        setGameClient(null);
        setError("");
        clientFor(gameName, server)
            .then((client) => {
                if (active) setGameClient(() => client);
            })
            .catch((err) => {
                if (active) setError(String(err));
            });
        return () => {
            active = false;
        };
    }, [gameName, server]);
    return {gameClient, error};
};

export const Spectate = ({matchID, server, gameName}: ISpectateProps) => {
    const {gameClient: SpectateClient, error} = useGameClient(gameName, server);
    if (error) return <div>{error}</div>;
    if (!SpectateClient) return <Loading/>;
    return <SpectateClient matchID={matchID}/>;
}

export const MultiPlayer = ({matchID, serverURL, credentials, player, gameName}: MultiplayerProps) => {
    const {gameClient: MultiplayerClient, error} = useGameClient(gameName, serverURL);
    if (error) return <div>{error}</div>;
    if (!MultiplayerClient) return <Loading/>;
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
