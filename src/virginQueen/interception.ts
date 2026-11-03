import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {Controller, Power, SeaZoneID, VQGame, landCount, navalCount} from "./constant/general";
import {LEADER_BY_ID} from "./constant/leaders";
import {LAND_NEIGHBORS, SEA_ZONE_BY_ID, SPACE_BY_ID} from "./mapData";
import {ownerOf} from "./ownership";
import {tutorialSpaceAllowed} from "./tutorial";
import {startBattle} from "./combat";
import {
    atWar, bestBattle, ensureLand, ensureNaval, friendlyControlled, friendlyController, isFortifiedSpace,
    isSeaZone, moveLeaders, navalAdjacent, ownersWithLand, ownersWithNaval, powerLabel, pushLog, roll, totalLand,
} from "./util";
import {playBeaconFires} from "./navalCombat";

const candidateSpaces = (G: VQGame): string[] => {
    const pending = G.pendingIntercept;
    if (!pending) return [];
    const used = G.interceptedThisImpulse?.impulse === G.impulse ? G.interceptedThisImpulse.spaces : [];
    const locations = pending.phase === "field" ? (LAND_NEIGHBORS[pending.to] ?? []).filter((link) => !link.pass).map((link) => link.id) :
        [...Object.keys(G.spaces), ...Object.keys(SEA_ZONE_BY_ID)].filter((id) => navalAdjacent(id, pending.to));
    return locations.filter((id) => {
        if (id === pending.from || pending.attempted.includes(id) || used.includes(id)) return false;
        if (pending.phase === "field") {
            const space = G.spaces[id];
            const stack = space?.land[pending.defender];
            return tutorialSpaceAllowed(id) && !!stack && landCount(stack) > 0 && !space.siege;
        }
        if (!isSeaZone(id) && !tutorialSpaceAllowed(id)) return false;
        const stacks = isSeaZone(id) ? G.seaZones[id as SeaZoneID].naval : G.spaces[id].naval;
        return navalCount(stacks[pending.defender]) > 0 && navalCount(stacks[pending.power]) === 0;
    });
};

export const interceptionOptions = (G: VQGame): {id: string; label: string}[] => {
    const pending = G.pendingIntercept;
    if (!pending) return [];
    const result = candidateSpaces(G).flatMap((id) => {
        const options = [{id: `intercept:${id}`, label: `从 ${SPACE_BY_ID[id]?.name ?? id} 尝试拦截`}];
        if (pending.phase === "naval" && !isSeaZone(id) && SPACE_BY_ID[id].home === pending.defender && G.powers[pending.defender].cards.includes("vq-014")) {
            options.push({id: `beacon:${id}`, label: `打出 Beacon Fires，从 ${SPACE_BY_ID[id].name} 自动拦截`});
        }
        return options;
    });
    return [...result, {id: "done", label: "结束拦截选择"}];
};

const complete = (G: VQGame, ctx: Ctx): void => {
    const pending = G.pendingIntercept!;
    delete G.pendingIntercept;
    const defenders = pending.phase === "field" ? ownersWithLand(G, pending.to).filter((owner) => !friendlyController(G, pending.power, owner)) :
        ownersWithNaval(G, pending.to).filter((owner) => !friendlyController(G, pending.power, owner));
    if (defenders.length > 0) {
        startBattle(G, ctx, pending.phase, pending.to, pending.power, defenders, pending.from, pending.attackers);
        G.pendingBattle!.intercepted = pending.succeeded;
        G.pendingBattle!.transported = pending.transported;
    } else {
        if (pending.phase === "field" && isFortifiedSpace(G, pending.to) && !friendlyControlled(G, pending.power, pending.to)) G.spaces[pending.to].siege = {by: pending.power, sinceImpulse: G.impulse};
        ctx.events?.endStage();
    }
};

export const offerInterception = (G: VQGame, ctx: Ctx, phase: "field" | "naval", from: string, to: string, power: Power, attackers: Controller[] = [power]): boolean => {
    if (G.scenario !== "tutorial") return false;
    if (phase === "field" && isFortifiedSpace(G, to) && friendlyControlled(G, power, to) && !G.spaces[to].siege) return false;
    const defender = power === "ottoman" ? "spain" : "ottoman";
    if (!atWar(G, power, defender)) return false;
    G.pendingIntercept = {power, defender, phase, from, to, attackers, attempted: [], succeeded: false};
    if (!candidateSpaces(G).length) {delete G.pendingIntercept; return false;}
    ctx.events?.setActivePlayers({value: {[ownerOf(G, defender)!]: "interceptChoice"}});
    return true;
};

export const chooseInterception = (G: VQGame, ctx: Ctx, args: {choice: string; units?: {regular: number; merc: number; cav: number}; leaders?: string[]}): void | typeof INVALID_MOVE => {
    const pending = G.pendingIntercept;
    if (!pending || ctx.playerID !== ownerOf(G, pending.defender) || !interceptionOptions(G).some((entry) => entry.id === args.choice)) return INVALID_MOVE;
    if (args.choice === "done") {complete(G, ctx); return;}
    const [action, from] = args.choice.split(":");
    // #14 is legal only while its owner still holds the card and only from a
    // home-port fleet (the option list is computed from the same conditions).
    if (action === "beacon" && !G.powers[pending.defender].cards.includes("vq-014")) return INVALID_MOVE;
    const leaders = (isSeaZone(from) ? G.seaZones[from as SeaZoneID].leaders : G.spaces[from].leaders)
        .filter((id) => LEADER_BY_ID[id]?.power === pending.defender && LEADER_BY_ID[id].kind === (pending.phase === "field" ? "army" : "naval"));
    const selected = args.leaders ?? leaders.slice(0, 2);
    if (selected.some((id) => !leaders.includes(id)) || new Set(selected).size !== selected.length || selected.length > 2) return INVALID_MOVE;
    let moving = args.units;
    if (pending.phase === "field") {
        const source = G.spaces[from].land[pending.defender]!;
        const capacity = Math.max(4, selected.reduce((sum, id) => sum + (LEADER_BY_ID[id].command ?? 0), 0));
        if (!moving) {
            let remaining = capacity;
            moving = {regular: 0, merc: 0, cav: 0};
            for (const kind of ["regular", "merc", "cav"] as const) {moving[kind] = Math.min(source[kind], remaining); remaining -= moving[kind];}
        }
        if (landCount(moving) < 1 || landCount(moving) > capacity || Object.entries(moving).some(([kind, count]) => count < 0 || !Number.isInteger(count) || count > source[kind as keyof typeof source])) return INVALID_MOVE;
    }
    pending.attempted.push(from);
    if (G.interceptedThisImpulse?.impulse !== G.impulse) G.interceptedThisImpulse = {impulse: G.impulse, spaces: []};
    G.interceptedThisImpulse!.spaces.push(from);
    let success = action === "beacon";
    if (success) {
        // Same card, log and +2 dice state as the full-game beaconResponse stage.
        playBeaconFires(G, pending.defender);
    } else {
        const modifier = Math.max(0, ...selected.map((id) => LEADER_BY_ID[id].battle)) + (pending.phase === "field" && pending.defender === "ottoman" && (moving?.cav ?? 0) > 0 ? 1 : 0) -
            (pending.phase === "field" && pending.defender !== "ottoman" && (G.spaces[pending.to].land.ottoman?.cav ?? 0) > 0 ? 1 : 0);
        const dice = roll(ctx, 2);
        success = dice.reduce((sum, value) => sum + value, modifier) >= 9;
        pushLog(G, `Interception from ${from}: [${dice.join(",")}] + ${modifier}: ${success ? "success" : "failed"}.`);
    }
    if (success) {
        pending.succeeded = true;
        if (pending.phase === "field") {
            const source = G.spaces[from].land[pending.defender]!;
            const target = ensureLand(G, pending.to, pending.defender);
            for (const kind of ["regular", "merc", "cav"] as const) {source[kind] -= moving![kind]; target[kind] += moving![kind];}
        } else {
            const source = (isSeaZone(from) ? G.seaZones[from as SeaZoneID].naval : G.spaces[from].naval)[pending.defender]!;
            const target = ensureNaval(G, pending.to, pending.defender);
            for (const kind of ["galley", "galleon", "racebuilt", "corsair"] as const) {target[kind] += source[kind]; source[kind] = 0;}
        }
        moveLeaders(G, from, pending.to, selected);
        if (action === "beacon") {
            pushLog(G, `${powerLabel(pending.defender)} intercepts the naval move into ${SPACE_BY_ID[pending.to]?.name ?? pending.to}.`);
            complete(G, ctx);
            // No battle follows, so the recorded +2 dice have nothing to apply to.
            if (G.pendingBattle === undefined) delete G.navalDiceBonus;
            return;
        }
    }
    if (!candidateSpaces(G).length) complete(G, ctx);
};
