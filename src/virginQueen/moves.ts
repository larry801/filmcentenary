import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {
    CardDef,
    Controller,
    landCount,
    MinorPower,
    MINOR_POWERS,
    NavalStack,
    navalCount,
    POWER_INFO,
    POWERS,
    Power,
    Religion,
    ReligionArea,
    VQGame,
    isPower,
    powerAt,
} from "./constant/general";
import {cardById} from "./constant/cards";
import {patronById, royalAvailable, seaCaptainById} from "./scenario";
import {LEADER_BY_ID} from "./constant/leaders";
import {
    CAPITAL_SPACES,
    KEY_SPACES,
    LAND_NEIGHBORS,
    SPACE_BY_ID,
    SPACES,
} from "./constant/spaces";
import {
    addLand,
    addNaval,
    addVp,
    allied,
    assaultSpace,
    atWar,
    atWarWithMinor,
    bestBattle,
    bestPiracy,
    canControlSpace,
    canDeclareWar,
    capitalOf,
    captureLeaders,
    cleanupLand,
    cleanupNaval,
    clearWar,
    dealYear,
    discardCard,
    ensureLand,
    ensureNaval,
    exactLand,
    exactNaval,
    fieldBattle,
    friendly,
    friendlyControlled,
    hasLOC,
    hits,
    isFortifiedSpace,
    isPort,
    isSeaZone,
    leadersAt,
    navalAdjacent,
    ownersWithLand,
    ownersWithNaval,
    passBetween,
    portZones,
    powerLabel,
    pushLog,
    rebellionTargets,
    religionCandidates,
    removeCardFromHand,
    removeLandLosses,
    removePortNavalLosses,
    removeSeaNavalLosses,
    resolveConversions,
    resolveEvent,
    resolveOfficialCardEffect,
    resolveRebellion,
    roll,
    setWar,
    shuffle,
    spaceHasEnemyLand,
    totalLand,
    totalNaval,
    warCost,
    zonePorts,
} from "./util";

const power = (ctx: Ctx): Power => powerAt(ctx.currentPlayer);

const markAction = (G: VQGame, p: Power): void => {
    G.powers[p].passed = false;
    G.consecutivePasses = 0;
};

const spend = (G: VQGame, p: Power, cost: number): boolean => {
    if (G.powers[p].cp < cost) {
        return false;
    }
    G.powers[p].cp -= cost;
    markAction(G, p);
    return true;
};

const canUseCardForWar = (c: CardDef): boolean => c.kind !== "home";

const payWarCost = (G: VQGame, p: Power, cost: number): boolean => {
    const usable = G.powers[p].cards
        .filter((id) => canUseCardForWar(cardById(id)))
        .sort((a, b) => cardById(a).cp - cardById(b).cp);
    let total = 0;
    const toDiscard: string[] = [];
    for (const c of usable) {
        if (total >= cost) {
            break;
        }
        total += cardById(c).cp;
        toDiscard.push(c);
    }
    if (total < cost) {
        // Treasures may be used to pay for declarations of war (rule 9.4).
        while (total < cost && G.powers[p].treasures.length > 0) {
            total += G.powers[p].treasures.pop() ?? 0;
        }
        if (total < cost) {
            return false;
        }
    }
    for (const c of toDiscard) {
        removeCardFromHand(G, p, c);
        discardCard(G, p, c, false);
    }
    return true;
};

// --------------------------------------------------------------------------
// Action Phase: impulses
// --------------------------------------------------------------------------

export const playCard = (G: VQGame, ctx: Ctx, args: { cardId: string; asEvent?: boolean; target?: string }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const ps = G.powers[p];
    if (ps.cardPlayed) {
        return INVALID_MOVE;
    }
    if (!ps.cards.includes(args.cardId)) {
        return INVALID_MOVE;
    }
    const def = cardById(args.cardId);
    if (args.asEvent === true && def.officialEffect?.kind === "conversion" &&
        def.officialEffect.areas.length > 1 && args.target === undefined) {
        return INVALID_MOVE;
    }
    const mandatory = def.officialKind === "mandatory";
    const timedCombatCard = def.officialKind === "combat";
    const timedResponseCard = def.officialKind === "response";
    if (mandatory && args.asEvent !== true) {
        return INVALID_MOVE;
    }
    if (args.asEvent === true && def.kind === "command" && !mandatory && !timedCombatCard && !timedResponseCard) {
        return INVALID_MOVE;
    }
    if (args.asEvent === true && timedCombatCard &&
        (G.cardWindow?.kind !== "combat" || (def.officialEffect?.kind === "combat" &&
            def.officialEffect.phase !== undefined && def.officialEffect.phase !== "any" &&
            G.cardWindow.phase !== def.officialEffect.phase) ||
            (G.cardWindow.attacker !== undefined && G.cardWindow.attacker !== p))) {
        return INVALID_MOVE;
    }
    if (args.asEvent === true && timedResponseCard && G.cardWindow?.kind !== "response") {
        return INVALID_MOVE;
    }
    removeCardFromHand(G, p, args.cardId);
    discardCard(G, p, args.cardId, args.asEvent === true);
    ps.cardPlayed = true;
    markAction(G, p);
    if (args.asEvent === true) {
        pushLog(G, `${powerLabel(p)} plays ${def.name} as an event.`);
        if (def.effect !== undefined) {
            resolveEvent(G, ctx, p, def.effect);
        } else if (def.officialEffect !== undefined &&
            resolveOfficialCardEffect(G, ctx, p, def, args.target)) {
            // The typed card-table effect resolved above.
        } else if (def.officialNumber !== undefined) {
            pushLog(G, `Official event text: ${def.text ?? ""}`);
        }
        if (mandatory) {
            // Mandatory events resolve before their printed two command points.
            ps.cp += 2;
            pushLog(G, `${powerLabel(p)} receives 2 CP after the mandatory event.`);
        }
    } else {
        ps.cp += def.cp;
        pushLog(G, `${powerLabel(p)} plays ${def.name} for ${def.cp} CP.`);
    }
};

export const playTreasure = (G: VQGame, ctx: Ctx, args: { index: number }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const ps = G.powers[p];
    if (!ps.cardPlayed || ps.treasurePlayed) {
        return INVALID_MOVE;
    }
    const idx = Number(args.index);
    const value = ps.treasures[idx];
    if (value === undefined) {
        return INVALID_MOVE;
    }
    ps.treasures.splice(idx, 1);
    ps.cp += value;
    ps.treasurePlayed = true;
    pushLog(G, `${powerLabel(p)} extends the impulse with a ${value} CP treasure.`);
};

export const pass = (G: VQGame, ctx: Ctx): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    if (G.powers[p].cards.some((id) => cardById(id).officialKind === "mandatory")) {
        return INVALID_MOVE;
    }
    G.powers[p].cp = 0;
    G.powers[p].passed = true;
    G.consecutivePasses += 1;
    pushLog(G, `${powerLabel(p)} passes.`);
    ctx.events?.endTurn();
};

export const endImpulse = (G: VQGame, ctx: Ctx): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    if (G.powers[p].cards.some((id) => cardById(id).officialKind === "mandatory")) {
        return INVALID_MOVE;
    }
    if (!G.powers[p].cardPlayed) {
        G.powers[p].passed = true;
        G.consecutivePasses += 1;
        pushLog(G, `${powerLabel(p)} passes (no card played).`);
    }
    G.powers[p].cp = 0;
    ctx.events?.endTurn();
};

export const endPhaseTurn = (_G: VQGame, ctx: Ctx): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "cardDraw" && ctx.phase !== "diplomacy" && ctx.phase !== "spring") {
        return INVALID_MOVE;
    }
    ctx.events?.endTurn();
};

export const claimSeaCaptain = (G: VQGame, ctx: Ctx, args: {captain: string}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "cardDraw") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const captain = seaCaptainById(args.captain);
    if (captain === undefined || captain.power !== "france/protestant" || captain.turn > G.year ||
        !G.seaCaptainsAvailable.includes(captain.id) || G.powers[p].seaCaptains.includes(captain.id) ||
        (p !== "france" && p !== "protestant")) {
        return INVALID_MOVE;
    }
    G.seaCaptainsAvailable = G.seaCaptainsAvailable.filter((id) => id !== captain.id);
    G.powers[p].seaCaptains.push(captain.id);
    pushLog(G, `${powerLabel(p)} claims shared Sea Captain ${captain.nameEn}.`);
};

// --------------------------------------------------------------------------
// Diplomacy
// --------------------------------------------------------------------------

export const declareWar = (G: VQGame, ctx: Ctx, args: { target: Power }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "diplomacy") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const target = args.target;
    if (!isPower(target) || !canDeclareWar(G, p, target)) {
        return INVALID_MOVE;
    }
    const cost = warCost(G, p, target);
    if (!payWarCost(G, p, cost)) {
        return INVALID_MOVE;
    }
    setWar(G, p, target);
    pushLog(G, `${powerLabel(p)} pays ${cost} CP for the declaration of war.`);
};

export const declareWarMinor = (G: VQGame, ctx: Ctx, args: { target: MinorPower }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "diplomacy") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const target = args.target;
    if (!MINOR_POWERS.includes(target) || G.powers[p].warsMinors.includes(target)) {
        return INVALID_MOVE;
    }
    if (!payWarCost(G, p, 2)) {
        return INVALID_MOVE;
    }
    G.powers[p].warsMinors.push(target);
    pushLog(G, `${powerLabel(p)} declares war on ${target}.`);
};

export const makePeace = (G: VQGame, ctx: Ctx, args: { target: Power }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "diplomacy") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    if (!atWar(G, p, args.target)) {
        return INVALID_MOVE;
    }
    if ((p === "england" && args.target === "spain") || (p === "spain" && args.target === "england")) {
        return INVALID_MOVE;
    }
    clearWar(G, p, args.target);
    pushLog(G, `${powerLabel(p)} and ${powerLabel(args.target)} end their war by agreement.`);
};

export const formAlliance = (G: VQGame, ctx: Ctx, args: { target: Power }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "diplomacy") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const t = args.target;
    if (!isPower(t) || p === t || atWar(G, p, t) || allied(G, p, t)) {
        return INVALID_MOVE;
    }
    if ((p === "spain" && t === "protestant") || (p === "protestant" && t === "spain")) {
        return INVALID_MOVE;
    }
    if (p === "france") {
        if ((t === "spain" && G.powers.france.allies.includes("protestant"))
            || (t === "protestant" && G.powers.france.allies.includes("spain"))) {
            return INVALID_MOVE;
        }
    }
    G.powers[p].allies.push(t);
    G.powers[t].allies.push(p);
    pushLog(G, `${powerLabel(p)} and ${powerLabel(t)} form an alliance for this turn.`);
};

export const betroth = (G: VQGame, ctx: Ctx, args: { male: string; female: string }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "diplomacy") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const male = G.royals.find((r) => r.id === args.male);
    const female = G.royals.find((r) => r.id === args.female);
    if (male === undefined || female === undefined || male.gender !== "male" || female.gender !== "female") {
        return INVALID_MOVE;
    }
    if (!royalAvailable(male) || !royalAvailable(female) || (male.turn ?? 1) > G.year || (female.turn ?? 1) > G.year) {
        return INVALID_MOVE;
    }
    if (male.power === female.power) {
        return INVALID_MOVE;
    }
    if (male.family !== undefined && male.family === female.family) {
        return INVALID_MOVE;
    }
    if (atWar(G, male.power, female.power)) {
        return INVALID_MOVE;
    }
    if (p !== male.power && p !== female.power) {
        return INVALID_MOVE;
    }
    G.betrothals.push({male: male.id, female: female.id});
    pushLog(G, `${male.name} and ${female.name} are betrothed.`);
};

export const ransom = (G: VQGame, ctx: Ctx, args: { leaderId: string }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "diplomacy") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const def = LEADER_BY_ID[args.leaderId];
    const st = G.leaders[args.leaderId];
    if (def === undefined || st === undefined || def.power !== p || st.location !== "captured") {
        return INVALID_MOVE;
    }
    const usable = G.powers[p].cards.filter((id) => cardById(id).kind !== "home");
    if (usable.length > 0) {
        const paid = shuffle(ctx, usable)[0];
        removeCardFromHand(G, p, paid);
        discardCard(G, p, paid, false);
    } else if (G.powers[p].treasures.length > 0) {
        G.powers[p].treasures.pop();
    } else {
        return INVALID_MOVE;
    }
    const dest = capitalOf(G, p) ?? KEY_SPACES.find((id) => G.spaces[id].control === p);
    if (dest === undefined) {
        return INVALID_MOVE;
    }
    G.leaders[args.leaderId] = {id: args.leaderId, location: dest};
    G.spaces[dest].leaders.push(args.leaderId);
    pushLog(G, `${def.name} is ransomed and returns to ${SPACE_BY_ID[dest].name}.`);
};

// --------------------------------------------------------------------------
// Spring Deployment
// --------------------------------------------------------------------------

export const springDeploy = (G: VQGame, ctx: Ctx, args: { from: string; to: string }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "spring") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    if (G.springDone.includes(p)) {
        return INVALID_MOVE;
    }
    const caps = CAPITAL_SPACES[p];
    if (!caps.includes(args.from) || G.spaces[args.from] === undefined) {
        return INVALID_MOVE;
    }
    if (!G.spaces[args.from] || (G.spaces[args.from].control !== p && !friendlyControlled(G, p, args.from))) {
        return INVALID_MOVE;
    }
    const to = args.to;
    if (G.spaces[to] === undefined || !friendlyControlled(G, p, to) || G.spaces[to].unrest) {
        return INVALID_MOVE;
    }
    const direct = LAND_NEIGHBORS[args.from].find((n) => n.id === to && !n.pass);
    const sea = portZones(args.from).some((z) => portZones(to).includes(z));
    if (direct === undefined && !sea) {
        return INVALID_MOVE;
    }
    if (sea && !direct) {
        const zones = portZones(args.from).filter((z) => portZones(to).includes(z));
        if (zones.length === 0) {
            return INVALID_MOVE;
        }
        const zone = zones[0];
        const enemyShips = ownersWithNaval(G, zone).some((c) => isPower(c) && atWar(G, p, c) && navalCount(G.seaZones[zone].naval[c]) > 0);
        if (enemyShips) {
            return INVALID_MOVE;
        }
    }
    const stack = G.spaces[args.from].land[p];
    if (stack === undefined || landCount(stack) === 0) {
        return INVALID_MOVE;
    }
    const leaders = G.spaces[args.from].leaders.filter((id) => LEADER_BY_ID[id]?.power === p && LEADER_BY_ID[id]?.kind === "army");
    const target = ensureLand(G, to, p);
    target.regular += stack.regular;
    target.merc += stack.merc;
    target.cav += stack.cav;
    delete G.spaces[args.from].land[p];
    for (const id of leaders) {
        G.spaces[args.from].leaders = G.spaces[args.from].leaders.filter((x) => x !== id);
        G.spaces[to].leaders.push(id);
        G.leaders[id].location = to;
    }
    G.springDone.push(p);
    pushLog(G, `${powerLabel(p)} redeploys from ${SPACE_BY_ID[args.from].name} to ${SPACE_BY_ID[to].name}.`);
};

// --------------------------------------------------------------------------
// Action Phase: construction
// --------------------------------------------------------------------------

export const recruit = (G: VQGame, ctx: Ctx, args: { space: string; kind: "regular" | "merc" | "cav" }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const space = args.space;
    const s = G.spaces[space];
    const def = SPACE_BY_ID[space];
    if (s === undefined || def === undefined) {
        return INVALID_MOVE;
    }
    if (s.control !== p || s.unrest || !isFortifiedSpace(G, space)) {
        return INVALID_MOVE;
    }
    if (def.home !== p && !(isPower(def.home) && allied(G, p, def.home))) {
        return INVALID_MOVE;
    }
    if (spaceHasEnemyLand(G, p, space) || !hasLOC(G, p, space)) {
        return INVALID_MOVE;
    }
    if (args.kind === "cav" && p !== "ottoman") {
        return INVALID_MOVE;
    }
    if (args.kind === "merc" && p === "ottoman") {
        return INVALID_MOVE;
    }
    if (!spend(G, p, 1)) {
        return INVALID_MOVE;
    }
    addLand(G, space, p, args.kind, 1);
    pushLog(G, `${powerLabel(p)} recruits 1 ${args.kind} in ${def.name}.`);
};

export const buildNaval = (G: VQGame, ctx: Ctx, args: { port: string; kind: keyof NavalStack }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const port = args.port;
    const s = G.spaces[port];
    const def = SPACE_BY_ID[port];
    if (s === undefined || def === undefined || !isPort(port)) {
        return INVALID_MOVE;
    }
    if (s.control !== p || s.unrest || spaceHasEnemyLand(G, p, port)) {
        return INVALID_MOVE;
    }
    if (def.home !== p) {
        return INVALID_MOVE;
    }
    const kind = args.kind;
    const cost: Record<string, number> = {galley: 1, galleon: 2, racebuilt: 2, corsair: 1};
    if (kind === "racebuilt" && p !== "england") {
        return INVALID_MOVE;
    }
    if (kind === "corsair" && p !== "ottoman") {
        return INVALID_MOVE;
    }
    if (kind === "galleon" && !portZones(port).some((z) => z === "atlanticOcean" || z === "englishChannel" || z === "northSea" || z === "irishSea" || z === "bayOfBiscay")) {
        return INVALID_MOVE;
    }
    if (!spend(G, p, cost[kind] ?? 2)) {
        return INVALID_MOVE;
    }
    const placedKind = kind === "galleon" && p === "england" && port === "london" && G.year >= 3 &&
        G.powers.england.seaCaptains.includes("hawkins") ? "racebuilt" : kind;
    addNaval(G, port, p, placedKind, 1);
    pushLog(G, `${powerLabel(p)} builds a ${placedKind} in ${def.name}${placedKind !== kind ? " (Hawkins)" : ""}.`);
};

export const buildFortress = (G: VQGame, ctx: Ctx, args: { space: string }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const s = G.spaces[args.space];
    const def = SPACE_BY_ID[args.space];
    if (s === undefined || def === undefined) {
        return INVALID_MOVE;
    }
    if (def.kind !== "open" || s.fortress || s.control !== p || s.unrest || def.home !== p) {
        return INVALID_MOVE;
    }
    if (!spend(G, p, 2)) {
        return INVALID_MOVE;
    }
    s.fortress = true;
    pushLog(G, `${powerLabel(p)} builds a fortress in ${def.name}.`);
};

export const influence = (G: VQGame, ctx: Ctx, args: { target: MinorPower }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    if (!MINOR_POWERS.includes(args.target)) {
        return INVALID_MOVE;
    }
    const cur = G.powers[p].influence[args.target] ?? 0;
    if (cur >= 9 || !spend(G, p, 1)) {
        return INVALID_MOVE;
    }
    G.powers[p].influence[args.target] = cur + 1;
    pushLog(G, `${powerLabel(p)} buys influence with ${args.target} (${cur + 1}).`);
};

export const patronize = (G: VQGame, ctx: Ctx, args: { patron: string; cp: number }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const patron = patronById(G, args.patron);
    if (patron === undefined || patron.region !== p || patron.rating === null) {
        return INVALID_MOVE;
    }
    if (POWERS.some((x) => G.powers[x].patrons.includes(patron.id))) {
        return INVALID_MOVE;
    }
    const patronageKey = `${p}:${patron.kind}`;
    if (G.patronizedThisTurn.includes(patronageKey)) {
        return INVALID_MOVE;
    }
    if (!Number.isInteger(args.cp) || args.cp < 2 || args.cp > 4 || !spend(G, p, args.cp)) {
        return INVALID_MOVE;
    }
    G.pendingPatronage.push({power: p, patronId: patron.id, cp: args.cp});
    G.patronizedThisTurn.push(patronageKey);
    pushLog(G, `${powerLabel(p)} sponsors ${patron.name} for ${args.cp} CP; Winter Patronage resolution is pending.`);
};

// --------------------------------------------------------------------------
// Movement
// --------------------------------------------------------------------------

export const moveLand = (G: VQGame, ctx: Ctx, args: { from: string; to: string }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const from = args.from;
    const to = args.to;
    if (G.spaces[from] === undefined || G.spaces[to] === undefined || from === to) {
        return INVALID_MOVE;
    }
    if (!LAND_NEIGHBORS[from].some((n) => n.id === to)) {
        return INVALID_MOVE;
    }
    const stack = G.spaces[from].land[p];
    if (stack === undefined || landCount(stack) === 0) {
        return INVALID_MOVE;
    }
    if (spaceHasEnemyLand(G, p, from) && G.spaces[from].siege !== undefined && G.spaces[from].siege?.by !== p) {
        // Units under siege may not move; the besieger may march away.
        return INVALID_MOVE;
    }
    const dest = G.spaces[to];
    const destControl = dest.control;
    const canEnter = friendlyControlled(G, p, to)
        || destControl === "independent"
        || (isPower(destControl) ? atWar(G, p, destControl) : atWarWithMinor(G, p, destControl as MinorPower));
    const otherUnits = ownersWithLand(G, to).filter((c) => c !== p && !(isPower(c) && friendly(G, p, c)));
    if (!canEnter && otherUnits.length === 0) {
        return INVALID_MOVE;
    }
    const cost = passBetween(from, to) ? 2 : 1;
    if (!spend(G, p, cost)) {
        return INVALID_MOVE;
    }
    const leaders = G.spaces[from].leaders.filter((id) => LEADER_BY_ID[id]?.power === p && LEADER_BY_ID[id]?.kind === "army");
    const tgt = ensureLand(G, to, p);
    tgt.regular += stack.regular;
    tgt.merc += stack.merc;
    tgt.cav += stack.cav;
    delete G.spaces[from].land[p];
    for (const id of leaders) {
        G.spaces[from].leaders = G.spaces[from].leaders.filter((x) => x !== id);
        G.spaces[to].leaders.push(id);
        G.leaders[id].location = to;
    }
    pushLog(G, `${powerLabel(p)} moves ${landCount(stack)} unit(s) from ${SPACE_BY_ID[from].name} to ${SPACE_BY_ID[to].name}.`);
    // Marching the besiegers away lifts the siege (rule 15.3).
    const oldSiege = G.spaces[from].siege;
    if (oldSiege !== undefined && oldSiege.by === p) {
        const stillBesieging = totalLand(G, from, [p]);
        const defenders = totalLand(G, from, ownersWithLand(G, from).filter((c) => c !== p) as Controller[]);
        if (stillBesieging <= defenders) {
            delete G.spaces[from].siege;
            pushLog(G, `The siege of ${SPACE_BY_ID[from].name} is lifted.`);
        }
    }

    const hostile = ownersWithLand(G, to)
        .filter((c) => c !== p && !(isPower(c) && friendly(G, p, c)))
        .filter((c) => isPower(c) ? atWar(G, p, c) : true);
    const defenders = totalLand(G, to, hostile);
    if (defenders > 0) {
        if (isFortifiedSpace(G, to) && defenders <= 4) {
            if (totalLand(G, to, [p]) > defenders) {
                dest.siege = {by: p, sinceImpulse: G.impulse};
                pushLog(G, `The defenders of ${SPACE_BY_ID[to].name} withdraw into the fortifications; the space is under siege.`);
            } else {
                const st = G.spaces[to].land[p];
                if (st !== undefined) {
                    delete G.spaces[to].land[p];
                    const back = ensureLand(G, from, p);
                    back.regular += st.regular;
                    back.merc += st.merc;
                    back.cav += st.cav;
                    for (const id of leaders) {
                        G.spaces[to].leaders = G.spaces[to].leaders.filter((x) => x !== id);
                        G.spaces[from].leaders.push(id);
                        G.leaders[id].location = from;
                    }
                    pushLog(G, "Not enough troops to besiege the space; the formation returns.");
                }
            }
        } else {
            fieldBattle(G, ctx, to, p, hostile, from);
        }
        return;
    }
    if (isFortifiedSpace(G, to) && !friendlyControlled(G, p, to)) {
        dest.siege = {by: p, sinceImpulse: G.impulse};
        pushLog(G, `${SPACE_BY_ID[to].name} is under siege.`);
    }
};

export const moveNaval = (G: VQGame, ctx: Ctx, args: { from: string; to: string }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const from = args.from;
    const to = args.to;
    if (!isSeaZone(from) && G.spaces[from] === undefined) {
        return INVALID_MOVE;
    }
    if (!isSeaZone(to) && G.spaces[to] === undefined) {
        return INVALID_MOVE;
    }
    if (!navalAdjacent(from, to)) {
        return INVALID_MOVE;
    }
    const stack = isSeaZone(from) ? G.seaZones[from as keyof VQGame["seaZones"]].naval[p] : G.spaces[from].naval[p];
    if (stack === undefined || navalCount(stack) === 0) {
        return INVALID_MOVE;
    }
    if (G.spaces[to] !== undefined && G.spaces[to].control !== p && !friendlyControlled(G, p, to)) {
        const enemyNaval = ownersWithNaval(G, to).some((c) => isPower(c) && atWar(G, p, c));
        if (!enemyNaval) {
            return INVALID_MOVE;
        }
    }
    if (!spend(G, p, 1)) {
        return INVALID_MOVE;
    }
    const leaders = (isSeaZone(from) ? G.seaZones[from as keyof VQGame["seaZones"]].leaders : G.spaces[from].leaders)
        .filter((id) => LEADER_BY_ID[id]?.power === p && LEADER_BY_ID[id]?.kind === "naval");
    if (isSeaZone(to)) {
        const dst = G.seaZones[to as keyof VQGame["seaZones"]];
        const tgt = dst.naval[p] ?? {galley: 0, galleon: 0, racebuilt: 0, corsair: 0};
        tgt.galley += stack.galley;
        tgt.galleon += stack.galleon;
        tgt.racebuilt += stack.racebuilt;
        tgt.corsair += stack.corsair;
        dst.naval[p] = tgt;
    } else {
        const dst = ensureNaval(G, to, p);
        dst.galley += stack.galley;
        dst.galleon += stack.galleon;
        dst.racebuilt += stack.racebuilt;
        dst.corsair += stack.corsair;
    }
    if (isSeaZone(from)) {
        delete G.seaZones[from as keyof VQGame["seaZones"]].naval[p];
    } else {
        delete G.spaces[from].naval[p];
    }
    for (const id of leaders) {
        if (isSeaZone(from)) {
            G.seaZones[from as keyof VQGame["seaZones"]].leaders = G.seaZones[from as keyof VQGame["seaZones"]].leaders.filter((x) => x !== id);
        } else {
            G.spaces[from].leaders = G.spaces[from].leaders.filter((x) => x !== id);
        }
        if (isSeaZone(to)) {
            G.seaZones[to as keyof VQGame["seaZones"]].leaders.push(id);
        } else {
            G.spaces[to].leaders.push(id);
        }
        G.leaders[id].location = to;
    }
    pushLog(G, `${powerLabel(p)} sails from ${from} to ${to}.`);

    // Naval combat against enemy squadrons in a sea zone.
    if (isSeaZone(to)) {
        const zone = to as keyof VQGame["seaZones"];
        const enemies = ownersWithNaval(G, to).filter((c) => c !== p && isPower(c) && atWar(G, p, c) && navalCount(G.seaZones[zone].naval[c]) > 0);
        if (enemies.length > 0) {
            const aUnits = navalCount(G.seaZones[zone].naval[p]);
            const dUnits = enemies.reduce((n, c) => n + navalCount(G.seaZones[zone].naval[c]), 0);
            const med = ["gulfOfLyon", "tyrrhenian", "ionian", "adriatic", "aegean", "easternMediterranean", "barbaryCoast", "northAfricanCoast"].includes(to);
            const hasGalleys = (G.seaZones[zone].naval[p]?.galley ?? 0) > 0;
            const galleyPenalty = !med && hasGalleys ? 1 : 0;
            const aDice = Math.max(1, aUnits + bestBattle(G, to, [p], "naval") - galleyPenalty);
            const dDice = Math.max(1, dUnits + bestBattle(G, to, enemies, "naval"));
            const aHits = hits(roll(ctx, aDice));
            const dHits = hits(roll(ctx, dDice));
            G.lastRolls = `Naval battle at ${to}: ${aHits} hits (${aDice} dice) vs ${dHits} hits (${dDice} dice)`;
            pushLog(G, G.lastRolls);
            removeSeaNavalLosses(G, zone, enemies, aHits);
            removeSeaNavalLosses(G, zone, [p], dHits);
            if (aHits <= dHits) {
                const left = G.seaZones[zone].naval[p];
                if (left !== undefined) {
                    const back = ensureNaval(G, from, p);
                    back.galley += left.galley;
                    back.galleon += left.galleon;
                    back.racebuilt += left.racebuilt;
                    back.corsair += left.corsair;
                    delete G.seaZones[zone].naval[p];
                }
                pushLog(G, `${powerLabel(p)} loses the naval battle and returns to ${from}.`);
            }
        }
    } else {
        // Port combat: the only reason to enter a hostile port is to fight the
        // squadron sheltering there.
        const enemies = ownersWithNaval(G, to).filter((c) => c !== p && isPower(c) && atWar(G, p, c) && navalCount(G.spaces[to].naval[c]) > 0);
        if (enemies.length > 0) {
            const aUnits = navalCount(G.spaces[to].naval[p]);
            const dUnits = enemies.reduce((n, c) => n + navalCount(G.spaces[to].naval[c]), 0);
            const aDice = Math.max(1, aUnits + bestBattle(G, to, [p], "naval"));
            const dDice = Math.max(1, dUnits + bestBattle(G, to, enemies, "naval"));
            const aHits = hits(roll(ctx, aDice));
            const dHits = hits(roll(ctx, dDice));
            G.lastRolls = `Naval battle at ${to}: ${aHits} hits (${aDice} dice) vs ${dHits} hits (${dDice} dice)`;
            pushLog(G, G.lastRolls);
            removePortNavalLosses(G, to, enemies, aHits);
            removePortNavalLosses(G, to, [p], dHits);
            if (aHits <= dHits) {
                const left = G.spaces[to].naval[p];
                if (left !== undefined) {
                    const back = ensureNaval(G, from, p);
                    back.galley += left.galley;
                    back.galleon += left.galleon;
                    back.racebuilt += left.racebuilt;
                    back.corsair += left.corsair;
                    delete G.spaces[to].naval[p];
                }
                pushLog(G, `${powerLabel(p)} loses the naval battle and returns to ${from}.`);
            }
        }
    }
};

// --------------------------------------------------------------------------
// Control, siege, religion
// --------------------------------------------------------------------------

export const controlSpace = (G: VQGame, ctx: Ctx, args: { space: string }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const space = args.space;
    const s = G.spaces[space];
    const def = SPACE_BY_ID[space];
    if (s === undefined || def === undefined) {
        return INVALID_MOVE;
    }
    if (s.unrest) {
        const friendlyPresent = ownersWithLand(G, space).some((c) => isPower(c) && friendly(G, p, c));
        const adjacentFriendly = LAND_NEIGHBORS[space].some((n) => ownersWithLand(G, n.id).some((c) => isPower(c) && friendly(G, p, c)));
        if (!friendlyPresent && !adjacentFriendly) {
            return INVALID_MOVE;
        }
        if (!spend(G, p, 1)) {
            return INVALID_MOVE;
        }
        s.unrest = false;
        pushLog(G, `${powerLabel(p)} removes unrest from ${def.name}.`);
        return;
    }
    const check = canControlSpace(G, p, space);
    if (!check.ok) {
        return INVALID_MOVE;
    }
    if (!spend(G, p, 1)) {
        return INVALID_MOVE;
    }
    s.control = p;
    pushLog(G, `${powerLabel(p)} takes control of ${def.name}.`);
};

export const assault = (G: VQGame, ctx: Ctx, args: { space: string }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const s = G.spaces[args.space];
    if (s === undefined || s.siege === undefined || s.siege.by !== p) {
        return INVALID_MOVE;
    }
    if (s.siege.sinceImpulse >= G.impulse) {
        return INVALID_MOVE;
    }
    if (!hasLOC(G, p, args.space)) {
        return INVALID_MOVE;
    }
    if (!spend(G, p, 1)) {
        return INVALID_MOVE;
    }
    assaultSpace(G, ctx, p, args.space);
};

const allowedPreach = (p: Power, area: ReligionArea): Religion | undefined => {
    if (p === "spain" && area === "england") {
        return "catholic";
    }
    if (p === "protestant" && (area === "france" || area === "netherlands" || area === "scotland")) {
        return "protestant";
    }
    return undefined;
};

export const preach = (G: VQGame, ctx: Ctx, args: { area: ReligionArea }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const side = allowedPreach(p, args.area);
    if (side === undefined || !spend(G, p, 2)) {
        return INVALID_MOVE;
    }
    pushLog(G, `${powerLabel(p)} preaches a sermon in ${args.area}.`);
    resolveConversions(G, ctx, p, side, args.area, 5);
};

export const suppress = (G: VQGame, ctx: Ctx, args: { area: ReligionArea }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    let side: Religion | undefined;
    if (p === "spain" && args.area === "netherlands") {
        side = "catholic";
    } else if (p === "england" && args.area === "england") {
        side = "protestant";
    } else if (p === "france" && (args.area === "france" || args.area === "scotland")) {
        side = "catholic";
    }
    if (side === undefined || !spend(G, p, 2)) {
        return INVALID_MOVE;
    }
    pushLog(G, `${powerLabel(p)} suppresses heresy in ${args.area}.`);
    resolveConversions(G, ctx, p, side, args.area, 5);
};

export const rebellion = (G: VQGame, ctx: Ctx, args: { space: string; cp: number }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const cp = Number(args.cp);
    if (p !== "protestant" || cp < 2 || cp > 5) {
        return INVALID_MOVE;
    }
    if (!rebellionTargets(G).includes(args.space)) {
        return INVALID_MOVE;
    }
    if (!spend(G, p, cp)) {
        return INVALID_MOVE;
    }
    resolveRebellion(G, ctx, p, args.space, cp);
};

// --------------------------------------------------------------------------
// Piracy
// --------------------------------------------------------------------------

export const piracy = (G: VQGame, ctx: Ctx, args: { zone: string; target: Power }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    if (!isSeaZone(args.zone) || !isPower(args.target) || args.target === p) {
        return INVALID_MOVE;
    }
    const zone = args.zone as keyof VQGame["seaZones"];
    const targetPorts = zonePorts(zone).filter((id) => G.spaces[id].control === args.target);
    if (targetPorts.length === 0) {
        return INVALID_MOVE;
    }
    const ownStack = G.seaZones[zone].naval[p];
    if (ownStack === undefined || navalCount(ownStack) === 0) {
        return INVALID_MOVE;
    }
    const corsair = ownStack.corsair > 0;
    if (!atWar(G, p, args.target) && !corsair) {
        return INVALID_MOVE;
    }
    if (!spend(G, p, 1)) {
        return INVALID_MOVE;
    }
    const diceN = navalCount(ownStack) + bestPiracy(G, args.zone, [p]);
    const r = roll(ctx, diceN);
    const h = hits(r);
    G.lastRolls = `Piracy: ${diceN} dice [${r.join(", ")}] = ${h} hit(s)`;
    pushLog(G, G.lastRolls);
    let stolenCards = 0;
    let stolenTreasures = 0;
    let vp = 0;
    for (let i = 0; i < h; i++) {
        const target = G.powers[args.target];
        const stealable = target.cards.filter((id) => cardById(id).kind !== "home");
        if (stealable.length > 0) {
            const picked = shuffle(ctx, stealable)[0];
            removeCardFromHand(G, args.target, picked);
            G.powers[p].cards.push(picked);
            stolenCards += 1;
        } else if (target.treasures.length > 0) {
            const idx = Math.floor(ctx.random?.Die(target.treasures.length) ?? 1) - 1;
            const [v] = target.treasures.splice(idx, 1);
            G.powers[p].treasures.push(v);
            stolenTreasures += 1;
        } else {
            addVp(G, p, 1);
            vp += 1;
        }
    }
    pushLog(G, `Piracy results: ${stolenCards} card(s), ${stolenTreasures} treasure(s), ${vp} VP.`);
};

// --------------------------------------------------------------------------
// Convenience
// --------------------------------------------------------------------------

export const noop = (): void => {
    // Used by the client to clear a local selection.
};
