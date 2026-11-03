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

/** Number of seats in the match; 6-player games do not use `playerPowers`. */
export const playerCount = (G: VQGame): number =>
    G.playerPowers === undefined ? 6 : Object.keys(G.playerPowers).length;

/**
 * A major power that may be activated by another player.  In 2-player games
 * both the Ottoman and the HRE are eligible; in 5-player games the Ottoman is
 * player-controlled and only the HRE is eligible.
 */
export const canActivateMajor = (G: VQGame, power: Power): boolean =>
    G.scenario !== "tutorial" && !!G.playerPowers && (power === "ottoman" || power === "hre") &&
    !Object.values(G.playerPowers).some((powers) => powers.includes(power));

/**
 * True for a power that is part of an Activated Major Power variant rather
 * than a directly seated power.  The HRE is always such a power in the 2- and
 * 5-player configurations (inactive until diplomacy activates it); the Ottoman
 * is one only in the 2-player configuration, where setup puts it in
 * `activatedMajors` from the start.
 */
export const isActivatedMajor = (G: VQGame, power: Power): boolean =>
    G.scenario !== "tutorial" && !!G.playerPowers &&
    (power === "hre" || (power === "ottoman" && G.activatedMajors?.ottoman !== undefined));
