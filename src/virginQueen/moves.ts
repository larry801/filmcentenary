import {Ctx} from "boardgame.io";
import {beginEspionageEvent, beginMassacre, beginNorthernRising, canPlayEspionageEvent, canPlayMassacre, canPlayNorthernRising, isEspionageEvent, plantOperative, startEspionage, espionageState} from "./espionage";
import {INVALID_MOVE} from "boardgame.io/core";
import {
    CardDef,
    Controller,
    HreReligiousPreference,
    HRE_RELIGIOUS_PREFERENCE_NAMES,
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
import {actingPower, ownerOf, samePlayer} from "./ownership";
import {moveError} from "./movePolicy";
import {activateMajor, resolveMajorDiplomacy} from "./util";
import {startBattle} from "./combat";
import {beginTutorialEvent, canPlayTutorialEvent} from "./tutorialEvents";
import {beginGrandVizierEvent, canCancelCardEvent, canPlayGrandVizier, canPlayUntimelyDeath, cardEventOptions, chooseGrandVizierEvent, grandVizierInHand, isGrandVizier, resolveUntimelyDeath} from "./cardEvents";
import {startPiracy} from "./piracy";
import {offerInterception} from "./interception";
import {tutorialSpaceAllowed} from "./tutorial";
import {LEADER_BY_ID} from "./constant/leaders";
import {
    CAPITAL_SPACES,
    KEY_SPACES,
    LAND_NEIGHBORS,
    SEA_ZONE_BY_ID,
    SPACE_BY_ID,
    SPACES,
    inlandPortLink,
    isInlandPort,
} from "./mapData";
import {
    addLand,
    addNaval,
    addVp,
    allied,
    applyCatholicLeagueSpace,
    attemptLandInterception,
    applyHreReplacement,
    assaultSpace,
    atWar,
    atWarWithMinor,
    bestBattle,
    bestPiracy,
    canControlSpace,
    canDeclareWar,
    capitalOf,
    captureLeaders,
    catholicLeagueSpaceOptions,
    cleanupLand,
    cleanupNaval,
    clearWar,
    dealYear,
    discardCard,
    drawCards,
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
    hreReligiousPreferenceRequired,
    inFrenchReligiousArea,
    isFortifiedSpace,
    isPort,
    isSeaZone,
    landDistance,
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
    reliefBattle,
    removeLandLosses,
    removePortNavalLosses,
    removeSeaNavalLosses,
    resolveConversions,
    resolveEvent,
    resolveMoriscoRevolt,
    resolveOfficialCardEffect,
    resolveMinorDiplomacy,
    resolveRebellion,
    roll,
    setWar,
    shuffle,
    spaceHasEnemyLand,
    spaceHasEnemyNaval,
    moveLeaders,
    totalLand,
    totalNaval,
    warCost,
    zonePorts,
} from "./util";

const power = (G: VQGame, ctx: Ctx): Power => actingPower(G, ctx.currentPlayer);

/** Rule 20.10: no deals between Spain and France/Protestant in the next Diplomacy Segment. */
const catholicLeagueDealsBlocked = (G: VQGame, a: Power, b: Power): boolean =>
    G.catholicLeagueNoDealsUntil === G.year &&
    ((a === "spain" && (b === "france" || b === "protestant")) ||
        (b === "spain" && (a === "france" || a === "protestant")));

const offerActionResponse = (G: VQGame, ctx: Ctx, move: NonNullable<VQGame["pendingAction"]>["move"], args: NonNullable<VQGame["pendingAction"]>["args"]): boolean => {
    if (G.resumeAction) {delete G.resumeAction; return false;}
    if (G.scenario !== "tutorial") return false;
    const active = power(G, ctx);
    const responder = active === "ottoman" ? "spain" : "ottoman";
    if (!G.powers[responder].cards.includes("vq-015") && !(active === "ottoman" && G.impulse > 1 && G.powers[responder].cards.includes("vq-016"))) return false;
    G.pendingAction = {power: active, move, args};
    ctx.events?.setActivePlayers({value: {[ownerOf(G, responder)!]: "actionResponse"}});
    return true;
};

export const actionResponseOptions = (G: VQGame): {id: string; label: string}[] => {
    const pending = G.pendingAction;
    if (!pending) return [];
    const responder = pending.power === "ottoman" ? "spain" : "ottoman";
    return [{id: "continue", label: "允许行动"},
        ...(G.powers[responder].cards.includes("vq-015") ? [{id: "storms", label: "打出 Storms，中断行动"}] : []),
        ...(pending.power === "ottoman" && G.impulse > 1 && G.powers[responder].cards.includes("vq-016") ? [{id: "harem", label: "打出 Sultan's Harem，奥斯曼跳过下次行动轮次"}] : [])];
};

export const respondAction = (G: VQGame, ctx: Ctx, args: {choice: string}): void | typeof INVALID_MOVE => {
    const pending = G.pendingAction;
    if (!pending) return INVALID_MOVE;
    const responder = pending.power === "ottoman" ? "spain" : "ottoman";
    if (ctx.playerID !== ownerOf(G, responder) || !actionResponseOptions(G).some((entry) => entry.id === args.choice)) return INVALID_MOVE;
    delete G.pendingAction;
    ctx.events?.endStage();
    if (args.choice === "storms") {
        removeCardFromHand(G, responder, "vq-015");
        discardCard(G, responder, "vq-015", true);
        G.powers[pending.power].cp = Math.max(0, G.powers[pending.power].cp - 1);
        G.tutorialEffects!.stormImpulse = G.impulse;
        G.tutorialEffects!.movedAfterStorm = [];
        return;
    }
    if (args.choice === "harem") {
        removeCardFromHand(G, responder, "vq-016");
        discardCard(G, responder, "vq-016", true);
        G.tutorialEffects!.skip.push("ottoman");
        drawCards(G, ctx, responder, 1);
    }
    G.resumeAction = true;
    const activeCtx = {...ctx, playerID: ownerOf(G, pending.power)};
    if (pending.move === "moveLand") moveLand(G, activeCtx, pending.args as Parameters<typeof moveLand>[2]);
    if (pending.move === "moveNaval") moveNaval(G, activeCtx, pending.args as Parameters<typeof moveNaval>[2]);
    if (pending.move === "navalTransport") navalTransport(G, activeCtx, pending.args as Parameters<typeof navalTransport>[2]);
    if (pending.move === "assault") assault(G, activeCtx, pending.args as Parameters<typeof assault>[2]);
    if (pending.move === "piracy") piracy(G, activeCtx, pending.args as Parameters<typeof piracy>[2]);
    delete G.resumeAction;
};

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
    if ((handler === "germanIntervention" || handler === "sublimePorte") && G.majorInfluence) {
        resolveMajorDiplomacy(G, ctx, handler === "germanIntervention" ? "hre" : "ottoman");
        return true;
    }
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
        const mary = espionageState(G);
        if (mary.mary !== "dead") {
            mary.mary = ["england", "protestant"].some((p) => G.powers[p as Power].alliedMinors.includes("scotland")) ? "captured" : "exiled";
            const royal = G.royals.find((r) => r.id === "maryScots");
            if (royal && mary.mary === "captured") royal.status = "captured";
        }
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

const resolvePlayedCardEvent = (G: VQGame, ctx: Ctx, p: Power, cardId: string, target?: string): void => {
    const def = cardById(cardId);
    const handler = def.officialEffect?.kind === "manual" ? def.officialEffect.handler : "";
    const beneficiary = foreignWarPower(handler);
    if (isGrandVizier(def)) {
        beginGrandVizierEvent(G, ctx, cardId);
    } else if (G.scenario === "tutorial") {
        beginTutorialEvent(G, ctx, p, cardId, true);
    } else if (isEspionageEvent(handler)) {
        beginEspionageEvent(G, ctx, p, handler, target);
    } else if (beneficiary !== undefined) {
        startForeignWar(G, cardId, beneficiary, Number(target));
    } else if (handler === "stBartholomewsDayMassacre") {
        beginMassacre(G, ctx, p);
    } else if (handler === "northernRising") {
        beginNorthernRising(G, ctx, p);
    } else if (handler === "untimelyDeath") {
        resolveUntimelyDeath(G, target ?? "none");
    } else if (handler === "moriscoRevolt") {
        resolveMoriscoRevolt(G, p);
    } else if (def.effect !== undefined) {
        resolveEvent(G, ctx, p, def.effect);
    } else if (resolveMinorDiplomacyCard(G, ctx, p, def)) {
        // Official minor-power event handler resolved above.
    } else if (def.officialEffect !== undefined && resolveOfficialCardEffect(G, ctx, p, def, target)) {
        // The typed card-table effect resolved above.
    } else if (def.officialNumber !== undefined) {
        pushLog(G, `Official event text: ${def.text ?? ""}`);
    }
    if (handler === "polishRoyalElection" && G.foreignWars.hre?.status === "active") {
        endForeignWar(G, "hre");
        pushLog(G, "The Polish Royal Election ends the HRE's foreign war.");
    }
    if (handler === "selimII") {
        G.powers.ottoman.ruler = "selimII";
        pushLog(G, "Selim II succeeds Suleiman; the Ottoman Home card exception ends.");
    }
    if (def.officialKind === "mandatory") {
        G.powers[p].cp += 2;
        pushLog(G, `${powerLabel(p)} receives 2 CP after the mandatory event.`);
    }
};

export const chooseCardEvent = (G: VQGame, ctx: Ctx, args: {choice: string}): void | typeof INVALID_MOVE => {
    const pending = G.pendingCardEvent;
    if (!pending || ctx.playerID !== ownerOf(G, pending.responding) ||
        !cardEventOptions(G, ctx.numPlayers).some((option) => option.id === args.choice)) return INVALID_MOVE;
    if (pending.kind === "grandVizier") return chooseGrandVizierEvent(G, ctx, args.choice);
    delete G.pendingCardEvent;
    ctx.events?.endStage();
    if (args.choice === "cancel") {
        discardCard(G, pending.power, pending.cardId, false);
        const responseCard = grandVizierInHand(G)!;
        removeCardFromHand(G, "ottoman", responseCard);
        discardCard(G, "ottoman", responseCard, true);
        pushLog(G, `Grand Vizier cancels ${cardById(pending.cardId).name}.`);
    } else {
        // Continue with the original power and target, without playing or discarding twice.
        discardCard(G, pending.power, pending.cardId, true);
        resolvePlayedCardEvent(G, {...ctx, playerID: ownerOf(G, pending.power)}, pending.power, pending.cardId, pending.target);
    }
};

export const playCard = (G: VQGame, ctx: Ctx, args: { cardId: string; asEvent?: boolean; target?: string }): void | typeof INVALID_MOVE => {
    if (moveError(G, "playCard", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
    const ps = G.powers[p];
    if (ps.cardPlayed) {
        return INVALID_MOVE;
    }
    if (!ps.cards.includes(args.cardId)) {
        return INVALID_MOVE;
    }
    const def = cardById(args.cardId);
    if (args.asEvent === true && isGrandVizier(def) && !canPlayGrandVizier(G, p, ctx.numPlayers)) return INVALID_MOVE;
    const cardHandler = def.officialEffect?.kind === "manual" ? def.officialEffect.handler : "";
    const beneficiary = foreignWarPower(cardHandler);
    if (args.asEvent === true && isEspionageEvent(cardHandler) && !canPlayEspionageEvent(G, p, cardHandler, args.target)) return INVALID_MOVE;
    if (args.asEvent === true && cardHandler === "northernRising" && !canPlayNorthernRising(G)) return INVALID_MOVE;
    if (args.asEvent === true && cardHandler === "stBartholomewsDayMassacre" && !canPlayMassacre(G)) return INVALID_MOVE;
    if (args.asEvent === true && cardHandler === "untimelyDeath" && G.scenario !== "tutorial" && !canPlayUntimelyDeath(G, args.target)) return INVALID_MOVE;
    if (args.asEvent === true && cardHandler === "moriscoRevolt" &&
        !(atWar(G, "ottoman", "spain") && G.morisco === undefined)) return INVALID_MOVE;
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
    const tutorialEvent = G.scenario === "tutorial" && args.asEvent === true;
    if (tutorialEvent && !canPlayTutorialEvent(G, p, args.cardId)) return INVALID_MOVE;
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
    if (args.asEvent === true && timedResponseCard && !tutorialEvent && G.cardWindow?.kind !== "response") {
        return INVALID_MOVE;
    }
    const cancelWindow = args.asEvent === true && canCancelCardEvent(G, def);
    removeCardFromHand(G, p, args.cardId);
    // Event-only removal is deferred until the Ottoman accepts or cancels the event.
    if (!cancelWindow) discardCard(G, p, args.cardId, args.asEvent === true);
    ps.cardPlayed = true;
    markAction(G, p);
    if (args.asEvent === true) {
        pushLog(G, `${powerLabel(p)} plays ${def.name} as an event.`);
        if (cancelWindow) {
            G.pendingCardEvent = {kind: "cancelEvent", cardId: args.cardId, power: p, responding: "ottoman",
                ...(args.target !== undefined ? {target: args.target} : {})};
            ctx.events?.setActivePlayers({value: {[ownerOf(G, "ottoman")!]: "cardEvent"}});
            return;
        }
        resolvePlayedCardEvent(G, ctx, p, args.cardId, args.target);
    } else {
        ps.cp += def.cp;
        pushLog(G, `${powerLabel(p)} plays ${def.name} for ${def.cp} CP.`);
    }
};

export const playTreasure = (G: VQGame, ctx: Ctx, args: { index: number }): void | typeof INVALID_MOVE => {
    if (moveError(G, "playTreasure", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
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
    if (moveError(G, "pass")) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
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
    if (moveError(G, "endImpulse")) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
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
    if (moveError(G, "endPhaseTurn")) return INVALID_MOVE;
    if (ctx.phase !== "cardDraw" && ctx.phase !== "diplomacy" && ctx.phase !== "spring") {
        return INVALID_MOVE;
    }
    if (ctx.phase === "spring" && (homeCardChoiceRequired(G, power(G, ctx)) ||
        hreReligiousPreferenceRequired(G, power(G, ctx)))) {
        return INVALID_MOVE;
    }
    ctx.events?.endTurn();
};

export const claimSeaCaptain = (G: VQGame, ctx: Ctx, args: {captain: string}): void | typeof INVALID_MOVE => {
    if (moveError(G, "claimSeaCaptain", args)) return INVALID_MOVE;
    if (ctx.phase !== "cardDraw") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
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
    if (moveError(G, "declareWar", args)) return INVALID_MOVE;
    if (ctx.phase !== "diplomacy") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
    const target = args.target;
    if (!isPower(target) || !canDeclareWar(G, p, target)) {
        return INVALID_MOVE;
    }
    const cost = warCost(G, p, target);
    if (!payWarCost(G, p, cost)) {
        return INVALID_MOVE;
    }
    if (G.majorInfluence?.[target] && ownerOf(G, target) === undefined) resolveMajorDiplomacy(G, ctx, target, p);
    setWar(G, p, target);
    pushLog(G, `${powerLabel(p)} pays ${cost} CP for the declaration of war.`);
};

export const declareWarMinor = (G: VQGame, ctx: Ctx, args: { target: MinorPower }): void | typeof INVALID_MOVE => {
    if (moveError(G, "declareWarMinor", args)) return INVALID_MOVE;
    if (ctx.phase !== "diplomacy") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
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

export const chooseHreReplacement = (G: VQGame, ctx: Ctx, args: {choice: "regular" | "mercs" | "marker"}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "diplomacy" || G.pendingHreReplacement === undefined) return INVALID_MOVE;
    if (ctx.playerID !== undefined && ownerOf(G, "hre") !== ctx.playerID) return INVALID_MOVE;
    if (!applyHreReplacement(G, args.choice)) return INVALID_MOVE;
};

export const chooseCatholicLeagueSpace = (G: VQGame, ctx: Ctx, args: {space: string}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "diplomacy" || G.pendingCatholicLeague === undefined) return INVALID_MOVE;
    if (power(G, ctx) !== "spain") return INVALID_MOVE;
    if (ctx.playerID !== undefined && ownerOf(G, "spain") !== ctx.playerID) return INVALID_MOVE;
    if (!catholicLeagueSpaceOptions(G).includes(args.space)) return INVALID_MOVE;
    applyCatholicLeagueSpace(G, args.space);
};

export const makePeace = (G: VQGame, ctx: Ctx, args: { target: Power }): void | typeof INVALID_MOVE => {
    if (moveError(G, "makePeace", args)) return INVALID_MOVE;
    if (ctx.phase !== "diplomacy") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
    if (!atWar(G, p, args.target)) {
        return INVALID_MOVE;
    }
    if (catholicLeagueDealsBlocked(G, p, args.target)) {
        return INVALID_MOVE;
    }
    if ((p === "england" && args.target === "spain") || (p === "spain" && args.target === "england")) {
        return INVALID_MOVE;
    }
    clearWar(G, p, args.target);
    pushLog(G, `${powerLabel(p)} and ${powerLabel(args.target)} end their war by agreement.`);
};

export const formAlliance = (G: VQGame, ctx: Ctx, args: { target: Power }): void | typeof INVALID_MOVE => {
    if (moveError(G, "formAlliance", args)) return INVALID_MOVE;
    if (ctx.phase !== "diplomacy") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
    const t = args.target;
    if (!isPower(t) || p === t || atWar(G, p, t) || allied(G, p, t)) {
        return INVALID_MOVE;
    }
    if (catholicLeagueDealsBlocked(G, p, t)) {
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
    if (moveError(G, "proposeBetroth", args)) return INVALID_MOVE;
    if (ctx.phase !== "diplomacy") {
        return INVALID_MOVE;
    }
    if (G.pendingBetrothal !== null) {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
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
    if (catholicLeagueDealsBlocked(G, p, target)) {
        return INVALID_MOVE;
    }
    if (target === "hre" && G.playerPowers && ownerOf(G, "hre") === undefined) {
        const influence = G.majorInfluence?.hre?.[p] ?? 0;
        if (influence < 1) return INVALID_MOVE;
        G.majorInfluence!.hre![p] = influence - 1;
        G.betrothals.push({male: male.id, female: female.id});
        pushLog(G, `${powerLabel(p)} spends 1 HRE influence to arrange a marriage between ${male.name} and ${female.name}.`);
        return;
    }
    const targetPlayerID = ownerOf(G, target);
    if (targetPlayerID === undefined) return INVALID_MOVE;
    G.pendingBetrothal = {male: male.id, female: female.id, proposer: p, target};
    pushLog(G, `${powerLabel(p)} proposes a marriage between ${male.name} and ${female.name}.`);
    ctx.events?.setActivePlayers?.({value: {[targetPlayerID]: "respondBetroth"}, moveLimit: 1});
};

export const acceptBetroth = (G: VQGame, _ctx: Ctx): void | typeof INVALID_MOVE => {
    if (moveError(G, "acceptBetroth")) return INVALID_MOVE;
    if (G.pendingBetrothal === null) {
        return INVALID_MOVE;
    }
    if (_ctx.playerID !== undefined && ownerOf(G, G.pendingBetrothal.target) !== _ctx.playerID) return INVALID_MOVE;
    const {male, female} = G.pendingBetrothal;
    const maleDef = G.royals.find((r) => r.id === male);
    const femaleDef = G.royals.find((r) => r.id === female);
    G.betrothals.push({male, female});
    G.pendingBetrothal = null;
    pushLog(G, `${maleDef?.name ?? male} and ${femaleDef?.name ?? female} are betrothed.`);
};

export const rejectBetroth = (G: VQGame, _ctx: Ctx): void | typeof INVALID_MOVE => {
    if (moveError(G, "rejectBetroth")) return INVALID_MOVE;
    if (G.pendingBetrothal === null) {
        return INVALID_MOVE;
    }
    if (_ctx.playerID !== undefined && ownerOf(G, G.pendingBetrothal.target) !== _ctx.playerID) return INVALID_MOVE;
    const {proposer} = G.pendingBetrothal;
    G.pendingBetrothal = null;
    pushLog(G, `${powerLabel(proposer)}'s marriage proposal was rejected.`);
};

export const ransom = (G: VQGame, ctx: Ctx, args: { leaderId: string }): void | typeof INVALID_MOVE => {
    if (moveError(G, "ransom", args)) return INVALID_MOVE;
    if (ctx.phase !== "diplomacy" && !(G.scenario === "tutorial" && ctx.phase === "cardDraw")) {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
    const def = LEADER_BY_ID[args.leaderId];
    const st = G.leaders[args.leaderId];
    const tutorialHreRansom = G.scenario === "tutorial" && p === "spain" && def?.power === "hre";
    if (def === undefined || st === undefined || (def.power !== p && !tutorialHreRansom) || st.location !== "captured") {
        return INVALID_MOVE;
    }
    const usable = G.powers[p].cards.filter((id) => cardById(id).kind !== "home");
    if (usable.length > 0) {
        const paid = shuffle(ctx, usable)[0];
        removeCardFromHand(G, p, paid);
        if (tutorialHreRansom) G.powers.ottoman.cards.push(paid);
        else discardCard(G, p, paid, false);
    } else if (G.powers[p].treasures.length > 0) {
        G.powers[p].treasures.pop();
    } else {
        return INVALID_MOVE;
    }
    const dest = capitalOf(G, tutorialHreRansom ? "hre" : p) ?? KEY_SPACES.find((id) => G.spaces[id].control === (tutorialHreRansom ? "hre" : p));
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
    if (moveError(G, "chooseHomeCard", args)) return INVALID_MOVE;
    if (ctx.phase !== "spring") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
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

export const chooseHreReligiousPreference = (G: VQGame, ctx: Ctx, args: {preference: HreReligiousPreference}): void | typeof INVALID_MOVE => {
    if (moveError(G, "chooseHreReligiousPreference", args)) return INVALID_MOVE;
    if (ctx.phase !== "spring" || !hreReligiousPreferenceRequired(G, power(G, ctx)) ||
        !args || !Object.prototype.hasOwnProperty.call(HRE_RELIGIOUS_PREFERENCE_NAMES, args.preference)) return INVALID_MOVE;
    G.hreReligiousPreference = args.preference;
    G.hreReligiousPreferenceChosen = true;
    pushLog(G, "Holy Roman records its secret religious preference.");
};

export const springDeploy = (G: VQGame, ctx: Ctx, args: { from: string; to: string; units?: Partial<LandStack>; leaders?: string[]; path?: string[] }): void | typeof INVALID_MOVE => {
    if (moveError(G, "springDeploy", args)) return INVALID_MOVE;
    if (ctx.phase !== "spring") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
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
    if (G.scenario === "tutorial") {
        const available = G.spaces[args.from].land[p];
        if (!available) return INVALID_MOVE;
        const stack = args.units ? {regular: args.units.regular ?? 0, merc: args.units.merc ?? 0, cav: args.units.cav ?? 0} : {...available};
        const availableLeaders = G.spaces[args.from].leaders.filter((id) => LEADER_BY_ID[id]?.power === p && LEADER_BY_ID[id].kind === "army");
        const leaders = args.leaders ?? availableLeaders.slice(0, 2);
        const capacity = Math.max(4, leaders.reduce((sum, id) => sum + (LEADER_BY_ID[id]?.command ?? 0), 0));
        if (leaders.length > 2 || new Set(leaders).size !== leaders.length || leaders.some((id) => !availableLeaders.includes(id)) ||
            landCount(stack) < 1 || landCount(stack) > capacity || Object.entries(stack).some(([kind, count]) => count < 0 || !Number.isInteger(count) || count > available[kind as keyof LandStack])) return INVALID_MOVE;
        const queue: {id: string; crossedSea: boolean}[] = [{id: args.from, crossedSea: false}];
        const seen = new Set<string>();
        let reachable = false;
        while (queue.length) {
            const current = queue.shift()!;
            if (current.id === to) {reachable = true; break;}
            const key = `${current.id}:${current.crossedSea}`;
            if (seen.has(key)) continue;
            seen.add(key);
            for (const neighbor of LAND_NEIGHBORS[current.id] ?? []) {
                if (!neighbor.pass && tutorialSpaceAllowed(neighbor.id) && friendlyControlled(G, p, neighbor.id) && !G.spaces[neighbor.id].unrest &&
                    ownersWithLand(G, neighbor.id).every((owner) => friendlyController(G, p, owner))) queue.push({id: neighbor.id, crossedSea: current.crossedSea});
            }
            if (!current.crossedSea && landCount(stack) <= 5) {
                for (const zone of portZones(current.id)) {
                    const occupied = zonePorts(zone).some((port) => ownersWithNaval(G, port).some((owner) => owner !== p));
                    if (occupied || ownersWithNaval(G, zone).some((owner) => owner !== p)) continue;
                    for (const port of zonePorts(zone)) {
                        if (tutorialSpaceAllowed(port) && friendlyControlled(G, p, port) && !G.spaces[port].unrest) queue.push({id: port, crossedSea: true});
                    }
                }
            }
        }
        if (!reachable) return INVALID_MOVE;
        const target = ensureLand(G, to, p);
        for (const kind of ["regular", "merc", "cav"] as const) {available[kind] -= stack[kind]; target[kind] += stack[kind];}
        moveLeaders(G, args.from, to, leaders);
        G.springDone.push(p);
        return;
    }
    // Rule 10.6: trace a path of any length from the capital, crossing at
    // most one sea zone, with no passes, unrest or foreign units on the path.
    const source = G.spaces[args.from].land[p];
    if (source === undefined || landCount(source) === 0) return INVALID_MOVE;
    const availableLeaders = G.spaces[args.from].leaders.filter((id) =>
        LEADER_BY_ID[id]?.power === p && LEADER_BY_ID[id]?.kind === "army");
    const leaders = args.leaders ?? availableLeaders.slice(0, 2);
    const stack: LandStack = args.units
        ? {regular: args.units.regular ?? 0, merc: args.units.merc ?? 0, cav: args.units.cav ?? 0}
        : {...source};
    if (leaders.length > 2 || new Set(leaders).size !== leaders.length ||
        leaders.some((id) => !availableLeaders.includes(id))) return INVALID_MOVE;
    const capacity = Math.max(4, leaders.reduce((sum, id) => sum + (LEADER_BY_ID[id].command ?? 0), 0));
    if (landCount(stack) < 1 || landCount(stack) > capacity ||
        Object.entries(stack).some(([kind, count]) => count < 0 || !Number.isInteger(count) ||
            count > source[kind as keyof LandStack])) return INVALID_MOVE;
    const pathSpaceAllowed = (id: string): boolean => {
        const state = G.spaces[id];
        if (state === undefined || !friendlyControlled(G, p, id) || state.unrest) return false;
        if (ownersWithLand(G, id).some((owner) => !friendlyController(G, p, owner))) return false;
        if (ownersWithNaval(G, id).some((owner) => !friendlyController(G, p, owner))) return false;
        return state.leaders.every((leader) => {
            const def = LEADER_BY_ID[leader];
            return def === undefined || friendlyController(G, p, def.power);
        });
    };
    if (to === args.from || !pathSpaceAllowed(to)) return INVALID_MOVE;
    const queue: {id: string; crossedSea: boolean}[] = [{id: args.from, crossedSea: false}];
    const seen = new Set<string>([`${args.from}:false`]);
    let reachable = false;
    while (queue.length > 0) {
        const current = queue.shift() as {id: string; crossedSea: boolean};
        for (const neighbor of LAND_NEIGHBORS[current.id] ?? []) {
            if (neighbor.pass || !pathSpaceAllowed(neighbor.id)) continue;
            const key = `${neighbor.id}:${current.crossedSea}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (neighbor.id === to) {reachable = true; break;}
            queue.push({id: neighbor.id, crossedSea: current.crossedSea});
        }
        if (reachable) break;
        if (current.crossedSea || landCount(stack) > 5) continue;
        for (const zone of portZones(current.id)) {
            // Other major powers' naval units in ports of the zone block the
            // crossing, even if they are allied (10.6).
            if (zonePorts(zone).some((port) => ownersWithNaval(G, port).some((owner) => isPower(owner) && owner !== p))) continue;
            if (ownersWithNaval(G, zone).some((owner) => !friendlyController(G, p, owner))) continue;
            for (const port of zonePorts(zone)) {
                if (port === current.id || !pathSpaceAllowed(port)) continue;
                const key = `${port}:true`;
                if (seen.has(key)) continue;
                seen.add(key);
                if (port === to) {reachable = true; break;}
                queue.push({id: port, crossedSea: true});
            }
            if (reachable) break;
        }
    }
    if (!reachable) return INVALID_MOVE;
    for (const kind of ["regular", "merc", "cav"] as const) {
        source[kind] -= stack[kind];
    }
    cleanupLand(G, args.from, p);
    const target = ensureLand(G, to, p);
    target.regular += stack.regular;
    target.merc += stack.merc;
    target.cav += stack.cav;
    moveLeaders(G, args.from, to, leaders);
    G.springDone.push(p);
    pushLog(G, `${powerLabel(p)} redeploys ${landCount(stack)} unit(s) from ${SPACE_BY_ID[args.from].name} to ${SPACE_BY_ID[to].name}.`);
};

// --------------------------------------------------------------------------
// Action Phase: construction
// --------------------------------------------------------------------------

export const recruit = (G: VQGame, ctx: Ctx, args: { space: string; kind: "regular" | "merc" | "cav" }): void | typeof INVALID_MOVE => {
    if (moveError(G, "recruit", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
    const space = args.space;
    const s = G.spaces[space];
    const def = SPACE_BY_ID[space];
    if (s === undefined || def === undefined) {
        return INVALID_MOVE;
    }
    if (G.scenario === "tutorial" && p === "spain" && G.tutorialHreAlly === "spain" && def.home === "hre") {
        if (s.control !== "hre" || s.unrest || s.siege || !["regular", "merc"].includes(args.kind) || !spend(G, p, args.kind === "regular" ? 2 : 1)) return INVALID_MOVE;
        addLand(G, space, "hre", args.kind, 1);
        return;
    }
    // Rule 17.2: any controlled home space not occupied by enemy units.
    if (s.control !== p || s.unrest || def.home !== p || spaceHasEnemyLand(G, p, space)) {
        return INVALID_MOVE;
    }
    if (args.kind === "cav" && p !== "ottoman") {
        return INVALID_MOVE;
    }
    if (args.kind === "merc" && p === "ottoman") {
        return INVALID_MOVE;
    }
    // Rule 17.2 construction exceptions.
    if (p === "ottoman" && ["algiers", "tripoli"].includes(space)) return INVALID_MOVE;
    if (p === "spain" && ["oran", "malta"].includes(space)) return INVALID_MOVE;
    if (!spend(G, p, args.kind === "regular" ? 2 : 1)) {
        return INVALID_MOVE;
    }
    addLand(G, space, p, args.kind, 1);
    pushLog(G, `${powerLabel(p)} recruits 1 ${args.kind} in ${def.name}.`);
};

export const buildNaval = (G: VQGame, ctx: Ctx, args: { port: string; kind: keyof NavalStack }): void | typeof INVALID_MOVE => {
    if (moveError(G, "buildNaval", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
    const port = args.port;
    const s = G.spaces[port];
    const def = SPACE_BY_ID[port];
    if (s === undefined || def === undefined || !isPort(port)) {
        return INVALID_MOVE;
    }
    // Rule 16.7: no naval unit may ever enter Antwerp or Rotterdam.
    if (isInlandPort(port)) return INVALID_MOVE;
    if (s.control !== p || s.unrest || spaceHasEnemyLand(G, p, port)) {
        return INVALID_MOVE;
    }
    if (def.home !== p) {
        return INVALID_MOVE;
    }
    const kind = args.kind;
    const cost: Record<string, number> = {galley: 2, galleon: 2, racebuilt: 2, corsair: 1};
    if (kind === "racebuilt" && p !== "england") {
        return INVALID_MOVE;
    }
    if (kind === "corsair" && p !== "ottoman") {
        return INVALID_MOVE;
    }
    if (kind === "galley" && !["ottoman", "spain", "france", "hre"].includes(p)) {
        return INVALID_MOVE;
    }
    if (kind === "galleon" && !["spain", "england", "france", "protestant"].includes(p)) {
        return INVALID_MOVE;
    }
    if (p === "ottoman" && kind === "galley" && ["algiers", "tripoli"].includes(port)) {
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
    if (moveError(G, "buildFortress", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
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

export const influence = (G: VQGame, ctx: Ctx, args: { target: MinorPower | Power }): void | typeof INVALID_MOVE => {
    if (moveError(G, "influence", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
    const target = args.target;
    if (isPower(target)) {
        const track = G.majorInfluence?.[target];
        if (!track || track[p] === undefined || G.majorDiplomacyResolved?.includes(target) || target === p || (track[p] ?? 0) >= 9 || !spend(G, p, 1)) return INVALID_MOVE;
        track[p] = (track[p] ?? 0) + 1;
        return;
    }
    if (!MINOR_POWERS.includes(target) || (!MINOR_DIPLOMACY[target].eligible.includes(p) &&
        !(G.scenario === "tutorial" && p === "ottoman" && target === "papacy")) ||
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

export const chooseMajorActivation = (G: VQGame, ctx: Ctx, args: {joinDefense?: boolean; war?: Power}): void | typeof INVALID_MOVE => {
    const pending = G.pendingActivation;
    if (!pending || ctx.playerID !== ownerOf(G, pending.ally)) return INVALID_MOVE;
    if (args.war && (!isPower(args.war) || samePlayer(G, pending.ally, args.war) || args.war === pending.power ||
        allied(G, pending.power, args.war))) return INVALID_MOVE;
    if (!activateMajor(G, ctx, pending.power, pending.ally, {
        war: args.war, defense: args.joinDefense ? pending.aggressor : undefined,
    })) return INVALID_MOVE;
    if (pending.aggressor) setWar(G, pending.power, pending.aggressor);
    delete G.pendingActivation;
    ctx.events?.endStage();
};

export const plantInformant = (G: VQGame, ctx: Ctx, args: {target?: Power; space?: string; fromTarget?: Power}): void | typeof INVALID_MOVE => {
    if (moveError(G, "plantInformant", args)) return INVALID_MOVE;
    return plantOperative(G, ctx, args);
};

export const gainIntelligence = (G: VQGame, ctx: Ctx, args: {target: Power}): void | typeof INVALID_MOVE => {
    if (moveError(G, "gainIntelligence", args)) return INVALID_MOVE;
    return startEspionage(G, ctx, "intelligence", args);
};

export const assassinate = (G: VQGame, ctx: Ctx, args: {target: string; cp: number}): void | typeof INVALID_MOVE => {
    if (moveError(G, "assassinate", args)) return INVALID_MOVE;
    return startEspionage(G, ctx, "assassination", args);
};

export const englishCatholicRebellion = (G: VQGame, ctx: Ctx, args: {cp: number}): void | typeof INVALID_MOVE => {
    if (moveError(G, "englishCatholicRebellion", args)) return INVALID_MOVE;
    return startEspionage(G, ctx, "rebellion", args);
};

export const buildExpedition = (G: VQGame, ctx: Ctx, args: {captain: string; colony?: boolean}): void | typeof INVALID_MOVE => {
    if (moveError(G, "buildExpedition", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") return INVALID_MOVE;
    const p = power(G, ctx);
    const captain = seaCaptainById(args.captain);
    const start = p === "ottoman" ? "indianOcean" : "northAtlantic";
    const freeColonist = captain?.bonus.startsWith("Free colonist") === true;
    const freeScienceColony = G.powers[p].scienceBonuses.includes("plantation");
    const baseCost = captain?.bonus.startsWith("Costs 2 CP") === true ? 2 : 1;
    const cost = baseCost + (args.colony && !freeColonist && !freeScienceColony ? 1 : 0);
    if (captain === undefined || captain.turn > G.year || !G.powers[p].seaCaptains.includes(args.captain) ||
        (args.colony === true && (p === "hre" || (p === "ottoman" && !G.suezDone))) ||
        G.worldCaptains[args.captain] !== undefined || !spend(G, p, cost)) return INVALID_MOVE;
    G.worldCaptains[args.captain] = {power: p, location: start, damaged: p === "ottoman" && !G.suezDone, colony: args.colony === true};
    pushLog(G, `${powerLabel(p)} launches ${captain.nameEn}'s expedition from ${WORLD_SEA_ZONE_BY_ID[start].nameEn}${args.colony ? " with a colony" : ""}.`);
};

export const moveExpedition = (G: VQGame, ctx: Ctx, args: {captain: string; zone: string}): void | typeof INVALID_MOVE => {
    if (moveError(G, "moveExpedition", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") return INVALID_MOVE;
    const p = power(G, ctx);
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
    if (moveError(G, "settleColony", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") return INVALID_MOVE;
    const p = power(G, ctx);
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
    const p = power(G, ctx);
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
    if (moveError(G, "fightForeignWar")) return INVALID_MOVE;
    if (ctx.phase !== "action") return INVALID_MOVE;
    const p = power(G, ctx);
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
    const p = power(G, ctx);
    const war = G.foreignWars[p];
    const cost = args.kind === "regular" ? 2 : 1;
    if ((p !== "ottoman" && p !== "hre") || war?.status !== "active" || landCount(war.units) >= 8 ||
        (args.kind === "cav" && p !== "ottoman") || (args.kind === "merc" && p === "ottoman") || !spend(G, p, cost)) return INVALID_MOVE;
    war.units[args.kind] += 1;
    pushLog(G, `${powerLabel(p)} recruits 1 ${args.kind} directly into the ${war.enemy} war.`);
};

export const patronize = (G: VQGame, ctx: Ctx, args: { patron: string; cp: number }): void | typeof INVALID_MOVE => {
    if (moveError(G, "patronize", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
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

export const navalTransport = (G: VQGame, ctx: Ctx, args: {from: string; to: string; zones: string[]; units: Partial<LandStack>; leaders?: string[]}): void | typeof INVALID_MOVE => {
    if (moveError(G, "navalTransport", args) || ctx.phase !== "action") return INVALID_MOVE;
    const p = power(G, ctx);
    const source = G.spaces[args.from]?.land[p];
    const destination = G.spaces[args.to];
    if (G.spaces[args.from]?.siege && G.spaces[args.from].siege!.by !== p) return INVALID_MOVE;
    if (!source || !destination || !isPort(args.from) || !isPort(args.to) || args.from === args.to || !args.zones.length ||
        new Set(args.zones).size !== args.zones.length || !portZones(args.from).includes(args.zones[0] as keyof VQGame["seaZones"]) ||
        !portZones(args.to).includes(args.zones[args.zones.length - 1] as keyof VQGame["seaZones"])) return INVALID_MOVE;
    // Rule 16.7: the inland-port leg is a direct 1 CP move through the North
    // Sea, available only while the linked port (Flushing/Brielle) is controlled.
    const inland = isInlandPort(args.from) ? args.from : isInlandPort(args.to) ? args.to : undefined;
    if (inland !== undefined) {
        const other = inland === args.from ? args.to : args.from;
        const link = inlandPortLink(inland) as string;
        if (args.zones.length !== 1 || args.zones[0] !== "northSea" || !portZones(other).includes("northSea") ||
            G.spaces[link].control !== p) return INVALID_MOVE;
    }
    const transportCost = inland !== undefined ? 1 : args.zones.length + 1;
    const stack = {regular: args.units.regular ?? 0, merc: args.units.merc ?? 0, cav: args.units.cav ?? 0};
    if (landCount(stack) < 1 || landCount(stack) > 5 || Object.entries(stack).some(([kind, count]) => count < 0 || !Number.isInteger(count) || count > source[kind as keyof LandStack])) return INVALID_MOVE;
    for (let index = 0; index < args.zones.length; index++) {
        const zone = args.zones[index];
        if (!isSeaZone(zone) || navalCount(G.seaZones[zone as keyof VQGame["seaZones"]].naval[p]) === 0 ||
            (index > 0 && !SEA_ZONE_BY_ID[args.zones[index - 1]].adjacent.includes(zone as keyof VQGame["seaZones"]))) return INVALID_MOVE;
    }
    if (spaceHasEnemyNaval(G, p, args.to) || (!friendlyControlled(G, p, args.to) && destination.control !== "independent" &&
        !(isPower(destination.control) ? atWar(G, p, destination.control) : atWarWithMinor(G, p, destination.control as MinorPower)))) return INVALID_MOVE;
    const leaders = args.leaders ?? [];
    if (leaders.length > 2 || new Set(leaders).size !== leaders.length || leaders.some((id) => !G.spaces[args.from].leaders.includes(id) || LEADER_BY_ID[id]?.power !== p || LEADER_BY_ID[id]?.kind !== "army")) return INVALID_MOVE;
    // Rule 20.10: the Duke of Guise may not leave the French religious struggle area.
    if (leaders.includes("guise") && !inFrenchReligiousArea(args.to)) return INVALID_MOVE;
    const capacity = Math.max(4, leaders.reduce((sum, id) => sum + (LEADER_BY_ID[id].command ?? 0), 0));
    if (landCount(stack) > capacity || G.powers[p].cp < transportCost) return INVALID_MOVE;
    if (offerActionResponse(G, ctx, "navalTransport", args)) return;
    if (!spend(G, p, transportCost)) return INVALID_MOVE;
    const target = ensureLand(G, args.to, p);
    for (const kind of ["regular", "merc", "cav"] as const) {source[kind] -= stack[kind]; target[kind] += stack[kind];}
    moveLeaders(G, args.from, args.to, leaders);
    if (offerInterception(G, ctx, "field", args.from, args.to, p)) {
        G.pendingIntercept!.transported = true;
        return;
    }
    const enemies = ownersWithLand(G, args.to)
        .filter((owner) => !friendlyController(G, p, owner))
        .filter((owner) => isPower(owner) ? atWar(G, p, owner) : true);
    if (enemies.length) {
        if (G.scenario === "tutorial") {
            startBattle(G, ctx, "field", args.to, p, enemies, args.from);
            G.pendingBattle!.transported = true;
        } else {
            // Rule 16.3.4: a lost field battle at the port eliminates the
            // transported units instead of retreating them.
            fieldBattle(G, ctx, args.to, p, enemies, args.from, true);
        }
    } else if (isFortifiedSpace(G, args.to) && !friendlyControlled(G, p, args.to)) destination.siege = {by: p, sinceImpulse: G.impulse};
    pushLog(G, `${powerLabel(p)} transports ${landCount(stack)} units from ${args.from} to ${args.to}.`);
};

export const moveLand = (G: VQGame, ctx: Ctx, args: { from: string; to: string; units?: Partial<LandStack>; leaders?: string[]; unitPower?: Controller }): void | typeof INVALID_MOVE => {
    if (moveError(G, "moveLand", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
    const from = args.from;
    const to = args.to;
    if (G.spaces[from] === undefined || G.spaces[to] === undefined || from === to) {
        return INVALID_MOVE;
    }
    if (!LAND_NEIGHBORS[from].some((n) => n.id === to)) {
        return INVALID_MOVE;
    }
    const unitPower = args.unitPower ?? p;
    if (!friendlyController(G, p, unitPower)) return INVALID_MOVE;
    // Rule 23.1: Morisco units may never move more than 2 spaces from Granada.
    if (p === "ottoman" && unitPower === "ottoman" && G.morisco?.space === from &&
        (landDistance("granada", to) ?? Number.POSITIVE_INFINITY) > 2) return INVALID_MOVE;
    const source = G.spaces[from].land[unitPower];
    if (source === undefined || landCount(source) === 0) {
        return INVALID_MOVE;
    }
    const stack: LandStack = args.units ? {regular: args.units.regular ?? 0, merc: args.units.merc ?? 0, cav: args.units.cav ?? 0} : {...source};
    if (landCount(stack) === 0 || Object.entries(stack).some(([kind, count]) => !Number.isInteger(count) || count < 0 || count > source[kind as keyof LandStack])) return INVALID_MOVE;
    const availableLeaders = G.spaces[from].leaders.filter((id) => LEADER_BY_ID[id]?.power === unitPower && LEADER_BY_ID[id]?.kind === "army");
    const leaders = args.leaders ?? availableLeaders;
    if (new Set(leaders).size !== leaders.length || leaders.some((id) => !availableLeaders.includes(id))) return INVALID_MOVE;
    // Rule 20.10: the Duke of Guise may not leave the French religious struggle area.
    if (leaders.includes("guise") && !inFrenchReligiousArea(to)) return INVALID_MOVE;
    if (G.scenario === "tutorial" && (leaders.length > 2 || landCount(stack) > Math.max(4, leaders.reduce((total, id) => total + (LEADER_BY_ID[id].command ?? 0), 0)))) return INVALID_MOVE;
    if (spaceHasEnemyLand(G, p, from) && G.spaces[from].siege !== undefined && G.spaces[from].siege?.by !== p) {
        // Units under siege may not move; the besieger may march away.
        return INVALID_MOVE;
    }
    const dest = G.spaces[to];
    const siegeBefore = dest.siege;
    // Rule 15.2: moving a friendly formation into a besieged fortification
    // starts a relief battle instead of a normal siege or field battle.
    const isRelief = G.scenario !== "tutorial" && siegeBefore !== undefined && siegeBefore.by !== p &&
        ownersWithLand(G, to).some((owner) => owner !== siegeBefore.by && friendlyController(G, p, owner)) &&
        atWar(G, p, siegeBefore.by);
    const pUnitsInside = totalLand(G, to, [p]);
    const destControl = dest.control;
    const canEnter = friendlyControlled(G, p, to)
        || destControl === "independent"
        || (isPower(destControl) ? atWar(G, p, destControl) : atWarWithMinor(G, p, destControl as MinorPower));
    const otherUnits = ownersWithLand(G, to).filter((c) => !friendlyController(G, p, c));
    if (!canEnter && (G.scenario === "tutorial" || otherUnits.length === 0)) {
        return INVALID_MOVE;
    }
    const cost = passBetween(from, to) ? 2 : 1;
    if (G.powers[p].cp < cost) return INVALID_MOVE;
    if (offerActionResponse(G, ctx, "moveLand", args)) return;
    if (!spend(G, p, cost)) {
        return INVALID_MOVE;
    }
    // Interception is resolved before the active formation enters (13.2).
    const intercepted = !isRelief && attemptLandInterception(G, ctx, p, from, to);
    const tgt = ensureLand(G, to, unitPower);
    tgt.regular += stack.regular;
    tgt.merc += stack.merc;
    tgt.cav += stack.cav;
    source.regular -= stack.regular;
    source.merc -= stack.merc;
    source.cav -= stack.cav;
    if (landCount(source) === 0) delete G.spaces[from].land[unitPower];
    if (p === "ottoman" && unitPower === "ottoman" && G.morisco?.space === from &&
        landCount(G.spaces[from].land.ottoman) === 0) {
        G.morisco.space = to;
        G.morisco.units = Math.min(G.morisco.units, landCount(G.spaces[to].land.ottoman));
    }
    for (const id of leaders) {
        G.spaces[from].leaders = G.spaces[from].leaders.filter((x) => x !== id);
        G.spaces[to].leaders.push(id);
        G.leaders[id].location = to;
    }
    pushLog(G, `${powerLabel(p)} moves ${landCount(stack)} unit(s) from ${SPACE_BY_ID[from].name} to ${SPACE_BY_ID[to].name}.`);
    if (isRelief) {
        reliefBattle(G, ctx, to, p, from, stack, leaders, pUnitsInside);
        return;
    }
    if (G.tutorialEffects?.stormImpulse === G.impulse) G.tutorialEffects.movedAfterStorm?.push(to);
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

    if (offerInterception(G, ctx, "field", from, to, p, [unitPower])) return;
    const hostile = ownersWithLand(G, to)
        .filter((c) => !friendlyController(G, p, c))
        .filter((c) => isPower(c) ? atWar(G, p, c) : true);
    const defenders = totalLand(G, to, hostile);
    if (defenders > 0) {
        if (intercepted) {
            fieldBattle(G, ctx, to, p, hostile, from);
            return;
        }
        if (G.scenario === "tutorial") {
            startBattle(G, ctx, "field", to, p, hostile, from, [unitPower]);
            return;
        }
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
    if (moveError(G, "moveNaval", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
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
    if (isInlandPort(from) || isInlandPort(to)) return INVALID_MOVE;
    if (G.spaces[to] !== undefined && G.spaces[to].control !== p && !friendlyControlled(G, p, to)) {
        const enemyNaval = ownersWithNaval(G, to).some((c) => isPower(c) && atWar(G, p, c));
        if (!enemyNaval) {
            return INVALID_MOVE;
        }
    }
    if (G.powers[p].cp < 1) return INVALID_MOVE;
    if (offerActionResponse(G, ctx, "moveNaval", args)) return;
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
    if (G.scenario === "tutorial") {
        if (offerInterception(G, ctx, "naval", from, to, p)) return;
        const enemies = ownersWithNaval(G, to).filter((owner) => !friendlyController(G, p, owner) &&
            (isPower(owner) ? atWar(G, p, owner) : true));
        if (enemies.length) startBattle(G, ctx, "naval", to, p, enemies, from);
        return;
    }

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
    if (moveError(G, "controlSpace", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
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
    if (moveError(G, "assault", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
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
    // Rule 16.7: Antwerp/Rotterdam may not be assaulted while the besieged
    // power controls the linked inland-waterway port, unless the attacker has
    // naval units in the North Sea.
    const inlandLink = inlandPortLink(args.space);
    if (inlandLink !== undefined && G.spaces[inlandLink].control === s.control &&
        navalCount(G.seaZones.northSea.naval[p]) === 0) return INVALID_MOVE;
    if (G.powers[p].cp < 1) return INVALID_MOVE;
    if (offerActionResponse(G, ctx, "assault", args)) return;
    if (!spend(G, p, 1)) {
        return INVALID_MOVE;
    }
    if (G.scenario === "tutorial") {
        startBattle(G, ctx, "assault", args.space, p, ownersWithLand(G, args.space).filter((owner) => !friendlyController(G, p, owner)), args.space);
    } else assaultSpace(G, ctx, p, args.space);
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
    if (moveError(G, "preach", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
    const side = allowedPreach(p, args.area);
    if (side === undefined || !spend(G, p, 2)) {
        return INVALID_MOVE;
    }
    pushLog(G, `${powerLabel(p)} preaches a sermon in ${args.area}.`);
    resolveConversions(G, ctx, p, side, args.area, 5);
};

export const suppress = (G: VQGame, ctx: Ctx, args: { area: ReligionArea }): void | typeof INVALID_MOVE => {
    if (moveError(G, "suppress", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
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
    if (moveError(G, "rebellion", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
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
    if (moveError(G, "piracy", args)) return INVALID_MOVE;
    if (ctx.phase !== "action") {
        return INVALID_MOVE;
    }
    const p = power(G, ctx);
    if (!isSeaZone(args.zone) || !isPower(args.target) || samePlayer(G, p, args.target)) {
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
    if (G.scenario === "tutorial") {
        const used = G.piracyUsed?.[p] ?? [];
        const zoneUsers = Object.values(G.piracyUsed ?? {}).filter((zones) => zones?.includes(zone)).length;
        if (used.includes(zone) || used.length >= 3 || zoneUsers >= 2 || G.powers[p].cp < 2) return INVALID_MOVE;
        if (offerActionResponse(G, ctx, "piracy", args)) return;
        if (!spend(G, p, 2)) return INVALID_MOVE;
        startPiracy(G, ctx, p, args.target, zone);
        return;
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
