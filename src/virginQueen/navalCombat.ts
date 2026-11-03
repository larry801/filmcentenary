import {Ctx} from "boardgame.io";
import {Controller, POWER_INDEX, Power, VQGame, isPower, landCount, navalCount} from "./constant/general";
import {LEADER_BY_ID} from "./constant/leaders";
import {SEA_ZONE_BY_ID, SPACE_BY_ID} from "./mapData";
import {ownerOf} from "./ownership";
import {
    atWar, bestBattle, friendlyController, hits, isSeaZone, leaderPower, leadersAt, moveLeaders,
    navalAdjacent, ownersWithNaval, powerLabel, pushLog, roll,
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
    if (G.navalDiceBonus !== undefined && owners.includes(G.navalDiceBonus.power)) dice += G.navalDiceBonus.amount;
    if (owners.includes("spain") && G.armada?.location === location) dice += G.armada.strength;
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
    if (owners.includes("spain") && G.armada?.location === location && hitsCount > 0) {
        const absorbed = Math.min(hitsCount, G.armada.strength);
        const levels = Math.ceil(absorbed / 2);
        const remainingStrength = G.armada.strength - levels * 2;
        hitsCount -= absorbed;
        if (remainingStrength <= 0) {
            delete G.armada;
            G.armadaReturn = G.year + 1;
            pushLog(G, "The Spanish Armada is eliminated.");
        } else {
            G.armada.strength = remainingStrength as 2 | 4 | 6 | 8;
            if (G.armada.land !== undefined) {
                let excess = landCount(G.armada.land) - G.armada.strength;
                for (const kind of ["regular", "merc", "cav"] as const) {
                    const remove = Math.min(excess, G.armada.land[kind]);
                    G.armada.land[kind] -= remove;
                    excess -= remove;
                }
                if (landCount(G.armada.land) === 0) delete G.armada.land;
            }
        }
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

/** Adjacent legal destinations for a retreating/avoiding naval force. */
export const navalRetreatCandidates = (
    G: VQGame,
    location: string,
    owners: Controller[],
    portAttacker = false,
): string[] =>
    [...Object.keys(SEA_ZONE_BY_ID), ...Object.keys(SPACE_BY_ID)]
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

/** Move a retreating stack to an adjacent legal location; eliminate it if none. */
export const retreatNaval = (G: VQGame, location: string, owners: Controller[], portAttacker = false): boolean => {
    const candidates = navalRetreatCandidates(G, location, owners, portAttacker);
    if (candidates.length === 0) {
        for (const owner of owners) delete navalAt(G, location)[owner];
        const leaders = leadersAt(G, location).filter((id) => LEADER_BY_ID[id]?.kind === "naval" &&
            leaderPower(G, id) !== undefined && owners.includes(leaderPower(G, id)!));
        if (leaders.length > 0) moveLeaders(G, location, "pool", leaders);
        if (owners.includes("spain") && G.armada?.location === location) delete G.armada;
        pushLog(G, `${owners.join("/")} naval force is eliminated (no retreat).`);
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
        leaderPower(G, id) !== undefined && owners.includes(leaderPower(G, id)!));
    if (leaders.length > 0) moveLeaders(G, location, destination, leaders);
    if (owners.includes("spain") && G.armada?.location === location) G.armada.location = destination;
    pushLog(G, `${owners.join("/")} naval force retreats to ${SPACE_BY_ID[destination]?.name ?? destination}.`);
    return true;
};

/** Automatic naval avoid-battle attempts (16.1 step 5) in a sea zone. */
export const attemptNavalAvoidBattle = (G: VQGame, ctx: Ctx, active: Power, location: string): Power[] => {
    if (!isSeaZone(location)) return [];
    const avoided: Power[] = [];
    const enemies = ownersWithNaval(G, location)
        .filter((owner) => owner !== active && isPower(owner) && atWar(G, active, owner) &&
            navalCount(stackAt(G, location, owner)) > 0)
        .sort((a, b) => POWER_INDEX[a as Power] - POWER_INDEX[b as Power]) as Power[];
    if (G.armada?.location === location && atWar(G, active, "spain") && !enemies.includes("spain")) enemies.push("spain");
    for (const enemy of enemies) {
        const candidates = navalRetreatCandidates(G, location, [enemy]);
        if (candidates.length === 0) continue;
        const stack = stackAt(G, location, enemy);
        if (stack === undefined && !(enemy === "spain" && G.armada?.location === location)) continue;
        const galleonPenalty = stack !== undefined && MEDITERRANEAN.has(location) && stack.galleon + stack.racebuilt > 0 ? -1 : 0;
        const telescope = G.powers[enemy].scienceBonuses.includes("telescope") ? 1 : 0;
        const modifier = bestBattle(G, location, [enemy], "naval") + galleonPenalty + telescope;
        const dice = roll(ctx, 2);
        const total = dice[0] + dice[1] + modifier;
        pushLog(G, `${powerLabel(enemy)} naval avoid battle at ${location}: [${dice.join(",")}] + ${modifier} = ${total}.`);
        if (total < 9) continue;
        retreatNaval(G, location, [enemy]);
        avoided.push(enemy);
        pushLog(G, `${powerLabel(enemy)} avoids naval battle.`);
    }
    return avoided;
};

/** Move a successful intercepting fleet into the destination (16.1 step 4). */
export const completeNavalInterception = (G: VQGame, power: Power, from: string, to: string): void => {
    const source = navalAt(G, from)[power];
    if (source !== undefined) {
        const target = navalAt(G, to)[power] ?? {galley: 0, galleon: 0, racebuilt: 0, corsair: 0};
        target.galley += source.galley;
        target.galleon += source.galleon;
        target.racebuilt += source.racebuilt;
        target.corsair += source.corsair;
        navalAt(G, to)[power] = target;
        delete navalAt(G, from)[power];
    }
    const leaders = leadersAt(G, from).filter((id) =>
        leaderPower(G, id) === power && LEADER_BY_ID[id]?.kind === "naval");
    if (leaders.length > 0) moveLeaders(G, from, to, leaders);
    if (power === "spain" && G.armada?.location === from) G.armada.location = to;
    pushLog(G, `${powerLabel(power)} intercepts the naval move into ${SPACE_BY_ID[to]?.name ?? to}.`);
};

/** #14 legal only while a fleet in one of the power's own home ports intercepts. */
export const canOfferBeaconResponse = (G: VQGame, power: Power, location: string): boolean =>
    !isSeaZone(location) && SPACE_BY_ID[location]?.home === power && G.powers[power].cards.includes("vq-014");

/**
 * Automatic naval interception (16.1 step 4), used when the destination is
 * empty.  When the next intercepting stack is a home-port fleet holding #14
 * the resolution pauses before that stack's roll so the owner can play the
 * response; `"paused"` tells the caller to resume after the response window.
 */
export const attemptNavalInterception = (
    G: VQGame,
    ctx: Ctx,
    active: Power,
    from: string,
    to: string,
    destinationHadEnemy: boolean,
    beaconSkipAt?: string,
): boolean | "paused" => {
    if (destinationHadEnemy) return false;
    if (G.interceptedThisImpulse?.impulse !== G.impulse) G.interceptedThisImpulse = {impulse: G.impulse, spaces: []};
    const used = G.interceptedThisImpulse.spaces;
    const candidates: {location: string; power: Power}[] = [];
    const locations = [...Object.keys(SEA_ZONE_BY_ID), ...Object.keys(SPACE_BY_ID)];
    for (const id of locations) {
        if (id === from || id === to || used.includes(id) || !navalAdjacent(to, id)) continue;
        if (ownersWithNaval(G, id).some((owner) => isPower(owner) && friendlyController(G, active, owner))) continue;
        const stacks = navalAt(G, id);
        for (const owner of Object.keys(stacks) as Controller[]) {
            if (!isPower(owner) || !atWar(G, owner, active) || navalCount(stacks[owner]) === 0) continue;
            candidates.push({location: id, power: owner});
        }
        if (id === G.armada?.location && atWar(G, "spain", active) &&
            !candidates.some((candidate) => candidate.location === id && candidate.power === "spain")) {
            candidates.push({location: id, power: "spain"});
        }
    }
    candidates.sort((a, b) => POWER_INDEX[a.power] - POWER_INDEX[b.power] || a.location.localeCompare(b.location));
    for (const candidate of candidates) {
        const source = navalAt(G, candidate.location)[candidate.power];
        const armadaOnly = source === undefined && candidate.power === "spain" && G.armada?.location === candidate.location;
        if (!armadaOnly && (source === undefined || navalCount(source) === 0)) continue;
        if (beaconSkipAt !== candidate.location && canOfferBeaconResponse(G, candidate.power, candidate.location)) {
            G.pendingBeacon = {power: active, defender: candidate.power, from: candidate.location, moveFrom: from, to, destinationHadEnemy};
            ctx.events?.setActivePlayers({value: {[ownerOf(G, candidate.power)!]: "beaconResponse"}});
            return "paused";
        }
        if (!used.includes(candidate.location)) used.push(candidate.location);
        const galleonPenalty = source !== undefined && isSeaZone(to) && MEDITERRANEAN.has(to) &&
            source.galleon + source.racebuilt > 0 ? -1 : 0;
        const telescope = G.powers[candidate.power].scienceBonuses.includes("telescope") ? 1 : 0;
        const modifier = bestBattle(G, candidate.location, [candidate.power], "naval") + galleonPenalty + telescope;
        const dice = roll(ctx, 2);
        const total = dice[0] + dice[1] + modifier;
        pushLog(G, `${powerLabel(candidate.power)} naval interception from ${SPACE_BY_ID[candidate.location]?.name ?? candidate.location}: [${dice.join(",")}] + ${modifier} = ${total}.`);
        if (total < 9) continue;
        completeNavalInterception(G, candidate.power, candidate.location, to);
        return true;
    }
    return false;
};

/** Hostile naval powers in a location, in impulse order. */
export const navalEnemies = (G: VQGame, location: string, attacker: Power): Power[] => {
    const enemies = ownersWithNaval(G, location)
        .filter((owner) => owner !== attacker && isPower(owner) && atWar(G, attacker, owner) &&
            navalCount(stackAt(G, location, owner)) > 0)
        .sort((a, b) => POWER_INDEX[a as Power] - POWER_INDEX[b as Power]) as Power[];
    if (G.armada?.location === location && atWar(G, attacker, "spain") && !enemies.includes("spain")) enemies.push("spain");
    return enemies;
};

/** Resolve one naval battle against a chosen enemy. */
export const resolveNavalCombatEnemy = (G: VQGame, ctx: Ctx, location: string, attacker: Power, enemy: Power): void => {
    if (countAt(G, location, [attacker]) === 0) return;
    if (countAt(G, location, [enemy]) === 0 && !(enemy === "spain" && G.armada?.location === location)) return;
    const port = !isSeaZone(location);
    const aDice = navalCombatDice(G, location, [attacker], false);
    const dDice = navalCombatDice(G, location, [enemy], true);
    const aRolls = roll(ctx, aDice);
    const dRolls = roll(ctx, dDice);
    const aHits = hits(aRolls);
    const dHits = hits(dRolls);
    G.lastRolls = `Naval battle at ${SPACE_BY_ID[location]?.name ?? location}: ${aHits} hits (${aDice} dice) vs ${powerLabel(enemy)} ${dHits} hits (${dDice} dice)`;
    pushLog(G, G.lastRolls);
    const winner: "attacker" | "defender" = aHits > dHits ? "attacker" : "defender";
    applyNavalCombatLosses(G, location, [enemy], aHits, winner === "attacker", aRolls);
    applyNavalCombatLosses(G, location, [attacker], dHits, winner === "defender", dRolls);
    let attackerLeft = countAt(G, location, [attacker]);
    let defenderLeft = countAt(G, location, [enemy]);
    if (attackerLeft === 0 && defenderLeft === 0) {
        const keeper = aDice > dDice ? attacker : enemy;
        const target = navalAt(G, location)[keeper] ?? {galley: 0, galleon: 0, racebuilt: 0, corsair: 0};
        target.galley += 1;
        navalAt(G, location)[keeper] = target;
        if (keeper === attacker) attackerLeft = 1; else defenderLeft = 1;
        pushLog(G, `Both naval forces are eliminated; ${powerLabel(keeper)} retains 1 galley.`);
    }
    if (port) {
        if (attackerLeft > 0) retreatNaval(G, location, [attacker], true);
        return;
    }
    if (winner === "defender") {
        if (attackerLeft > 0) retreatNaval(G, location, [attacker]);
        return;
    }
    if (defenderLeft > 0) retreatNaval(G, location, [enemy]);
    if (G.navalDiceBonus !== undefined &&
        (G.navalDiceBonus.power === attacker || G.navalDiceBonus.power === enemy)) delete G.navalDiceBonus;
};

/** Resolve all naval combats in impulse order (used where no interactive order is needed). */
export const resolveNavalCombat = (G: VQGame, ctx: Ctx, location: string, attacker: Power, intercepted = false, avoidDone = false): void => {
    if (!intercepted && !avoidDone) attemptNavalAvoidBattle(G, ctx, attacker, location);
    for (const enemy of navalEnemies(G, location, attacker)) {
        if (countAt(G, location, [attacker]) === 0) return;
        resolveNavalCombatEnemy(G, ctx, location, attacker, enemy);
        if (!isSeaZone(location)) return;
        if (countAt(G, location, [attacker]) === 0) return;
    }
};
