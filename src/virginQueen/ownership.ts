import {Power, POWERS, POWER_INDEX, VQGame, powerAt} from "./constant/general";

export const ownerOf = (G: VQGame, power: Power): string | undefined => {
    if (!G.playerPowers) return String(POWER_INDEX[power]);
    const direct = Object.keys(G.playerPowers).find((id) => G.playerPowers![id].includes(power));
    if (direct !== undefined) return direct;
    const ally = G.activatedMajors?.[power]?.ally;
    return ally === undefined ? undefined : Object.keys(G.playerPowers).find((id) => G.playerPowers![id].includes(ally));
};

export const controlledPowers = (G: VQGame, playerID: string | null): Power[] =>
    playerID === null ? [] : POWERS.filter((power) => ownerOf(G, power) === playerID);

export const participatingPowers = (G: VQGame): Power[] =>
    POWERS.filter((power) => ownerOf(G, power) !== undefined);

export const samePlayer = (G: VQGame, first: Power, second: Power): boolean =>
    ownerOf(G, first) !== undefined && ownerOf(G, first) === ownerOf(G, second);

export const actingPower = (G: VQGame, currentPlayer: string): Power =>
    G.playerPowers ? G.activePower : powerAt(currentPlayer);

export const isActivatedMajor = (G: VQGame, power: Power): boolean =>
    G.scenario !== "tutorial" && !!G.playerPowers && (power === "ottoman" || power === "hre");
