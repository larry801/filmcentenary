import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {POWERS, Power, SeaZoneID, VQGame, isPower, navalCount} from "./constant/general";
import {SEA_ZONE_BY_ID, SEA_ZONES, SPACE_BY_ID, mapName} from "./mapData";
import {ownerOf} from "./ownership";
import {cardById} from "./constant/cards";
import i18n from "../constant/i18n";
import {TUTORIAL_FORTRESSES, tutorialSpaceAllowed} from "./tutorial";
import {addVp, atWar, bestPiracy, hits, isSeaZone, leaderPower, pushLog, recordNavalLoss, removeCardFromHand, roll, shuffle, zonePorts} from "./util";

const stacks = (G: VQGame, location: string) => isSeaZone(location) ? G.seaZones[location as SeaZoneID].naval : G.spaces[location].naval;
const adjacentLocations = (zone: SeaZoneID): string[] => [...zonePorts(zone).filter(tutorialSpaceAllowed), ...SEA_ZONE_BY_ID[zone].adjacent];
const prompt = (G: VQGame, ctx: Ctx): void => {
    const pending = G.pendingPiracy!;
    ctx.events?.setActivePlayers({value: {[ownerOf(G, pending.step === "losses" ? pending.power : pending.target)!]: "piracyChoice"}});
};
const finish = (G: VQGame, ctx: Ctx): void => {delete G.pendingPiracy; ctx.events?.endStage();};

export const piracyOptions = (G: VQGame): {id: string; label: string}[] => {
    const pending = G.pendingPiracy;
    if (!pending) return [];
    if (pending.step === "losses") return ["galley", "galleon", "racebuilt"].filter((kind) =>
        (G.seaZones[pending.zone].naval[pending.power]?.[kind as "galley"] ?? 0) > 0).map((kind) => ({id: `loss:${kind}`, label: `${i18n.chain.vq.engine.removeOne} ${kind}`}));
    const result: {id: string; label: string; reward: string}[] = [];
    const locations = [pending.zone, ...adjacentLocations(pending.zone)];
    for (const location of locations) {
        for (const [kind, count] of Object.entries(stacks(G, location)[pending.target] ?? {})) {
            if (count > 0) result.push({id: `ship:${location}:${kind}`, label: i18n.chain.vq.engine.removeFleet.replace("{space}", mapName(location)).replace("{kind}", kind), reward: "ship"});
        }
    }
    if (G.powers[pending.target].cards.some((id) => cardById(id).kind !== "home")) result.push({id: "card", label: i18n.chain.vq.engine.allowRandomDraw, reward: "card"});
    if (G.scenario === "tutorial") {
        if (pending.power === "ottoman") {
            if ((G.tutorialEffects?.piracyVp ?? 0) < 10) result.push({id: "vp", label: i18n.chain.vq.engine.giveOttomanPiracyVp, reward: "vp"});
        } else if ((G.tutorialEffects?.piracyVp ?? 0) > 0 || result.length === 0) {
            result.push({id: "vp", label: i18n.chain.vq.engine.ottomanPiracyVpMinusOne, reward: "vp"});
        }
    } else {
        // Rule 16.4 step 5c: any active power may be awarded 1 VP for Piracy.
        result.push({id: "vp", label: i18n.chain.vq.engine.awardPiracyVp, reward: "vp"});
    }
    const minimum = Math.min(...result.map((entry) => pending.rewards[entry.reward] ?? 0));
    return result.filter((entry) => (pending.rewards[entry.reward] ?? 0) === minimum);
};

const rollPiracy = (G: VQGame, ctx: Ctx): void => {
    const pending = G.pendingPiracy!;
    const stack = G.seaZones[pending.zone].naval[pending.power];
    if (!stack || navalCount(stack) === 0 || (!atWar(G, pending.power, pending.target) && stack.corsair === 0)) {finish(G, ctx); return;}
    const ports = zonePorts(pending.zone).filter((id) => tutorialSpaceAllowed(id) && G.spaces[id].control === pending.target).length;
    const base = navalCount(stack) === 1 || ports === 1 ? 1 : 2;
    const dice = roll(ctx, base + bestPiracy(G, pending.zone, [pending.power]) + ((G.haremImpulse ?? G.tutorialEffects?.haremImpulse) === G.impulse ? 1 : 0));
    pending.remaining = hits(dice);
    pending.step = "rewards";
    G.lastRolls = `Piracy [${dice.join(",")}] = ${pending.remaining} hits`;
    pushLog(G, G.lastRolls);
    if (G.seaZones[pending.zone].leaders.includes("dragut") && G.tutorialEffects) G.tutorialEffects.dragutWindow = true;
    if (pending.remaining === 0 || !piracyOptions(G).length) finish(G, ctx);
    else prompt(G, ctx);
};

export const startPiracy = (G: VQGame, ctx: Ctx, power: Power, target: Power, zone: SeaZoneID): void => {
    G.piracyUsed ??= {};
    G.piracyUsed[power] ??= [];
    G.piracyUsed[power]!.push(zone);
    // #11 Dragut Falls may be played after a piracy action involving Dragut.
    if (G.seaZones[zone].leaders.includes("dragut") && leaderPower(G, "dragut") === power) G.dragutFought = true;
    let dice = power === "ottoman" && (G.seaZones[zone].naval.ottoman?.corsair ?? 0) > 0
        ? 2 * navalCount(G.seaZones[zone].naval[target])
        : 0;
    for (const location of adjacentLocations(zone)) {
        for (const other of POWERS) {
            if (other !== target && !atWar(G, power, other)) continue;
            const stack = stacks(G, location)[other];
            if (stack) dice += stack.galley + stack.galleon + stack.racebuilt;
        }
    }
    dice += zonePorts(zone).filter((id) => {
        const space = G.spaces[id];
        if (space.unrest || space.siege || !isPower(space.control)) return false;
        if (space.control !== target && !atWar(G, power, space.control)) return false;
        return G.scenario === "tutorial" ? TUTORIAL_FORTRESSES.includes(id) : SPACE_BY_ID[id]?.kind === "fortress";
    }).length;
    if (power === "ottoman" && zonePorts(zone).includes("malta") && (G.spaces.malta.land.spain?.regular ?? 0) > 0) dice += 1;
    const defense = roll(ctx, dice);
    let remaining = hits(defense);
    const stack = G.seaZones[zone].naval[power]!;
    if (power === "ottoman") {
        const lost = Math.min(stack.corsair, remaining);
        stack.corsair -= lost;
        remaining -= lost;
    }
    G.pendingPiracy = {power, target, zone, step: "losses", remaining, rewards: {}};
    pushLog(G, `Piracy defense [${defense.join(",")}] = ${hits(defense)} hits.`);
    if (remaining > 0 && piracyOptions(G).length) prompt(G, ctx);
    else rollPiracy(G, ctx);
};

export const choosePiracy = (G: VQGame, ctx: Ctx, args: {choice: string}): void | typeof INVALID_MOVE => {
    const pending = G.pendingPiracy;
    if (!pending || ctx.playerID !== ownerOf(G, pending.step === "losses" ? pending.power : pending.target) || !piracyOptions(G).some((entry) => entry.id === args.choice)) return INVALID_MOVE;
    const [action, location, kind] = args.choice.split(":");
    if (pending.step === "losses") {
        G.seaZones[pending.zone].naval[pending.power]![location as "galley"] -= 1;
        recordNavalLoss(G, pending.power, location as "galley");
        pending.remaining = Math.max(0, pending.remaining - 2);
        if (pending.remaining === 0 || piracyOptions(G).length === 0) rollPiracy(G, ctx);
        return;
    }
    if (action === "ship") stacks(G, location)[pending.target]![kind as "galley"] -= 1;
    if (action === "card") {
        const id = shuffle(ctx, G.powers[pending.target].cards.filter((card) => cardById(card).kind !== "home"))[0];
        removeCardFromHand(G, pending.target, id);
        G.powers[pending.power].cards.push(id);
    }
    if (action === "vp") {
        if (G.scenario === "tutorial") {
            const change = pending.power === "ottoman" ? 1 : (G.tutorialEffects!.piracyVp > 0 ? -1 : 0);
            G.tutorialEffects!.piracyVp += change;
            G.powers.ottoman.bonusVp += change;
        } else {
            addVp(G, pending.power, 1);
        }
    }
    pending.rewards[action] = (pending.rewards[action] ?? 0) + 1;
    pending.remaining -= 1;
    if (pending.remaining === 0 || piracyOptions(G).length === 0) finish(G, ctx);
};
