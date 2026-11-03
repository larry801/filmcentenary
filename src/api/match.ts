/**
 * This module follows the API schema from: https://boardgame.io/documentation/#/api/Lobby
 */

import {Player,nameOf} from "../Game";

import { FilmCentenaryGame } from "../Game";

/** Represents a match. */
export interface Match {
    matchID: string;
    players: Map<Player, string | null>;
}

/** Represents the visibility of a match. */
export enum Visibility {
    PRIVATE,
    PUBLIC,
}

/** Defines headers for POST requests. */
const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
};

/** Create a match and return the match ID. */
export const createMatch = async (
    serverURL: string,
    gameName: string,
    visibility: Visibility,
    numPlayers: number = 3,
    setupData?: Record<string, unknown>,
): Promise<string> => {
    const resp = await fetch(`${serverURL}/games/${gameName}/create`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            numPlayers: numPlayers,
            unlisted: visibility === Visibility.PRIVATE,
            ...(setupData === undefined ? {} : {setupData}),
        }),
    });
    if (!resp.ok) {
        throw new Error("failed to create match: " + (await resp.text()));
    }
    const data = await resp.json();
    if (typeof data.matchID !== "string") {
        throw new Error("invalid response data: " + JSON.stringify(data));
    } else {
        return data.matchID as string;
    }
};

/** Join a match and return the player credentials. */
export const joinMatch = async (
    serverURL: string,
    matchID: string,
    player: Player,
    gameName: string
): Promise<string> => {
    const resp = await fetch(`${serverURL}/games/${gameName}/${matchID}/join`, {
        method: "POST",
        headers,
        body: JSON.stringify({ playerID: player, playerName: nameOf(player) }),
    });
    if (!resp.ok) {
        throw new Error("failed to join match: " + (await resp.text()));
    }
    const data = await resp.json();
    if (typeof data.playerCredentials !== "string") {
        throw new Error("invalid response data: " + JSON.stringify(data));
    } else {
        return data.playerCredentials as string;
    }
};

/** Leave a match. */
export const leaveMatch = async (
    serverURL: string,
    matchID: string,
    player: Player,
    credentials: string,
    gameName: string
): Promise<void> => {
    const resp = await fetch(`${serverURL}/games/${gameName}/${matchID}/leave`, {
        method: "POST",
        headers,
        body: JSON.stringify({ playerID: player, credentials }),
    });
    if (!resp.ok) {
        throw new Error("failed to leave match: " + (await resp.text()));
    }
};

/** List the IDs of all public matches. */
export const listMatchIDs = async (
    serverURL: string,
    gameName: string
): Promise<Array<string>> => {
    const resp = await fetch(`${serverURL}/games/${gameName}`);
    if (!resp.ok) {
        throw new Error("failed to list match IDs: " + (await resp.text()));
    }
    const data = await resp.json();
    if (
        !Array.isArray(data.matches) ||
        data.matches.some((m: any) => typeof m.matchID !== "string")
    ) {
        throw new Error("invalid response data: " + JSON.stringify(data));
    } else {
        return data.matches.map((m: any) => m.matchID) as Array<string>;
    }
};

/**
 * Download the full, unredacted log of a finished match as a JSON file.
 * The server refuses (403) while the match is still running.
 */
export const exportFullLog = async (
    serverURL: string,
    gameName: string,
    matchID: string
): Promise<void> => {
    const resp = await fetch(`${serverURL}/games/${encodeURIComponent(gameName)}/${encodeURIComponent(matchID)}/log`);
    if (!resp.ok) {
        throw new Error("failed to export log: " + (await resp.text()));
    }
    const data = await resp.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${gameName}-${matchID}-log.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

/** Get information about a match. */
export const getMatch = async (
    serverURL: string,
    matchID: string,
    gameName: string
): Promise<Match> => {
    const resp = await fetch(`${serverURL}/games/${gameName}/${matchID}`);
    if (!resp.ok) {
        throw new Error("failed to get match: " + (await resp.text()));
    }
    const data = await resp.json();
    if (
        typeof data.matchID !== "string" ||
        !Array.isArray(data.players) ||
        data.players.some((p: any) => typeof p.id !== "number") ||
        data.players.some((p: any) => p.name && typeof p.name !== "string")
    ) {
        throw new Error("invalid response data: " + JSON.stringify(data));
    } else {
        return {
            matchID: data.matchID as string,
            players: new Map<Player, string | null>(
                data.players.map((p: any) => [
                    p.id.toString() as Player,
                    p.name ?? null,
                ])
            ),
        };
    }
};
