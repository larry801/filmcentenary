import {Ctx} from "boardgame.io";
import {Controller, Power, VQGame, isPower, navalCount} from "./constant/general";
import {LEADER_BY_ID} from "./constant/leaders";
import {SEA_ZONE_BY_ID, SPACE_BY_ID} from "./mapData";
import {
    atWar, bestBattle, friendlyController, hits, isSeaZone, leadersAt, moveLeaders,
    navalAdjacent, ownersWithNaval, pushLog, roll,
} from "./util";

const MEDITERRANEAN = new Set([
    "gulfOfLyon", "tyrrhenian", "ionian", "adriatic", "aegean",
    "easternMediterranean", "barbaryCoast", "northAfricanCoast",
]);

const navalAt = (G: VQGame, location: string) =>
    isSeaZone(location) ? G.seaZones[location as keyof VQGame["seaZones"]].naval : G.spaces[location].naval;

const stackAt = (G: VQGame, location: string, owner: Controller) => navalAt(G, location)[owner];

const countAt = (G: VQGame, location: string, owners: Controller[]): number =>
    owners.reduce((total, owner) => total + navalCount(stackAt(G, location, owner)), 0);

/** Rule 16.2 naval combat dice. */
export const navalCombatDice = (G: VQGame, location: string, owners: Controller[], defender: boolean): number => {
    const port = !isSeaZone(location);
    const galleyDice = port || MEDITERRANEAN.has(location) ? 2 : 1;
    let dice = 0;
    for (const owner of owners) {
        const stack = stackAt(G, location, owner);
        if (stack === undefined) continue;
        dice += stack.corsair + stack.galleon * 2 + stack.racebuilt * 2 + stack.galley * galleyDice;
    }
    dice += bestBattle(G, location, owners, "naval");
    if (defender && port) dice += 1;
    return Math.max(1, dice);
};

/**
 * Apply combat hits (16.2 step 8): one galley/galleon/race-built per 2 hits;
 * odd hits eliminate one extra only for the losing side.  England's race-built
 * galleons in an Atlantic sea zone ignore one rolled "5" each for casualties.
 */
export const applyNavalCombatLosses = (
    G: VQGame,
    location: string,
    owners: Controller[],
    hitCount: number,
    losing: boolean,
    opposingRolls: number[],
): number => {
    let hitsCount = hitCount;
    if (isSeaZone(location) && !MEDITERRANEAN.has(location)) {
        const racebuilt = owners.reduce((total, owner) => total + (stackAt(G, location, owner)?.racebuilt ?? 0), 0);
        const fives = opposingRolls.filter((value) => value === 5).length;
        hitsCount = Math.max(0, hitsCount - Math.min(racebuilt, fives));
    }
    let losses = Math.floor(hitsCount / 2) + (losing ? hitsCount % 2 : 0);
    let removed = 0;
    for (const kind of ["galley", "galleon", "racebuilt", "corsair"] as const) {
        for (const owner of owners) {
            const stack = stackAt(G, location, owner);
            if (stack === undefined) continue;
            while (losses > 0 && stack[kind] > 0) {
                stack[kind] -= 1;
                losses -= 1;
                removed += 1;
            }
            if (stack.galley + stack.galleon + stack.racebuilt + stack.corsair === 0) {
                delete navalAt(G, location)[owner];
            }
            if (losses === 0) return removed;
        }
    }
    return removed;
};

/** Move a retreating stack to an adjacent legal location; eliminate it if none. */
export const retreatNaval = (G: VQGame, location: string, owners: Controller[], portAttacker = false): boolean => {
    const candidates = [...Object.keys(SEA_ZONE_BY_ID), ...Object.keys(SPACE_BY_ID)]
        .filter((id) => id !== location && navalAdjacent(location, id))
        .filter((id) => {
            if (portAttacker && !isSeaZone(id)) return false;
            const hasEnemy = ownersWithNaval(G, id).some((target) =>
                owners.some((owner) => isPower(owner) ? !friendlyController(G, owner, target) : owner !== target));
            if (hasEnemy) return false;
            if (!isSeaZone(id)) return owners.every((owner) => G.spaces[id].control === owner);
            return true;
        })
        .sort((a, b) => Number(SPACE_BY_ID[b] !== undefined) - Number(SPACE_BY_ID[a] !== undefined));
    if (candidates.length === 0) {
        for (const owner of owners) delete navalAt(G, location)[owner];
        const leaders = leadersAt(G, location).filter((id) => LEADER_BY_ID[id]?.kind === "naval" &&
            owners.includes(LEADER_BY_ID[id].power));
        if (leaders.length > 0) moveLeaders(G, location, "pool", leaders);
        pushLog(G, `${owners.map((owner) => owner).join("/")} naval force is eliminated (no retreat).`);
        return false;
    }
    const destination = candidates[0];
    for (const owner of owners) {
        const source = stackAt(G, location, owner);
        if (source === undefined) continue;
        const target = navalAt(G, destination)[owner] ?? {galley: 0, galleon: 0, racebuilt: 0, corsair: 0};
        target.galley += source.galley;
        target.galleon += source.galleon;
        target.racebuilt += source.racebuilt;
        target.corsair += source.corsair;
        navalAt(G, destination)[owner] = target;
        delete navalAt(G, location)[owner];
    }
    const leaders = leadersAt(G, location).filter((id) => LEADER_BY_ID[id]?.kind === "naval" &&
        owners.includes(LEADER_BY_ID[id].power));
    if (leaders.length > 0) moveLeaders(G, location, destination, leaders);
    pushLog(G, `${owners.join("/")} naval force retreats to ${SPACE_BY_ID[destination]?.name ?? destination}.`);
    return true;
};

/** Resolve a full-game naval combat in a sea zone or port (16.2). */
export const resolveNavalCombat = (G: VQGame, ctx: Ctx, location: string, attacker: Power): void => {
    const enemies = ownersWithNaval(G, location).filter((owner) =>
        owner !== attacker && isPower(owner) && atWar(G, attacker, owner) && navalCount(stackAt(G, location, owner)) > 0);
    if (enemies.length === 0) return;
    const port = !isSeaZone(location);
    const aDice = navalCombatDice(G, location, [attacker], false);
    const dDice = navalCombatDice(G, location, enemies, true);
    const aRolls = roll(ctx, aDice);
    const dRolls = roll(ctx, dDice);
    const aHits = hits(aRolls);
    const dHits = hits(dRolls);
    G.lastRolls = `Naval battle at ${SPACE_BY_ID[location]?.name ?? location}: ${aHits} hits (${aDice} dice) vs ${dHits} hits (${dDice} dice)`;
    pushLog(G, G.lastRolls);
    const winner: "attacker" | "defender" = aHits > dHits ? "attacker" : "defender";
    applyNavalCombatLosses(G, location, enemies, aHits, winner === "attacker", aRolls);
    applyNavalCombatLosses(G, location, [attacker], dHits, winner === "defender", dRolls);
    let attackerLeft = countAt(G, location, [attacker]);
    let defenderLeft = countAt(G, location, enemies);
    if (attackerLeft === 0 && defenderLeft === 0) {
        // Both sides eliminated: the side that rolled more dice retains 1 unit.
        const keeper = aDice > dDice ? attacker : enemies[0];
        const target = navalAt(G, location)[keeper] ?? {galley: 0, galleon: 0, racebuilt: 0, corsair: 0};
        target.galley += 1;
        navalAt(G, location)[keeper] = target;
        if (keeper === attacker) attackerLeft = 1; else defenderLeft = 1;
        pushLog(G, `Both naval forces are eliminated; ${keeper} retains 1 galley.`);
    }
    if (port) {
        // The attacker always retreats from a port, win or lose.
        if (attackerLeft > 0) retreatNaval(G, location, [attacker], true);
        return;
    }
    if (winner === "defender") {
        if (attackerLeft > 0) retreatNaval(G, location, [attacker]);
    } else if (defenderLeft > 0) {
        retreatNaval(G, location, enemies);
    }
};
