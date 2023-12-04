import {Player} from "../Game";

const STORAGE_KEY = "fimCentenary";
const CAPACITY = 100;

/** Load the queue from localStorage. */
const loadQueue = (): Array<any> => {
    let queue = null;
    try {
        queue = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "");
    } catch {
    } // Ignore errors.
    if (!Array.isArray(queue)) {
        queue = []; // Initialize the queue.
    }
    return queue;
};

/** Delete credentials in localStorage. */
export const deleteCredentials = (
    matchID: string,
    player: Player
) => {
    const queue = loadQueue();
    let itemIdx = -1;
    for (const item of queue) {
        if (
            item &&
            item.matchID === matchID &&
            item.player === player &&
            typeof item.credentials === "string"
        ) {
            itemIdx = queue.indexOf(item);
        }
    }
    if (itemIdx !== -1) {
        queue.splice(itemIdx, 1);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};


/** Save credentials to localStorage. */
export const saveCredentials = (
    matchID: string,
    player: Player,
    credentials: string,
    gameName?: string
) => {
    const queue = loadQueue();
    if (gameName == undefined) {
        queue.push({matchID, player, credentials});
    } else {
        queue.push({matchID, player, credentials, gameName})
    }
    while (queue.length > CAPACITY) {
        queue.shift();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

/** Load credentials from localStorage. */
export const loadCredentials = (
    matchID: string,
    player: Player,
    gameName?: string
): string | null => {
    const queue = loadQueue();
    for (const item of queue) {
        if (
            item &&
            item.matchID === matchID &&
            item.player === player &&
            typeof item.credentials === "string"
        ) {
            if (gameName == undefined || item.gameName == undefined){
                return item.credentials as string;
            } else {
                if (item.gameName === gameName){
                    return item.credentials as string;
                }
            }
        }
    }
    return null;
};
