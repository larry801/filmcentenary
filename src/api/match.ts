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
 * The server has no stored log for this match. This is expected for local
 * hotseat games, which never reach the server, and also happens when the page
 * is served by a static host that answers every unknown path with index.html.
 */
export class MissingServerLogError extends Error {
}

/** Save arbitrary log data as a pretty-printed JSON download. */
export const downloadLog = (data: unknown, filename: string): void => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

/** Fetch the server's unredacted log for a finished match. */
export const fetchFullLog = async (
    serverURL: string,
    gameName: string,
    matchID: string
): Promise<unknown> => {
    const resp = await fetch(`${serverURL}/games/${encodeURIComponent(gameName)}/${encodeURIComponent(matchID)}/log`);
    const contentType = resp.headers.get("content-type") ?? "";
    if (!resp.ok) {
        const body = await resp.text();
        if (resp.status === 404) {
            throw new MissingServerLogError(body);
        }
        throw new Error("failed to export log: " + body);
    }
    // A static host or dev server answers unknown paths with index.html and a
    // 200, so checking only `resp.ok` would surface a raw JSON parse error.
    if (!contentType.includes("application/json")) {
        throw new MissingServerLogError("server did not return a log");
    }
    return resp.json();
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
    const data = await fetchFullLog(serverURL, gameName, matchID);
    downloadLog(data, `${gameName}-${matchID}-log.json`);
};

/**
 * Download the log the browser holds for a local (hotseat) match. There is no
 * server copy, and the engine hides other seats' redacted move arguments, so
 * the file is marked as local.
 */
export const exportLocalLog = (
    gameName: string,
    matchID: string | undefined,
    log: unknown
): void => {
    downloadLog(
        {gameName, matchID: matchID ?? "local", local: true, log},
        `${gameName}-${matchID ?? "local"}-local-log.json`
    );
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
