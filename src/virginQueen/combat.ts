import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {Controller, Power, VQGame, isPower, landCount, navalCount} from "./constant/general";
import {cardById} from "./constant/cards";
import {LEADER_BY_ID} from "./constant/leaders";
import {LAND_NEIGHBORS, SEA_ZONE_BY_ID, SPACE_BY_ID, SPACES} from "./mapData";
import {ownerOf} from "./ownership";
import {tutorialSpaceAllowed} from "./tutorial";
import {
    addLand, atWar, bestBattle, captureLeaders, checkCyprusVp, discardCard, ensureLand, ensureNaval, friendlyControlled, landDistance,
    friendlyController, hits, isFortifiedSpace, isSeaZone, minorAlly, moveLeaders, navalAdjacent,
    ownersWithLand, ownersWithNaval, pushLog, recordNavalLoss, removeCardFromHand, roll, totalLand, totalNaval,
} from "./util";

type Battle = NonNullable<VQGame["pendingBattle"]>;
export interface BattleOption {id: string; label: string}

const sideOwners = (battle: Battle, attacker: boolean): Controller[] => attacker ? battle.attackers : battle.defenders;
const sideUnits = (G: VQGame, battle: Battle, attacker: boolean): number => battle.phase === "naval"
    ? totalNaval(G, battle.location, sideOwners(battle, attacker)) : totalLand(G, battle.location, sideOwners(battle, attacker));
const navalStacks = (G: VQGame, location: string) => isSeaZone(location) ? G.seaZones[location as keyof VQGame["seaZones"]].naval : G.spaces[location].naval;

const prompt = (G: VQGame, ctx: Ctx, step: Battle["step"], power: Power): void => {
    const battle = G.pendingBattle!;
    battle.step = step;
    battle.responding = power;
    ctx.events?.setActivePlayers({value: {[ownerOf(G, power)!]: "battleChoice"}});
};

const endBattle = (G: VQGame, ctx: Ctx): void => {
    delete G.pendingBattle;
    delete G.cardWindow;
    ctx.events?.endStage();
};

const retreatOptions = (G: VQGame, battle: Battle, power: Power): string[] => {
    if (battle.transported && power === battle.attacker) return [];
    if (battle.phase === "naval") {
        const candidates = [...Object.keys(SEA_ZONE_BY_ID), ...Object.keys(G.spaces)];
        return candidates.filter((id) => navalAdjacent(battle.location, id) &&
            (isSeaZone(id) || (tutorialSpaceAllowed(id) && friendlyControlled(G, power, id))) &&
            Object.keys(navalStacks(G, id)).every((owner) => friendlyController(G, power, owner as Controller)));
    }
    return (LAND_NEIGHBORS[battle.location] ?? []).filter((neighbor) => !neighbor.pass && tutorialSpaceAllowed(neighbor.id) &&
        (power === battle.attacker ? neighbor.id === battle.from || friendlyControlled(G, power, neighbor.id) : neighbor.id !== battle.from && friendlyControlled(G, power, neighbor.id)) &&
        !G.spaces[neighbor.id].unrest && ownersWithLand(G, neighbor.id).every((owner) => friendlyController(G, power, owner)))
        .map((neighbor) => neighbor.id);
};

const moveSide = (G: VQGame, battle: Battle, attacker: boolean, destination: string): void => {
    const owners = sideOwners(battle, attacker);
    for (const owner of owners) {
        if (battle.phase === "naval") {
            const source = navalStacks(G, battle.location)[owner];
            if (!source) continue;
            const target = ensureNaval(G, destination, owner);
            for (const kind of ["galley", "galleon", "racebuilt", "corsair"] as const) target[kind] += source[kind];
            delete navalStacks(G, battle.location)[owner];
        } else {
            const source = G.spaces[battle.location].land[owner];
            if (!source) continue;
            const target = ensureLand(G, destination, owner);
            for (const kind of ["regular", "merc", "cav"] as const) target[kind] += source[kind];
            delete G.spaces[battle.location].land[owner];
        }
    }
    const leaders = (isSeaZone(battle.location) ? G.seaZones[battle.location as keyof VQGame["seaZones"]].leaders : G.spaces[battle.location].leaders)
        .filter((id) => owners.includes(LEADER_BY_ID[id]?.power) && LEADER_BY_ID[id]?.kind === (battle.phase === "naval" ? "naval" : "army"));
    moveLeaders(G, battle.location, destination, leaders);
};

export const startBattle = (G: VQGame, ctx: Ctx, phase: Battle["phase"], location: string, attacker: Power, defenders: Controller[], from: string, attackers: Controller[] = [attacker]): void => {
    const controllingDefender = defenders.map((owner) => isPower(owner) && ownerOf(G, owner) !== undefined ? owner :
        !isPower(owner) && owner !== "independent" ? minorAlly(G, owner) : undefined).find((owner) => owner !== undefined);
    const defender = controllingDefender || (attacker === "ottoman" ? "spain" : "ottoman");
    G.pendingBattle = {phase, location, attacker, attackers, defenders, defender, from, responding: defender, step: "defend", cards: {}};
    G.cardWindow = {kind: "combat", phase, location, attacker};
    const leaders = isSeaZone(location) ? G.seaZones[location as keyof VQGame["seaZones"]].leaders : G.spaces[location].leaders;
    if (leaders.includes("dragut")) G.dragutFought = true;
    prompt(G, ctx, phase === "assault" ? "attackerCards" : "defend", phase === "assault" ? attacker : defender);
};

export const battleOptions = (G: VQGame): BattleOption[] => {
    const battle = G.pendingBattle;
    if (!battle) return [];
    const power = battle.responding;
    if (battle.step === "defend") {
        const options = [{id: "fight", label: "迎战"}];
        if (battle.intercepted) return options;
        if (battle.phase === "naval" && !isSeaZone(battle.location)) return options;
        if (isFortifiedSpace(G, battle.location) && sideUnits(G, battle, false) <= 4) options.push({id: "fortify", label: "退入要塞"});
        for (const destination of retreatOptions(G, battle, power)) options.push({id: `avoid:${destination}`, label: `尝试避战至 ${SPACE_BY_ID[destination]?.name ?? SEA_ZONE_BY_ID[destination]?.name ?? destination}`});
        return options;
    }
    if (battle.step === "attackerCards" || battle.step === "defenderCards" || battle.step === "attackerAfterRoll" || battle.step === "defenderAfterRoll") {
        const afterRoll = battle.step.endsWith("AfterRoll");
        const candidates = G.powers[power].cards.filter((id) => {
            const number = cardById(id).officialNumber;
            if (afterRoll) return battle.phase === "naval" && number === 12 && SEA_ZONE_BY_ID[battle.location]?.kind === "mediterranean";
            if (number === 7 || number === 10) return battle.phase === "assault" && power === battle.attacker;
            if (number === 8) return battle.phase === "field";
            if (number === 9) return battle.phase === "naval";
            if (number === 13) return battle.phase !== "naval";
            if (number === 40) return true;
            if (number === 39) return battle.phase === "assault" && power !== battle.attacker && SPACE_BY_ID[battle.location]?.area === "netherlands";
            return false;
        });
        return [...candidates.map((id) => ({id: `card:${id}`, label: `打出 ${cardById(id).name}`})), {id: "done", label: "继续结算"}];
    }
    if (battle.step === "attackerLosses" || battle.step === "defenderLosses") {
        const owners = sideOwners(battle, battle.step === "attackerLosses");
        const result: BattleOption[] = [];
        for (const owner of owners) {
            const stack = battle.phase === "naval" ? navalStacks(G, battle.location)[owner] : G.spaces[battle.location].land[owner];
            for (const [kind, count] of Object.entries(stack ?? {})) {
                const remaining = battle.losses![battle.step === "attackerLosses" ? "attacker" : "defender"];
                const loser = battle.hitCounts!.attacker > battle.hitCounts!.defender ? battle.defender : battle.attacker;
                if (count > 0 && (battle.phase !== "naval" || kind === "corsair" || remaining >= 2 || power === loser)) result.push({id: `loss:${owner}:${kind}`, label: `移除 1 ${owner} ${kind}`});
            }
        }
        return result;
    }
    return retreatOptions(G, battle, battle.loser!).map((id) => ({id: `retreat:${id}`, label: `撤退至 ${SPACE_BY_ID[id]?.name ?? id}`}));
};

const finishCasualties = (G: VQGame, ctx: Ctx): void => {
    const battle = G.pendingBattle!;
    const attackerUnits = sideUnits(G, battle, true);
    const defenderUnits = sideUnits(G, battle, false);
    if (battle.phase === "naval") {
        const leaders = isSeaZone(battle.location) ? G.seaZones[battle.location as keyof VQGame["seaZones"]].leaders : G.spaces[battle.location].leaders;
        for (const id of [...leaders]) {
            const owner = LEADER_BY_ID[id]?.power;
            if (!owner || (owner === battle.attacker ? attackerUnits : defenderUnits) > 0) continue;
            G.leaders[id] = {id, location: "pool", returnTurn: G.year + 1};
            leaders.splice(leaders.indexOf(id), 1);
        }
    } else {
        if (!attackerUnits) captureLeaders(G, battle.location, battle.attackers, battle.defender);
        if (!defenderUnits) captureLeaders(G, battle.location, battle.defenders, battle.attacker);
    }
    if (battle.phase === "assault") {
        if (battle.treachery && attackerUnits > defenderUnits) {
            for (const owner of battle.defenders) delete G.spaces[battle.location].land[owner];
            captureLeaders(G, battle.location, battle.defenders, battle.attacker);
            G.spaces[battle.location].control = battle.attacker;
            delete G.spaces[battle.location].siege;
            checkCyprusVp(G, battle.attacker, battle.location);
            endBattle(G, ctx);
            return;
        }
        if (attackerUnits > 0 && defenderUnits === 0 && battle.hitCounts!.attacker > 0) {
            G.spaces[battle.location].control = battle.attacker;
            delete G.spaces[battle.location].siege;
            checkCyprusVp(G, battle.attacker, battle.location);
        } else if (attackerUnits <= defenderUnits) {
            delete G.spaces[battle.location].siege;
            battle.loser = battle.attacker;
        }
    } else if (attackerUnits > 0 && defenderUnits > 0) {
        battle.loser = battle.hitCounts!.attacker > battle.hitCounts!.defender ? battle.defender : battle.attacker;
    }
    if (battle.phase === "naval" && !isSeaZone(battle.location) && attackerUnits > 0) battle.loser = battle.attacker;
    if (battle.loser && sideUnits(G, battle, battle.loser === battle.attacker) > 0) {
        const options = retreatOptions(G, battle, battle.loser);
        if (options.length > 0) {
            prompt(G, ctx, "retreat", battle.loser);
            return;
        }
        const owners = sideOwners(battle, battle.loser === battle.attacker);
        for (const owner of owners) {
            if (battle.phase === "naval") {
                const stack = navalStacks(G, battle.location)[owner];
                if (stack !== undefined) {
                    for (const kind of ["galley", "galleon", "racebuilt", "corsair"] as const) recordNavalLoss(G, owner, kind, stack[kind]);
                }
                delete navalStacks(G, battle.location)[owner];
            } else delete G.spaces[battle.location].land[owner];
        }
        captureLeaders(G, battle.location, owners, battle.loser === battle.attacker ? battle.defender : battle.attacker);
    }
    if (battle.phase === "field" && sideUnits(G, battle, true) > 0 && battle.loser !== battle.attacker && isFortifiedSpace(G, battle.location) && !friendlyControlled(G, battle.attacker, battle.location)) {
        G.spaces[battle.location].siege = {by: battle.attacker, sinceImpulse: G.impulse};
    }
    endBattle(G, ctx);
};

const casualties = (G: VQGame, ctx: Ctx): void => {
    const battle = G.pendingBattle!;
    if (battle.losses!.attacker > 0 && sideUnits(G, battle, true) > 0) {
        prompt(G, ctx, "attackerLosses", battle.attacker);
        if (battleOptions(G).length) return;
        battle.losses!.attacker = 0;
    }
    if (battle.losses!.defender > 0 && sideUnits(G, battle, false) > 0) {
        prompt(G, ctx, "defenderLosses", battle.defender);
        if (battleOptions(G).length) return;
        battle.losses!.defender = 0;
    }
    finishCasualties(G, ctx);
};

const rollBattle = (G: VQGame, ctx: Ctx): void => {
    const battle = G.pendingBattle!;
    const dice = (attacker: boolean): number[] => {
        const power = attacker ? battle.attacker : battle.defender;
        let count = sideUnits(G, battle, attacker);
        if (battle.phase === "naval") {
            count = sideOwners(battle, attacker).reduce((total, owner) => {
                const stack = navalStacks(G, battle.location)[owner];
                const galleyDice = isSeaZone(battle.location) && SEA_ZONE_BY_ID[battle.location].kind === "atlantic" ? 1 : 2;
                return total + (stack ? stack.corsair + galleyDice * stack.galley + 2 * (stack.galleon + stack.racebuilt) : 0);
            }, 0);
        }
        if (battle.phase === "assault") {
            count -= sideOwners(battle, attacker).reduce((total, owner) => total + (G.spaces[battle.location].land[owner]?.cav ?? 0), 0);
            if (attacker && sideUnits(G, battle, false) > 0) count = Math.ceil(count / 2);
        }
        count += bestBattle(G, battle.location, sideOwners(battle, attacker), battle.phase === "naval" ? "naval" : "army") +
            (attacker || (battle.phase === "naval" && isSeaZone(battle.location)) ? 0 : 1);
        if (!attacker && battle.cards[battle.attacker]?.includes("vq-007")) count *= 2;
        const values = roll(ctx, count);
        for (const id of battle.cards[power] ?? []) {
            if (id === "vq-008" || id === "vq-010") values.push(...roll(ctx, 3));
            if (id === "vq-009") values.push(...roll(ctx, isSeaZone(battle.location) && G.armada?.location !== battle.location ? 2 : 4));
            if (id === "vq-014") values.push(...roll(ctx, 2));
            if (id === "vq-040") values.push(...roll(ctx, power === "england" ? 4 : 2));
        }
        return values;
    };
    battle.rolls = {attacker: dice(true), defender: dice(false)};
    const countHits = (attacker: boolean): number => {
        const power = attacker ? battle.attacker : battle.defender;
        const values = attacker ? battle.rolls!.attacker : battle.rolls!.defender;
        if (battle.cards[power]?.includes("vq-007")) return values.filter((value) => value >= 4).length;
        if (battle.cards[power]?.includes("vq-008") && ["ottoman", "spain"].includes(power)) {
            const base = values.slice(0, -3);
            return hits(base) + values.slice(-3).filter((value) => value >= 4).length;
        }
        return hits(values);
    };
    battle.hitCounts = {attacker: countHits(true), defender: countHits(false)};
    G.lastRolls = `${battle.phase}: [${battle.rolls.attacker.join(",")}] ${battle.hitCounts.attacker} hits; [${battle.rolls.defender.join(",")}] ${battle.hitCounts.defender} hits`;
    pushLog(G, G.lastRolls);
    prompt(G, ctx, "attackerAfterRoll", battle.attacker);
};

export const chooseBattle = (G: VQGame, ctx: Ctx, args: {choice: string}): void | typeof INVALID_MOVE => {
    const battle = G.pendingBattle;
    if (!battle || ctx.playerID !== ownerOf(G, battle.responding) || !battleOptions(G).some((option) => option.id === args.choice)) return INVALID_MOVE;
    const choice = args.choice;
    if (battle.step === "defend") {
        if (choice === "fortify") {
            if (sideUnits(G, battle, true) > sideUnits(G, battle, false)) G.spaces[battle.location].siege = {by: battle.attacker, sinceImpulse: G.impulse};
            else moveSide(G, battle, true, battle.from);
            endBattle(G, ctx);
        } else if (choice.startsWith("avoid:")) {
            const galleonPenalty = battle.phase === "naval" && SEA_ZONE_BY_ID[battle.location]?.kind === "mediterranean" &&
                battle.defenders.some((owner) => {
                    const stack = navalStacks(G, battle.location)[owner];
                    return (stack?.galleon ?? 0) + (stack?.racebuilt ?? 0) > 0;
                }) ? 1 : 0;
            const result = roll(ctx, 2).reduce((total, value) => total + value, 0) +
                bestBattle(G, battle.location, battle.defenders, battle.phase === "naval" ? "naval" : "army") - galleonPenalty;
            if (result >= 9) {
                moveSide(G, battle, false, choice.slice(6));
                if (battle.phase === "field" && isFortifiedSpace(G, battle.location)) G.spaces[battle.location].siege = {by: battle.attacker, sinceImpulse: G.impulse};
                endBattle(G, ctx);
            } else prompt(G, ctx, "attackerCards", battle.attacker);
        } else prompt(G, ctx, "attackerCards", battle.attacker);
        return;
    }
    if (choice.startsWith("card:")) {
        const id = choice.slice(5);
        removeCardFromHand(G, battle.responding, id);
        discardCard(G, battle.responding, id, true);
        battle.cards[battle.responding] ??= [];
        battle.cards[battle.responding]!.push(id);
        if (id === "vq-013") {
            if (battle.responding === "ottoman") {
                let remaining = 2;
                for (const owner of [...battle.attackers, ...battle.defenders]) {
                    const stack = G.spaces[battle.location]?.land[owner];
                    if (!stack) continue;
                    const removed = Math.min(remaining, stack.merc);
                    stack.merc -= removed;
                    remaining -= removed;
                }
                if (remaining > 0) {
                    for (const space of Object.values(G.spaces)) {
                        for (const stack of Object.values(space.land)) {
                            if (remaining === 0) break;
                            const removed = Math.min(remaining, stack?.merc ?? 0);
                            if (stack !== undefined) stack.merc -= removed;
                            remaining -= removed;
                        }
                        if (remaining === 0) break;
                    }
                }
            } else {
                const target = G.spaces[battle.location].control === battle.responding && G.spaces[battle.location].siege === undefined &&
                    !G.spaces[battle.location].unrest &&
                    ownersWithLand(G, battle.location).every((owner) => !isPower(owner) || owner === battle.responding)
                    ? battle.location
                    : SPACES.find((space) => G.spaces[space.id].control === battle.responding && G.spaces[space.id].siege === undefined &&
                        !G.spaces[space.id].unrest && ownersWithLand(G, space.id).every((owner) => !isPower(owner) || owner === battle.responding))?.id;
                if (target !== undefined) {
                    const nearHre = SPACES.some((space) => space.home === "hre" && (landDistance(target, space.id) ?? 99) <= 2);
                    addLand(G, target, battle.responding, "merc", nearHre ? 4 : 2);
                }
            }
        }
        if (id === "vq-039") {
            if (G.powers[battle.attacker].cards.includes("vq-010")) {
                removeCardFromHand(G, battle.attacker, "vq-010");
                discardCard(G, battle.attacker, "vq-010", true);
                battle.cards[battle.attacker] ??= [];
                battle.cards[battle.attacker]!.push("vq-010");
                pushLog(G, "Siege Engineering cancels Flooding.");
                return;
            }
            for (const owner of sideOwners(battle, true)) {
                const stack = G.spaces[battle.location].land[owner];
                if (stack !== undefined) stack.merc -= Math.ceil(stack.merc / 2);
            }
            delete G.spaces[battle.location].siege;
            moveSide(G, battle, true, battle.from);
            endBattle(G, ctx);
            return;
        }
        if (id === "vq-012") {
            const ownVenetians = sideOwners(battle, battle.responding === battle.attacker).includes("venice");
            const values = roll(ctx, ownVenetians ? 5 : 3);
            const side = battle.responding === battle.attacker ? "attacker" : "defender";
            battle.rolls![side].push(...values);
            battle.hitCounts![side] += hits(values);
        }
        return;
    }
    if (choice === "done") {
        if (battle.step === "attackerCards") prompt(G, ctx, "defenderCards", battle.defender);
        else if (battle.step === "defenderCards") rollBattle(G, ctx);
        else if (battle.step === "attackerAfterRoll") prompt(G, ctx, "defenderAfterRoll", battle.defender);
        else {
            let attackerLosses = battle.phase === "naval" ? battle.hitCounts!.defender : Math.min(sideUnits(G, battle, true), battle.hitCounts!.defender);
            let defenderLosses = battle.phase === "naval" ? battle.hitCounts!.attacker : Math.min(sideUnits(G, battle, false), battle.hitCounts!.attacker);
            if (battle.phase === "field" && attackerLosses === sideUnits(G, battle, true) && defenderLosses === sideUnits(G, battle, false)) {
                if (battle.rolls!.attacker.length > battle.rolls!.defender.length) attackerLosses = Math.max(0, attackerLosses - 1);
                else defenderLosses = Math.max(0, defenderLosses - 1);
            }
            battle.losses = {attacker: attackerLosses, defender: defenderLosses};
            casualties(G, ctx);
        }
        return;
    }
    if (choice.startsWith("loss:")) {
        const [, owner, kind] = choice.split(":");
        const attacker = battle.step === "attackerLosses";
        if (battle.phase === "naval") {
            const stack = navalStacks(G, battle.location)[owner as Controller]!;
            stack[kind as keyof typeof stack] -= 1;
            recordNavalLoss(G, owner as Controller, kind as keyof typeof stack);
        } else {
            const stack = G.spaces[battle.location].land[owner as Controller]!;
            stack[kind as keyof typeof stack] -= 1;
        }
        battle.losses![attacker ? "attacker" : "defender"] = Math.max(0, battle.losses![attacker ? "attacker" : "defender"] - (battle.phase === "naval" && kind !== "corsair" ? 2 : 1));
        casualties(G, ctx);
        return;
    }
    moveSide(G, battle, battle.loser === battle.attacker, choice.slice(8));
    if (battle.phase === "field" && battle.loser === battle.defender && isFortifiedSpace(G, battle.location)) G.spaces[battle.location].siege = {by: battle.attacker, sinceImpulse: G.impulse};
    endBattle(G, ctx);
};
