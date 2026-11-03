import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {
    CardDef,
    Controller,
    landCount,
    LandStack,
    MinorPower,
    MINOR_POWERS,
    NavalStack,
    navalCount,
    POWER_INDEX,
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
import {MINOR_DIPLOMACY} from "./data/minorDiplomacy";
import {WORLD_SEA_ZONE_BY_ID, WORLD_SETTLEMENT_BY_ID} from "./data/world";
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
    friendlyController,
    friendlyControlled,
    hasLOC,
    hits,
    homeCardChoiceRequired,
    isFortifiedSpace,
    isPort,
    isSeaZone,
    leadersAt,
    minorAvailable,
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
    resolveMinorDiplomacy,
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

const awardMinorInfluence = (G: VQGame, p: Power, minor: MinorPower, amount: number): void => {
    const current = G.powers[p].influence[minor] ?? 0;
    G.powers[p].influence[minor] = Math.min(9, current + amount);
};

const resolveMinorDiplomacyCard = (G: VQGame, ctx: Ctx, p: Power, def: CardDef): boolean => {
    const handler = def.officialEffect?.kind === "manual" ? def.officialEffect.handler : "";
    if (handler === "kingSebastianDies") {
        for (const major of POWERS) {
            G.minorInfluenceDefaults[major].portugal = major === "england" ? 1 : 0;
            G.powers[major].influence.portugal = G.minorInfluenceDefaults[major].portugal;
        }
        pushLog(G, "Portugal enters play; England starts with 1 diplomatic influence there.");
        return true;
    }
    if (handler === "irishRebellion") {
        if (!["spain", "france", "hre"].includes(p) || G.minorDiplomacyResolved.includes("ireland")) return false;
        awardMinorInfluence(G, p, "ireland", 2);
        resolveMinorDiplomacy(G, ctx, "ireland");
        if (POWERS.some((major) => G.powers[major].alliedMinors.includes("ireland"))) {
            for (const id of ["dublin", "kinsale"]) {
                const units = G.spaces[id]?.land.england;
                if (units !== undefined) {
                    units.regular -= Math.floor(units.regular / 2);
                    units.merc -= Math.floor(units.merc / 2);
                }
            }
        }
        return true;
    }
    if (handler === "scottishLordsRebel") {
        if (G.minorDiplomacyResolved.includes("scotland")) return false;
        const edinburghController = G.spaces.edinburgh?.control;
        const modifier = isPower(edinburghController) ? {[edinburghController]: 1} : {};
        resolveMinorDiplomacy(G, ctx, "scotland", {modifier});
        for (const space of SPACES.filter((s) => s.area === "scotland")) {
            G.spaces[space.id].land = {};
        }
        addLand(G, "edinburgh", "scotland", "regular", 2);
        return true;
    }
    if (handler === "sultanaSafiye" && p !== "ottoman") {
        if (!MINOR_DIPLOMACY.venice.eligible.includes(p) || G.minorDiplomacyResolved.includes("venice")) return false;
        awardMinorInfluence(G, p, "venice", 2);
        resolveMinorDiplomacy(G, ctx, "venice");
        return true;
    }
    if (handler === "donAntonioOfPortugal" && !G.powers[p].alliedMinors.includes("portugal")) {
        if (!MINOR_DIPLOMACY.portugal.eligible.includes(p) || G.minorDiplomacyResolved.includes("portugal") ||
            !minorAvailable(G, "portugal")) return false;
        awardMinorInfluence(G, p, "portugal", 2);
        resolveMinorDiplomacy(G, ctx, "portugal");
        return true;
    }
    return false;
};

const foreignWarPower = (handler: string): "ottoman" | "hre" | undefined =>
    handler === "warInPersia" ? "ottoman" : handler === "warWithPoland" ? "hre" : undefined;

const startForeignWar = (G: VQGame, cardId: string, beneficiary: "ottoman" | "hre", enemyUnits: number): void => {
    const enemy = beneficiary === "ottoman" ? "Persia" : "Poland";
    G.foreignWars[beneficiary] = {
        power: beneficiary,
        cardId,
        enemy,
        enemyUnits,
        units: {regular: 0, merc: 0, cav: 0},
        winnerVp: enemyUnits === 5,
        status: "setup",
    };
    G.powers[beneficiary].cardModifier -= 1;
    G.discard = G.discard.filter((id) => id !== cardId);
    pushLog(G, `${enemyUnits}-unit foreign army appears in ${enemy}; ${powerLabel(beneficiary)} must commit 3–8 land units.`);
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
    const cardHandler = def.officialEffect?.kind === "manual" ? def.officialEffect.handler : "";
    const beneficiary = foreignWarPower(cardHandler);
    if (args.asEvent === true && beneficiary !== undefined) {
        const enemyUnits = Number(args.target);
        if ((enemyUnits !== 3 && enemyUnits !== 5) || G.foreignWars[beneficiary] !== undefined ||
            (beneficiary === "hre" && atWar(G, "hre", "ottoman")) ||
            Object.values(G.spaces).filter((space) => space.siege === undefined)
                .reduce((total, space) => total + landCount(space.land[beneficiary]), 0) < 3) return INVALID_MOVE;
    }
    const cardDiplomacyTarget: MinorPower | undefined = cardHandler === "irishRebellion" ? "ireland" :
        cardHandler === "scottishLordsRebel" ? "scotland" :
            cardHandler === "sultanaSafiye" && p !== "ottoman" ? "venice" :
                cardHandler === "donAntonioOfPortugal" && !ps.alliedMinors.includes("portugal") ? "portugal" : undefined;
    if (args.asEvent === true && cardDiplomacyTarget !== undefined &&
        (G.minorDiplomacyResolved.includes(cardDiplomacyTarget) ||
            !minorAvailable(G, cardDiplomacyTarget))) {
        return INVALID_MOVE;
    }
    if (args.asEvent === true && cardHandler === "irishRebellion" && !["spain", "france", "hre"].includes(p)) {
        return INVALID_MOVE;
    }
    if (args.asEvent === true && cardHandler === "sultanaSafiye" && p !== "ottoman" &&
        !MINOR_DIPLOMACY.venice.eligible.includes(p)) return INVALID_MOVE;
    if (args.asEvent === true && cardHandler === "donAntonioOfPortugal" &&
        !ps.alliedMinors.includes("portugal") && !MINOR_DIPLOMACY.portugal.eligible.includes(p)) return INVALID_MOVE;
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
        if (beneficiary !== undefined) {
            startForeignWar(G, args.cardId, beneficiary, Number(args.target));
        } else if (def.effect !== undefined) {
            resolveEvent(G, ctx, p, def.effect);
        } else if (resolveMinorDiplomacyCard(G, ctx, p, def)) {
            // Official minor-power event handler resolved above.
        } else if (def.officialEffect !== undefined &&
            resolveOfficialCardEffect(G, ctx, p, def, args.target)) {
            // The typed card-table effect resolved above.
        } else if (def.officialNumber !== undefined) {
            pushLog(G, `Official event text: ${def.text ?? ""}`);
        }
        if (cardHandler === "polishRoyalElection" && G.foreignWars.hre?.status === "active") {
            endForeignWar(G, "hre");
            pushLog(G, "The Polish Royal Election ends the HRE's foreign war.");
        }
        if (cardHandler === "selimII") {
            G.powers.ottoman.ruler = "selimII";
            pushLog(G, "Selim II succeeds Suleiman; the Ottoman Home card exception ends.");
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
    if (G.foreignWars[p]?.status === "setup" || G.powers[p].cards.some((id) => cardById(id).officialKind === "mandatory")) {
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
    if (G.foreignWars[p]?.status === "setup") {
        return INVALID_MOVE;
    }
    if (!G.powers[p].cardPlayed) {
        // Ending an impulse without playing a card is a pass, which is illegal
        // while a Mandatory Event is still in hand.  After a card has been
        // played the impulse may end normally, even if another Mandatory Event
        // is waiting for a later impulse this turn.
        if (G.powers[p].cards.some((id) => cardById(id).officialKind === "mandatory")) {
            return INVALID_MOVE;
        }
        G.powers[p].passed = true;
        G.consecutivePasses += 1;
        pushLog(G, `${powerLabel(p)} passes (no card played).`);
    }
    G.powers[p].cp = 0;
    ctx.events?.endTurn();
};

export const endPhaseTurn = (G: VQGame, ctx: Ctx): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "cardDraw" && ctx.phase !== "diplomacy" && ctx.phase !== "spring") {
        return INVALID_MOVE;
    }
    if (ctx.phase === "spring" && homeCardChoiceRequired(G, power(ctx))) {
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
    if (!minorAvailable(G, target)) {
        return INVALID_MOVE;
    }
    if (!MINOR_POWERS.includes(target) || G.powers[p].warsMinors.includes(target) ||
        POWERS.some((major) => G.powers[major].alliedMinors.includes(target)) ||
        G.minorInfluenceBlocked[p].includes(target)) {
        return INVALID_MOVE;
    }
    if (!payWarCost(G, p, 2)) {
        return INVALID_MOVE;
    }
    G.powers[p].warsMinors.push(target);
    pushLog(G, `${powerLabel(p)} declares war on ${target}.`);
    G.minorInfluenceBlocked[p].push(target);
    delete G.powers[p].influence[target];
    delete G.minorInfluenceDefaults[p][target];
    const winner = resolveMinorDiplomacy(G, ctx, target, {
        exclude: [p, ...MINOR_DIPLOMACY[target].deactivate],
    });
    if (winner !== undefined && G.powers[winner].alliedMinors.includes(target)) {
        setWar(G, winner, p);
    }
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

export const proposeBetroth = (G: VQGame, ctx: Ctx, args: { male: string; female: string }): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "diplomacy") {
        return INVALID_MOVE;
    }
    if (G.pendingBetrothal !== null) {
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
    const target = male.power === p ? female.power : male.power;
    G.pendingBetrothal = {male: male.id, female: female.id, proposer: p, target};
    pushLog(G, `${powerLabel(p)} proposes a marriage between ${male.name} and ${female.name}.`);
    const targetPlayerID = String(POWER_INDEX[target]);
    ctx.events?.setActivePlayers?.({value: {[targetPlayerID]: "respondBetroth"}, moveLimit: 1});
};

export const acceptBetroth = (G: VQGame, _ctx: Ctx): void | typeof INVALID_MOVE => {
    if (G.pendingBetrothal === null) {
        return INVALID_MOVE;
    }
    const {male, female} = G.pendingBetrothal;
    const maleDef = G.royals.find((r) => r.id === male);
    const femaleDef = G.royals.find((r) => r.id === female);
    G.betrothals.push({male, female});
    G.pendingBetrothal = null;
    pushLog(G, `${maleDef?.name ?? male} and ${femaleDef?.name ?? female} are betrothed.`);
};

export const rejectBetroth = (G: VQGame, _ctx: Ctx): void | typeof INVALID_MOVE => {
    if (G.pendingBetrothal === null) {
        return INVALID_MOVE;
    }
    const {proposer} = G.pendingBetrothal;
    G.pendingBetrothal = null;
    pushLog(G, `${powerLabel(proposer)}'s marriage proposal was rejected.`);
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

/**
 * Secretly keep one Home card and place the rest face down on the power card
 * (rulebook 10).  The move is redacted in game.ts so the chosen card is not
 * revealed through the move log.  The Ottoman may skip this while Suleiman is
 * ruler, but may still choose to set a card aside voluntarily.
 */
export const chooseHomeCard = (G: VQGame, ctx: Ctx, args: {cardId: string}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "spring") {
        return INVALID_MOVE;
    }
    const p = power(ctx);
    const ps = G.powers[p];
    if (ps.homeCardChoiceDone) {
        return INVALID_MOVE;
    }
    const homeCards = G.powers[p].cards.filter((id) => cardById(id).kind === "home");
    if (homeCards.length <= 1 || !homeCards.includes(args.cardId)) {
        return INVALID_MOVE;
    }
    const setAside = homeCards.filter((id) => id !== args.cardId);
    for (const id of setAside) {
        removeCardFromHand(G, p, id);
    }
    ps.homeCardSetAside = setAside;
    ps.homeCardChoiceDone = true;
    pushLog(G, `${powerLabel(p)} keeps one Home card and sets ${setAside.length} face down on the power card.`);
};

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
    const target = args.target;
    if (!MINOR_POWERS.includes(target) || !MINOR_DIPLOMACY[target].eligible.includes(p) ||
        G.minorDiplomacyResolved.includes(target) || G.minorInfluenceBlocked[p].includes(target) ||
        !minorAvailable(G, target)) {
        return INVALID_MOVE;
    }
    const cur = G.powers[p].influence[target] ?? 0;
    if (cur >= 9 || !spend(G, p, 1)) {
        return INVALID_MOVE;
    }
    G.powers[p].influence[target] = cur + 1;
    pushLog(G, `${powerLabel(p)} buys influence with ${target} (${cur + 1}).`);
};

const espionageAvailable = (G: VQGame): boolean => G.year >= 3;

export const plantInformant = (G: VQGame, ctx: Ctx, args: {target: Power}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action" || !espionageAvailable(G)) return INVALID_MOVE;
    const p = power(ctx);
    if (args.target === p || G.informants.some((i) => i.target === args.target) ||
        G.informants.filter((i) => i.owner === p).length >= 2 ||
        !spend(G, p, 2)) return INVALID_MOVE;
    G.informants.push({owner: p, target: args.target, neutralized: false, plantedImpulse: G.impulse});
    pushLog(G, `${powerLabel(p)} plants an informant in ${powerLabel(args.target)}.`);
};

export const gainIntelligence = (G: VQGame, ctx: Ctx, args: {target: Power}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action" || !espionageAvailable(G)) return INVALID_MOVE;
    const p = power(ctx);
    if (args.target === p || !spend(G, p, 2)) return INVALID_MOVE;
    const bonus = G.informants.filter((i) => i.target === args.target && !i.neutralized && i.plantedImpulse < G.impulse).length * 2;
    const dice = roll(ctx, 2 + bonus);
    const successes = hits(dice);
    const exposed = G.informants.filter((i) => i.owner !== p && i.target === args.target && !i.neutralized);
    for (const informant of exposed.slice(0, successes)) informant.neutralized = true;
    G.lastRolls = `Gain Intelligence: ${2 + bonus} dice [${dice.join(", ")}] = ${successes} hit(s)`;
    pushLog(G, G.lastRolls);
    if (successes > 0) {
        const stealable = G.powers[args.target].cards.filter((id) => cardById(id).kind !== "home");
        if (stealable.length > 0) {
            const id = shuffle(ctx, stealable)[0];
            removeCardFromHand(G, args.target, id);
            G.powers[p].cards.push(id);
            pushLog(G, `${powerLabel(p)} steals one card from ${powerLabel(args.target)}.`);
        }
        if (exposed.length > 0) pushLog(G, `${Math.min(successes, exposed.length)} informant(s) neutralized.`);
    }
};

export const assassinate = (G: VQGame, ctx: Ctx, args: {target: string; cp: number}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action" || !espionageAvailable(G)) return INVALID_MOVE;
    const p = power(ctx);
    const isElizabeth = args.target === "elizabeth";
    const royal = G.royals.find((r) => r.id === args.target);
    const def = LEADER_BY_ID[args.target];
    const eligibleLeader = def?.kind === "army" && G.leaders[args.target] !== undefined &&
        G.leaders[args.target].location !== "pool" && G.leaders[args.target].location !== "captured" &&
        G.leaders[args.target].location !== "offMap" &&
        Object.values(G.spaces).some((space) => space.leaders.includes(args.target));
    if (!Number.isInteger(args.cp) || args.cp < 2 || args.cp > 4 || G.assassinationUsed.includes(p) ||
        (isElizabeth && p === "england") ||
        !(isElizabeth ? royal?.alive === true : eligibleLeader) || def?.power === p || !spend(G, p, args.cp)) return INVALID_MOVE;
    const targetPower = isElizabeth ? "england" : def!.power;
    const attackDice = args.cp + 2 * G.informants.filter((i) => i.target === targetPower && !i.neutralized && i.plantedImpulse < G.impulse).length;
    const defenseDice = 2 + 2 * G.informants.filter((i) => i.owner === targetPower && i.target === p && !i.neutralized && i.plantedImpulse < G.impulse).length;
    const attack = roll(ctx, attackDice);
    const defense = roll(ctx, defenseDice);
    const attackHits = hits(attack);
    const defenseHits = hits(defense);
    G.assassinationUsed.push(p);
    G.lastRolls = `Assassination: ${powerLabel(p)} ${attackDice} [${attack.join(", ")}] = ${attackHits}; ${powerLabel(targetPower)} ${defenseDice} [${defense.join(", ")}] = ${defenseHits}`;
    pushLog(G, G.lastRolls);
    if (attackHits > defenseHits) {
        if (isElizabeth && royal !== undefined) {
            royal.alive = false;
            royal.status = "dead";
        } else if (G.leaders[args.target] !== undefined) {
            G.leaders[args.target].location = "pool";
            for (const space of Object.values(G.spaces)) space.leaders = space.leaders.filter((id) => id !== args.target);
            for (const zone of Object.values(G.seaZones)) zone.leaders = zone.leaders.filter((id) => id !== args.target);
        }
        addVp(G, p, 1);
        pushLog(G, `${args.target} is assassinated; ${powerLabel(p)} gains 1 VP.`);
    } else {
        pushLog(G, `Assassination attempt against ${args.target} fails.`);
    }
};

export const buildExpedition = (G: VQGame, ctx: Ctx, args: {captain: string; colony?: boolean}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") return INVALID_MOVE;
    const p = power(ctx);
    const captain = seaCaptainById(args.captain);
    const start = p === "ottoman" ? "indianOcean" : "northAtlantic";
    const freeColonist = captain?.bonus.startsWith("Free colonist") === true;
    const freeScienceColony = G.powers[p].scienceBonuses.includes("plantation");
    const baseCost = captain?.bonus.startsWith("Costs 2 CP") === true ? 2 : 1;
    const cost = baseCost + (args.colony && !freeColonist && !freeScienceColony ? 1 : 0);
    if (captain === undefined || captain.turn > G.year || !G.powers[p].seaCaptains.includes(args.captain) ||
        (args.colony === true && p === "hre") || G.worldCaptains[args.captain] !== undefined || !spend(G, p, cost)) return INVALID_MOVE;
    G.worldCaptains[args.captain] = {power: p, location: start, damaged: p === "ottoman" && !G.suezDone, colony: args.colony === true};
    pushLog(G, `${powerLabel(p)} launches ${captain.nameEn}'s expedition from ${WORLD_SEA_ZONE_BY_ID[start].nameEn}${args.colony ? " with a colony" : ""}.`);
};

export const moveExpedition = (G: VQGame, ctx: Ctx, args: {captain: string; zone: string}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") return INVALID_MOVE;
    const p = power(ctx);
    const expedition = G.worldCaptains[args.captain];
    const moveAlreadyPaid = Object.values(G.worldCaptains).some((candidate) => candidate.power === p && candidate.movedImpulse === G.impulse);
    if (expedition === undefined || expedition.power !== p || !WORLD_SEA_ZONE_BY_ID[args.zone] ||
        expedition.movedImpulse === G.impulse || !WORLD_SEA_ZONE_BY_ID[expedition.location].adjacent.includes(args.zone) ||
        (!moveAlreadyPaid && !spend(G, p, 1))) return INVALID_MOVE;
    expedition.location = args.zone;
    expedition.movedImpulse = G.impulse;
    pushLog(G, `${args.captain} sails to ${WORLD_SEA_ZONE_BY_ID[args.zone].nameEn}.`);
};

export const settleColony = (G: VQGame, ctx: Ctx, args: {captain: string; settlement: string}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") return INVALID_MOVE;
    const p = power(ctx);
    const expedition = G.worldCaptains[args.captain];
    const settlement = WORLD_SETTLEMENT_BY_ID[args.settlement];
    if (expedition === undefined || expedition.power !== p || !expedition.colony || settlement === undefined ||
        settlement.id === "philippines" || settlement.seaZone !== expedition.location || G.worldControls[settlement.id] !== undefined ||
        !spend(G, p, 1)) return INVALID_MOVE;
    G.worldColonies[settlement.id] = p;
    G.worldControls[settlement.id] = p;
    expedition.colony = false;
    pushLog(G, `${powerLabel(p)} establishes a colony at ${settlement.nameEn}.`);
};

export const commitForeignWarForce = (
    G: VQGame,
    ctx: Ctx,
    args: {units: {space: string; kind: keyof LandStack}[]; leaderId?: string},
): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") return INVALID_MOVE;
    const p = power(ctx);
    const war = G.foreignWars[p];
    if ((p !== "ottoman" && p !== "hre") || war?.status !== "setup" || !Array.isArray(args.units) ||
        args.units.length < 3 || args.units.length > 8) return INVALID_MOVE;
    const selectionCounts = new Map<string, number>();
    for (const selection of args.units) {
        const key = `${selection.space}:${selection.kind}`;
        selectionCounts.set(key, (selectionCounts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of selectionCounts) {
        const [spaceId, kind] = key.split(":") as [string, keyof LandStack];
        const space = G.spaces[spaceId];
        if (space === undefined || space.siege !== undefined || (space.land[p]?.[kind] ?? 0) < count) return INVALID_MOVE;
    }
    if (args.leaderId !== undefined) {
        const leader = G.leaders[args.leaderId];
        if (LEADER_BY_ID[args.leaderId]?.power !== p || LEADER_BY_ID[args.leaderId]?.kind !== "army" ||
            leader === undefined || leader.location === "pool" || leader.location === "captured" ||
            !Object.values(G.spaces).some((s) => s.leaders.includes(args.leaderId!))) return INVALID_MOVE;
    }
    for (const [key, count] of selectionCounts) {
        const [spaceId, kind] = key.split(":") as [string, keyof LandStack];
        const space = G.spaces[spaceId];
        const stack = space.land[p]!;
        stack[kind] -= count;
        war.units[kind] += count;
        if (landCount(stack) === 0) delete space.land[p];
    }
    if (args.leaderId !== undefined) {
        for (const space of Object.values(G.spaces)) space.leaders = space.leaders.filter((id) => id !== args.leaderId);
        G.leaders[args.leaderId].location = "foreignWar";
        war.leaderId = args.leaderId;
    }
    war.status = "active";
    pushLog(G, `${powerLabel(p)} commits ${landCount(war.units)} unit(s)${war.leaderId ? ` and ${war.leaderId}` : ""} to the ${war.enemy} war.`);
};

const loseForeignWarUnits = (units: LandStack, losses: number): number => {
    let remaining = losses;
    for (const kind of ["merc", "cav", "regular"] as const) {
        const lost = Math.min(units[kind], remaining);
        units[kind] -= lost;
        remaining -= lost;
        if (remaining === 0) break;
    }
    return losses - remaining;
};

const endForeignWar = (G: VQGame, p: "ottoman" | "hre"): void => {
    const war = G.foreignWars[p];
    if (war === undefined) return;
    const destination = capitalOf(G, p);
    if (destination !== undefined && landCount(war.units) > 0) {
        const stack = ensureLand(G, destination, p);
        stack.regular += war.units.regular;
        stack.merc += war.units.merc;
        stack.cav += war.units.cav;
    }
    if (destination !== undefined && war.leaderId !== undefined) {
        G.leaders[war.leaderId].location = destination;
        if (!G.spaces[destination].leaders.includes(war.leaderId)) G.spaces[destination].leaders.push(war.leaderId);
    }
    if (war.winnerVp) addVp(G, p, 1);
    G.powers[p].cardModifier += 1;
    G.discard.push(war.cardId);
    delete G.foreignWars[p];
    pushLog(G, `${powerLabel(p)} ends the foreign war${war.winnerVp ? " and gains 1 War Winner VP" : ""}.`);
};

export const fightForeignWar = (G: VQGame, ctx: Ctx): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") return INVALID_MOVE;
    const p = power(ctx);
    const war = G.foreignWars[p];
    if ((p !== "ottoman" && p !== "hre") || war?.status !== "active" || landCount(war.units) === 0 || !spend(G, p, 1)) return INVALID_MOVE;
    const majorUnits = landCount(war.units);
    const leaderDice = war.leaderId === undefined ? 0 : (LEADER_BY_ID[war.leaderId]?.battle ?? 0);
    const attackDice = majorUnits + leaderDice;
    const attackRolls = roll(ctx, attackDice);
    const enemyRolls = roll(ctx, war.enemyUnits);
    const attackHits = hits(attackRolls);
    const enemyHits = hits(enemyRolls);
    const enemyLosses = Math.min(war.enemyUnits, attackHits);
    const unitLosses = loseForeignWarUnits(war.units, enemyHits);
    war.enemyUnits -= enemyLosses;
    G.lastRolls = `Foreign war: ${p} ${attackDice} dice [${attackRolls.join(", ")}] = ${attackHits}; ${war.enemy} ${enemyRolls.length} dice [${enemyRolls.join(", ")}] = ${enemyHits}`;
    pushLog(G, G.lastRolls);
    pushLog(G, `${p} loses ${unitLosses} unit(s); ${war.enemy} loses ${enemyLosses}.`);
    if (war.enemyUnits === 0) endForeignWar(G, p);
};

export const reinforceForeignWar = (
    G: VQGame,
    ctx: Ctx,
    args: {kind: keyof LandStack},
): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") return INVALID_MOVE;
    const p = power(ctx);
    const war = G.foreignWars[p];
    const cost = args.kind === "regular" ? 2 : 1;
    if ((p !== "ottoman" && p !== "hre") || war?.status !== "active" || landCount(war.units) >= 8 ||
        (args.kind === "cav" && p !== "ottoman") || (args.kind === "merc" && p === "ottoman") || !spend(G, p, cost)) return INVALID_MOVE;
    war.units[args.kind] += 1;
    pushLog(G, `${powerLabel(p)} recruits 1 ${args.kind} directly into the ${war.enemy} war.`);
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
    const otherUnits = ownersWithLand(G, to).filter((c) => !friendlyController(G, p, c));
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
        .filter((c) => !friendlyController(G, p, c))
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
        const friendlyPresent = ownersWithLand(G, space).some((c) => friendlyController(G, p, c));
        const adjacentFriendly = LAND_NEIGHBORS[space].some((n) => ownersWithLand(G, n.id).some((c) => friendlyController(G, p, c)));
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
