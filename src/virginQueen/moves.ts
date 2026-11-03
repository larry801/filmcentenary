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
    NAVAL_LIMITS,
    OTTOMAN_CAVALRY_LIMIT,
    REGULAR_LIMITS,
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
import {WORLD_HAZARDS, WORLD_SEA_ZONE_BY_ID, WORLD_SETTLEMENTS, WORLD_SETTLEMENT_BY_ID, WORLD_TRADE_WINDS} from "./data/world";
import {patronById, royalAvailable, seaCaptainById} from "./scenario";
import {actingPower, ownerOf, samePlayer} from "./ownership";
import {moveError} from "./movePolicy";
import {activateMajor, checkCircumnavigation, die, navigationCheck, resolveMajorDiplomacy} from "./util";
import {startBattle} from "./combat";
import {beginTutorialEvent, canPlayTutorialEvent} from "./tutorialEvents";
import {beginGrandVizierEvent, cancelEventResponder, canPlayGrandVizier, canPlayUntimelyDeath, cardEventOptions, chooseGrandVizierEvent, isGrandVizier, resolveUntimelyDeath} from "./cardEvents";
import {startPiracy} from "./piracy";
import {attemptNavalAvoidBattle, attemptNavalInterception, navalEnemies, resolveNavalCombat, resolveNavalCombatEnemy} from "./navalCombat";
import {offerInterception} from "./interception";
import {tutorialSpaceAllowed} from "./tutorial";
import {LEADER_BY_ID, SEA_CAPTAIN_LEADER_BY_CAPTAIN} from "./constant/leaders";
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
    addTreasure,
    addVp,
    allied,
    applyCatholicLeagueSpace,
    attemptLandAvoidBattle,
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
    capitalSpacesFor,
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
    landAdjacent,
    landNeighbors,
    leaderPower,
    landDistance,
    leadersAt,
    minorAvailable,
    navalAdjacent,
    ownersWithLand,
    ownersWithNaval,
    passBetween,
    navalBlockadeSatisfied,
    portZones,
    seaPathBetweenPorts,
    powerLabel,
    pushLog,
    rebellionTargets,
    religionCandidates,
    removeCardFromHand,
    removeCardFromGame,
    reliefBattle,
    cavalryCount,
    landForceCount,
    navalForceCount,
    navalLostCount,
    regularCount,
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

const countAtLocation = (G: VQGame, location: string, owner: Power): number => {
    const stack = isSeaZone(location) ? G.seaZones[location as keyof VQGame["seaZones"]].naval[owner] : G.spaces[location].naval[owner];
    if (stack !== undefined) return navalCount(stack);
    return owner === "spain" && G.armada?.location === location ? 1 : 0;
};

/** Rule 20.10: no deals between Spain and France/Protestant in the next Diplomacy Segment. */
const catholicLeagueDealsBlocked = (G: VQGame, a: Power, b: Power): boolean =>
    G.catholicLeagueNoDealsUntil === G.year &&
    ((a === "spain" && (b === "france" || b === "protestant")) ||
        (b === "spain" && (a === "france" || a === "protestant")));

const offerActionResponse = (G: VQGame, ctx: Ctx, move: NonNullable<VQGame["pendingAction"]>["move"], args: NonNullable<VQGame["pendingAction"]>["args"]): boolean => {
    if (G.resumeAction) {delete G.resumeAction; return false;}
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
        G.stormImpulse = G.impulse;
        G.stormMoved = [];
        return;
    }
    if (args.choice === "harem") {
        removeCardFromHand(G, responder, "vq-016");
        discardCard(G, responder, "vq-016", true);
        G.skipImpulse = [...(G.skipImpulse ?? []), "ottoman"];
        G.haremImpulse = G.impulse;
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
        G.portugalEntered = true;
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
                    if (units.regular > 0) units.regular -= Math.max(1, Math.floor(units.regular / 2));
                    if (units.merc > 0) units.merc -= Math.max(1, Math.floor(units.merc / 2));
                }
            }
            const ulster = G.spaces.ulster;
            ulster.land = {};
            ulster.leaders = [];
            ulster.control = "ireland";
            addLand(G, "ulster", "ireland", "regular", 3);
            pushLog(G, "Ireland rises: Ulster is cleared and 3 Irish rebels are placed.");
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
    if (handler === "donAntonioOfPortugal") {
        if (!G.powers[p].alliedMinors.includes("portugal")) {
            if (!MINOR_DIPLOMACY.portugal.eligible.includes(p) || G.minorDiplomacyResolved.includes("portugal") ||
                !minorAvailable(G, "portugal")) return false;
            awardMinorInfluence(G, p, "portugal", 3);
            resolveMinorDiplomacy(G, ctx, "portugal");
            return true;
        }
        const home = SPACES.find((space) => space.home === "portugal" && G.spaces[space.id].control === "portugal" &&
            G.spaces[space.id].siege === undefined);
        if (home !== undefined) {
            addLand(G, home.id, "portugal", "regular", 3);
            pushLog(G, `Don Antonio places 3 Portuguese regulars in ${home.name}.`);
            return true;
        }
        return false;
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

/** Virgin Queen home card: retrieve a discard or jilt Elizabeth's suitor. */
const resolveVirginQueenEvent = (G: VQGame, ctx: Ctx, p: Power, target?: string): void => {
    const elizabeth = G.royals.find((r) => r.id === "elizabeth");
    if (elizabeth === undefined || !elizabeth.alive) {
        pushLog(G, "Elizabeth I is dead; the Virgin Queen event has no effect.");
        return;
    }
    const betrothal = G.betrothals.find((b) => b.female === "elizabeth");
    const retrieveTarget = target !== undefined && target.startsWith("retrieve:") ? target.slice(9) : undefined;
    if (betrothal !== undefined && target !== "retrieve" && retrieveTarget === undefined) {
        const groom = G.royals.find((r) => r.id === betrothal.male);
        G.betrothals = G.betrothals.filter((b) => b !== betrothal);
        if (groom === undefined) return;
        const roll = die(ctx, 6);
        G.lastRolls = `Jilted by Elizabeth: ${roll}`;
        pushLog(G, `${powerLabel(groom.power)} is jilted by Elizabeth I: ${G.lastRolls}.`);
        if (roll >= 5) {
            const amount = roll === 6 ? 2 : 1;
            G.powers[groom.power].marriageCardModifier = (G.powers[groom.power].marriageCardModifier ?? 0) + amount;
            pushLog(G, `${powerLabel(groom.power)} gains ${amount} +1 Card marker(s).`);
        } else if (roll >= 2) {
            G.powers[groom.power].cp += roll;
            pushLog(G, `${powerLabel(groom.power)} gains ${roll} CP for Diplomatic Influence and/or Mercenaries.`);
        } else {
            pushLog(G, "No compensation is awarded.");
        }
        drawCards(G, ctx, p, 1);
        return;
    }
    const index = retrieveTarget !== undefined ? G.discard.indexOf(retrieveTarget) : G.discard.findIndex((id) => cardById(id).kind !== "home");
    if (index >= 0) {
        const [card] = G.discard.splice(index, 1);
        G.powers[p].cards.push(card);
        pushLog(G, `England retrieves ${cardById(card).name} from the discard pile.`);
    } else {
        pushLog(G, "England finds no card in the discard pile.");
    }
};

/** Spanish Armada home card: place it and grant CP, or grant CP if already placed. */
/** Treasure Fleet mandatory event (23.2). */
const resolveTreasureFleet = (G: VQGame, ctx: Ctx): void => {
    G.powers.spain.treasures.push(die(ctx, 5));
    const escorts = G.treasureFleetEscorts ?? 0;
    const count = Math.min(escorts >= 2 ? 3 : 2, G.powers.spain.treasures.length);
    const fleet = G.powers.spain.treasures.splice(0, count);
    const zoneRoll = die(ctx, 6);
    const zone = zoneRoll <= 2 ? "northAtlantic" : zoneRoll <= 4 ? "antilles" :
        zoneRoll === 5 ? "spanishMain" : (G.worldControls.philippines === "spain" ? "mexicanCoast" : "spanishMain");
    const expeditions = Object.entries(G.worldCaptains)
        .filter(([, expedition]) => expedition.location === zone)
        .sort(([a, ea], [b, eb]) => POWER_INDEX[ea.power] - POWER_INDEX[eb.power] || a.localeCompare(b));
    pushLog(G, `Treasure Fleet appears in ${WORLD_SEA_ZONE_BY_ID[zone].nameEn} with ${fleet.length} treasure(s).`);
    let escortsLeft = escorts;
    for (const [id, expedition] of expeditions) {
        const captain = seaCaptainById(id);
        if (captain === undefined) continue;
        const attackDice = (expedition.damaged ? 1 : 2) + captain.piracy;
        const defenseDice = 1 + escortsLeft;
        const attackHits = hits(roll(ctx, attackDice));
        const defenseHits = hits(roll(ctx, defenseDice));
        const net = attackHits - defenseHits;
        G.lastRolls = `Treasure Fleet attack by ${captain.nameEn}: ${attackHits} hits vs ${defenseHits}`;
        pushLog(G, G.lastRolls);
        if (net > 0) {
            let awards = net;
            while (awards > 0) {
                if (fleet.length > 0) {
                    const treasure = fleet.shift()!;
                    G.powers[expedition.power].treasures.push(treasure);
                    pushLog(G, `${captain.nameEn} captures a treasure.`);
                } else if (escortsLeft > 0) {
                    escortsLeft -= 1;
                    pushLog(G, "An escorting galleon is eliminated.");
                } else {
                    addVp(G, expedition.power, 1);
                    pushLog(G, `${captain.nameEn} gains 1 piracy VP.`);
                }
                awards -= 1;
            }
        } else if (net < 0) {
            const damage = -net;
            if (damage === 1 && !expedition.damaged) {
                expedition.damaged = true;
                pushLog(G, `${captain.nameEn} is damaged.`);
            } else {
                delete G.worldCaptains[id];
                G.powers[expedition.power].seaCaptains = G.powers[expedition.power].seaCaptains.filter((captainId) => captainId !== id);
                pushLog(G, `${captain.nameEn}'s expedition is eliminated.`);
            }
        }
    }
    G.treasureFleetEscorts = escortsLeft;
    for (const treasure of fleet) G.powers.spain.treasures.push(treasure);
};

/** #100 Enterprise of England mandatory event (23.3). */
/** #33 Gouvernante de France: place +2 Wedding Festivities on a French match. */
/** #49 Conquest of the Philippines. */
/** #50 Council of Troubles. */
/** #52 Foxe's Book of Martyrs. */
const resolveFoxesBook = (G: VQGame, ctx: Ctx): void => {
    const english = SPACES.filter((space) => space.area === "england" && G.spaces[space.id].religion === "catholic").slice(0, 2);
    for (const space of english) G.spaces[space.id].religion = "protestant";
    pushLog(G, `Foxe's Book of Martyrs converts ${english.length} English Catholic space(s).`);
    for (let attempt = 0; attempt < 5; attempt++) {
        const areas = ["france", "netherlands", "scotland"] as const;
        const area = areas
            .map((id) => ({id, count: SPACES.filter((space) => space.area === id && G.spaces[space.id].religion === "catholic").length}))
            .sort((a, b) => b.count - a.count)[0].id;
        resolveConversions(G, ctx, "protestant", "protestant", area, 1);
    }
};

const resolveCouncilOfTroubles = (G: VQGame, ctx: Ctx): void => {
    const spanishUnits = SPACES.filter((space) => space.area === "netherlands")
        .reduce((total, space) => total + totalLand(G, space.id, ["spain"]), 0);
    if (spanishUnits < 5) {
        pushLog(G, "Council of Troubles: Spain has fewer than 5 units in the Netherlands.");
        return;
    }
    resolveConversions(G, ctx, "spain", "catholic", "netherlands", 8, true);
    const targets = SPACES.filter((space) => space.area === "netherlands" && G.spaces[space.id].control === "protestant" &&
        !G.spaces[space.id].unrest && totalLand(G, space.id, ownersWithLand(G, space.id)) === 0)
        .slice(0, 3);
    for (const space of targets) G.spaces[space.id].control = "spain";
    G.powers.protestant.marriageCardModifier = (G.powers.protestant.marriageCardModifier ?? 0) + 1;
    pushLog(G, `Council of Troubles converts the Netherlands and takes ${targets.length} space(s); the Protestant gains a +1 Card marker.`);
};

const resolveConquestOfPhilippines = (G: VQGame, ctx: Ctx): void => {
    G.worldControls.philippines = "spain";
    G.philippinesSpanish = true;
    if (G.powers.spain.treasures.length < 5) G.powers.spain.treasures.push(die(ctx, 5));
    pushLog(G, "Spain conquers the Philippines and gains a fifth New World treasure box.");
};

/** #43 Experienced Navigator: +1 Navigation for one captain (max 3). */
/** #89 Mary Queen of Scots event: +3 French influence then resolve Scotland. */
/** #102 Sir Edward Stafford event: inspect and discard a card or treasure. */
const resolveSirEdwardStafford = (G: VQGame, ctx: Ctx, target?: string): void => {
    if (target === undefined || !isPower(target)) return;
    const cards = G.powers[target].cards.filter((id) => cardById(id).kind !== "home");
    const treasures = G.powers[target].treasures;
    if (cards.length === 0 && treasures.length === 0) {
        pushLog(G, "Sir Edward Stafford finds nothing to discard.");
        return;
    }
    if (treasures.length >= cards.length) {
        const index = Math.min(treasures.length - 1, Math.max(0, die(ctx, treasures.length) - 1));
        const [value] = treasures.splice(index, 1);
        pushLog(G, `Sir Edward Stafford discards a ${value} CP treasure from ${powerLabel(target)}.`);
    } else {
        const card = cards[Math.min(cards.length - 1, Math.max(0, die(ctx, cards.length) - 1))];
        G.powers[target].cards = G.powers[target].cards.filter((id) => id !== card);
        G.discard.push(card);
        pushLog(G, `Sir Edward Stafford discards ${cardById(card).name} from ${powerLabel(target)}.`);
    }
};

/** #45 Scurvy: -1 Navigation on the next navigation check. */
/** #46 Spanish Fury: take a card from the defender, then draw one. */
/** #44 Sack!: adjacent enemy fortresses may surrender after a fortress falls. */
/** #48 Italian Expert: sponsor an Italian patron for 3 CP without paying. */
/** #35 Patron of Arts, option 2: draw two cards and give one to another power. */
/** #34 Holy Roman Intercession: join one side of a war and punish the other. */
/** #2 Ottoman Tribute: threaten a power; auto-resolve tribute or war. */
const resolveOttomanTribute = (G: VQGame, ctx: Ctx, target?: string): void => {
    if (target === undefined || !isPower(target) || target === "ottoman" || allied(G, "ottoman", target)) return;
    const cards = G.powers[target].cards.filter((id) => cardById(id).kind !== "home");
    const treasures = G.powers[target].treasures;
    if (cards.length > 0 || treasures.length > 0) {
        if (treasures.length >= cards.length) {
            const value = treasures.splice(Math.max(0, die(ctx, treasures.length) - 1), 1)[0];
            G.powers.ottoman.treasures.push(value);
            pushLog(G, `${powerLabel(target)} pays tribute: the Ottoman takes a treasure.`);
        } else {
            const card = cards[Math.max(0, die(ctx, cards.length) - 1)];
            G.powers[target].cards = G.powers[target].cards.filter((id) => id !== card);
            G.powers.ottoman.cards.push(card);
            pushLog(G, `${powerLabel(target)} pays tribute: the Ottoman takes a card.`);
        }
        drawCards(G, ctx, "ottoman", 1);
        return;
    }
    setWar(G, "ottoman", target);
    G.powers.ottoman.cp += 2;
    pushLog(G, `${powerLabel(target)} refuses tribute; the Ottoman declares war and gains 2 CP.`);
};

/** #3 Spanish Road: place a regular in Milan and prepare one special move. */
const resolveSpanishRoad = (G: VQGame): void => {
    if (G.spaces.milan?.control !== "spain") {
        pushLog(G, "Spanish Road requires Spanish control of Milan.");
        return;
    }
    addLand(G, "milan", "spain", "regular", 1);
    G.spanishRoadAvailable = true;
    pushLog(G, "Spain adds a regular in Milan and prepares a Spanish Road move.");
};

export const spanishRoadMove = (G: VQGame, ctx: Ctx, args: {to: string; units?: Partial<LandStack>; leaders?: string[]}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action" || power(G, ctx) !== "spain" || G.spanishRoadAvailable !== true ||
        G.spaces[args.to] === undefined || !friendlyControlled(G, "spain", args.to)) return INVALID_MOVE;
    const source = G.spaces.milan.land.spain;
    if (source === undefined) return INVALID_MOVE;
    const stack = {regular: args.units?.regular ?? source.regular, merc: args.units?.merc ?? 0, cav: args.units?.cav ?? 0};
    if (landCount(stack) < 1 || Object.entries(stack).some(([kind, count]) => count < 0 || count > source[kind as keyof LandStack])) return INVALID_MOVE;
    const availableLeaders = G.spaces.milan.leaders.filter((id) => LEADER_BY_ID[id]?.power === "spain" && LEADER_BY_ID[id].kind === "army");
    const leaders = args.leaders ?? [];
    if (new Set(leaders).size !== leaders.length || leaders.some((id) => !availableLeaders.includes(id))) return INVALID_MOVE;
    const capacity = Math.max(4, leaders.reduce((total, id) => total + (LEADER_BY_ID[id].command ?? 0), 0));
    if (landCount(stack) > capacity) return INVALID_MOVE;
    const queue: {id: string; passes: number}[] = [{id: "milan", passes: 0}];
    const seen = new Set(["milan:0"]);
    let reachable = false;
    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.id === args.to) {reachable = true; break;}
        if (current.id !== "milan" && spaceHasEnemyLand(G, "spain", current.id)) continue;
        for (const neighbor of landNeighbors(current.id)) {
            if (G.spaces[neighbor.id] === undefined) continue;
            const passes = current.passes + (neighbor.pass ? 1 : 0);
            if (passes > 1) continue;
            const key = `${neighbor.id}:${passes}`;
            if (seen.has(key)) continue;
            seen.add(key);
            queue.push({id: neighbor.id, passes});
        }
    }
    if (!reachable) return INVALID_MOVE;
    source.regular -= stack.regular;
    source.merc -= stack.merc;
    source.cav -= stack.cav;
    if (landCount(source) === 0) delete G.spaces.milan.land.spain;
    const target = ensureLand(G, args.to, "spain");
    target.regular += stack.regular;
    target.merc += stack.merc;
    target.cav += stack.cav;
    moveLeaders(G, "milan", args.to, leaders);
    delete G.spanishRoadAvailable;
    pushLog(G, `Spain uses the Spanish Road from Milan to ${SPACE_BY_ID[args.to].name}.`);
};

const resolveHolyRomanIntercession = (G: VQGame, ctx: Ctx, target?: string): void => {
    if (target === undefined) return;
    const [ally, enemy] = target.split(":");
    if (!isPower(ally) || !isPower(enemy) || ally === enemy || !atWar(G, ally, enemy)) return;
    G.powers.hre.allies.push(ally);
    G.powers[ally].allies.push("hre");
    setWar(G, "hre", enemy);
    const home = SPACES.find((space) => space.home === "hre" && G.spaces[space.id].control === "hre" && !G.spaces[space.id].unrest);
    if (home !== undefined) addLand(G, home.id, "hre", "regular", 2);
    const dice = roll(ctx, 5);
    const ones = dice.filter((die) => die === 1).length;
    const unrestTargets = SPACES.filter((space) => space.home === "hre" && !G.spaces[space.id].unrest).slice(0, ones);
    for (const space of unrestTargets) G.spaces[space.id].unrest = true;
    G.lastRolls = `Holy Roman Intercession: [${dice.join(",")}] = ${ones} unrest`;
    pushLog(G, `${powerLabel("hre")} allies with ${powerLabel(ally)}, declares war on ${powerLabel(enemy)}, and places ${ones} unrest (${G.lastRolls}).`);
};

/** #56 Index of Prohibited Books, option 1: six Catholic attempts. */
/** #83 Dutch Revolt mandatory VP table. */
const resolveDutchRevolt = (G: VQGame): void => {
    const controlled = SPACES.filter((space) => space.area === "netherlands" && !G.spaces[space.id].unrest &&
        G.spaces[space.id].control === "spain").length;
    pushLog(G, `Dutch Revolt: ${controlled} Netherlands space(s) under Spanish control.`);
    if (controlled === 0) {
        addVp(G, "protestant", 3);
    } else if (controlled <= 7) {
        addVp(G, "protestant", 2);
        addVp(G, "england", 1);
    } else if (controlled <= 11) {
        addVp(G, "protestant", 1);
        addVp(G, "england", 1);
        addVp(G, "spain", 1);
    } else if (controlled <= 19) {
        addVp(G, "spain", 2);
    } else {
        addVp(G, "spain", 3);
    }
};

/** #75 Lost Colony: destroy an Atlantic-coast colony unless it rolls 5-6. */
/** #77 Portuguese Raid: remove a southern-ocean colony; draw if Lisbon is held. */
/** #84 Henry III succeeds Charles IX. */
const resolveHenryIII = (G: VQGame): void => {
    G.powers.france.ruler = "henryIII";
    G.powers.france.rulerAdmin = 1;
    G.powers.france.rulerCardBonus = 1;
    const charles = G.royals.find((royal) => royal.id === "charlesIX");
    if (charles !== undefined && !charles.married) {
        charles.alive = false;
        charles.status = "dead";
        G.betrothals = G.betrothals.filter((b) => b.male !== "charlesIX" && b.female !== "charlesIX");
    }
    pushLog(G, "Henry III becomes ruler of France.");
};

/** #85 Murad III succeeds Selim II. */
const resolveMuradIII = (G: VQGame, ctx: Ctx): void => {
    G.powers.ottoman.ruler = "muradIII";
    G.powers.ottoman.rulerAdmin = 1;
    G.powers.ottoman.rulerCardBonus = 0;
    if (ctx.numPlayers <= 4 && G.majorInfluence) resolveMajorDiplomacy(G, ctx, "ottoman");
    pushLog(G, "Murad III becomes Ottoman ruler.");
};

/** #87 Rudolf II succeeds Maximilian II and moves the HRE capital to Prague. */
/** #60 John Knox: convert all but one Scottish space, or add influence. */
/** #63 Nostradamus' Prophecies: draw 4 (8 for France) and keep one. */
/** #61 Menéndez de Avilés: Florida raid, escort, or fortress/patrol. */
/** #62 Northwest Passage: force a navigator to test the passage. */
/** #65 Puritans: draw a random English card or place three English unrest. */
/** #79 Convention of Estates: convert three Netherlands spaces to Protestant. */
/** #67 Spanish Pay Ships Seized: Spain loses two Netherlands regulars. */
/** #71 Black Magic: take a random non-home card from another power. */
/** #68 Taxis Family Courier: give one card to another power and draw one. */
/** #69 Tenth Penny: Protestant rebellion or Spanish card seizure. */
/** #107 Edmund Campion: place a Jesuit and make conversion attempts. */
/** #98 Sultana Safiye option 1: exchange a card with another power. */
/** #80 The Black Queen, option 3: take a card or draw two. */
/** #112 Day of the Barricades: seize Paris under the right conditions. */
/** #103 Act of Abjuration: collect offers for the Protestant to choose. */
const resolveActOfAbjuration = (G: VQGame, ctx: Ctx, p: Power): void => {
    if (!["england", "france", "hre"].includes(p) || atWar(G, p, "protestant")) return;
    const offers: {power: Power; space: string}[] = [];
    for (const power of ["england", "france", "hre"] as Power[]) {
        if (atWar(G, power, "protestant")) continue;
        const space = SPACES.find((def) => def.area === "netherlands" && G.spaces[def.id].control === "protestant" &&
            ownersWithLand(G, def.id).every((owner) => owner === "protestant"));
        if (space !== undefined) offers.push({power, space: space.id});
    }
    if (offers.length === 0) return;
    G.pendingAbjuration = {offers};
    ctx.events?.setActivePlayers({value: {[ownerOf(G, "protestant")!]: "abjurationChoice"}});
    pushLog(G, "Act of Abjuration: offers are made; the Protestant must choose one.");
};

export const chooseAbjuration = (G: VQGame, ctx: Ctx, args: {power: Power}): void | typeof INVALID_MOVE => {
    const pending = G.pendingAbjuration;
    if (ctx.playerID !== ownerOf(G, "protestant") || pending === undefined) return INVALID_MOVE;
    const offer = pending.offers.find((candidate) => candidate.power === args.power);
    if (offer === undefined) return INVALID_MOVE;
    G.powers[offer.power].allies.push("protestant");
    G.powers.protestant.allies.push(offer.power);
    let remaining = 5;
    const sources: string[] = [];
    for (const space of SPACES.filter((def) => def.home === offer.power && G.spaces[def.id].control === offer.power)) {
        const stack = G.spaces[space.id].land[offer.power];
        if (stack === undefined) continue;
        const take = Math.min(remaining, stack.regular);
        if (take > 0) sources.push(space.id);
        stack.regular -= take;
        remaining -= take;
        addLand(G, offer.space, offer.power, "regular", take);
        if (remaining === 0) break;
    }
    const leader = sources.flatMap((id) => G.spaces[id].leaders)
        .find((id) => LEADER_BY_ID[id]?.power === offer.power && LEADER_BY_ID[id]?.kind === "army");
    if (leader !== undefined) {
        const from = G.leaders[leader].location;
        moveLeaders(G, from, offer.space, [leader]);
    }
    addVp(G, offer.power, 1);
    delete G.pendingAbjuration;
    removeCardFromGame(G, "vq-103");
    ctx.events?.endStage();
    pushLog(G, `Act of Abjuration: the Protestant accepts ${powerLabel(offer.power)}'s offer.`);
};

/** #18 City State Rebels: five dice against an occupying garrison. */
/** #31 Treachery!: force an immediate assault on a besieged fortress. */
/** #24 Holy League: influence the Papacy and Venice, then resolve. */
/** #27 Knights of St. John: deploy the Knights when they are absent. */
/** #29 Muscovy Company: extra card draws next year (and two years later for England). */
/** #22 Genoese Bankers, option 1: draw two now, one fewer next year. */
/** #32 Calvinist Zeal, option 1: seven attempts in France and the Netherlands. */
/** #5 Papal Bull: resolve the Papacy; an ally may make Catholic attempts. */
const resolvePapalBull = (G: VQGame, ctx: Ctx): void => {
    if (!G.minorDiplomacyResolved.includes("papacy")) resolveMinorDiplomacy(G, ctx, "papacy");
    const ally = POWERS.find((power) => G.powers[power].alliedMinors.includes("papacy") && ownerOf(G, power) !== undefined);
    if (ally === undefined) return;
    const area = (["france", "netherlands"] as const)
        .map((id) => ({id, count: SPACES.filter((space) => space.area === id && G.spaces[space.id].religion === "protestant").length}))
        .sort((a, b) => b.count - a.count)[0].id;
    resolveConversions(G, ctx, ally, "catholic", area, 7);
    pushLog(G, `Papal Bull: ${powerLabel(ally)} makes seven Catholic attempts in ${area}.`);
};

const resolveCalvinistZeal = (G: VQGame, ctx: Ctx): void => {
    resolveConversions(G, ctx, "protestant", "protestant", "france", 7, true);
    resolveConversions(G, ctx, "protestant", "protestant", "netherlands", 7, true);
};

/** #53 Grand Tour: clear French unrest, recover Nostradamus, reinforce Paris. */
const resolveGrandTour = (G: VQGame, p: Power, target?: string): void => {
    const [mode, value, extra] = target?.split(":") ?? [];
    if (mode === "peace" && value !== undefined && isPower(value) && G.powers[p].wars.includes(value)) {
        G.powers[p].wars = G.powers[p].wars.filter((power) => power !== value);
        G.powers[value].wars = G.powers[value].wars.filter((power) => power !== p);
        pushLog(G, `Grand Tour makes peace between ${powerLabel(p)} and ${powerLabel(value)}.`);
    }
    if (mode === "give" && value !== undefined && isPower(value) && value !== p) {
        const card = extra !== undefined && G.powers[p].cards.includes(extra) && cardById(extra).kind !== "home" && cardById(extra).officialKind !== "mandatory"
            ? extra
            : G.powers[p].cards.find((id) => cardById(id).kind !== "home" && cardById(id).officialKind !== "mandatory");
        if (card !== undefined) {
            G.powers[p].cards = G.powers[p].cards.filter((id) => id !== card);
            G.powers[value].cards.push(card);
        } else if (G.powers[p].treasures.length > 0) {
            G.powers[value].treasures.push(G.powers[p].treasures.pop()!);
        }
    }
    if (mode === "move" && value !== undefined && G.spaces[value] !== undefined && G.spaces[value].control === p) {
        const source = G.spaces.paris.land[p];
        if (source !== undefined) {
            const targetStack = ensureLand(G, value, p);
            for (const kind of ["regular", "merc", "cav"] as const) {
                targetStack[kind] += source[kind];
                source[kind] = 0;
            }
            delete G.spaces.paris.land[p];
        }
    }
    for (const space of SPACES.filter((def) => def.area === "france" || def.home === "france")) G.spaces[space.id].unrest = false;
    const choseMode = mode === "peace" || mode === "give" || mode === "move";
    if (!choseMode && G.discard.includes("vq-063")) {
        G.discard = G.discard.filter((id) => id !== "vq-063");
        G.powers[p].cards.push("vq-063");
    }
    if (p === "france") addLand(G, "paris", "france", "regular", 1);
    if (G.catholicLeagueFormed === true) removeCardFromGame(G, "vq-053");
    pushLog(G, `Grand Tour clears French unrest and reinforces Paris for ${powerLabel(p)}.`);
};

const resolveGenoeseBankers = (G: VQGame, ctx: Ctx, p: Power, target?: string): void => {
    const captain = target !== undefined ? seaCaptainById(target) : undefined;
    if (captain !== undefined && G.powers[p].seaCaptains.includes(captain.id) && G.worldCaptains[captain.id] === undefined &&
        !(p === "hre" || (p === "ottoman" && !G.suezDone))) {
        const start = p === "ottoman" ? "indianOcean" : "northAtlantic";
        G.worldCaptains[captain.id] = {power: p, location: start, damaged: p === "ottoman", colony: true, route: [start]};
        G.powers[p].cp += 3;
        pushLog(G, `Genoese Bankers launch ${captain.nameEn}'s colonist expedition and grant 3 CP.`);
        return;
    }
    drawCards(G, ctx, p, 2);
    G.pendingCardDraws = [...(G.pendingCardDraws ?? []), {power: p, turn: G.year + 1, amount: -1}];
    pushLog(G, `${powerLabel(p)} draws two cards but draws one fewer next year.`);
};

const resolveMuscovyCompany = (G: VQGame, p: Power): void => {
    G.pendingCardDraws = [...(G.pendingCardDraws ?? []), {power: p, turn: G.year + 1, amount: 1}];
    if (p === "england") G.pendingCardDraws.push({power: p, turn: G.year + 2, amount: 1});
    pushLog(G, `Muscovy Company grants ${powerLabel(p)} an extra card next year.`);
};

const resolveKnightsOfStJohn = (G: VQGame): void => {
    const onMap = (G.spaces.malta?.land.independent?.regular ?? 0) > 0;
    if (onMap) return;
    if (G.spaces.malta?.control === "spain" && G.spaces.malta.siege === undefined) {
        addLand(G, "malta", "independent", "regular", 2);
        pushLog(G, "Knights of St. John deploy 2 regulars in Malta.");
        return;
    }
    const port = SPACES.find((space) => space.home === "spain" && space.ports !== undefined &&
        G.spaces[space.id].control === "spain" && G.spaces[space.id].siege === undefined &&
        totalLand(G, space.id, ownersWithLand(G, space.id)) === 0 && !G.spaces[space.id].fortress);
    if (port !== undefined) {
        addLand(G, port.id, "independent", "regular", 2);
        G.spaces[port.id].fortress = true;
        pushLog(G, `Knights of St. John deploy 2 regulars and a fortress in ${port.name}.`);
    }
};

const resolveHolyLeague = (G: VQGame, ctx: Ctx, p: Power): void => {
    for (const minor of ["papacy", "venice"] as MinorPower[]) {
        awardMinorInfluence(G, p, minor, 2);
        if (!G.minorDiplomacyResolved.includes(minor)) resolveMinorDiplomacy(G, ctx, minor);
    }
    pushLog(G, `Holy League adds 2 influence each to the Papacy and Venice for ${powerLabel(p)}.`);
};

const resolveTreachery = (G: VQGame, ctx: Ctx, target?: string): void => {
    if (target === undefined) return;
    const state = G.spaces[target];
    if (state === undefined || state.siege === undefined) return;
    const attacker = state.siege.by;
    if (!isPower(attacker)) return;
    const defenders = ownersWithLand(G, target).filter((owner) => !friendlyController(G, attacker, owner));
    startBattle(G, ctx, "assault", target, attacker, defenders, target);
    if (G.pendingBattle !== undefined) G.pendingBattle.treachery = true;
    pushLog(G, `Treachery! forces an assault on ${SPACE_BY_ID[target].name}.`);
};

const resolveCityStateRebels = (G: VQGame, ctx: Ctx, p: Power, target?: string): void => {
    if (target === undefined) return;
    const def = SPACE_BY_ID[target];
    const state = G.spaces[target];
    if (def === undefined || state === undefined || def.kind !== "fortress" || !isPower(state.control)) return;
    const controller = state.control;
    const values = roll(ctx, 5);
    let hitCount = hits(values);
    G.lastRolls = `City State Rebels [${values.join(",")}] = ${hitCount} hit(s)`;
    for (const owner of [controller]) {
        const stack = state.land[owner];
        if (stack !== undefined) {
            for (const kind of ["merc", "regular", "cav"] as const) {
                const take = Math.min(hitCount, stack[kind]);
                stack[kind] -= take;
                hitCount -= take;
            }
            if (stack.regular + stack.merc + stack.cav === 0) delete state.land[owner];
        }
        const naval = state.naval[owner];
        if (naval !== undefined && hitCount > 0) {
            for (const kind of ["corsair", "galley", "galleon", "racebuilt"] as const) {
                const take = Math.min(hitCount, naval[kind]);
                naval[kind] -= take;
                hitCount -= take;
            }
        }
    }
    if (totalLand(G, target, ownersWithLand(G, target)) === 0 && totalNaval(G, target, ownersWithNaval(G, target)) === 0) {
        for (const id of [...state.leaders]) {
            const leader = LEADER_BY_ID[id];
            if (leader?.kind !== "naval" || leader.power !== controller) continue;
            state.leaders = state.leaders.filter((leaderId) => leaderId !== id);
            G.leaders[id] = {id, location: "pool", returnTurn: G.year + 1};
        }
        captureLeaders(G, target, [controller], p);
        state.control = def.home;
        addLand(G, target, def.home, "regular", 1);
    }
    pushLog(G, `${G.lastRolls} in ${def.name}.`);
};

const resolveArmyMutiny = (G: VQGame, ctx: Ctx, target?: string): void => {
    if (target === undefined) return;
    const [spaceId, ownerId] = target.split(":");
    if (G.spaces[spaceId] === undefined) return;
    const state = G.spaces[spaceId];
    const owner = ownerId !== undefined && isPower(ownerId) && state.land[ownerId] !== undefined
        ? ownerId
        : (Object.keys(state.land) as Power[]).find((power) => isPower(power));
    if (owner === undefined) return;
    const stack = state.land[owner]!;
    stack.merc = 0;
    const card = G.powers[owner].cards
        .filter((id) => cardById(id).officialKind !== "mandatory")
        .sort((a, b) => cardById(a).cp - cardById(b).cp)[0];
    let keep = 0;
    if (card !== undefined) {
        const cp = cardById(card).cp;
        keep = cp >= 4 ? stack.regular : cp * 2;
        removeCardFromHand(G, owner, card);
        discardCard(G, owner, card, false);
    }
    stack.regular = Math.min(stack.regular, keep);
    if (stack.regular + stack.merc + stack.cav === 0) delete state.land[owner];
    state.unrest = true;
    const neighbor = landNeighbors(spaceId).find((space) => G.spaces[space.id] !== undefined && !G.spaces[space.id].unrest);
    if (neighbor !== undefined) G.spaces[neighbor.id].unrest = true;
    pushLog(G, `Army Mutiny strikes ${powerLabel(owner)} in ${SPACE_BY_ID[spaceId].name}.`);
};

const resolveElDorado = (G: VQGame, target?: string): void => {
    if (target === undefined) return;
    const expedition = G.worldCaptains[target];
    if (expedition === undefined || !["spanishMain", "antilles"].includes(expedition.location)) return;
    delete G.worldCaptains[target];
    G.seaCaptainReturn = {...(G.seaCaptainReturn ?? {}), [target]: {power: expedition.power, turn: G.year + 1}};
    if (expedition.companion !== undefined) {
        G.seaCaptainReturn[expedition.companion] = {power: expedition.power, turn: G.year + 1};
    }
    pushLog(G, `${target} departs for El Dorado; the expedition ends and returns next turn.`);
};

const resolvePhilosophersStone = (G: VQGame, target?: string): void => {
    const candidates = G.pendingPatronage.filter((entry) => patronById(G, entry.patronId)?.kind === "scientist");
    const entry = target !== undefined ? candidates.find((candidate) => candidate.patronId === target) : candidates[0];
    if (entry === undefined) return;
    G.pendingPatronage = G.pendingPatronage.filter((candidate) => candidate !== entry);
    G.patronsAvailable = G.patronsAvailable.filter((id) => id !== entry.patronId);
    G.patronReturn = {...(G.patronReturn ?? {}), [entry.patronId]: G.year + 1};
    pushLog(G, `Philosopher's Stone cancels ${patronById(G, entry.patronId)?.name ?? entry.patronId}'s work.`);
};

const resolveJohnHawkins = (G: VQGame, p: Power, target?: string): void => {
    if (p !== "england") return;
    if (target === "upgrade") {
        for (const space of SPACES.filter((def) => def.home === "england" && def.ports !== undefined && G.spaces[def.id].control === "england")) {
            const stack = G.spaces[space.id].naval.england;
            if (stack === undefined) continue;
            stack.racebuilt += stack.galleon;
            stack.galleon = 0;
        }
        pushLog(G, "John Hawkins upgrades English home-port galleons to race-built galleons.");
        return;
    }
    G.powers.england.cp += 5;
    G.hawkinsBonus = true;
    pushLog(G, "John Hawkins grants England 5 CP for naval operations.");
};

const resolveTopcliffe = (G: VQGame, ctx: Ctx): void => {
    const state = espionageState(G);
    const removed = state.jesuits.filter((id) => SPACE_BY_ID[id]?.area === "england").slice(0, 2);
    state.jesuits = state.jesuits.filter((id) => !removed.includes(id));
    resolveConversions(G, ctx, "protestant", "protestant", "england", 5);
    G.powers.spain.cardModifier += 1;
    pushLog(G, `Richard Topcliffe removes ${removed.length} Jesuit(s), converts England, and Spain gains +1 Card.`);
};

const resolveForeignVolunteers = (G: VQGame, p: Power): void => {
    const targets = SPACES.filter((space) => G.spaces[space.id].control === p && !G.spaces[space.id].siege &&
        !G.spaces[space.id].unrest).slice(0, 3);
    if (targets.length === 0) return;
    for (const space of targets) addLand(G, space.id, p, "regular", 1);
    pushLog(G, `Foreign Volunteers place ${targets.length} regular(s) for ${powerLabel(p)}.`);
};

/** #26 A Small Aid: one regular in a small besieged fortress. */
const resolveSmallAid = (G: VQGame, target?: string): void => {
    if (target === undefined) return;
    const state = G.spaces[target];
    if (state === undefined || state.siege === undefined || !isPower(state.control)) return;
    const defenders = totalLand(G, target, ownersWithLand(G, target));
    if (defenders > 3) return;
    addLand(G, target, state.control, "regular", 1);
    pushLog(G, `A Small Aid adds a ${powerLabel(state.control)} regular to ${SPACE_BY_ID[target].name}.`);
};

const resolveEloquentAmbassador = (G: VQGame, ctx: Ctx, p: Power, target?: string): void => {
    if (target === undefined || !(target in MINOR_DIPLOMACY)) return;
    const minor = target as MinorPower;
    awardMinorInfluence(G, p, minor, 3);
    if (!G.minorDiplomacyResolved.includes(minor)) resolveMinorDiplomacy(G, ctx, minor);
};

const resolveDiplomaticFauxPas = (G: VQGame, target?: string): void => {
    if (target === undefined || !isPower(target)) return;
    let remaining = 5;
    const influences = G.powers[target].influence;
    for (const minor of (Object.keys(influences) as MinorPower[]).sort((a, b) => (influences[b] ?? 0) - (influences[a] ?? 0))) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, influences[minor] ?? 0);
        influences[minor] = (influences[minor] ?? 0) - take;
        remaining -= take;
    }
    pushLog(G, `Diplomatic Faux Pas removes ${5 - remaining} influence from ${powerLabel(target)}.`);
};

/** #23 German Recruitment Curtailed: remove all mercenaries in a space. */
const resolveGermanRecruitment = (G: VQGame, p: Power, target?: string): void => {
    if (target === undefined) return;
    const areas = (p === "hre" ? target.split(":") : [target]).filter((id) => G.spaces[id] !== undefined);
    for (const area of areas) {
        for (const stack of Object.values(G.spaces[area].land)) {
            if (stack !== undefined) stack.merc = 0;
        }
    }
    pushLog(G, `German Recruitment Curtailed removes all mercenaries in ${areas.map((id) => SPACE_BY_ID[id].name).join(" and ")}.`);
};

const resolveUnrestInRealm = (G: VQGame, target?: string): void => {
    if (target === undefined) return;
    const [targetPower, ...preferred] = target.split(":");
    if (!["ottoman", "hre", "spain"].includes(targetPower)) return;
    const eligible = SPACES.filter((space) => space.home === targetPower && !G.spaces[space.id].unrest &&
        totalLand(G, space.id, ownersWithLand(G, space.id)) === 0 &&
        !(targetPower === "spain" && space.area === "netherlands"));
    const chosen = preferred.length > 0 ? eligible.filter((space) => preferred.includes(space.id)) : eligible;
    const homes = chosen.slice(0, 3);
    for (const space of homes) G.spaces[space.id].unrest = true;
    pushLog(G, `Unrest in the Realm places ${homes.length} unrest in ${powerLabel(targetPower as Power)} home spaces.`);
};

/** #30 Ruler Falls Ill: discard a random card from another power. */
const resolveRulerFallsIll = (G: VQGame, ctx: Ctx, p: Power, target?: string): void => {
    if (target === undefined) return;
    const [targetPower, mode, extra] = target.split(":");
    if (!isPower(targetPower) || targetPower === p) return;
    if (mode === "skip") {
        G.skipImpulse = [...(G.skipImpulse ?? []), targetPower];
        pushLog(G, `Ruler Falls Ill: ${powerLabel(targetPower)} will skip its next action round.`);
        return;
    }
    if (mode === "return") {
        const leader = Object.values(G.leaders).find((state) => state.id !== "guise" && LEADER_BY_ID[state.id]?.power === targetPower && LEADER_BY_ID[state.id]?.kind === "army" &&
            (extra === undefined || state.id === extra) &&
            state.location !== "pool" && state.location !== "dead" && G.spaces[state.location] !== undefined);
        const capital = capitalOf(G, targetPower) ?? SPACES.find((space) => space.home === targetPower && space.kind === "fortress")?.id;
        if (leader !== undefined && capital !== undefined && leader.location !== capital) {
            moveLeaders(G, leader.location, capital, [leader.id]);
            pushLog(G, `Ruler Falls Ill: ${leader.id} returns to ${SPACE_BY_ID[capital].name}.`);
        }
        return;
    }
    const cards = G.powers[targetPower].cards.filter((id) => cardById(id).kind !== "home");
    if (cards.length === 0) return;
    const chosen = mode === "discard" && extra !== undefined && cards.includes(extra) ? extra : undefined;
    const card = chosen ?? cards[Math.min(cards.length - 1, Math.max(0, die(ctx, cards.length) - 1))];
    G.powers[targetPower].cards = G.powers[targetPower].cards.filter((id) => id !== card);
    discardCard(G, targetPower, card, false);
    pushLog(G, `Ruler Falls Ill discards ${cardById(card).name} from ${powerLabel(targetPower)}.`);
};

const resolveJeanne = (G: VQGame, ctx: Ctx): void => {
    const target = rebellionTargets(G).find((id) => SPACE_BY_ID[id]?.area === "france");
    if (target !== undefined) resolveRebellion(G, ctx, "protestant", target, 5);
    const bayonne = G.spaces.bayonne;
    if (bayonne !== undefined) {
        for (const owner of Object.keys(bayonne.land) as Power[]) {
            if (owner !== "protestant") delete bayonne.land[owner];
        }
        bayonne.control = "protestant";
        addLand(G, "bayonne", "protestant", "regular", 1);
    }
    removeCardFromGame(G, "vq-058");
    pushLog(G, "Jeanne of Navarre raises the Protestant cause and takes Bayonne.");
};

const resolveSeaBeggars = (G: VQGame, ctx: Ctx, target?: string): void => {
    if (target === undefined) return;
    const def = SPACE_BY_ID[target];
    const state = G.spaces[target];
    if (def === undefined || def.area !== "netherlands" || def.home !== "protestant" || !def.ports?.includes("northSea") ||
        state === undefined || state.control === "protestant" || ownersWithLand(G, target).length > 0) return;
    state.control = "protestant";
    state.religion = "protestant";
    addLand(G, target, "protestant", "regular", 1);
    addNaval(G, target, "protestant", "galleon", 1);
    if (["brielle", "flushing"].includes(target)) addNaval(G, target, "protestant", "galleon", 1);
    pushLog(G, `Sea Beggars seize ${def.name} for the Protestant.`);
    const spanishPort = zonePorts("northSea").find((id) => G.spaces[id].control === "spain" && !G.spaces[id].unrest);
    if (spanishPort !== undefined && (G.piracyActions?.protestant ?? 0) < 3) {
        const dice = roll(ctx, 3);
        const remaining = hits(dice);
        G.lastRolls = `Sea Beggars piracy [${dice.join(",")}] = ${remaining} hit(s)`;
        pushLog(G, G.lastRolls);
        if (remaining > 0) {
            G.pendingPiracy = {power: "protestant", target: "spain", zone: "northSea", step: "rewards", remaining, rewards: {}};
            ctx.events?.setActivePlayers({value: {[ownerOf(G, "spain")!]: "piracyChoice"}});
        }
    }
};

const resolveBorderReivers = (G: VQGame, ctx: Ctx, p: Power, target?: string): void => {
    const border = (power: Power): boolean => G.spaces.york.control === power ||
        SPACES.some((space) => space.area === "scotland" && G.spaces[space.id].control === power);
    if (target !== undefined && isPower(target) && target !== p && border(p) && border(target)) {
        const cards = G.powers[target].cards.filter((id) => cardById(id).kind !== "home");
        if (cards.length > 0) {
            const card = cards[Math.min(cards.length - 1, Math.max(0, die(ctx, cards.length) - 1))];
            G.powers[target].cards = G.powers[target].cards.filter((id) => id !== card);
            G.powers[p].cards.push(card);
            pushLog(G, `Border Reivers take ${cardById(card).name} from ${powerLabel(target)}.`);
        }
        return;
    }
    if (p === "england" || p === "france" || p === "protestant") {
        G.powers[p].influence.scotland = (G.powers[p].influence.scotland ?? 0) + 4;
        pushLog(G, `Border Reivers add 4 ${powerLabel(p)} influence in Scotland.`);
    }
};

const resolveDrakeHawkins = (G: VQGame): void => {
    if (G.worldCaptains.drake !== undefined || G.worldCaptains.hawkins !== undefined) return;
    const drake = seaCaptainById("drake");
    const hawkins = seaCaptainById("hawkins");
    if (drake === undefined || hawkins === undefined) return;
    G.worldCaptains.drake = {power: "england", location: "northAtlantic", damaged: false, colony: false, route: ["northAtlantic"], companion: "hawkins", treasureValues: []};
    G.powers.england.seaCaptains = G.powers.england.seaCaptains.filter((id) => id !== "drake" && id !== "hawkins");
    G.seaCaptainsAvailable = G.seaCaptainsAvailable.filter((id) => id !== "drake" && id !== "hawkins");
    removeCardFromGame(G, "vq-106");
    pushLog(G, "Drake and Hawkins combine into a single English expedition.");
};

const resolveLouise = (G: VQGame, p: Power): void => {
    if (p === "ottoman") return;
    const existing = G.royals.find((royal) => royal.id === "louiseLorraine");
    if (existing !== undefined) {
        existing.alive = true;
        existing.married = false;
        existing.status = "available";
        existing.power = p;
        existing.eligibility = 2;
    } else {
        G.royals.push({id: "louiseLorraine", name: "Louise of Lorraine", power: p, gender: "female",
            eligibility: 2, status: "available", alive: true, married: false});
    }
    removeCardFromGame(G, "vq-095");
    pushLog(G, `Louise of Lorraine enters the marriage pool for ${powerLabel(p)}.`);
};

const resolveDunkirkPrivateers = (G: VQGame, ctx: Ctx): void => {
    if (G.spaces.antwerp?.control !== "spain" && G.spaces.dunkirk?.control !== "spain" &&
        !SPACES.some((space) => space.area === "netherlands" && space.ports?.includes("northSea") &&
            G.spaces[space.id].control === "spain" && !G.spaces[space.id].unrest)) return;
    const target = zonePorts("northSea").find((id) => ["england", "protestant"].includes(G.spaces[id].control) && !G.spaces[id].unrest);
    if (target === undefined) return;
    const dice = roll(ctx, 4);
    const remaining = hits(dice);
    G.lastRolls = `Dunkirk Privateers [${dice.join(",")}] = ${remaining} hit(s)`;
    pushLog(G, `${G.lastRolls} against ${SPACE_BY_ID[target].name}.`);
    if (remaining === 0) return;
    G.pendingPiracy = {power: "spain", target: G.spaces[target].control as Power, zone: "northSea", step: "rewards", remaining, rewards: {}};
    ctx.events?.setActivePlayers({value: {[ownerOf(G, G.spaces[target].control as Power)!]: "piracyChoice"}});
};

const resolveGregorianCalendar = (G: VQGame, ctx: Ctx, p: Power, target?: string): void => {
    if (target === undefined || !isPower(target)) return;
    G.gregorianNext = target;
    if (G.powers[p].alliedMinors.includes("papacy")) drawCards(G, ctx, p, 1);
    removeCardFromGame(G, "vq-101");
    pushLog(G, `Gregorian Calendar: ${powerLabel(target)} will begin the next action round.`);
};

const resolvePolishElection = (G: VQGame, ctx: Ctx): void => {
    if (G.foreignWars.hre?.enemy === "Poland") {
        delete G.foreignWars.hre;
        pushLog(G, "Polish Royal Election ends the Polish war; the Holy Roman Empire is considered victorious.");
    }
    const order: Power[] = ["france", "hre", "spain"];
    const scores: {power: Power; score: number}[] = [];
    for (const power of order) {
        const card = G.powers[power].cards
            .filter((id) => cardById(id).kind !== "home" && cardById(id).officialKind !== "mandatory")
            .sort((a, b) => cardById(b).cp - cardById(a).cp)[0];
        let bid = 0;
        if (card !== undefined) {
            bid = cardById(card).cp;
            removeCardFromHand(G, power, card);
            discardCard(G, power, card, false);
        }
        const score = die(ctx, 6) + bid;
        scores.push({power, score});
        pushLog(G, `Polish election: ${powerLabel(power)} bids ${bid} and rolls ${score - bid} = ${score}.`);
    }
    const best = scores.slice().sort((a, b) => b.score - a.score || order.indexOf(a.power) - order.indexOf(b.power))[0];
    if (best !== undefined && best.score > 5) {
        addVp(G, best.power, 2);
        pushLog(G, `${powerLabel(best.power)} wins the Polish election and gains 2 VP.`);
    } else {
        pushLog(G, "No candidate exceeds 5; no Polish election VP is awarded.");
    }
    removeCardFromGame(G, "vq-086");
};

const resolveDragutFalls = (G: VQGame): void => {
    if (G.spaces.djerba?.control !== "spain" && G.spaces.tripoli?.control !== "spain") return;
    const dragut = G.leaders.dragut;
    if (dragut !== undefined && dragut.location !== "pool") {
        if (G.spaces[dragut.location] !== undefined) {
            G.spaces[dragut.location].leaders = G.spaces[dragut.location].leaders.filter((id) => id !== "dragut");
        } else if (G.seaZones[dragut.location as keyof VQGame["seaZones"]] !== undefined) {
            G.seaZones[dragut.location as keyof VQGame["seaZones"]].leaders =
                G.seaZones[dragut.location as keyof VQGame["seaZones"]].leaders.filter((id) => id !== "dragut");
        }
    }
    delete G.leaders.dragut;
    G.leaders.uluchAli = {id: "uluchAli", location: "pool", returnTurn: G.year + 1};
    addVp(G, "spain", 1);
    removeCardFromGame(G, "vq-011");
    pushLog(G, "Dragut falls; Uluch Ali returns next turn and Spain gains 1 VP.");
};

const resolveUnionOfArras = (G: VQGame, target?: string): void => {
    for (const space of SPACES.filter((def) => def.area === "netherlands")) {
        const state = G.spaces[space.id];
        for (const owner of Object.keys(state.land) as Power[]) {
            const stack = state.land[owner];
            if (stack !== undefined) stack.merc = 0;
        }
    }
    G.unionOfArras = true;
    G.dutchSpanishHome = true;
    const preferred = target?.split(":").filter((id) => G.spaces[id] !== undefined && SPACE_BY_ID[id]?.area === "netherlands") ?? [];
    const selected = preferred.length > 0
        ? preferred.slice(0, 5).map((id) => SPACE_BY_ID[id])
        : SPACES.filter((space) => space.area === "netherlands").slice(0, 5);
    for (const space of selected) {
        G.spaces[space.id].control = "spain";
        G.spaces[space.id].religion = "catholic";
    }
    let guards = 4;
    for (const space of SPACES.filter((def) => def.area === "netherlands" && G.spaces[def.id].control === "spain" &&
        G.spaces[def.id].siege === undefined && !G.spaces[def.id].unrest)) {
        const stack = G.spaces[space.id].land.spain;
        if (stack === undefined || stack.regular === 0) continue;
        const take = Math.min(guards, stack.regular);
        stack.regular -= take;
        addLand(G, space.id, "spain", "merc", take);
        guards -= take;
        if (guards === 0) break;
    }
    removeCardFromGame(G, "vq-109");
    pushLog(G, "Union of Arras removes Dutch mercenaries, secures five spaces, and raises Walloon guards.");
};

const resolveParisMass = (G: VQGame, target?: string): void => {
    if (allied(G, "protestant", "france")) return;
    const neighbors = landNeighbors("paris").map((neighbor) => neighbor.id);
    const adjacent = neighbors.filter((id) => G.spaces[id]?.control === "protestant").length;
    if (G.spaces.paris.control !== "protestant" && adjacent < 2) return;
    const region = ["paris", ...neighbors];
    const regulars = region.reduce((total, id) => total + (G.spaces[id]?.land.protestant?.regular ?? 0), 0);
    const navarre = G.leaders.navarre;
    if (regulars < 5 || navarre === undefined || !region.includes(navarre.location)) return;
    const preferred = target?.split(":").filter((id) => region.includes(id)) ?? [];
    const chosen = preferred.length > 0 ? preferred.slice(0, 3) : region.slice(0, 3);
    for (const id of chosen) G.spaces[id].control = "protestant";
    G.protestantCapital = "paris";
    removeCardFromGame(G, "vq-111");
    pushLog(G, "Paris is Worth a Mass: the Protestant takes Paris and moves the Huguenot capital there.");
};

const resolveDayOfBarricades = (G: VQGame): void => {
    if (allied(G, "france", "spain") || G.spaces.paris.control === "spain") return;
    const neighbors = landNeighbors("paris").map((neighbor) => neighbor.id);
    const controlled = neighbors.filter((id) => G.spaces[id]?.control === "spain").length;
    if (controlled < 2) return;
    const spanish = ["paris", ...neighbors].reduce((total, id) => total + (G.spaces[id]?.land.spain?.regular ?? 0), 0);
    const guise = G.leaders.guise;
    if (spanish < 4 || guise === undefined || !["paris", ...neighbors].includes(guise.location)) return;
    G.spaces.paris.land = {};
    G.spaces.paris.leaders = [];
    G.spaces.paris.control = "spain";
    addLand(G, "paris", "spain", "regular", 4);
    if (guise.location !== "paris") moveLeaders(G, guise.location, "paris", ["guise"]);
    pushLog(G, "Day of the Barricades: Spain seizes Paris and places 4 regulars.");
};

const resolveBlackQueen = (G: VQGame, ctx: Ctx, p: Power, target?: string): void => {
    if (target === undefined || !isPower(target) || target === p) return;
    const cards = G.powers[target].cards.filter((id) => cardById(id).kind !== "home");
    if (cards.length > 0) {
        const card = cards[Math.min(cards.length - 1, Math.max(0, die(ctx, cards.length) - 1))];
        G.powers[target].cards = G.powers[target].cards.filter((id) => id !== card);
        G.powers[p].cards.push(card);
        pushLog(G, `The Black Queen takes ${cardById(card).name} from ${powerLabel(target)}.`);
        return;
    }
    drawCards(G, ctx, p, 2);
};

const resolveSultanaSafiye = (G: VQGame, ctx: Ctx, p: Power, target?: string): void => {
    if (p !== "ottoman" || G.powers.ottoman.ruler !== "muradIII" || ctx.numPlayers < 5 ||
        target === undefined || !isPower(target) || target === "ottoman") return;
    const give = G.powers.ottoman.cards.find((id) => cardById(id).kind !== "home");
    const take = G.powers[target].cards.filter((id) => cardById(id).kind !== "home");
    if (give === undefined || take.length === 0) return;
    const received = take[Math.min(take.length - 1, Math.max(0, die(ctx, take.length) - 1))];
    G.powers.ottoman.cards = G.powers.ottoman.cards.filter((id) => id !== give);
    G.powers[target].cards = G.powers[target].cards.filter((id) => id !== received);
    G.powers[target].cards.push(give);
    G.powers.ottoman.cards.push(received);
    if (target === "england" || target === "france") drawCards(G, ctx, "ottoman", 1);
    pushLog(G, `Sultana Safiye exchanges a card with ${powerLabel(target)}.`);
};

const resolveEdmundCampion = (G: VQGame, ctx: Ctx): void => {
    const target = SPACES.find((space) => space.area === "england" &&
        totalLand(G, space.id, ownersWithLand(G, space.id)) === 0 && !G.spaces[space.id].unrest);
    if (target === undefined) return;
    const state = espionageState(G);
    if (!state.jesuits.includes(target.id)) {
        state.jesuits.push(target.id);
        state.jesuitsOnCard = Math.max(0, state.jesuitsOnCard - 1);
    }
    G.spaces[target.id].religion = "catholic";
    const adjacentProtestant = landNeighbors(target.id).filter((neighbor) => G.spaces[neighbor.id]?.religion === "protestant").length;
    if (adjacentProtestant > 0) resolveConversions(G, ctx, "spain", "catholic", "england", adjacentProtestant);
    pushLog(G, `Edmund Campion places a Jesuit in ${target.name}; ${adjacentProtestant} conversion attempt(s).`);
};

const resolveTenthPenny = (G: VQGame, ctx: Ctx, p: Power): void => {
    if (p === "protestant") {
        const space = rebellionTargets(G)[0];
        if (space !== undefined) resolveRebellion(G, ctx, "protestant", space, 5);
        return;
    }
    if (p === "spain") {
        const cards = G.powers.protestant.cards.filter((id) => cardById(id).kind !== "home");
        if (cards.length > 0) {
            const card = cards[Math.min(cards.length - 1, Math.max(0, die(ctx, cards.length) - 1))];
            G.powers.protestant.cards = G.powers.protestant.cards.filter((id) => id !== card);
            G.powers.spain.cards.push(card);
            G.lockedCards = {...(G.lockedCards ?? {}), spain: [...(G.lockedCards?.spain ?? []), card]};
            pushLog(G, `Tenth Penny: Spain takes ${cardById(card).name} from the Protestant; it cannot be played this impulse.`);
        }
    }
};

const resolveTaxis = (G: VQGame, ctx: Ctx, p: Power, target?: string): void => {
    if (target !== undefined && isPower(target) && target !== p) {
        const card = G.powers[p].cards.find((id) => cardById(id).kind !== "home" && cardById(id).officialKind !== "mandatory");
        if (card !== undefined) {
            G.powers[p].cards = G.powers[p].cards.filter((id) => id !== card);
            G.powers[target].cards.push(card);
            pushLog(G, `Taxis Family Courier gives ${cardById(card).name} to ${powerLabel(target)}.`);
        }
    }
    drawCards(G, ctx, p, 1);
};

const resolveBlackMagic = (G: VQGame, ctx: Ctx, p: Power, target?: string): void => {
    if (target === undefined || !isPower(target) || target === p) return;
    const cards = G.powers[target].cards.filter((id) => cardById(id).kind !== "home");
    if (cards.length === 0) {
        pushLog(G, "Black Magic: the target has no eligible card.");
        return;
    }
    const card = cards[Math.min(cards.length - 1, Math.max(0, die(ctx, cards.length) - 1))];
    G.powers[target].cards = G.powers[target].cards.filter((id) => id !== card);
    G.powers[p].cards.push(card);
    pushLog(G, `Black Magic takes ${cardById(card).name} from ${powerLabel(target)}.`);
};

/** #104 Armada Pardon: CP for the Armada. */
const resolveArmadaPardon = (G: VQGame, p: Power): void => {
    if (G.armada === undefined) return;
    const papacy = G.powers[p].alliedMinors.includes("papacy") ? 1 : 0;
    G.powers[p].cp += 4 + papacy;
    pushLog(G, `Armada Pardon grants Spain ${4 + papacy} CP for the Armada.`);
};

const resolveSpanishPayShips = (G: VQGame, ctx: Ctx, p: Power): void => {
    let remaining = 2;
    for (const space of SPACES.filter((def) => def.area === "netherlands")) {
        const stack = G.spaces[space.id].land.spain;
        if (stack === undefined) continue;
        while (remaining > 0 && stack.regular > 0) {
            stack.regular -= 1;
            remaining -= 1;
        }
        while (remaining > 0 && stack.merc >= 2) {
            stack.merc -= 2;
            remaining -= 1;
        }
        if (stack.regular + stack.merc + stack.cav === 0) delete G.spaces[space.id].land.spain;
        if (remaining === 0) break;
    }
    drawCards(G, ctx, p, 1);
    pushLog(G, `Spanish Pay Ships Seized removes ${2 - remaining} Spanish unit(s) and ${powerLabel(p)} draws a card.`);
};

const resolveConventionOfEstates = (G: VQGame): void => {
    const targets = SPACES.filter((space) => space.area === "netherlands" && G.spaces[space.id].religion !== "protestant").slice(0, 3);
    for (const space of targets) G.spaces[space.id].religion = "protestant";
    pushLog(G, `Convention of Estates converts ${targets.length} Netherlands space(s) to Protestant.`);
};

const resolvePuritans = (G: VQGame, ctx: Ctx, p: Power): void => {
    const cards = G.powers.england.cards.filter((id) => cardById(id).kind !== "home");
    if (cards.length > 0) {
        const card = cards[Math.min(cards.length - 1, Math.max(0, die(ctx, cards.length) - 1))];
        G.powers.england.cards = G.powers.england.cards.filter((id) => id !== card);
        G.powers[p].cards.push(card);
        pushLog(G, `Puritans draw ${cardById(card).name} from England; England gives it to ${powerLabel(p)}.`);
        return;
    }
    const targets = SPACES.filter((space) => space.home === "england" && !G.spaces[space.id].unrest &&
        totalLand(G, space.id, ownersWithLand(G, space.id)) === 0).slice(0, 3);
    for (const space of targets) G.spaces[space.id].unrest = true;
    pushLog(G, `Puritans place unrest in ${targets.length} English space(s).`);
};

const resolveNorthwestPassage = (G: VQGame, ctx: Ctx, target?: string): void => {
    if (target === undefined || G.worldCaptains[target] === undefined) return;
    const expedition = G.worldCaptains[target];
    const captain = seaCaptainById(target);
    if (captain === undefined || !["northAtlantic", "guineaCoast"].includes(expedition.location)) return;
    const first = die(ctx, 6);
    if (first <= captain.navigation) {
        pushLog(G, `Northwest Passage: ${captain.nameEn} rolls ${first} and remains safe.`);
        return;
    }
    delete G.worldCaptains[target];
    const second = die(ctx, 6);
    if (second >= 5) {
        G.powers[expedition.power].seaCaptains = G.powers[expedition.power].seaCaptains.filter((id) => id !== target);
        pushLog(G, `Northwest Passage: ${captain.nameEn} rolls ${first} then ${second} and dies.`);
    } else {
        G.seaCaptainReturn = {...(G.seaCaptainReturn ?? {}), [target]: {power: expedition.power, turn: G.year + 1}};
        pushLog(G, `Northwest Passage: ${captain.nameEn} rolls ${first} then ${second}; the expedition ends and he returns next turn.`);
    }
};

const resolveMenendez = (G: VQGame, ctx: Ctx): void => {
    const florida = G.worldColonies.florida;
    if (florida !== undefined && florida !== "spain") {
        const roll = die(ctx, 6);
        G.lastRolls = `Menéndez de Avilés: ${roll}`;
        if (roll >= 3) {
            delete G.worldColonies.florida;
            G.worldControls.florida = "spain";
            pushLog(G, `${G.lastRolls} — the Florida colony is removed and Spain takes control.`);
        } else {
            pushLog(G, `${G.lastRolls} — the Florida colony survives.`);
        }
        return;
    }
    if ((G.treasureFleetEscorts ?? 0) < 2) {
        G.treasureFleetEscorts = (G.treasureFleetEscorts ?? 0) + 1;
        pushLog(G, "Menéndez de Avilés adds a galleon to the Treasure Fleet escorts.");
        return;
    }
    const settlement = WORLD_SETTLEMENTS.find((def) => G.worldControls[def.id] === "spain" && G.worldFortresses?.[def.id] === undefined);
    if (settlement !== undefined) {
        G.worldFortresses = {...(G.worldFortresses ?? {}), [settlement.id]: "spain"};
        const zone = settlement.seaZone;
        if (zone !== undefined) G.worldPatrols = {...(G.worldPatrols ?? {}), [zone]: (G.worldPatrols?.[zone] ?? 0) + 1};
        pushLog(G, `Menéndez de Avilés fortifies ${settlement.nameEn} and adds a patrol.`);
    }
};

const resolveNostradamus = (G: VQGame, ctx: Ctx, p: Power): void => {
    const drawn = drawCards(G, ctx, p, p === "france" ? 8 : 4);
    if (drawn.length === 0) return;
    const best = drawn.slice().sort((a, b) => (cardById(b).cp ?? 0) - (cardById(a).cp ?? 0))[0];
    for (const card of drawn) {
        if (card === best) continue;
        G.powers[p].cards = G.powers[p].cards.filter((id) => id !== card);
        G.deck.push(card);
    }
    G.deck = shuffle(ctx, G.deck);
    pushLog(G, `Nostradamus' Prophecies: ${powerLabel(p)} keeps ${cardById(best).name} and returns the rest.`);
};

const resolveJohnKnox = (G: VQGame, p: Power, target?: string): void => {
    const chosen = target !== undefined ? SPACE_BY_ID[target] : undefined;
    if (chosen !== undefined && chosen.area === "scotland") {
        for (const space of SPACES.filter((def) => def.area === "scotland" && def.id !== chosen.id)) {
            G.spaces[space.id].religion = "protestant";
        }
        pushLog(G, `John Knox converts Scotland, sparing ${chosen.name}.`);
        return;
    }
    if (p === "england" || p === "protestant") {
        G.powers[p].influence.scotland = (G.powers[p].influence.scotland ?? 0) + 4;
        pushLog(G, `John Knox adds 4 ${powerLabel(p)} influence in Scotland.`);
    }
};

const resolveRudolfII = (G: VQGame, ctx: Ctx): void => {
    G.powers.hre.ruler = "rudolfII";
    G.powers.hre.rulerAdmin = 1;
    G.powers.hre.rulerCardBonus = 1;
    G.hreCapital = "prague";
    if (ctx.numPlayers <= 5 && G.majorInfluence) resolveMajorDiplomacy(G, ctx, "hre");
    pushLog(G, "Rudolf II becomes Holy Roman Emperor; the capital moves to Prague.");
};

const resolvePortugueseRaid = (G: VQGame, p: Power, ctx: Ctx): void => {
    const colony = Object.entries(G.worldColonies).find(([settlement, owner]) => {
        const def = WORLD_SETTLEMENT_BY_ID[settlement];
        return def !== undefined && ["southAtlantic", "indianOcean", "southPacific"].includes(def.seaZone ?? "") &&
            owner !== "spain";
    });
    if (colony === undefined) {
        pushLog(G, "Portuguese Raid: no eligible colony is present.");
        return;
    }
    const [settlement, owner] = colony;
    delete G.worldColonies[settlement];
    if (owner !== undefined && G.worldControls[settlement] === owner) delete G.worldControls[settlement];
    if (G.spaces.lisbon?.control === p) addTreasure(G, ctx, p, 1);
    pushLog(G, `Portuguese Raid removes the colony at ${settlement}${G.spaces.lisbon.control === p ? " and draws a treasure" : ""}.`);
};

const resolveLostColony = (G: VQGame, ctx: Ctx): void => {
    const colony = Object.entries(G.worldColonies).find(([settlement]) => {
        const def = WORLD_SETTLEMENT_BY_ID[settlement];
        return def !== undefined && (def.region === "atlanticCoast" || def.region === "northAmerica");
    });
    if (colony === undefined) {
        pushLog(G, "Lost Colony: no Atlantic-coast colony is present.");
        return;
    }
    const [settlement, power] = colony;
    if (power === undefined) return;
    const roll = die(ctx, 6);
    G.lastRolls = `Lost Colony (${settlement}): ${roll}`;
    if (roll >= 5) {
        pushLog(G, `${G.lastRolls} — the colony survives.`);
        return;
    }
    delete G.worldColonies[settlement];
    if (G.worldControls[settlement] === power) delete G.worldControls[settlement];
    pushLog(G, `${G.lastRolls} — the colony is destroyed.`);
};

const resolveIndex = (G: VQGame, ctx: Ctx): void => {
    for (let attempt = 0; attempt < 6; attempt++) {
        const areas = ["france", "netherlands", "scotland"] as const;
        const area = areas
            .map((id) => ({id, count: SPACES.filter((space) => space.area === id && G.spaces[space.id].religion === "protestant").length}))
            .sort((a, b) => b.count - a.count)[0].id;
        resolveConversions(G, ctx, "spain", "catholic", area, 1, attempt === 0);
    }
};

const resolvePatronOfArts = (G: VQGame, ctx: Ctx, target?: string): void => {
    if (target === undefined) {
        target = G.patronsAvailable.map((id) => patronById(G, id)).find((patron) => patron?.region === "hre" && patron.rating !== null)?.id;
    }
    if (target === undefined) return;
    const patron = patronById(G, target);
    if (patron !== undefined && (patron.region === "italy" || patron.region === "hre") && patron.rating !== null &&
        !POWERS.some((power) => G.powers[power].patrons.includes(patron.id))) {
        const key = `hre:${patron.kind}`;
        if (G.patronizedThisTurn.includes(key)) return;
        G.pendingPatronage.push({power: "hre", patronId: patron.id, cp: 3});
        G.patronizedThisTurn.push(key);
        if (G.powers.hre.ruler === "rudolf") G.pragueCulturalCenter = patron.id;
        drawCards(G, ctx, "hre", 1);
        pushLog(G, `Patron of Arts sponsors ${patron.name} for the Holy Roman Empire.`);
        return;
    }
    if (!isPower(target) || target === "hre") return;
    drawCards(G, ctx, "hre", 2);
    const candidates = G.powers.hre.cards.filter((id) => cardById(id).kind !== "home" && cardById(id).officialKind !== "mandatory");
    if (candidates.length === 0) {
        pushLog(G, "Patron of Arts finds no card to give.");
        return;
    }
    const card = candidates[Math.min(candidates.length - 1, Math.max(0, die(ctx, candidates.length) - 1))];
    G.powers.hre.cards = G.powers.hre.cards.filter((id) => id !== card);
    G.powers[target].cards.push(card);
    pushLog(G, `Patron of Arts draws two cards and gives ${cardById(card).name} to ${powerLabel(target)}.`);
};

const resolveItalianExpert = (G: VQGame, p: Power, target?: string): void => {
    if (target === undefined) return;
    const patron = patronById(G, target);
    if (patron === undefined || patron.region !== "italy" || patron.rating === null ||
        POWERS.some((power) => G.powers[power].patrons.includes(patron.id))) return;
    const key = `${p}:${patron.kind}`;
    if (G.patronizedThisTurn.includes(key)) return;
    G.pendingPatronage.push({power: p, patronId: patron.id, cp: 3});
    G.patronizedThisTurn.push(key);
    pushLog(G, `Italian Expert sponsors ${patron.name} for ${powerLabel(p)}.`);
};

const resolveSack = (G: VQGame, ctx: Ctx, attacker: Power, target?: string): void => {
    if (target === undefined || G.spaces[target] === undefined || G.spaces[target].control !== attacker) return;
    let defender: Power | undefined;
    for (const neighbor of landNeighbors(target)) {
        const state = G.spaces[neighbor.id];
        if (!state.fortress) continue;
        const controllers = ownersWithLand(G, neighbor.id).filter((owner): owner is Power =>
            isPower(owner) && !friendlyController(G, attacker, owner));
        if (controllers.length === 0 || friendlyControlled(G, attacker, neighbor.id)) continue;
        defender ??= controllers[0];
        const defenders = totalLand(G, neighbor.id, controllers);
        const roll = die(ctx, 6);
        pushLog(G, `Sack! roll at ${SPACE_BY_ID[neighbor.id].name}: ${roll} vs ${defenders} defender(s).`);
        if (roll <= defenders) continue;
        state.control = attacker;
        for (const owner of controllers) delete state.land[owner];
        captureLeaders(G, neighbor.id, controllers, attacker);
        pushLog(G, `${SPACE_BY_ID[neighbor.id].name} surrenders to ${powerLabel(attacker)}.`);
    }
    if (defender !== undefined) {
        G.powers[defender].marriageCardModifier = (G.powers[defender].marriageCardModifier ?? 0) + 1;
    }
};

const resolveSpanishFury = (G: VQGame, ctx: Ctx, target?: string): void => {
    if (target === undefined || !isPower(target) || target === "spain") return;
    const cards = G.powers[target].cards.filter((id) => cardById(id).kind !== "home");
    if (cards.length === 0) {
        pushLog(G, "Spanish Fury: the defender has no cards to seize.");
        return;
    }
    const card = cards[Math.min(cards.length - 1, Math.max(0, die(ctx, cards.length) - 1))];
    G.powers[target].cards = G.powers[target].cards.filter((id) => id !== card);
    G.powers.spain.cards.push(card);
    drawCards(G, ctx, "spain", 1);
    G.powers[target].marriageCardModifier = (G.powers[target].marriageCardModifier ?? 0) + 1;
    pushLog(G, `Spanish Fury seizes ${cardById(card).name} from ${powerLabel(target)}; Spain draws a card and the defender gains +1 Card.`);
};

const resolveScurvy = (G: VQGame, target?: string): void => {
    if (target === undefined || G.worldCaptains[target] === undefined) return;
    G.worldCaptains[target].navigationPenalty = 1;
    pushLog(G, `${seaCaptainById(target)?.nameEn ?? target} suffers scurvy (-1 Navigation).`);
};

const resolveMaryQueenOfScots = (G: VQGame, ctx: Ctx): void => {
    const mary = G.royals.find((royal) => royal.id === "maryScots");
    const alive = G.espionage?.mary !== "dead" && mary?.alive !== false;
    if (!alive) {
        removeCardFromGame(G, "vq-089");
        pushLog(G, "Mary Queen of Scots is dead; the card is removed after play.");
        return;
    }
    G.powers.france.influence.scotland = (G.powers.france.influence.scotland ?? 0) + 3;
    pushLog(G, "Mary Queen of Scots adds 3 French influence in Scotland.");
    resolveMinorDiplomacy(G, ctx, "scotland");
};

const resolveExperiencedNavigator = (G: VQGame, target?: string): void => {
    if (target === undefined || G.worldCaptains[target] === undefined) return;
    const captain = seaCaptainById(target);
    if (captain === undefined) return;
    G.worldCaptains[target].navigationBonus = Math.min(3, captain.navigation + 1);
    pushLog(G, `${captain.nameEn} becomes an Experienced Navigator (Navigation ${G.worldCaptains[target].navigationBonus}).`);
};

const resolveGouvernanteDeFrance = (G: VQGame, ctx: Ctx): void => {
    if (atWar(G, "france", "protestant") && G.powers.france.cards.length <= 2) {
        const result = die(ctx, 6) + 2;
        const targets = SPACES.filter((space) => space.area === "france" &&
            (G.spaces[space.id].control === "protestant" || G.spaces[space.id].religion === "protestant"))
            .slice(0, result);
        for (const space of targets) {
            if (G.spaces[space.id].control === "protestant") G.spaces[space.id].control = "france";
            if (G.spaces[space.id].religion === "protestant") G.spaces[space.id].religion = "catholic";
        }
        G.protestantRebellionBlockedTurn = G.year;
        pushLog(G, `Gouvernante de France converts ${targets.length} French space(s); Protestant rebellions are blocked this turn.`);
        return;
    }
    const betrothal = G.betrothals.find((b) => {
        const male = G.royals.find((royal) => royal.id === b.male);
        const female = G.royals.find((royal) => royal.id === b.female);
        return male?.power === "france" || female?.power === "france";
    });
    if (betrothal === undefined) {
        pushLog(G, "Gouvernante de France: no French betrothal is available.");
        return;
    }
    G.marriageFestivities = "france";
    drawCards(G, ctx, "france", 1);
    pushLog(G, "Gouvernante de France places +2 Wedding Festivities on a French marriage and draws a card.");
};

const resolveEnterpriseOfEngland = (G: VQGame): void => {
    const english = SPACES.filter((space) => space.area === "england");
    const jesuits = (G.espionage?.jesuits ?? []).filter((space) => english.some((def) => def.id === space)).length;
    const catholic = english.filter((space) => !G.spaces[space.id].unrest && G.spaces[space.id].religion === "catholic").length;
    const spanishControl = english.filter((space) => !G.spaces[space.id].unrest && G.spaces[space.id].control === "spain").length;
    const spanishRegulars = english.reduce((total, space) => total + (G.spaces[space.id].land.spain?.regular ?? 0), 0);
    const total = jesuits + catholic + spanishControl + spanishRegulars;
    pushLog(G, `Enterprise of England: ${jesuits} Jesuit(s), ${catholic} Catholic, ${spanishControl} Spanish-controlled, ${spanishRegulars} Spanish regulars = ${total}.`);
    if (total <= 2) {
        addVp(G, "england", 1);
        addVp(G, "spain", -1);
    } else if (total <= 4) {
        addVp(G, "england", 1);
    } else if (total <= 6) {
        // No award.
    } else if (total <= 10) {
        addVp(G, "spain", 1);
    } else if (total <= 15) {
        addVp(G, "spain", 2);
        addVp(G, "england", -1);
    } else {
        addVp(G, "spain", 3);
        addVp(G, "england", -2);
    }
};

const resolveSpanishArmada = (G: VQGame, p: Power): void => {
    if (G.armada === undefined) {
        const port = ["seville", "corunna", "lisbon"].find((id) => G.spaces[id].control === p && !G.spaces[id].unrest && G.spaces[id].siege === undefined);
        if (port === undefined) {
            pushLog(G, "Spain has no legal port for the Armada.");
            return;
        }
        G.armada = {strength: 2, location: port};
        delete G.armadaReturn;
        G.powers[p].cp += 5;
        pushLog(G, `The Spanish Armada is placed in ${SPACE_BY_ID[port].name}; Spain gains 5 CP.`);
    } else {
        G.powers[p].cp += 7;
        pushLog(G, "Spain gains 7 CP for the Armada.");
    }
};

export const armadaTransport = (G: VQGame, ctx: Ctx, args: {port: string; direction: "load" | "unload"}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action" || power(G, ctx) !== "spain" || G.armada === undefined || !isSeaZone(G.armada.location) ||
        !navalAdjacent(G.armada.location, args.port) || !friendlyControlled(G, "spain", args.port) ||
        G.powers.spain.cp < 1) return INVALID_MOVE;
    const port = G.spaces[args.port];
    if (port === undefined) return INVALID_MOVE;
    if (args.direction === "load") {
        const source = port.land.spain;
        if (source === undefined) return INVALID_MOVE;
        const free = G.armada.strength - landCount(G.armada.land ?? {regular: 0, merc: 0, cav: 0});
        if (free <= 0) return INVALID_MOVE;
        const loaded: LandStack = {regular: 0, merc: 0, cav: 0};
        let room = free;
        for (const kind of ["regular", "merc", "cav"] as const) {
            const take = Math.min(room, source[kind]);
            loaded[kind] = take;
            source[kind] -= take;
            room -= take;
        }
        if (landCount(loaded) === 0) return INVALID_MOVE;
        const current = G.armada.land ?? {regular: 0, merc: 0, cav: 0};
        G.armada.land = {regular: current.regular + loaded.regular, merc: current.merc + loaded.merc, cav: current.cav + loaded.cav};
        if (landCount(source) === 0) delete port.land.spain;
    } else {
        if (G.armada.land === undefined) return INVALID_MOVE;
        const target = port.land.spain ?? {regular: 0, merc: 0, cav: 0};
        target.regular += G.armada.land.regular;
        target.merc += G.armada.land.merc;
        target.cav += G.armada.land.cav;
        port.land.spain = target;
        delete G.armada.land;
    }
    if (!spend(G, "spain", 1)) return INVALID_MOVE;
    pushLog(G, `Spain uses Armada naval transport at ${SPACE_BY_ID[args.port].name}.`);
};

export const loadArmada = (G: VQGame, ctx: Ctx): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action" || power(G, ctx) !== "spain" || G.armada === undefined) return INVALID_MOVE;
    const port = G.spaces[G.armada.location];
    if (port === undefined || G.armada.location === "englishChannel" || !isPort(G.armada.location)) return INVALID_MOVE;
    const stack = port.land.spain;
    if (stack === undefined) return INVALID_MOVE;
    const free = G.armada.strength - landCount(G.armada.land ?? {regular: 0, merc: 0, cav: 0});
    if (free <= 0) return INVALID_MOVE;
    const loaded: LandStack = {regular: 0, merc: 0, cav: 0};
    let room = free;
    for (const kind of ["regular", "merc", "cav"] as const) {
        const take = Math.min(room, stack[kind]);
        loaded[kind] = take;
        stack[kind] -= take;
        room -= take;
    }
    if (landCount(loaded) === 0) return INVALID_MOVE;
    const current = G.armada.land ?? {regular: 0, merc: 0, cav: 0};
    G.armada.land = {regular: current.regular + loaded.regular, merc: current.merc + loaded.merc, cav: current.cav + loaded.cav};
    if (landCount(stack) === 0) delete port.land.spain;
    pushLog(G, `Spain loads ${landCount(loaded)} land unit(s) onto the Armada.`);
};

export const unloadArmada = (G: VQGame, ctx: Ctx): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action" || power(G, ctx) !== "spain" || G.armada?.land === undefined) return INVALID_MOVE;
    const port = G.spaces[G.armada.location];
    if (port === undefined || !isPort(G.armada.location)) return INVALID_MOVE;
    const stack = port.land.spain ?? {regular: 0, merc: 0, cav: 0};
    stack.regular += G.armada.land.regular;
    stack.merc += G.armada.land.merc;
    stack.cav += G.armada.land.cav;
    port.land.spain = stack;
    delete G.armada.land;
    pushLog(G, "Spain unloads the Armada's land units into port.");
};

export const upgradeArmada = (G: VQGame, ctx: Ctx): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action" || power(G, ctx) !== "spain" || G.armada === undefined || G.armada.strength >= 8 ||
        !["seville", "corunna", "lisbon"].includes(G.armada.location) || G.powers.spain.cp < 3) return INVALID_MOVE;
    if (!spend(G, "spain", 3)) return INVALID_MOVE;
    G.armada.strength = (G.armada.strength + 2) as 2 | 4 | 6 | 8;
    pushLog(G, `Spain upgrades the Armada to strength ${G.armada.strength}.`);
};

const resolvePlayedCardEvent = (G: VQGame, ctx: Ctx, p: Power, cardId: string, target?: string): void => {
    const def = cardById(cardId);
    const handler = def.officialEffect?.kind === "manual" ? def.officialEffect.handler : "";
    const beneficiary = foreignWarPower(handler);
    if (cardId === "vq-014") {
        G.beaconFires = p;
        pushLog(G, `${powerLabel(p)} prepares Beacon Fires for the next interception.`);
    } else if (cardId === "vq-021") {
        resolveForeignVolunteers(G, p);
    } else if (cardId === "vq-026") {
        resolveSmallAid(G, target);
    } else if (cardId === "vq-055" && (target === "france" || target === "netherlands")) {
        resolveConversions(G, ctx, p, "protestant", target, 7, true, 0, {fivesAsSix: true}, true);
    } else if (cardId === "vq-070") {
        const areas = (["england", "scotland", "netherlands", "france"] as const)
            .map((id) => ({id, count: SPACES.filter((space) => space.area === id && G.spaces[space.id].religion === "protestant").length}))
            .sort((a, b) => b.count - a.count).slice(0, 2);
        resolveConversions(G, ctx, p, "catholic", areas[0].id, 4, true);
        resolveConversions(G, ctx, p, "catholic", areas[1].id, 4, false);
    } else if (cardId === "vq-108") {
        resolveConversions(G, ctx, p, "catholic", "england", 3, true);
        resolveConversions(G, ctx, p, "catholic", "scotland", 3, false);
    } else if (isGrandVizier(def)) {
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
    } else if (handler === "virginQueen") {
        resolveVirginQueenEvent(G, ctx, p, target);
    } else if (handler === "spanishArmada") {
        resolveSpanishArmada(G, p);
    } else if (handler === "treasureFleet") {
        resolveTreasureFleet(G, ctx);
    } else if (handler === "enterpriseOfEngland") {
        resolveEnterpriseOfEngland(G);
    } else if (handler === "gouvernanteDeFrance") {
        resolveGouvernanteDeFrance(G, ctx);
    } else if (handler === "card049") {
        resolveConquestOfPhilippines(G, ctx);
    } else if (handler === "councilOfTroubles") {
        resolveCouncilOfTroubles(G, ctx);
    } else if (handler === "foxesBookOfMartyrs") {
        resolveFoxesBook(G, ctx);
    } else if (handler === "experiencedNavigator") {
        resolveExperiencedNavigator(G, target);
    } else if (handler === "maryQueenOfScots") {
        resolveMaryQueenOfScots(G, ctx);
    } else if (handler === "sirEdwardStafford") {
        resolveSirEdwardStafford(G, ctx, target);
    } else if (handler === "scurvy") {
        resolveScurvy(G, target);
    } else if (handler === "spanishFury") {
        resolveSpanishFury(G, ctx, target);
    } else if (handler === "sack") {
        resolveSack(G, ctx, p, target);
    } else if (handler === "italianExpert") {
        resolveItalianExpert(G, p, target);
    } else if (handler === "patronOfArts") {
        resolvePatronOfArts(G, ctx, target);
    } else if (handler === "indexOfProhibitedBooks") {
        resolveIndex(G, ctx);
    } else if (handler === "lostColony") {
        resolveLostColony(G, ctx);
    } else if (handler === "portugueseRaid") {
        resolvePortugueseRaid(G, p, ctx);
    } else if (handler === "henryIII") {
        resolveHenryIII(G);
    } else if (handler === "muradIII") {
        resolveMuradIII(G, ctx);
    } else if (handler === "rudolfII") {
        resolveRudolfII(G, ctx);
    } else if (handler === "johnKnox") {
        resolveJohnKnox(G, p, target);
    } else if (handler === "card063") {
        resolveNostradamus(G, ctx, p);
    } else if (handler === "menendezDeAviles") {
        resolveMenendez(G, ctx);
    } else if (handler === "northwestPassage") {
        resolveNorthwestPassage(G, ctx, target);
    } else if (handler === "puritans") {
        resolvePuritans(G, ctx, p);
    } else if (handler === "conventionOfEstates") {
        resolveConventionOfEstates(G);
    } else if (handler === "spanishPayShipsSeized") {
        resolveSpanishPayShips(G, ctx, p);
    } else if (handler === "blackMagic") {
        resolveBlackMagic(G, ctx, p, target);
    } else if (handler === "taxisFamilyCourier") {
        resolveTaxis(G, ctx, p, target);
    } else if (handler === "tenthPenny") {
        resolveTenthPenny(G, ctx, p);
    } else if (handler === "edmundCampion") {
        resolveEdmundCampion(G, ctx);
    } else if (handler === "sultanaSafiye") {
        resolveSultanaSafiye(G, ctx, p, target);
    } else if (handler === "sultansHarem") {
        G.powers.ottoman.cp += 5;
        G.haremImpulse = G.impulse;
        pushLog(G, "Sultan's Harem grants the Ottoman 5 CP for corsairs, naval movement, or piracy.");
    } else if (handler === "blackQueen") {
        resolveBlackQueen(G, ctx, p, target);
    } else if (handler === "dayOfTheBarricades") {
        resolveDayOfBarricades(G);
    } else if (handler === "actOfAbjuration") {
        resolveActOfAbjuration(G, ctx, p);
    } else if (handler === "parisIsWorthAMass") {
        resolveParisMass(G, target);
    } else if (handler === "unionOfArras") {
        resolveUnionOfArras(G, target);
    } else if (handler === "dragutFalls") {
        resolveDragutFalls(G);
    } else if (handler === "polishRoyalElection") {
        resolvePolishElection(G, ctx);
    } else if (handler === "gregorianCalendar") {
        resolveGregorianCalendar(G, ctx, p, target);
    } else if (handler === "dunkirkPrivateers") {
        resolveDunkirkPrivateers(G, ctx);
    } else if (handler === "louiseOfLorraine") {
        resolveLouise(G, p);
    } else if (handler === "drakeHawkinsExpedition") {
        resolveDrakeHawkins(G);
    } else if (handler === "borderReivers") {
        resolveBorderReivers(G, ctx, p, target);
    } else if (handler === "seaBeggars") {
        resolveSeaBeggars(G, ctx, target);
    } else if (handler === "jeanneOfNavarre") {
        resolveJeanne(G, ctx);
    } else if (handler === "card025") {
        resolveUnrestInRealm(G, target);
    } else if (handler === "diplomaticFauxPas") {
        resolveDiplomaticFauxPas(G, target);
    } else if (handler === "eloquentAmbassador") {
        resolveEloquentAmbassador(G, ctx, p, target);
    } else if (handler === "foreignVolunteers") {
        resolveForeignVolunteers(G, p);
    } else if (handler === "johnHawkins") {
        resolveJohnHawkins(G, p, target);
    } else if (handler === "philosophersStone") {
        resolvePhilosophersStone(G, target);
    } else if (handler === "elDorado") {
        resolveElDorado(G, target);
    } else if (handler === "armyMutiny") {
        resolveArmyMutiny(G, ctx, target);
    } else if (handler === "cityStateRebels") {
        resolveCityStateRebels(G, ctx, p, target);
    } else if (handler === "treachery") {
        resolveTreachery(G, ctx, target);
    } else if (handler === "holyLeague") {
        resolveHolyLeague(G, ctx, p);
    } else if (handler === "knightsOfStJohn") {
        resolveKnightsOfStJohn(G);
    } else if (handler === "muscovyCompany") {
        resolveMuscovyCompany(G, p);
    } else if (handler === "card022") {
        resolveGenoeseBankers(G, ctx, p, target);
    } else if (handler === "grandTour") {
        resolveGrandTour(G, p, target);
    } else if (handler === "calvinistZeal") {
        resolveCalvinistZeal(G, ctx);
    } else if (handler === "papalBull") {
        resolvePapalBull(G, ctx);
    } else if (handler === "aSmallAid") {
        resolveSmallAid(G, target);
    } else if (handler === "germanRecruitmentCurtailed") {
        resolveGermanRecruitment(G, p, target);
    } else if (handler === "rulerFallsIll") {
        resolveRulerFallsIll(G, ctx, p, target);
    } else if (handler === "armadaPardon") {
        resolveArmadaPardon(G, p);
    } else if (handler === "dutchRevolt") {
        resolveDutchRevolt(G);
    } else if (handler === "holyRomanIntercession") {
        resolveHolyRomanIntercession(G, ctx, target);
    } else if (handler === "ottomanTribute") {
        resolveOttomanTribute(G, ctx, target);
    } else if (handler === "spanishRoad") {
        resolveSpanishRoad(G);
    } else if (handler === "beaconFires") {
        G.beaconFires = p;
        pushLog(G, `${powerLabel(p)} prepares Beacon Fires for the next interception.`);
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
        G.powers.ottoman.rulerAdmin = 2;
        G.powers.ottoman.rulerCardBonus = 1;
        G.cyprusTarget = ["nicosia", "candia", "corfu"].find((id) => G.spaces[id] !== undefined && G.spaces[id].control !== "ottoman");
        pushLog(G, `Selim II succeeds Suleiman; the Cyprus VP target is ${G.cyprusTarget ?? "none"}.`);
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
        const responseCard = pending.responseCard ?? (pending.responding === "ottoman" ? G.powers.ottoman.cards.find((id) => id === "vq-001" || id === "vq-home-grand-vizier") : undefined)!;
        removeCardFromHand(G, pending.responding, responseCard);
        discardCard(G, pending.responding, responseCard, true);
        pushLog(G, `${pending.responding === "ottoman" && responseCard !== "vq-042" ? "Grand Vizier" : "Catherine's Flying Squadron"} cancels ${cardById(pending.cardId).name}.`);
    } else {
        // Continue with the original power and target, without playing or discarding twice.
        discardCard(G, pending.power, pending.cardId, true);
        resolvePlayedCardEvent(G, {...ctx, playerID: ownerOf(G, pending.power)}, pending.power, pending.cardId, pending.target);
    }
};

export const playCard = (G: VQGame, ctx: Ctx, args: { cardId: string; asEvent?: boolean; target?: string }): void | typeof INVALID_MOVE => {
    if (moveError(G, "playCard", args)) return INVALID_MOVE;
    const earlyEffect = cardById(args.cardId).officialEffect;
    const louiseDiplomacy = ctx.phase === "diplomacy" && args.asEvent === true &&
        earlyEffect?.kind === "manual" && earlyEffect.handler === "louiseOfLorraine";
    if (ctx.phase !== "action" && !louiseDiplomacy) {
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
    if (G.lockedCards?.[p]?.includes(args.cardId)) return INVALID_MOVE;
    const def = cardById(args.cardId);
    if (args.asEvent === true && isGrandVizier(def) && !canPlayGrandVizier(G, p, ctx.numPlayers)) return INVALID_MOVE;
    const cardHandler = def.officialEffect?.kind === "manual" ? def.officialEffect.handler : "";
    const isBeaconFires = def.id === "vq-014";
    const beneficiary = foreignWarPower(cardHandler);
    if (args.asEvent === true && isEspionageEvent(cardHandler) && !canPlayEspionageEvent(G, p, cardHandler, args.target)) return INVALID_MOVE;
    if (args.asEvent === true && cardHandler === "northernRising" && !canPlayNorthernRising(G)) return INVALID_MOVE;
    if (args.asEvent === true && cardHandler === "stBartholomewsDayMassacre" && !canPlayMassacre(G)) return INVALID_MOVE;
    if (args.asEvent === true && cardHandler === "untimelyDeath" && G.scenario !== "tutorial" && !canPlayUntimelyDeath(G, args.target)) return INVALID_MOVE;
    if (args.asEvent === true && cardHandler === "moriscoRevolt" &&
        !(atWar(G, "ottoman", "spain") && G.morisco === undefined)) return INVALID_MOVE;
    if (args.asEvent === true && cardHandler === "spanishPayShipsSeized" && p === "spain") return INVALID_MOVE;
    if (args.asEvent === true && cardHandler === "louiseOfLorraine" && p === "ottoman") return INVALID_MOVE;
    if (args.asEvent === true && cardHandler === "virginQueen" &&
        !G.royals.some((royal) => royal.id === "elizabeth" && royal.alive)) return INVALID_MOVE;
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
    if (args.asEvent === true && timedCombatCard && !isBeaconFires &&
        (G.cardWindow?.kind !== "combat" || (def.officialEffect?.kind === "combat" &&
            def.officialEffect.phase !== undefined && def.officialEffect.phase !== "any" &&
            G.cardWindow.phase !== def.officialEffect.phase) ||
            (G.cardWindow.attacker !== undefined && G.cardWindow.attacker !== p))) {
        return INVALID_MOVE;
    }
    if (args.asEvent === true && timedResponseCard && !isBeaconFires && !tutorialEvent && G.cardWindow?.kind !== "response" &&
        !["experiencedNavigator", "maryQueenOfScots", "sirEdwardStafford", "scurvy", "spanishFury", "sack", "dragutFalls", "gregorianCalendar", "borderReivers", "jeanneOfNavarre", "sultansHarem"].includes(cardHandler)) {
        return INVALID_MOVE;
    }
    const cancellation = args.asEvent === true ? cancelEventResponder(G, def) : undefined;
    const cancelWindow = cancellation !== undefined;
    removeCardFromHand(G, p, args.cardId);
    const maryDead = args.cardId === "vq-089" && args.asEvent !== true &&
        (G.espionage?.mary === "dead" || G.royals.find((royal) => royal.id === "maryScots")?.alive === false);
    const elizabethDead = args.cardId === "vq-036" && args.asEvent !== true &&
        G.royals.find((royal) => royal.id === "elizabeth")?.alive === false;
    // Event-only removal is deferred until the Ottoman accepts or cancels the event.
    if (maryDead) removeCardFromGame(G, "vq-089");
    else if (elizabethDead) removeCardFromGame(G, "vq-036");
    else if (!cancelWindow) discardCard(G, p, args.cardId, args.asEvent === true);
    ps.cardPlayed = true;
    markAction(G, p);
    if (args.asEvent === true) {
        pushLog(G, `${powerLabel(p)} plays ${def.name} as an event.`);
        if (cancelWindow) {
            G.pendingCardEvent = {kind: "cancelEvent", cardId: args.cardId, power: p, responding: cancellation!.power,
                responseCard: cancellation!.cardId, ...(args.target !== undefined ? {target: args.target} : {})};
            ctx.events?.setActivePlayers({value: {[ownerOf(G, cancellation!.power)!]: "cardEvent"}});
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

/** #11 response after Dragut fights: roll for death or return to the Turn Track. */
/** #89 Mary Queen of Scots response: +4 French influence in Scotland. */
/** #15 Storms option 2: force an expedition navigation check. */
/** #45 Scurvy option 2: force an expedition navigation check. */
export const scurvyNavigation = (G: VQGame, ctx: Ctx, args: {captain: string}): void | typeof INVALID_MOVE => {
    const p = power(G, ctx);
    if (!G.powers[p].cards.includes("vq-045") || G.worldCaptains[args.captain] === undefined) return INVALID_MOVE;
    removeCardFromHand(G, p, "vq-045");
    discardCard(G, p, "vq-045", true);
    navigationCheck(G, ctx, args.captain);
};

export const stormNavigation = (G: VQGame, ctx: Ctx, args: {captain: string}): void | typeof INVALID_MOVE => {
    const p = power(G, ctx);
    if (!G.powers[p].cards.includes("vq-015") || G.worldCaptains[args.captain] === undefined) return INVALID_MOVE;
    removeCardFromHand(G, p, "vq-015");
    discardCard(G, p, "vq-015", true);
    navigationCheck(G, ctx, args.captain);
};

export const maryInfluence = (G: VQGame, ctx: Ctx): void | typeof INVALID_MOVE => {
    const p = power(G, ctx);
    const mary = G.royals.find((royal) => royal.id === "maryScots");
    if (p !== "france" || !G.powers.france.cards.includes("vq-089") || G.espionage?.mary === "dead" || mary?.alive === false) return INVALID_MOVE;
    G.powers.france.influence.scotland = (G.powers.france.influence.scotland ?? 0) + 4;
    removeCardFromHand(G, "france", "vq-089");
    discardCard(G, "france", "vq-089", true);
    pushLog(G, "Mary Queen of Scots adds 4 French influence in Scotland.");
};

export const dragutFallsRoll = (G: VQGame, ctx: Ctx): void | typeof INVALID_MOVE => {
    const p = power(G, ctx);
    if (!G.powers[p].cards.includes("vq-011") || G.leaders.dragut === undefined ||
        G.leaders.dragut.location === "pool" || G.dragutFought !== true) return INVALID_MOVE;
    removeCardFromHand(G, p, "vq-011");
    discardCard(G, p, "vq-011", true);
    delete G.dragutFought;
    const dragut = G.leaders.dragut;
    if (G.spaces[dragut.location] !== undefined) {
        G.spaces[dragut.location].leaders = G.spaces[dragut.location].leaders.filter((id) => id !== "dragut");
    } else if (G.seaZones[dragut.location as keyof VQGame["seaZones"]] !== undefined) {
        G.seaZones[dragut.location as keyof VQGame["seaZones"]].leaders =
            G.seaZones[dragut.location as keyof VQGame["seaZones"]].leaders.filter((id) => id !== "dragut");
    }
    const roll = die(ctx, 6);
    G.lastRolls = `Dragut Falls: ${roll}`;
    if (roll >= 4) {
        delete G.leaders.dragut;
        G.leaders.uluchAli = {id: "uluchAli", location: "pool", returnTurn: G.year + 1};
        removeCardFromGame(G, "vq-011");
        pushLog(G, `${G.lastRolls} — Dragut dies; Uluch Ali returns next turn.`);
    } else {
        G.leaders.dragut = {id: "dragut", location: "pool", returnTurn: G.year + 1};
        pushLog(G, `${G.lastRolls} — Dragut returns next turn.`);
    }
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

export const setTreasureFleetEscorts = (G: VQGame, ctx: Ctx, args: {count: number}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "spring" || power(G, ctx) !== "spain") return INVALID_MOVE;
    const count = Number(args.count);
    const current = G.treasureFleetEscorts ?? 0;
    if (!Number.isInteger(count) || count < 0 || count > 2) return INVALID_MOVE;
    if (count > current) {
        let need = count - current;
        for (const id of ["seville", "corunna", "lisbon"]) {
            const stack = G.spaces[id]?.naval.spain;
            if (stack === undefined) continue;
            const take = Math.min(need, stack.galleon);
            stack.galleon -= take;
            need -= take;
            if (stack.galleon + stack.galley + stack.racebuilt + stack.corsair === 0) delete G.spaces[id].naval.spain;
            if (need === 0) break;
        }
        if (need > 0) return INVALID_MOVE;
    } else if (count < current) {
        const port = ["seville", "corunna", "lisbon"].find((id) => G.spaces[id].control === "spain");
        if (port === undefined) return INVALID_MOVE;
        const stack = G.spaces[port].naval.spain ?? {galley: 0, galleon: 0, racebuilt: 0, corsair: 0};
        stack.galleon += current - count;
        G.spaces[port].naval.spain = stack;
    }
    G.treasureFleetEscorts = count;
    pushLog(G, `Spain assigns ${count} galleon(s) to Treasure Fleet escort.`);
};

export const placeSeaCaptainLeader = (G: VQGame, ctx: Ctx, args: {captain: string; port: string}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "spring" || power(G, ctx) !== "england") return INVALID_MOVE;
    const leaderId = SEA_CAPTAIN_LEADER_BY_CAPTAIN[args.captain];
    const captain = seaCaptainById(args.captain);
    const port = G.spaces[args.port];
    if (leaderId === undefined || captain === undefined || captain.turn > G.year ||
        !G.powers.england.seaCaptains.includes(args.captain) || G.leaders[leaderId] !== undefined ||
        port === undefined || port.control !== "england" || SPACE_BY_ID[args.port]?.home !== "england" ||
        !isPort(args.port) || navalCount(port.naval.england) === 0) return INVALID_MOVE;
    G.powers.england.seaCaptains = G.powers.england.seaCaptains.filter((id) => id !== args.captain);
    G.leaders[leaderId] = {id: leaderId, location: args.port};
    port.leaders.push(leaderId);
    pushLog(G, `England places ${captain.nameEn} as a naval leader in ${SPACE_BY_ID[args.port].name}.`);
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

export const giveRandomCard = (G: VQGame, ctx: Ctx, args: {target: Power}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "diplomacy") return INVALID_MOVE;
    const p = power(G, ctx);
    if (!isPower(args.target) || args.target === p || atWar(G, p, args.target)) return INVALID_MOVE;
    const candidates = G.powers[p].cards.filter((id) => cardById(id).kind !== "home");
    if (candidates.length === 0) return INVALID_MOVE;
    const card = candidates[Math.min(candidates.length - 1, Math.max(0, die(ctx, candidates.length) - 1))];
    G.powers[p].cards = G.powers[p].cards.filter((id) => id !== card);
    G.powers[args.target].cards.push(card);
    pushLog(G, `${powerLabel(p)} gives a random card to ${powerLabel(args.target)}.`);
};

export const giveMercenary = (G: VQGame, ctx: Ctx, args: {target: Power; space: string}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "diplomacy") return INVALID_MOVE;
    const p = power(G, ctx);
    if (!isPower(args.target) || args.target === p || atWar(G, p, args.target) || G.spaces[args.space] === undefined) return INVALID_MOVE;
    const source = G.spaces[args.space].land[p];
    if (source === undefined || source.merc < 1) return INVALID_MOVE;
    source.merc -= 1;
    if (landCount(source) === 0) delete G.spaces[args.space].land[p];
    ensureLand(G, args.space, args.target).merc += 1;
    pushLog(G, `${powerLabel(p)} gives a mercenary to ${powerLabel(args.target)} in ${SPACE_BY_ID[args.space].name}.`);
};

export const giveTreasure = (G: VQGame, ctx: Ctx, args: {target: Power; index: number}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "diplomacy") return INVALID_MOVE;
    const p = power(G, ctx);
    if (!isPower(args.target) || args.target === p || atWar(G, p, args.target)) return INVALID_MOVE;
    const index = Number(args.index);
    const value = G.powers[p].treasures[index];
    if (value === undefined) return INVALID_MOVE;
    G.powers[p].treasures.splice(index, 1);
    G.powers[args.target].treasures.push(value);
    pushLog(G, `${powerLabel(p)} gives a treasure to ${powerLabel(args.target)}.`);
};

export const loanNaval = (G: VQGame, ctx: Ctx, args: {target: Power; fromPort: string; toPort: string; kind: "galley" | "galleon" | "racebuilt"; leader?: string}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "diplomacy") return INVALID_MOVE;
    const p = power(G, ctx);
    if (!isPower(args.target) || args.target === p || !allied(G, p, args.target) ||
        G.spaces[args.fromPort]?.control !== p || G.spaces[args.toPort]?.control !== args.target ||
        !seaPathBetweenPorts(args.fromPort, args.toPort)) return INVALID_MOVE;
    if ((G.loanedNaval ?? []).some((loan) =>
        (loan.lender === p && loan.borrower === args.target) || (loan.lender === args.target && loan.borrower === p))) return INVALID_MOVE;
    if (args.leader !== undefined) {
        const leader = G.leaders[args.leader];
        if (leader === undefined || leader.location !== args.fromPort || leaderPower(G, args.leader) !== p ||
            LEADER_BY_ID[args.leader]?.kind !== "naval") return INVALID_MOVE;
    }
    const source = G.spaces[args.fromPort].naval[p];
    if (source === undefined || source[args.kind] < 1) return INVALID_MOVE;
    source[args.kind] -= 1;
    if (source.galley + source.galleon + source.racebuilt + source.corsair === 0) delete G.spaces[args.fromPort].naval[p];
    const target = G.spaces[args.toPort].naval[args.target] ?? {galley: 0, galleon: 0, racebuilt: 0, corsair: 0};
    target[args.kind] += 1;
    G.spaces[args.toPort].naval[args.target] = target;
    if (args.leader !== undefined) {
        moveLeaders(G, args.fromPort, args.toPort, [args.leader]);
        G.leaders[args.leader].loanedTo = args.target;
    }
    G.loanedNaval = [...(G.loanedNaval ?? []), {lender: p, borrower: args.target, kind: args.kind, fromPort: args.fromPort, toPort: args.toPort,
        ...(args.leader !== undefined ? {leader: args.leader} : {})}];
    pushLog(G, `${powerLabel(p)} loans one ${args.kind} to ${powerLabel(args.target)}.`);
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
    const caps = capitalSpacesFor(G, p);
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
    const spanishDutchHome = G.dutchSpanishHome === true && p === "spain" && def.area === "netherlands";
    if (s.control !== p || s.unrest || (def.home !== p && !spanishDutchHome) || spaceHasEnemyLand(G, p, space)) {
        return INVALID_MOVE;
    }
    if (args.kind === "cav" && p !== "ottoman") {
        return INVALID_MOVE;
    }
    if (args.kind === "cav" && cavalryCount(G, p) >= OTTOMAN_CAVALRY_LIMIT) {
        return INVALID_MOVE;
    }
    if (args.kind === "merc" && p === "ottoman") {
        return INVALID_MOVE;
    }
    // Rule 17.2 construction exceptions.
    if (p === "ottoman" && ["algiers", "tripoli"].includes(space)) return INVALID_MOVE;
    if (p === "spain" && ["oran", "malta"].includes(space)) return INVALID_MOVE;
    if (landForceCount(G, p) >= REGULAR_LIMITS[p]) return INVALID_MOVE;
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
    const spanishDutchHome = G.dutchSpanishHome === true && p === "spain" && def.area === "netherlands";
    if (def.home !== p && !spanishDutchHome) {
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
    if (navalForceCount(G, p) + navalLostCount(G, p) >= NAVAL_LIMITS[p]) {
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
    G.worldCaptains[args.captain] = {power: p, location: start, damaged: p === "ottoman" && !G.suezDone, colony: args.colony === true, route: [start]};
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
    const againstTradeWind = WORLD_TRADE_WINDS.has(`${args.zone}|${expedition.location}`) &&
        !WORLD_TRADE_WINDS.has(`${expedition.location}|${args.zone}`);
    if ((WORLD_HAZARDS.has(`${expedition.location}|${args.zone}`) || againstTradeWind) &&
        !navigationCheck(G, ctx, args.captain)) return;
    const from = expedition.location;
    expedition.location = args.zone;
    expedition.movedImpulse = G.impulse;
    expedition.route = [...(expedition.route ?? [from]), args.zone];
    pushLog(G, `${args.captain} sails to ${WORLD_SEA_ZONE_BY_ID[args.zone].nameEn}.`);
    checkCircumnavigation(G, args.captain, from, args.zone);
};

export const buildPatrol = (G: VQGame, ctx: Ctx, args: {zone: string}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action" || power(G, ctx) !== "spain") return INVALID_MOVE;
    if (WORLD_SEA_ZONE_BY_ID[args.zone] === undefined) return INVALID_MOVE;
    const connected = WORLD_SETTLEMENTS.some((settlement) => settlement.seaZone === args.zone &&
        (G.worldControls[settlement.id] === "spain" || G.worldColonies[settlement.id] === "spain"));
    if (!connected || G.powers.spain.cp < 2) return INVALID_MOVE;
    if (!spend(G, "spain", 2)) return INVALID_MOVE;
    G.worldPatrols = {...(G.worldPatrols ?? {}), [args.zone]: (G.worldPatrols?.[args.zone] ?? 0) + 1};
    pushLog(G, `Spain builds a patrol in ${WORLD_SEA_ZONE_BY_ID[args.zone].nameEn}.`);
};

export const buildWorldFortress = (G: VQGame, ctx: Ctx, args: {settlement: string}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action" || power(G, ctx) !== "spain") return INVALID_MOVE;
    const settlement = WORLD_SETTLEMENT_BY_ID[args.settlement];
    if (settlement === undefined || (G.worldFortresses?.[args.settlement] !== undefined) ||
        (G.worldControls[args.settlement] !== "spain" && G.worldColonies[args.settlement] !== "spain") ||
        (G.worldFortressesBuilt ?? 0) >= 2 || G.powers.spain.cp < 2) return INVALID_MOVE;
    if (!spend(G, "spain", 2)) return INVALID_MOVE;
    G.worldFortresses = {...(G.worldFortresses ?? {}), [args.settlement]: "spain"};
    G.worldFortressesBuilt = (G.worldFortressesBuilt ?? 0) + 1;
    pushLog(G, `Spain builds a fortress at ${settlement.nameEn}.`);
};

export const worldPiracy = (G: VQGame, ctx: Ctx, args: {captain: string}): void | typeof INVALID_MOVE => {
    if (ctx.phase !== "action") return INVALID_MOVE;
    const p = power(G, ctx);
    const expedition = G.worldCaptains[args.captain];
    const captain = seaCaptainById(args.captain);
    if (expedition === undefined || expedition.power !== p || captain === undefined || p === "spain" ||
        (G.piracyActions?.[p] ?? 0) >= 3 || (G.piracyZones?.[expedition.location] ?? []).includes(p) ||
        G.powers[p].cp < 2) return INVALID_MOVE;
    const settlements = WORLD_SETTLEMENTS.filter((settlement) => settlement.seaZone === expedition.location &&
        (G.worldControls[settlement.id] === "spain" || G.worldColonies[settlement.id] === "spain"));
    if (settlements.length === 0 || !spend(G, p, 2)) return INVALID_MOVE;
    G.piracyActions = {...(G.piracyActions ?? {}), [p]: (G.piracyActions?.[p] ?? 0) + 1};
    G.piracyZones = {...(G.piracyZones ?? {}), [expedition.location]: [...(G.piracyZones?.[expedition.location] ?? []), p]};
    if (args.captain === "dragut") G.dragutFought = true;
    const patrols = G.worldPatrols?.[expedition.location] ?? 0;
    const fortresses = settlements.filter((settlement) => G.worldFortresses?.[settlement.id] === "spain").length;
    const defenseDice = patrols + fortresses;
    if (defenseDice > 0) {
        const dice = roll(ctx, defenseDice);
        const hits = dice.filter((die) => die >= 5).length;
        G.lastRolls = `World piracy defense: [${dice.join(",")}] = ${hits} hit(s)`;
        pushLog(G, G.lastRolls);
        if (expedition.damaged ? hits >= 1 : hits >= 2) {
            delete G.worldCaptains[args.captain];
            G.powers[p].seaCaptains = G.powers[p].seaCaptains.filter((id) => id !== args.captain);
            pushLog(G, `${captain.nameEn} is eliminated during world piracy.`);
            return;
        }
        if (hits === 1) expedition.damaged = true;
    }
    const base = expedition.damaged || settlements.length === 1 ? 1 : 2;
    const hawkinsPiracy = args.captain === "hawkins" && ["guineaCoast", "spanishMain"].includes(expedition.location);
    const piracyDice = base + (hawkinsPiracy ? 2 : captain.piracy);
    const dice = roll(ctx, piracyDice);
    const hits = dice.filter((die) => die >= 5).length;
    G.lastRolls = `World piracy (${captain.nameEn}): [${dice.join(",")}] = ${hits} hit(s)`;
    pushLog(G, G.lastRolls);
    if (args.captain === "hawkins" && !dice.some((die) => die >= 4)) {
        addVp(G, "england", -1);
        pushLog(G, "Hawkins fails to roll 4-6; England takes a -1 Slave Trader VP marker.");
    }
    if (args.captain === "drake" && dice.includes(6)) {
        const fortress = settlements.find((settlement) => G.worldFortresses?.[settlement.id] === "spain");
        if (fortress !== undefined) {
            delete G.worldFortresses![fortress.id];
            pushLog(G, `Drake destroys the Spanish fortress at ${fortress.nameEn}.`);
        }
    }
    let remaining = hits;
    while (remaining > 0) {
        if ((G.worldPatrols?.[expedition.location] ?? 0) > 0) {
            G.worldPatrols![expedition.location] = (G.worldPatrols?.[expedition.location] ?? 0) - 1;
            pushLog(G, "A Spanish patrol is eliminated.");
        } else if (G.powers.spain.treasures.length > 0) {
            const treasure = G.powers.spain.treasures.pop()!;
            if (expedition.treasureValues !== undefined && expedition.treasureValues.length < 2) {
                expedition.treasureValues.push(treasure);
                pushLog(G, `${powerLabel(p)} loads a ${treasure} CP treasure onto the expedition.`);
            } else {
                G.powers[p].treasures.push(treasure);
                pushLog(G, `${powerLabel(p)} captures a ${treasure} CP Spanish treasure.`);
            }
        } else {
            addVp(G, p, 1);
            pushLog(G, `${powerLabel(p)} gains 1 piracy VP.`);
        }
        remaining -= 1;
    }
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
    // Rule 16.3: only one formation may be transported per impulse.
    if (G.navalTransportImpulse === G.impulse) return INVALID_MOVE;
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
    G.navalTransportImpulse = G.impulse;
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
    if (G.stormImpulse === G.impulse) G.stormMoved = [...(G.stormMoved ?? []), to];
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
    // Rule 13.3: defenders may attempt to avoid battle before it is fought.
    if (!intercepted && !friendlyControlled(G, p, to)) attemptLandAvoidBattle(G, ctx, p, to, from);
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
            const defenderPower = hostile.find(isPower);
            if (defenderPower !== undefined && ownerOf(G, defenderPower) !== undefined) {
                G.pendingWithdraw = {active: p, defender: defenderPower, space: to, origin: from};
                return;
            }
            if (totalLand(G, to, [p]) > defenders) {
                dest.siege = {by: p, sinceImpulse: G.impulse};
                pushLog(G, `The defenders of ${SPACE_BY_ID[to].name} withdraw into the fortifications; the space is under siege.`);
            } else if (G.powers[p].cp >= 1) {
                G.pendingContinue = {power: p, origin: from, space: to, units: {...stack}, leaders: [...leaders]};
                pushLog(G, "The defenders withdraw; the active formation may spend 1 CP to continue or return.");
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
    const armadaHere = p === "spain" && G.armada?.location === from;
    if ((stack === undefined || navalCount(stack) === 0) && !armadaHere) {
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
    const destinationHadEnemy = ownersWithNaval(G, to).some((owner) => !friendlyController(G, p, owner));
    if (stack === undefined && destinationHadEnemy) return INVALID_MOVE;
    const leaders = (isSeaZone(from) ? G.seaZones[from as keyof VQGame["seaZones"]].leaders : G.spaces[from].leaders)
        .filter((id) => leaderPower(G, id) === p && LEADER_BY_ID[id]?.kind === "naval");
    if (stack !== undefined) {
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
    if (p === "spain" && G.armada?.location === from) G.armada.location = to;
    pushLog(G, `${powerLabel(p)} sails from ${from} to ${to}.`);
    if (G.scenario === "tutorial") {
        if (offerInterception(G, ctx, "naval", from, to, p)) return;
        const enemies = ownersWithNaval(G, to).filter((owner) => !friendlyController(G, p, owner) &&
            (isPower(owner) ? atWar(G, p, owner) : true));
        if (enemies.length) startBattle(G, ctx, "naval", to, p, enemies, from);
        return;
    }

    const intercepted = attemptNavalInterception(G, ctx, p, from, to, destinationHadEnemy);
    if (!intercepted) {
        // Avoid battle is resolved before choosing the order of multiple enemies.
        attemptNavalAvoidBattle(G, ctx, p, to);
    }
    const enemies = navalEnemies(G, to, p);
    if (enemies.length > 1) {
        G.pendingNavalOrder = {attacker: p, location: to, enemies};
    } else {
        resolveNavalCombat(G, ctx, to, p, intercepted, true);
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
    if (!navalBlockadeSatisfied(G, p, args.space)) return INVALID_MOVE;
    if (G.powers[p].cp < 1) return INVALID_MOVE;
    if (offerActionResponse(G, ctx, "assault", args)) return;
    if (!spend(G, p, 1)) {
        return INVALID_MOVE;
    }
    if (G.scenario === "tutorial") {
        startBattle(G, ctx, "assault", args.space, p, ownersWithLand(G, args.space).filter((owner) => !friendlyController(G, p, owner)), args.space);
    } else assaultSpace(G, ctx, p, args.space);
};

export const chooseNavalOrder = (G: VQGame, ctx: Ctx, args: {enemy: Power}): void | typeof INVALID_MOVE => {
    const pending = G.pendingNavalOrder;
    if (pending === undefined || power(G, ctx) !== pending.attacker || !pending.enemies.includes(args.enemy)) return INVALID_MOVE;
    resolveNavalCombatEnemy(G, ctx, pending.location, pending.attacker, args.enemy);
    pending.enemies = pending.enemies.filter((enemy) => enemy !== args.enemy);
    if (pending.enemies.length === 0 || countAtLocation(G, pending.location, pending.attacker) === 0 || !isSeaZone(pending.location)) {
        delete G.pendingNavalOrder;
    }
};

export const chooseWithdraw = (G: VQGame, ctx: Ctx, args: {withdraw: boolean}): void | typeof INVALID_MOVE => {
    const pending = G.pendingWithdraw;
    if (pending === undefined || ctx.playerID !== ownerOf(G, pending.defender)) return INVALID_MOVE;
    const state = G.spaces[pending.space];
    const defenders = totalLand(G, pending.space, ownersWithLand(G, pending.space).filter((owner) => owner !== pending.active));
    const activeUnits = totalLand(G, pending.space, [pending.active]);
    delete G.pendingWithdraw;
    if (!args.withdraw) {
        const hostile = ownersWithLand(G, pending.space).filter((owner) => !friendlyController(G, pending.active, owner));
        const activeCtx = {...ctx, playerID: ownerOf(G, pending.active)!};
        fieldBattle(G, activeCtx, pending.space, pending.active, hostile, pending.origin);
        return;
    }
    if (activeUnits > defenders) {
        state.siege = {by: pending.active, sinceImpulse: G.impulse};
        pushLog(G, `The defenders of ${SPACE_BY_ID[pending.space].name} withdraw into the fortifications; the space is under siege.`);
        return;
    }
    if (G.powers[pending.active].cp >= 1) {
        const stack = state.land[pending.active];
        if (stack !== undefined) {
            const leaders = state.leaders.filter((id) => LEADER_BY_ID[id]?.power === pending.active && LEADER_BY_ID[id]?.kind === "army");
            G.pendingContinue = {power: pending.active, origin: pending.origin, space: pending.space, units: {...stack}, leaders};
            pushLog(G, "The defenders withdraw; the active formation may spend 1 CP to continue or return.");
        }
        return;
    }
    const stack = state.land[pending.active];
    if (stack !== undefined) {
        delete state.land[pending.active];
        const back = ensureLand(G, pending.origin, pending.active);
        back.regular += stack.regular;
        back.merc += stack.merc;
        back.cav += stack.cav;
        for (const id of state.leaders.filter((leader) => LEADER_BY_ID[leader]?.power === pending.active)) {
            state.leaders = state.leaders.filter((leader) => leader !== id);
            G.spaces[pending.origin].leaders.push(id);
            G.leaders[id].location = pending.origin;
        }
        pushLog(G, "Not enough troops to besiege the space; the formation returns.");
    }
};

export const continueMove = (G: VQGame, ctx: Ctx, args: {to: string}): void | typeof INVALID_MOVE => {
    const pending = G.pendingContinue;
    if (pending === undefined || power(G, ctx) !== pending.power || !landAdjacent(pending.space, args.to) ||
        G.powers[pending.power].cp < 1 || args.to === pending.origin) return INVALID_MOVE;
    const destination = G.spaces[args.to];
    if (destination === undefined) return INVALID_MOVE;
    const hostile = ownersWithLand(G, args.to).some((owner) => !friendlyController(G, pending.power, owner));
    if (hostile) return INVALID_MOVE;
    const canEnter = friendlyControlled(G, pending.power, args.to) || destination.control === "independent" ||
        (isPower(destination.control) ? atWar(G, pending.power, destination.control) : atWarWithMinor(G, pending.power, destination.control));
    if (!canEnter || !spend(G, pending.power, 1)) return INVALID_MOVE;
    const source = G.spaces[pending.space].land[pending.power];
    if (source === undefined || source.regular < pending.units.regular || source.merc < pending.units.merc || source.cav < pending.units.cav) return INVALID_MOVE;
    source.regular -= pending.units.regular;
    source.merc -= pending.units.merc;
    source.cav -= pending.units.cav;
    if (landCount(source) === 0) delete G.spaces[pending.space].land[pending.power];
    const target = ensureLand(G, args.to, pending.power);
    target.regular += pending.units.regular;
    target.merc += pending.units.merc;
    target.cav += pending.units.cav;
    for (const id of pending.leaders) {
        G.spaces[pending.space].leaders = G.spaces[pending.space].leaders.filter((leader) => leader !== id);
        G.spaces[args.to].leaders.push(id);
        G.leaders[id].location = args.to;
    }
    delete G.pendingContinue;
    pushLog(G, `${powerLabel(pending.power)} continues to ${SPACE_BY_ID[args.to].name}.`);
};

export const stopContinue = (G: VQGame, ctx: Ctx): void | typeof INVALID_MOVE => {
    const pending = G.pendingContinue;
    if (pending === undefined || power(G, ctx) !== pending.power) return INVALID_MOVE;
    const source = G.spaces[pending.space].land[pending.power];
    if (source === undefined) return INVALID_MOVE;
    source.regular -= pending.units.regular;
    source.merc -= pending.units.merc;
    source.cav -= pending.units.cav;
    if (landCount(source) === 0) delete G.spaces[pending.space].land[pending.power];
    const target = ensureLand(G, pending.origin, pending.power);
    target.regular += pending.units.regular;
    target.merc += pending.units.merc;
    target.cav += pending.units.cav;
    for (const id of pending.leaders) {
        G.spaces[pending.space].leaders = G.spaces[pending.space].leaders.filter((leader) => leader !== id);
        G.spaces[pending.origin].leaders.push(id);
        G.leaders[id].location = pending.origin;
    }
    delete G.pendingContinue;
    pushLog(G, `${powerLabel(pending.power)} returns to ${SPACE_BY_ID[pending.origin].name}.`);
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
    if (G.protestantRebellionBlockedTurn === G.year) return INVALID_MOVE;
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
