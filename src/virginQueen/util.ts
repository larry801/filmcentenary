import {Ctx} from "boardgame.io";
import {refreshJesuits} from "./espionage";
import {
    AREA_NAMES,
    CardDef,
    Controller,
    EventEffect,
    HRE_RELIGIOUS_PREFERENCE_NAMES,
    LandStack,
    landCount,
    LeaderDef,
    MinorPower,
    MINOR_POWERS,
    NavalStack,
    navalCount,
    POWER_COLORS,
    POWER_INFO,
    POWER_INDEX,
    POWER_NAMES,
    POWERS,
    Power,
    Religion,
    ReligionArea,
    ROYALS,
    SeaZoneID,
    VQGame,
    isPower,
    emptyLand,
    emptyNaval,
} from "./constant/general";
import {
    initialControl,
    initialLandFor,
    initialNavalFor,
    initialReligion,
} from "./constant/spaces";
import {
    CAPITAL_SPACES,
    DUTCH_KEYS,
    KEY_SPACES,
    LAND_NEIGHBORS,
    SEA_PORTS,
    SEA_ZONE_BY_ID,
    SEA_ZONES,
    SPACES,
    SPACE_BY_ID,
    isInlandPort,
} from "./mapData";
import {cardById, officialCardById} from "./constant/cards";
import {OFFICIAL_CARDS} from "./data/cards";
import {PatronageVpAward} from "./data/types";
import {MINOR_DIPLOMACY} from "./data/minorDiplomacy";
import {DEFAULT_LEADER_BY_POWER, LEADER_BY_ID, LEADERS, SEA_CAPTAIN_LEADER_BY_CAPTAIN, startingLeaders} from "./constant/leaders";
import {
    ScenarioSetupData,
    patronDef,
    scienceBonusById,
    powerCardSummary,
    scenarioFromSetupData,
    scenarioLeaders,
    scenarioPatrons,
    scenarioRoyals,
    seaCaptainById,
    royalAvailable,
    scenarioSeaCaptains,
    scenarioSetup,
    scenarioSpaces,
} from "./scenario";
import {PATRONAGE_VP_AWARD_BY_ID} from "./data/patronage";
import {WORLD_HAZARDS} from "./data/world";
import {validateSetupData} from "./configuration";
import {isActivatedMajor, ownerOf, participatingPowers, samePlayer} from "./ownership";
import {TUTORIAL_FORTRESSES, TUTORIAL_KEYS, TUTORIAL_POWER_CARDS, tutorialFortressVp, tutorialSpaceAllowed} from "./tutorial";

export {SPACE_BY_ID, KEY_SPACES, DUTCH_KEYS, initialControl, initialReligion, initialLandFor, initialNavalFor};

// --------------------------------------------------------------------------
// Generic helpers
// --------------------------------------------------------------------------

export const shuffle = <T>(ctx: Ctx, arr: T[]): T[] =>
    (ctx.random?.Shuffle(arr) as T[] | undefined) ?? arr.slice();

export const die = (ctx: Ctx, sides = 6): number =>
    (ctx.random?.Die(sides) as number | undefined) ?? 1 + Math.floor(Math.random() * sides);

export const roll = (ctx: Ctx, n: number): number[] =>
    Array.from({length: Math.max(0, n)}, () => die(ctx, 6));

export const hits = (dice: number[]): number =>
    dice.filter((d) => d >= 5).length;

export const pushLog = (G: VQGame, msg: string): void => {
    G.log.push(msg);
    if (G.log.length > 250) {
        G.log.splice(0, G.log.length - 250);
    }
};

export const powerLabel = (p: Power): string => POWER_NAMES[p].en;

export const controllerLabel = (c: Controller): string =>
    isPower(c) ? POWER_NAMES[c].short : c === "independent" ? "Independent" : c.charAt(0).toUpperCase() + c.slice(1);

export const sortByImpulse = (list: Power[]): Power[] =>
    [...list].sort((a, b) => POWERS.indexOf(a) - POWERS.indexOf(b));

// --------------------------------------------------------------------------
// Initial state
// --------------------------------------------------------------------------

export const setupGame = (ctx: Ctx, setupData?: ScenarioSetupData): VQGame => {
    const numPlayers = ctx.numPlayers ?? 6;
    const setupError = validateSetupData(setupData, numPlayers);
    if (setupError) throw new Error(setupError);
    const scenarioId = scenarioFromSetupData(setupData);
    const scenario = scenarioSetup(scenarioId, numPlayers);
    const spaces = scenarioSpaces(scenario);
    const militaryVictoryBaseline = Object.fromEntries(POWERS.map((p) => [
        p,
        KEY_SPACES.filter((id) => spaces[id]?.control === p && !spaces[id]?.unrest &&
            (p !== "protestant" || !DUTCH_KEYS.includes(id))).length,
    ])) as Record<Power, number>;

    const seaZones: VQGame["seaZones"] = {} as VQGame["seaZones"];
    for (const zone of SEA_ZONES) {
        seaZones[zone.id] = {naval: {}, leaders: []};
    }

    const powers = {} as VQGame["powers"];
    for (const p of POWERS) {
        powers[p] = {
            power: p,
            ruler: scenario.powerCard[p]?.ruler ?? POWER_INFO[p].ruler.id,
            cards: [],
            treasures: [],
            cp: 0,
            cardPlayed: false,
            treasurePlayed: false,
            bonusVp: 0,
            cardModifier: 0,
            marriageCardModifier: 0,
            wars: [],
            warsMinors: [],
            allies: [],
            alliedMinors: [],
            influence: {},
            patrons: [],
            seaCaptains: [],
            scienceBonuses: [],
            patronageModifier: 0,
            scmOnCard: 0,
            passed: false,
            homeCardSetAside: [],
            homeCardChoiceDone: false,
        };
    }

    // Scenario wars are undirected pairs on the Diplomatic Status Display.
    for (const [a, b] of scenario.wars) {
        if (!powers[a].wars.includes(b)) {
            powers[a].wars.push(b);
        }
        if (!powers[b].wars.includes(a)) {
            powers[b].wars.push(a);
        }
    }
    for (const [a, minor] of scenario.alliances) {
        if (!powers[a].alliedMinors.includes(minor)) {
            powers[a].alliedMinors.push(minor);
        }
    }
    for (const p of POWERS) {
        const influence = scenario.influence[p];
        if (influence !== undefined) {
            powers[p].influence = {...influence};
        }
    }

    let mercenariesForHire = 0;
    for (const p of POWERS) {
        const card = powerCardSummary(scenario, p);
        powers[p].scmOnCard = card.scmOnCard;
        powers[p].seaCaptains = [...card.seaCaptains];
        mercenariesForHire += card.mercenariesForHire;
        for (let i = 0; i < card.treasures; i++) {
            powers[p].treasures.push(shuffleTreasure(ctx));
        }
    }

    const leaders = scenarioLeaders(scenario, spaces);

    const G: VQGame = {
        ...(scenarioId === "tutorial" ? {tutorialEffects: {nextDraw: {}, skip: [], piracyVp: 0}} : {}),
        ...(numPlayers === 2 ? {
            playerPowers: scenarioId === "tutorial" ? {"0": ["ottoman" as Power], "1": ["spain" as Power]} :
                {"0": ["spain" as Power, "france" as Power], "1": ["england" as Power, "protestant" as Power]},
            activatedMajors: {},
            majorDiplomacyResolved: [],
            majorInfluence: {ottoman: {spain: 1, england: 0, protestant: 0}, hre: {ottoman: 3, spain: 1, england: scenarioId === "tutorial" ? 0 : 1, france: scenarioId === "tutorial" ? 0 : 1, protestant: scenarioId === "tutorial" ? 0 : 1}},
        } : {}),
        scenario: scenarioId,
        startTurn: scenario.startTurn,
        endTurn: scenario.endTurn,
        year: scenario.startTurn,
        dealtYear: 0,
        turnsCompleted: 0,
        phaseTurns: 0,
        consecutivePasses: 0,
        impulse: 0,
        activePower: "ottoman",
        spaces,
        seaZones,
        powers,
        leaders,
        deck: shuffle(ctx, scenario.cardsInPlay
            .filter((number) => {
                const card = OFFICIAL_CARDS[number - 1];
                return card !== undefined && card.kind !== "home" &&
                    (card.availableFromTurn === "variable" || (typeof card.availableFromTurn === "number" && card.availableFromTurn <= scenario.startTurn));
            })
            .map((number) => OFFICIAL_CARDS[number - 1].id)),
        futureDeck: shuffle(ctx, scenario.cardsInPlay
            .filter((number) => {
                const card = OFFICIAL_CARDS[number - 1];
                return card !== undefined && card.kind !== "home" &&
                    typeof card.availableFromTurn === "number" && card.availableFromTurn > scenario.startTurn;
            })
            .map((number) => OFFICIAL_CARDS[number - 1].id)),
        discard: [],
        removed: scenario.cardsRemoved.map((number) => OFFICIAL_CARDS[number - 1].id),
        homeSetAside: [],
        doWCostEnglandSpain: 5,
        suezAttempts: scenario.powerCard.ottoman.suezAttempts ?? 0,
        suezDone: false,
        mercenariesForHire,
        betrothals: [],
        pendingBetrothal: null,
        marriages: 0,
        log: [],
        vpHistory: {},
        hreReligiousPreferenceChosen: false,
        hreReligiousPreferenceRevealed: false,
        checkVictory: false,
        militaryVictoryBaseline,
        lastAction: scenario.nameZh,
        lastRolls: "",
        springDone: [],
        patronizedThisTurn: [],
        cardDrawDone: [],
        royals: scenarioRoyals(scenario),
        patronsAvailable: scenarioPatrons(scenario),
        vpAwardsAvailable: [...scenario.patronage.vpAwards],
        pendingPatronage: [],
        minorInfluenceDefaults: Object.fromEntries(POWERS.map((p) => [p, {...(scenario.influence[p] ?? {})}])) as VQGame["minorInfluenceDefaults"],
        minorDiplomacyResolved: [],
        minorInfluenceBlocked: POWERS.reduce((blocked, p) => {
            blocked[p] = [];
            return blocked;
        }, {} as VQGame["minorInfluenceBlocked"]),
        espionage: {jesuits: [], jesuitsOnCard: scenario.powerCard.spain?.jesuits ?? 0,
            douai: false, mary: scenarioId === "tournament" ? "captured" : "scotland",
            cipherKeys: {}, nextDraw: {}, inspections: []},
        informants: [],
        assassinationUsed: [],
        worldCaptains: {},
        worldColonies: {},
        worldControls: Object.fromEntries(Object.entries(scenario.worldSpaces ?? {})
            .filter(([, setup]) => setup.control !== undefined && isPower(setup.control))
            .map(([id, setup]) => [id, setup.control as Power])),
        morisco: scenario.cardsOnBoard.includes(28) ? {space: "granada", units: 2} : undefined,
        foreignWars: {},
        seaCaptainsAvailable: scenarioSeaCaptains(scenario).filter((id) => seaCaptainById(id)?.power === "france/protestant"),
        scienceBonusesAvailable: [...scenario.patronage.scienceBonuses],
        protestantSpacesStart: scenario.protestantSpaces,
        protestantSpacesMapAtStart: 0,
    };

    G.protestantSpacesMapAtStart = mapProtestantSpaceCount(G);

    // The VP track starts at the printed scenario value.  Keep that value as an
    // offset so the dynamic base/religious scoring below still moves from it.
    for (const p of POWERS) {
        powers[p].bonusVp = scenario.vpStart[p] - (baseVp(G, p) + religiousSpecialVp(G, p)) -
            (scenarioId === "tutorial" && p === "ottoman" ? tutorialFortressVp(G) : 0);
    }
    if (numPlayers === 2 && scenarioId !== "tutorial") {
        G.activatedMajors!.ottoman = {ally: "england", baseline: powerVp(G, "ottoman")};
    }

    pushLog(G, `Virgin Queen: ${scenario.nameZh}（第 ${scenario.startTurn}-${scenario.endTurn} 回合）`);
    pushLog(G, `VP 起始：${POWERS.map((p) => `${POWER_NAMES[p].short} ${scenario.vpStart[p]}`).join(" / ")}`);
    pushLog(G, `新教地区起始：${scenario.protestantSpaces}`);
    pushLog(G, `已按 Scenario Book 设置 ${Object.keys(scenario.spaces).length} 个地区。`);
    if (scenario.notes !== undefined) {
        for (const note of scenario.notes) {
            pushLog(G, `场景说明：${note}`);
        }
    }
    const unknownPatrons = G.patronsAvailable.filter((id) => patronDef(id)?.rating === null);
    if (unknownPatrons.length > 0) {
        pushLog(G, `注意：${unknownPatrons.length} 位赞助人的评级未转录，冬季赞助结算需要手动处理。`);
    }
    return G;
};

// --------------------------------------------------------------------------
// Cards, treasures, deck
// --------------------------------------------------------------------------

export const drawCards = (G: VQGame, ctx: Ctx, p: Power, n: number): string[] => {
    const drawn: string[] = [];
    if (ownerOf(G, p) === undefined) return drawn;
    for (let i = 0; i < n; i++) {
        if (G.deck.length === 0) {
            if (G.discard.length === 0) {
                break;
            }
            G.deck = shuffle(ctx, G.discard.slice());
            G.discard = [];
            pushLog(G, "Deck reshuffled from the discard pile.");
        }
        const c = G.deck.shift();
        if (c === undefined) {
            break;
        }
        G.powers[p].cards.push(c);
        drawn.push(c);
    }
    return drawn;
};

export const handCount = (G: VQGame, p: Power): number => G.powers[p].cards.length;

export const removeCardFromHand = (G: VQGame, p: Power, cardId: string): boolean => {
    const hand = G.powers[p].cards;
    const idx = hand.indexOf(cardId);
    if (idx < 0) {
        return false;
    }
    hand.splice(idx, 1);
    return true;
};

export const removeCardFromGame = (G: VQGame, cardId: string): void => {
    if (!G.removed.includes(cardId)) G.removed.push(cardId);
    G.deck = G.deck.filter((id) => id !== cardId);
    G.discard = G.discard.filter((id) => id !== cardId);
    G.futureDeck = G.futureDeck.filter((id) => id !== cardId);
    G.homeSetAside = G.homeSetAside.filter((id) => id !== cardId);
    for (const p of POWERS) G.powers[p].cards = G.powers[p].cards.filter((id) => id !== cardId);
};

export const discardCard = (G: VQGame, p: Power, cardId: string, asEvent: boolean): void => {
    const def = cardById(cardId);
    // Rule 20.10: Grand Tour (#53) leaves play if played after the League formed.
    if (cardId === "vq-053" && G.catholicLeagueFormed === true) {
        removeCardFromGame(G, cardId);
        return;
    }
    if (def.kind === "home") {
        // Used Home cards sit face up on the power card until the next Card
        // Draw.  A few Home cards (for example #111) are removed for good when
        // played as an event.
        if (def.removeAfterUse || (asEvent && def.removeOnEvent)) {
            G.removed.push(cardId);
        } else {
            G.homeSetAside.push(cardId);
        }
        return;
    }
    if (def.removeAfterUse || (asEvent && def.removeOnEvent) || (asEvent && def.kind === "event" && def.text?.includes("Remove from deck"))) {
        G.removed.push(cardId);
    } else {
        G.discard.push(cardId);
    }
};

/**
 * Home cards that are available to a power on the current turn (6.2 / 10).
 * "variable" cards enter only through their printed event, which this runtime
 * does not yet model, so they stay out of the annual hand.
 */
export const availableHomeCards = (G: VQGame, p: Power): string[] => {
    if (isActivatedMajor(G, p)) return [];
    const scenario = scenarioSetup(G.scenario, G.playerPowers ? 2 : 6);
    const available: string[] = [];
    for (const number of scenario.cardsInPlay) {
        const card = OFFICIAL_CARDS[number - 1];
        if (card?.kind !== "home" || card.power !== p) {
            continue;
        }
        if (typeof card.availableFromTurn !== "number" || card.availableFromTurn > G.year) {
            continue;
        }
        if (G.removed.includes(card.id)) {
            continue;
        }
        available.push(card.id);
    }
    return available;
};

export const homeCardsInHand = (G: VQGame, p: Power): string[] =>
    G.powers[p].cards.filter((id) => cardById(id).kind === "home");

/** While Suleiman is the Ottoman ruler, the Ottoman keeps both Home cards (6.1 / 10). */
export const suleimanIsOttomanRuler = (G: VQGame): boolean =>
    G.powers.ottoman.ruler === "suleiman";

export const keepsBothHomeCards = (G: VQGame, p: Power): boolean =>
    p === "ottoman" && suleimanIsOttomanRuler(G);

/** True when the active power still owes its secret Spring Home card choice. */
export const homeCardChoiceRequired = (G: VQGame, p: Power): boolean =>
    !keepsBothHomeCards(G, p) &&
    !G.powers[p].homeCardChoiceDone &&
    homeCardsInHand(G, p).length > 1;

export const hreReligiousPreferenceEnabled = (G: VQGame): boolean =>
    G.scenario !== "tutorial" && !G.playerPowers;

export const hreReligiousPreferenceRequired = (G: VQGame, p: Power): boolean =>
    p === "hre" && hreReligiousPreferenceEnabled(G) && G.year === G.startTurn &&
    !G.hreReligiousPreferenceChosen && G.hreReligiousPreference === undefined;

/** Current ruler card/admin ratings, including deaths from marriage/assassination. */
export const rulerStats = (G: VQGame, p: Power): {cardBonus: number; admin: number} => {
    const dead = (id: string): boolean => G.royals.find((royal) => royal.id === id)?.alive === false;
    if (p === "england" && (G.powers.england.ruler === "elizabethDead" || dead("elizabeth"))) return {cardBonus: 0, admin: 1};
    if (p === "spain" && dead("philip")) return {cardBonus: 0, admin: 1};
    if (p === "france" && G.powers.france.ruler === "charlesIX" && dead("charlesIX")) return {cardBonus: 0, admin: 0};
    if (p === "france" && dead("henryIII")) return {cardBonus: 0, admin: 1};
    if (p === "hre" && dead("rudolf")) return {cardBonus: 0, admin: 1};
    return {cardBonus: POWER_INFO[p].ruler.cardBonus, admin: POWER_INFO[p].ruler.admin};
};

export const drawCount = (G: VQGame, p: Power): number => {
    const keys = controlledKeys(G, p).length;
    if (G.scenario === "tutorial" && (p === "ottoman" || p === "spain")) {
        const table = TUTORIAL_POWER_CARDS[p].draw;
        const rulerBonus = p === "spain" || G.powers.ottoman.ruler === "selimII" ? 1 : 0;
        return Math.max(0, table[Math.min(keys, table.length - 1)] + rulerBonus + G.powers[p].cardModifier + (G.powers[p].marriageCardModifier ?? 0) + (G.tutorialEffects?.nextDraw[p] ?? 0));
    }
    const info = POWER_INFO[p];
    const base = p === "protestant"
        ? 4 + Math.min(3, Math.min(controlledKeysInNetherlands(G, p).length, protestantKeysOutsideNetherlands(G).length))
        : (info.drawByKeys[Math.min(keys, info.drawByKeys.length - 1)] ?? 3);
    const rulerBonus = rulerStats(G, p).cardBonus;
    return Math.max(1, base + rulerBonus + G.powers[p].cardModifier + (G.powers[p].marriageCardModifier ?? 0) + (G.espionage?.nextDraw[p] ?? 0));
};

/** Navigation Table check for a hazardous passage (16.4). */
export const navigationCheck = (G: VQGame, ctx: Ctx, captainId: string): boolean => {
    const expedition = G.worldCaptains[captainId];
    const captain = seaCaptainById(captainId);
    if (expedition === undefined || captain === undefined) return false;
    const mapProjection = G.powers[expedition.power].scienceBonuses.includes("mapProjection") ? 1 : 0;
    const dice = roll(ctx, 2);
    const total = dice[0] + dice[1] + captain.navigation + mapProjection;
    G.lastRolls = `Navigation (${captain.nameEn}): [${dice.join(",")}] + ${captain.navigation}` +
        `${mapProjection ? ` + ${mapProjection} Map Projection` : ""} = ${total}`;
    pushLog(G, G.lastRolls);
    if (total <= 6) {
        delete G.worldCaptains[captainId];
        if (captainId === "muratReis") {
            G.seaCaptainReturn = {...(G.seaCaptainReturn ?? {}), [captainId]: {power: expedition.power, turn: G.year + 1}};
            pushLog(G, "Murat Reis survives the elimination and returns to the Turn Track.");
        } else {
            G.powers[expedition.power].seaCaptains = G.powers[expedition.power].seaCaptains.filter((id) => id !== captainId);
            pushLog(G, `${captain.nameEn}'s expedition is eliminated; the captain is removed from the game.`);
        }
        return false;
    }
    if (total <= 8) {
        if (expedition.damaged) {
            delete G.worldCaptains[captainId];
            G.seaCaptainReturn = {...(G.seaCaptainReturn ?? {}), [captainId]: {power: expedition.power, turn: G.year + 1}};
            pushLog(G, `${captain.nameEn}'s already damaged expedition is eliminated; the captain goes to the Turn Track.`);
            return false;
        }
        expedition.damaged = true;
        pushLog(G, `${captain.nameEn}'s expedition is damaged.`);
    }
    return true;
};

/** 8.4 Colony Table: each established colony rolls for survival/rewards. */
/** 16.6 Circumnavigation, checked after an expedition enters an ocean zone. */
export const checkCircumnavigation = (G: VQGame, captainId: string, from: string, to: string): boolean => {
    const expedition = G.worldCaptains[captainId];
    if (expedition === undefined) return false;
    const recorded = expedition.route ?? [from];
    const route = recorded[recorded.length - 1] === to ? recorded.slice(0, -1) : recorded;
    const firstVisit = !route.includes(to);
    let circumnavigated = false;
    if (expedition.power === "ottoman") {
        const returns = route.filter((zone) => zone === "indianOcean").length === 1;
        const departedTo = from === "southPacific" ? "southPacific" : from === "guineaCoast" ? "guineaCoast" : undefined;
        const departedFromIndia = departedTo !== undefined && route.indexOf("indianOcean") >= 0 &&
            route.indexOf(departedTo) > route.indexOf("indianOcean");
        if (to === "indianOcean" && returns && departedFromIndia) circumnavigated = true;
    } else {
        const toIndiaFromGuinea = route.some((zone, i) => zone === "guineaCoast" && route[i + 1] === "indianOcean");
        const toChileFromAtlantic = route.some((zone, i) => zone === "southAtlantic" && route[i + 1] === "chileanCoast");
        if (to === "southAtlantic" && from === "chileanCoast" && firstVisit && toIndiaFromGuinea) circumnavigated = true;
        if (to === "guineaCoast" && from === "indianOcean" && firstVisit && toChileFromAtlantic) circumnavigated = true;
    }
    if (!circumnavigated) return false;
    const number = (G.circumnavigations ?? 0) + 1;
    G.circumnavigations = number;
    const vp = number === 1 ? 2 : 1;
    addVp(G, expedition.power, vp);
    delete G.worldCaptains[captainId];
    G.seaCaptainReturn = {...(G.seaCaptainReturn ?? {}), [captainId]: {power: expedition.power, turn: G.year + 1}};
    pushLog(G, `${captainId} completes a circumnavigation; ${powerLabel(expedition.power)} gains ${vp} VP.`);
    return true;
};

export const resolveColonies = (G: VQGame, ctx: Ctx): void => {
    if (G.scenario === "tutorial") return;
    for (const [settlement, power] of Object.entries(G.worldColonies)) {
        if (power === undefined) continue;
        const plantation = G.powers[power].scienceBonuses.includes("plantation") ? 1 : 0;
        const dice = roll(ctx, 2);
        const total = dice[0] + dice[1] + plantation;
        G.lastRolls = `Colony ${settlement}: [${dice.join(",")}] + ${plantation} = ${total}`;
        pushLog(G, G.lastRolls);
        if (total <= 4) {
            delete G.worldColonies[settlement];
            if (G.worldControls[settlement] === power) delete G.worldControls[settlement];
            pushLog(G, `Colony ${settlement} is eliminated.`);
        } else if (total >= 12) {
            addTreasure(G, ctx, power, 1);
            addVp(G, power, 1);
            pushLog(G, `Colony ${settlement} yields a treasure and 1 Virginia Dare VP.`);
        } else if (total >= 9) {
            addTreasure(G, ctx, power, 1);
            pushLog(G, `Colony ${settlement} yields a treasure.`);
        } else {
            pushLog(G, `Colony ${settlement} has no effect this turn.`);
        }
    }
};

/** Return sea captains from the Turn Track during Card Draw. */
export const returnSeaCaptains = (G: VQGame): void => {
    for (const [id, entry] of Object.entries(G.seaCaptainReturn ?? {})) {
        if (entry.turn > G.year) continue;
        if (!G.powers[entry.power].seaCaptains.includes(id)) G.powers[entry.power].seaCaptains.push(id);
        delete G.seaCaptainReturn![id];
        pushLog(G, `${id} returns to ${powerLabel(entry.power)}'s sea captain pool.`);
    }
};

/** 6.3/20.7: Portuguese treasure row refresh and winter award. */
export const refreshPortugueseTreasures = (G: VQGame, ctx: Ctx): void => {
    if (G.portugalEntered === true && (G.portugueseTreasures?.length ?? 0) === 0) {
        G.portugueseTreasures = Array.from({length: 3}, () => 1 + die(ctx, 5) - 1);
    }
};

export const awardPortugueseTreasures = (G: VQGame, ctx: Ctx): void => {
    if (G.portugalEntered !== true || (G.portugueseTreasures?.length ?? 0) === 0) return;
    const controller = G.spaces.lisbon.control;
    if (isPower(controller) && G.portugueseTreasures !== undefined) {
        const index = die(ctx, G.portugueseTreasures.length) - 1;
        const [treasure] = G.portugueseTreasures.splice(index, 1);
        G.powers[controller].treasures.push(treasure);
        pushLog(G, `${powerLabel(controller)} takes a Portuguese treasure.`);
    }
    G.portugueseTreasures = [];
};

/** 20.3: return loaned naval units to the lender. */
export const returnLoanedNaval = (G: VQGame): void => {
    for (const loan of G.loanedNaval ?? []) {
        const stack = G.spaces[loan.toPort].naval[loan.borrower];
        if (stack === undefined || stack[loan.kind] < 1) continue;
        stack[loan.kind] -= 1;
        if (stack.galley + stack.galleon + stack.racebuilt + stack.corsair === 0) delete G.spaces[loan.toPort].naval[loan.borrower];
        const port = G.spaces[loan.fromPort]?.control === loan.lender ? loan.fromPort :
            SPACES.find((def) => G.spaces[def.id].control === loan.lender && isPort(def.id) && !isInlandPort(def.id))?.id;
        if (port === undefined) continue;
        ensureNaval(G, port, loan.lender)[loan.kind] += 1;
        pushLog(G, `${powerLabel(loan.lender)}'s loaned ${loan.kind} returns from ${powerLabel(loan.borrower)}.`);
    }
    G.loanedNaval = [];
};

/** Rebuild the Armada at strength 2 on its Turn Track year. */
export const rebuildArmada = (G: VQGame): void => {
    if (G.armada !== undefined || G.armadaReturn === undefined || G.armadaReturn > G.year) return;
    const port = ["seville", "corunna", "lisbon"].find((id) => G.spaces[id]?.control === "spain" && !G.spaces[id].unrest);
    if (port === undefined) return;
    G.armada = {strength: 2, location: port};
    delete G.armadaReturn;
    pushLog(G, `The Spanish Armada is rebuilt in ${SPACE_BY_ID[port].name}.`);
};

/** Deal a new year's hands. Home cards return, hands are trimmed to Admin. */
export const dealYear = (G: VQGame, ctx: Ctx): void => {
    returnSeaCaptains(G);
    rebuildArmada(G);
    refreshPortugueseTreasures(G, ctx);
    G.piracyActions = {};
    G.piracyZones = {};
    G.worldFortressesBuilt = 0;
    refreshJesuits(G);
    const eligibleFuture: string[] = [];
    G.futureDeck = G.futureDeck.filter((id) => {
        const card = officialCardById(id);
        if (typeof card?.availableFromTurn === "number" && card.availableFromTurn <= G.year) {
            eligibleFuture.push(id);
            return false;
        }
        return true;
    });
    G.deck = shuffle(ctx, [...G.deck, ...G.discard, ...eligibleFuture]);
    G.discard = [];
    G.homeSetAside = [];
    for (const p of POWERS) {
        const ps = G.powers[p];
        if (ownerOf(G, p) === undefined) continue;
        // Home cards return to the power card after use / Spring set-aside and
        // are dealt again only if they are available this turn.
        ps.cards = ps.cards.filter((id) => cardById(id).kind !== "home");
        for (const id of availableHomeCards(G, p)) {
            ps.cards.push(id);
        }
        ps.homeCardSetAside = [];
        ps.homeCardChoiceDone = false;
        // Keep at most the ruler's admin rating of non-home cards.
        const nonHome = ps.cards.filter((c) => cardById(c).kind !== "home");
        const keep = Math.min(nonHome.length, G.scenario === "tutorial" ? 2 : rulerStats(G, p).admin);
        const dropped = nonHome.slice(keep);
        for (const d of dropped) {
            ps.cards = ps.cards.filter((c) => c !== d);
            G.discard.push(d);
        }
        const n = drawCount(G, p);
        drawCards(G, ctx, p, n);
        if (G.espionage) delete G.espionage.nextDraw[p];
        if (G.tutorialEffects) delete G.tutorialEffects.nextDraw[p];
        ps.passed = false;
        ps.cp = 0;
        ps.cardPlayed = false;
        ps.treasurePlayed = false;
        // The first Card Draw Phase preserves the scenario's printed alliances
        // and influence.  Later years keep the existing simplified reset.
        if (G.dealtYear !== 0 && !G.playerPowers) {
            ps.influence = {};
            ps.allies = [];
        }
    }
    for (const p of POWERS) G.powers[p].marriageCardModifier = 0;
    G.dealtYear = G.year;
    G.springDone = [];
    G.patronizedThisTurn = [];
    G.cardDrawDone = [];
    if (G.scenario !== "tutorial" && G.powers.spain.treasures.length === 0) {
        G.powers.spain.treasures = Array.from({length: 4}, () => 1 + die(ctx, 5) - 1);
    }
    resolveColonies(G, ctx);
};

export const shuffleTreasure = (ctx: Ctx): number => 1 + (die(ctx, 5) - 1);

export const addTreasure = (G: VQGame, ctx: Ctx, p: Power, n: number): void => {
    if (G.scenario === "tutorial") return;
    for (let i = 0; i < n; i++) {
        G.powers[p].treasures.push(shuffleTreasure(ctx));
    }
};

export const playTreasure = (G: VQGame, p: Power, index: number): number => {
    const t = G.powers[p].treasures[index];
    if (t === undefined) {
        return 0;
    }
    G.powers[p].treasures.splice(index, 1);
    G.powers[p].cp += t;
    G.powers[p].treasurePlayed = true;
    return t;
};

// --------------------------------------------------------------------------
// Political / diplomatic state
// --------------------------------------------------------------------------

export const atWar = (G: VQGame, a: Power, b: Power): boolean =>
    G.powers[a].wars.includes(b) || G.powers[b].wars.includes(a);

export const atWarWithMinor = (G: VQGame, p: Power, m: MinorPower): boolean =>
    G.powers[p].warsMinors.includes(m);

export const minorAlly = (G: VQGame, minor: MinorPower): Power | undefined =>
    POWERS.find((p) => G.powers[p].alliedMinors.includes(minor));

export const minorAvailable = (G: VQGame, minor: MinorPower): boolean =>
    minor !== "portugal" || POWERS.some((p) => G.minorInfluenceDefaults[p].portugal !== undefined);

/** Evaluate one minor's influence track and apply the resulting activation. */
export const resolveMinorDiplomacy = (
    G: VQGame,
    ctx: Ctx,
    minor: MinorPower,
    options: {exclude?: Power[]; modifier?: Partial<Record<Power, number>>} = {},
): Power | undefined => {
    if (!MINOR_POWERS.includes(minor) || G.minorDiplomacyResolved.includes(minor) || !minorAvailable(G, minor)) return undefined;
    if (minor === "portugal") G.portugalEntered = true;
    const def = MINOR_DIPLOMACY[minor];
    const candidates = [...def.eligible, ...(G.scenario === "tutorial" && minor === "papacy" ? ["ottoman" as Power] : [])].filter((p) =>
        ownerOf(G, p) !== undefined &&
        !options.exclude?.includes(p) && !G.minorInfluenceBlocked[p]?.includes(minor));
    if (candidates.length === 0) {
        G.minorDiplomacyResolved.push(minor);
        return undefined;
    }
    const scotlandCatholic = minor === "scotland" &&
        SPACES.filter((s) => s.home === "scotland" && G.spaces[s.id].religion === "catholic").length >= 3;
    const scotlandProtestant = minor === "scotland" &&
        SPACES.filter((s) => s.home === "scotland" && G.spaces[s.id].religion === "protestant").length >= 3;
    const rolls = candidates.map((p) => {
        const dieRoll = die(ctx);
        const modifier = (options.modifier?.[p] ?? 0) +
            (p === "france" && scotlandCatholic ? 2 : 0) +
            (p === "protestant" && scotlandProtestant ? 2 : 0);
        return {power: p, die: dieRoll, influence: G.powers[p].influence[minor] ?? 0, modifier,
            total: dieRoll + (G.powers[p].influence[minor] ?? 0) + modifier};
    });
    rolls.sort((a, b) => b.total - a.total ||
        POWERS.indexOf(a.power) - POWERS.indexOf(b.power));
    const winner = rolls[0].power;
    const oldAlly = minorAlly(G, minor);
    pushLog(G, `${minor} diplomacy: ${rolls.map((r) => `${powerLabel(r.power)} ${r.die}+${r.influence}+${r.modifier}=${r.total}`).join("; ")}. ${powerLabel(winner)} wins.`);

    const deactivatesExistingAlly = (def.deactivate.includes(winner) || (G.scenario === "tutorial" && minor === "papacy" && winner === "ottoman")) && oldAlly !== undefined &&
        (!def.activateOrder.includes(winner) || oldAlly === winner);
    if (deactivatesExistingAlly) {
        G.powers[oldAlly].alliedMinors = G.powers[oldAlly].alliedMinors.filter((m) => m !== minor);
        for (const s of SPACES.filter((space) => space.home === minor)) {
            if (G.spaces[s.id].control === oldAlly) G.spaces[s.id].control = minor;
        }
        pushLog(G, `${powerLabel(winner)} deactivates ${minor}.`);
    } else if (def.activateOrder.includes(winner) && oldAlly !== winner) {
        if (oldAlly !== undefined) {
            G.powers[oldAlly].alliedMinors = G.powers[oldAlly].alliedMinors.filter((m) => m !== minor);
            for (const s of SPACES.filter((space) => space.home === minor)) {
                if (G.spaces[s.id].control === oldAlly) G.spaces[s.id].control = minor;
            }
        }
        G.powers[winner].alliedMinors.push(minor);
        for (const s of SPACES.filter((space) => space.home === minor)) {
            const owner = G.spaces[s.id].control;
            if (owner === minor || (isPower(owner) && def.eligible.includes(owner))) G.spaces[s.id].control = winner;
        }
        for (const p of POWERS) G.powers[p].warsMinors = G.powers[p].warsMinors.filter((m) => m !== minor);
        if (minor === "ireland") {
            const ulster = G.spaces.ulster;
            if (ulster !== undefined) {
                delete ulster.land.ireland;
                ulster.fortress = true;
                addLand(G, "ulster", "ireland", "regular", 3);
            }
        }
        pushLog(G, `${powerLabel(winner)} activates ${minor} as an ally.`);
    }
    G.minorDiplomacyResolved.push(minor);
    return winner;
};

export const allied = (G: VQGame, a: Power, b: Power): boolean =>
    a !== b && (G.powers[a].allies.includes(b) || G.activatedMajors?.[a]?.ally === b ||
        G.activatedMajors?.[b]?.ally === a ||
        (G.scenario === "tutorial" && ((a === "hre" && G.tutorialHreAlly === b) || (b === "hre" && G.tutorialHreAlly === a))));

export const friendly = (G: VQGame, a: Power, b: Power): boolean => a === b || allied(G, a, b);

export const friendlyController = (G: VQGame, p: Power, owner: Controller): boolean =>
    owner === p || (isPower(owner) ? friendly(G, p, owner) : owner !== "independent" && G.powers[p].alliedMinors.includes(owner));

export const setWar = (G: VQGame, a: Power, b: Power): void => {
    if (!G.powers[a].wars.includes(b)) {
        G.powers[a].wars.push(b);
    }
    if (!G.powers[b].wars.includes(a)) {
        G.powers[b].wars.push(a);
    }
    G.powers[a].allies = G.powers[a].allies.filter((x) => x !== b);
    G.powers[b].allies = G.powers[b].allies.filter((x) => x !== a);
    pushLog(G, `${powerLabel(a)} declares war on ${powerLabel(b)}.`);
};

export const clearWar = (G: VQGame, a: Power, b: Power): void => {
    G.powers[a].wars = G.powers[a].wars.filter((x) => x !== b);
    G.powers[b].wars = G.powers[b].wars.filter((x) => x !== a);
    pushLog(G, `${powerLabel(a)} and ${powerLabel(b)} make peace.`);
    if (G.morisco !== undefined && !atWar(G, "ottoman", "spain")) clearMorisco(G);
};

const WAR_COST: Record<string, number> = {
    "england-france": 3,
    "england-spain": 5,
    "france-hre": 2,
    "france-ottoman": 3,
    "france-protestant": 1,
    "france-spain": 2,
    "hre-ottoman": 2,
    "hre-protestant": 3,
    "hre-spain": 1,
    "ottoman-protestant": 3,
    "ottoman-spain": 2,
    "protestant-spain": 2,
};

export const warCost = (G: VQGame, a: Power, b: Power): number => {
    if ((a === "england" && b === "spain") || (a === "spain" && b === "england")) {
        return Math.max(1, G.doWCostEnglandSpain);
    }
    return WAR_COST[[a, b].sort().join("-")] ?? 2;
};

export const canDeclareWar = (G: VQGame, a: Power, b: Power): boolean => {
    if (a === b || samePlayer(G, a, b) || atWar(G, a, b) || allied(G, a, b)) {
        return false;
    }
    if ((a === "spain" && b === "protestant") || (a === "protestant" && b === "spain")) {
        return false;
    }
    return true;
};

export const settleActivatedMajorVp = (G: VQGame, only?: Power): void => {
    for (const power of POWERS) {
        if (only !== undefined && power !== only) continue;
        const activation = G.activatedMajors?.[power];
        if (!activation) continue;
        const change = Math.trunc((powerVp(G, power) - activation.baseline) / 2);
        if (change === 0) continue;
        addVp(G, activation.ally, change);
        activation.baseline += change * 2;
        pushLog(G, `${powerLabel(activation.ally)} receives ${change} VP from ${powerLabel(power)}.`);
    }
};

export const deactivateMajor = (G: VQGame, power: Power): void => {
    if (!G.activatedMajors?.[power]) return;
    settleActivatedMajorVp(G, power);
    delete G.activatedMajors[power];
    for (const other of POWERS) {
        G.powers[other].wars = G.powers[other].wars.filter((enemy) => enemy !== power);
        G.powers[other].allies = G.powers[other].allies.filter((ally) => ally !== power);
    }
    const state = G.powers[power];
    state.wars = [];
    state.allies = [];
    state.influence = {};
    for (const card of state.cards) discardCard(G, power, card, false);
    state.cards = [];
    state.cp = 0;
    state.cardModifier = 0;
    G.majorDiplomacyResolved ??= [];
    if (!G.majorDiplomacyResolved.includes(power)) G.majorDiplomacyResolved.push(power);
    if (power === "hre") {
        for (const minor of state.alliedMinors) {
            for (const def of SPACES.filter((space) => space.home === minor)) {
                if (G.spaces[def.id].control === power) G.spaces[def.id].control = minor;
            }
        }
        state.alliedMinors = [];
    }
    for (const def of SPACES) {
        for (const other of POWERS) {
            const relocate = other === power || G.spaces[def.id].control === power;
            if (!relocate) continue;
            const space = G.spaces[def.id];
            if (space.land[other]) {
                const destinations = SPACES.filter((candidate) => candidate.home === other &&
                    G.spaces[candidate.id].control === other && isFortifiedSpace(G, candidate.id));
                const destination = destinations.sort((first, second) =>
                    Math.hypot(first.lon - def.lon, first.lat - def.lat) - Math.hypot(second.lon - def.lon, second.lat - def.lat))[0];
                if (destination && destination.id !== def.id) {
                    const target = ensureLand(G, destination.id, other);
                    const source = space.land[other]!;
                    target.regular += source.regular;
                    target.merc += source.merc;
                    target.cav += source.cav;
                    delete space.land[other];
                    moveLeaders(G, def.id, destination.id, space.leaders.filter((id) => LEADER_BY_ID[id]?.power === other && LEADER_BY_ID[id].kind === "army"));
                }
            }
            if (space.naval[other]) {
                const destination = SPACES.find((candidate) => candidate.home === other && candidate.id !== def.id &&
                    G.spaces[candidate.id].control === other && isPort(candidate.id));
                if (destination) {
                    const target = ensureNaval(G, destination.id, other);
                    for (const kind of ["galley", "galleon", "racebuilt", "corsair"] as const) target[kind] += space.naval[other]![kind];
                    delete space.naval[other];
                    moveLeaders(G, def.id, destination.id, space.leaders.filter((id) => LEADER_BY_ID[id]?.power === other && LEADER_BY_ID[id].kind === "naval"));
                }
            }
        }
    }
    for (const zone of SEA_ZONES) {
        const source = G.seaZones[zone.id].naval[power];
        if (!source) continue;
        const destination = nearestFriendlyPort(G, power, zone.id);
        if (destination) {
            const target = ensureNaval(G, destination, power);
            for (const kind of ["galley", "galleon", "racebuilt", "corsair"] as const) target[kind] += source[kind];
            moveLeaders(G, zone.id, destination, G.seaZones[zone.id].leaders.filter((id) => LEADER_BY_ID[id]?.power === power));
        }
        delete G.seaZones[zone.id].naval[power];
    }
    pushLog(G, `${powerLabel(power)} is deactivated.`);
};

export const activateMajor = (G: VQGame, ctx: Ctx, power: Power, ally: Power, options: {war?: Power; defense?: Power} = {}): boolean => {
    if (!isActivatedMajor(G, power) || isActivatedMajor(G, ally) || ownerOf(G, ally) === undefined || power === ally) return false;
    if (options.war && (samePlayer(G, ally, options.war) || options.war === power)) return false;
    deactivateMajor(G, power);
    G.activatedMajors![power] = {ally, baseline: powerVp(G, power)};
    G.majorDiplomacyResolved ??= [];
    if (!G.majorDiplomacyResolved.includes(power)) G.majorDiplomacyResolved.push(power);
    G.powers[power].influence = {...G.minorInfluenceDefaults[power]};
    if (options.defense && !samePlayer(G, ally, options.defense)) setWar(G, ally, options.defense);
    if (options.war) setWar(G, power, options.war);
    const cap = Math.max(0, ...participatingPowers(G).filter((other) => other !== power).map((other) => handCount(G, other)));
    const count = Math.min(drawCount(G, power), cap, options.war ? handCount(G, options.war) : Infinity);
    drawCards(G, ctx, power, count);
    pushLog(G, `${powerLabel(power)} is activated by ${powerLabel(ally)} and draws ${count} cards.`);
    return true;
};

export const resolveMajorDiplomacy = (G: VQGame, ctx: Ctx, target: Power, aggressor?: Power): void => {
    if (!G.majorInfluence?.[target] || G.majorDiplomacyResolved?.includes(target)) return;
    if (G.scenario === "tutorial" && target !== "hre") return;
    const candidates = POWERS.filter((power) => power !== target && power !== aggressor &&
        G.majorInfluence![target]![power] !== undefined &&
        (ownerOf(G, power) !== undefined || (G.scenario === "tutorial" && power === "ottoman")));
    const results = candidates.map((power) => ({power, result: die(ctx) + (G.majorInfluence![target]![power] ?? 0)}))
        .sort((first, second) => second.result - first.result || POWERS.indexOf(first.power) - POWERS.indexOf(second.power));
    if (!results.length) return;
    const winner = results[0].power;
    G.majorDiplomacyResolved ??= [];
    G.majorDiplomacyResolved.push(target);
    pushLog(G, `${powerLabel(target)} diplomacy: ${results.map((entry) => `${powerLabel(entry.power)} ${entry.result}`).join("; ")}.`);
    const deactivate = (target === "ottoman" && winner === "spain") || (target === "hre" && winner === "ottoman");
    if (G.scenario === "tutorial") {
        G.tutorialHreAlly = deactivate ? undefined : "spain";
        return;
    }
    if (deactivate) {
        deactivateMajor(G, target);
        return;
    }
    if (G.activatedMajors?.[target]?.ally === winner) return;
    G.pendingActivation = {power: target, ally: winner, aggressor};
    ctx.events?.setActivePlayers({value: {[ownerOf(G, winner)!]: "activateMajor"}});
};

export const declareWar = (G: VQGame, a: Power, b: Power): boolean => {
    if (!canDeclareWar(G, a, b)) {
        return false;
    }
    setWar(G, a, b);
    return true;
};

// --------------------------------------------------------------------------
// Controlled spaces, keys, VP and religion
// --------------------------------------------------------------------------

export const controlled = (G: VQGame, p: Power, space: string): boolean => {
    const s = G.spaces[space];
    return s !== undefined && s.control === p;
};

export const friendlyControlled = (G: VQGame, p: Power, space: string): boolean => {
    const s = G.spaces[space];
    if (s === undefined) {
        return false;
    }
    return s.control === p || (isPower(s.control) && allied(G, p, s.control)) ||
        (!isPower(s.control) && s.control !== "independent" && G.powers[p].alliedMinors.includes(s.control));
};

export const controlledKeys = (G: VQGame, p: Power): string[] =>
    (G.scenario === "tutorial" ? TUTORIAL_KEYS : KEY_SPACES).filter((id) => {
        const s = G.spaces[id];
        return s !== undefined && s.control === p && !s.unrest;
    });

export const controlledKeysInNetherlands = (G: VQGame, p: Power): string[] =>
    controlledKeys(G, p).filter((id) => DUTCH_KEYS.includes(id));

export const protestantKeysOutsideNetherlands = (G: VQGame): string[] =>
    controlledKeys(G, "protestant").filter((id) => !DUTCH_KEYS.includes(id));

export const baseVp = (G: VQGame, p: Power): number => {
    if (G.scenario === "tutorial" && (p === "ottoman" || p === "spain")) {
        const table = TUTORIAL_POWER_CARDS[p].vp;
        return table[Math.min(controlledKeys(G, p).length, table.length - 1)];
    }
    if (p === "protestant") {
        const keys = controlledKeys(G, "protestant");
        return keys.reduce((sum, id) => sum + (DUTCH_KEYS.includes(id) ? 3 : 2), 0);
    }
    const keys = controlledKeys(G, p).length;
    const table = POWER_INFO[p].vpByKeys;
    return table[Math.min(keys, table.length - 1)] ?? 0;
};

/** Number of Protestant spaces currently printed on the map. */
export const mapProtestantSpaceCount = (G: VQGame): number =>
    SPACES.filter((s) => s.area !== undefined && G.spaces[s.id].religion === "protestant" && !G.spaces[s.id].unrest).length;

/**
 * Official Protestant Spaces track.  The Scenario Book starts the marker at a
 * printed value (18 Campaign / 30 Tournament) that does not match the number
 * of spaces drawn on our reconstructed map.  Track changes to the map count so
 * conversions move the official marker by the same amount.
 */
export const protestantSpaceCount = (G: VQGame): number => {
    const current = mapProtestantSpaceCount(G);
    return Math.max(0, G.protestantSpacesStart + (current - G.protestantSpacesMapAtStart));
};

export const protestantSpacesInArea = (G: VQGame, area: ReligionArea): number =>
    SPACES.filter((s) => s.area === area && G.spaces[s.id].religion === "protestant" && !G.spaces[s.id].unrest).length;

export const hreReligiousVp = (G: VQGame): number => {
    if (!hreReligiousPreferenceEnabled(G) || G.hreReligiousPreference === undefined) return 0;
    const row = Math.max(0, Math.min(7, Math.floor((protestantSpaceCount(G) - 10) / 5)));
    const vp = {
        protestant: [0, 0, 0, 0, 1, 3, 5, 7],
        balanced: [0, 0, 2, 4, 4, 2, 0, 0],
        catholic: [7, 5, 3, 1, 0, 0, 0, 0],
    };
    return vp[G.hreReligiousPreference][row];
};

export const religiousSpecialVp = (G: VQGame, p: Power): number => {
    if (G.scenario === "tutorial") return 0;
    const n = protestantSpaceCount(G);
    switch (p) {
        case "spain":
            return n <= 8 ? 3 : n <= 16 ? 2 : n <= 25 ? 1 : 0;
        case "england":
            return n <= 8 ? 0 : n <= 16 ? 1 : n <= 25 ? 2 : n <= 33 ? 2 : n <= 42 ? 3 : 4;
        case "protestant":
            return n <= 8 ? 0 : n <= 16 ? 1 : n <= 25 ? 2 : n <= 33 ? 3 : n <= 42 ? 4 : 5;
        case "hre":
            return G.hreReligiousPreferenceRevealed ? hreReligiousVp(G) : 0;
        default:
            return 0;
    }
};

export const powerVp = (G: VQGame, p: Power): number =>
    baseVp(G, p) + religiousSpecialVp(G, p) + G.powers[p].bonusVp +
    (G.scenario === "tutorial" && p === "ottoman" ? tutorialFortressVp(G) +
        (G.tutorialEffects?.cyprusTarget && G.spaces[G.tutorialEffects.cyprusTarget].control === "ottoman" ? 1 : 0) : 0);

export const victoryStandings = (G: VQGame, includeSecretHreVp = false): { power: Power; vp: number }[] =>
    participatingPowers(G).filter((power) => !isActivatedMajor(G, power))
        .map((p) => ({power: p, vp: powerVp(G, p) +
            (p === "hre" && includeSecretHreVp && !G.hreReligiousPreferenceRevealed ? hreReligiousVp(G) : 0)}))
        .sort((a, b) => b.vp - a.vp);

export const addVp = (G: VQGame, p: Power, n: number): void => {
    G.powers[p].bonusVp += n;
};

// --------------------------------------------------------------------------
// Unit helpers
// --------------------------------------------------------------------------

export const exactLand = (G: VQGame, space: string, c: Controller): LandStack =>
    G.spaces[space].land[c] ?? emptyLand();

export const exactNaval = (G: VQGame, space: string, c: Controller): NavalStack =>
    G.spaces[space].naval[c] ?? emptyNaval();

export const ensureLand = (G: VQGame, space: string, c: Controller): LandStack => {
    const s = G.spaces[space];
    if (s.land[c] === undefined) {
        s.land[c] = emptyLand();
    }
    return s.land[c] as LandStack;
};

const navalStateAt = (G: VQGame, space: string) => G.seaZones[space as SeaZoneID] ?? G.spaces[space];

export const ensureNaval = (G: VQGame, space: string, c: Controller): NavalStack => {
    const s = navalStateAt(G, space);
    if (s.naval[c] === undefined) {
        s.naval[c] = emptyNaval();
    }
    return s.naval[c] as NavalStack;
};

export const cleanupLand = (G: VQGame, space: string, c: Controller): void => {
    const s = G.spaces[space];
    if (s.land[c] !== undefined && landCount(s.land[c] as LandStack) <= 0) {
        delete s.land[c];
    }
};

export const cleanupNaval = (G: VQGame, space: string, c: Controller): void => {
    const s = navalStateAt(G, space);
    if (s.naval[c] !== undefined && navalCount(s.naval[c] as NavalStack) <= 0) {
        delete s.naval[c];
    }
};

export const addLand = (G: VQGame, space: string, c: Controller, kind: keyof LandStack, n: number): void => {
    ensureLand(G, space, c)[kind] += n;
};

export const addNaval = (G: VQGame, space: string, c: Controller, kind: keyof NavalStack, n: number): void => {
    ensureNaval(G, space, c)[kind] += n;
};

export const ownersWithLand = (G: VQGame, space: string): Controller[] =>
    Object.keys(G.spaces[space].land) as Controller[];

export const ownersWithNaval = (G: VQGame, space: string): Controller[] =>
    (Object.keys(navalStateAt(G, space).naval) as Controller[]).filter((owner) => navalCount(navalStateAt(G, space).naval[owner]) > 0);

export const totalLand = (G: VQGame, space: string, owners: Controller[]): number =>
    owners.reduce((n, c) => n + landCount(G.spaces[space].land[c]), 0);

export const totalNaval = (G: VQGame, space: string, owners: Controller[]): number =>
    owners.reduce((n, c) => n + navalCount(navalStateAt(G, space).naval[c]), 0);

export const enemyOwners = (G: VQGame, p: Power, space: string): Controller[] =>
    ownersWithLand(G, space).filter((c) => {
        if (friendlyController(G, p, c) || c === "independent") return false;
        return isPower(c) ? atWar(G, p, c) : true;
    });

export const spaceHasEnemyLand = (G: VQGame, p: Power, space: string): boolean =>
    enemyOwners(G, p, space).some((c) => landCount(G.spaces[space].land[c]) > 0);

export const spaceHasEnemyNaval = (G: VQGame, p: Power, space: string): boolean =>
    ownersWithNaval(G, space).some((c) => !friendlyController(G, p, c) &&
        (isPower(c) ? atWar(G, p, c) : c !== "independent") && navalCount(navalStateAt(G, space).naval[c]) > 0);

export const removeLandLosses = (G: VQGame, space: string, owners: Controller[], hitsCount: number): void => {
    let left = hitsCount;
    // Losses are taken from mercenaries first (they are the least reliable),
    // then regulars, then cavalry.
    for (const kind of ["merc", "regular", "cav"] as const) {
        for (const c of owners) {
            const st = G.spaces[space].land[c];
            if (st === undefined) {
                continue;
            }
            while (left > 0 && st[kind] > 0) {
                st[kind] -= 1;
                left -= 1;
            }
            cleanupLand(G, space, c);
            if (left === 0) {
                return;
            }
        }
    }
};

export const removePortNavalLosses = (G: VQGame, port: string, owners: Controller[], hitsCount: number): void => {
    let left = hitsCount;
    for (const kind of ["galleon", "racebuilt", "corsair", "galley"] as const) {
        for (const c of owners) {
            const st = G.spaces[port].naval[c];
            if (st === undefined) {
                continue;
            }
            while (left > 0 && st[kind] > 0) {
                st[kind] -= 1;
                left -= 1;
            }
            cleanupNaval(G, port, c);
            if (left === 0) {
                return;
            }
        }
    }
};

export const removeSeaNavalLosses = (G: VQGame, zone: SeaZoneID, owners: Controller[], hitsCount: number): void => {
    let left = hitsCount;
    for (const kind of ["galleon", "racebuilt", "corsair", "galley"] as const) {
        for (const c of owners) {
            const st = G.seaZones[zone].naval[c];
            if (st === undefined) {
                continue;
            }
            while (left > 0 && st[kind] > 0) {
                st[kind] -= 1;
                left -= 1;
            }
            if (st.galley + st.galleon + st.racebuilt + st.corsair === 0) {
                delete G.seaZones[zone].naval[c];
            }
            if (left === 0) {
                return;
            }
        }
    }
};

export const leadersAt = (G: VQGame, loc: string): string[] => {
    if (G.spaces[loc] !== undefined) {
        return G.spaces[loc].leaders;
    }
    const sea = G.seaZones[loc as SeaZoneID];
    return sea !== undefined ? sea.leaders : [];
};

export const leaderDef = (id: string): LeaderDef => LEADER_BY_ID[id];

export const bestBattle = (G: VQGame, loc: string, owners: Controller[], kind: "army" | "naval" = "army"): number => {
    let best = 0;
    for (const id of leadersAt(G, loc)) {
        const def = LEADER_BY_ID[id];
        if (def === undefined || def.kind !== kind) {
            continue;
        }
        if (owners.includes(def.power)) {
            best = Math.max(best, def.battle);
        }
    }
    return best;
};

export const bestPiracy = (G: VQGame, loc: string, owners: Controller[]): number => {
    let best = 0;
    for (const id of leadersAt(G, loc)) {
        const def = LEADER_BY_ID[id];
        if (def !== undefined && def.power !== undefined && owners.includes(def.power)) {
            best = Math.max(best, def.piracy ?? 0);
        }
    }
    return best;
};

export const moveLeaders = (G: VQGame, from: string, to: string, ids: string[]): void => {
    for (const id of ids) {
        const def = LEADER_BY_ID[id];
        if (def === undefined) {
            continue;
        }
        if (G.spaces[from] !== undefined) {
            G.spaces[from].leaders = G.spaces[from].leaders.filter((x) => x !== id);
        } else if (G.seaZones[from as SeaZoneID] !== undefined) {
            G.seaZones[from as SeaZoneID].leaders = G.seaZones[from as SeaZoneID].leaders.filter((x) => x !== id);
        }
        if (G.spaces[to] !== undefined) {
            G.spaces[to].leaders.push(id);
        } else if (G.seaZones[to as SeaZoneID] !== undefined) {
            G.seaZones[to as SeaZoneID].leaders.push(id);
        }
        G.leaders[id].location = to;
    }
};

export const captureLeaders = (G: VQGame, loc: string, owners: Controller[], captor: Power): number => {
    let n = 0;
    for (const id of [...leadersAt(G, loc)]) {
        const def = LEADER_BY_ID[id];
        if (def === undefined || !owners.includes(def.power)) {
            continue;
        }
        if (G.spaces[loc] !== undefined) {
            G.spaces[loc].leaders = G.spaces[loc].leaders.filter((x) => x !== id);
        } else if (G.seaZones[loc as SeaZoneID] !== undefined) {
            G.seaZones[loc as SeaZoneID].leaders = G.seaZones[loc as SeaZoneID].leaders.filter((x) => x !== id);
        }
        G.leaders[id] = {id, location: "captured", capturedBy: captor};
        n += 1;
    }
    if (n > 0) {
        pushLog(G, `${n} leader(s) captured by ${powerLabel(captor)}.`);
    }
    return n;
};

// --------------------------------------------------------------------------
// Geography
// --------------------------------------------------------------------------

export const isLandSpace = (id: string): boolean => SPACE_BY_ID[id] !== undefined;
export const isSeaZone = (id: string): boolean => SEA_ZONE_BY_ID[id] !== undefined;

export const landNeighbors = (id: string): { id: string; pass: boolean }[] =>
    LAND_NEIGHBORS[id] ?? [];

export const landAdjacent = (a: string, b: string): boolean =>
    landNeighbors(a).some((n) => n.id === b);

export const passBetween = (a: string, b: string): boolean =>
    landNeighbors(a).some((n) => n.id === b && n.pass);

/** Shortest land-only path length, or undefined when disconnected. */
export const landDistance = (from: string, to: string): number | undefined => {
    if (from === to) return 0;
    const seen = new Set([from]);
    const queue: {id: string; distance: number}[] = [{id: from, distance: 0}];
    while (queue.length > 0) {
        const current = queue.shift() as {id: string; distance: number};
        for (const next of landNeighbors(current.id)) {
            if (seen.has(next.id)) continue;
            if (next.id === to) return current.distance + 1;
            seen.add(next.id);
            queue.push({id: next.id, distance: current.distance + 1});
        }
    }
    return undefined;
};

/** All land spaces within `distance` steps of `from`, including `from`. */
export const landWithin = (from: string, distance: number): string[] => {
    const seen = new Set([from]);
    let frontier = [from];
    for (let step = 0; step < distance; step++) {
        const next: string[] = [];
        for (const id of frontier) {
            for (const neighbor of landNeighbors(id)) {
                if (seen.has(neighbor.id)) continue;
                seen.add(neighbor.id);
                next.push(neighbor.id);
            }
        }
        frontier = next;
    }
    return [...seen];
};

export const seaAdjacent = (a: SeaZoneID, b: SeaZoneID): boolean =>
    SEA_ZONE_BY_ID[a].adjacent.includes(b);

export const portZones = (space: string): SeaZoneID[] => SPACE_BY_ID[space]?.ports ?? [];

export const isPort = (space: string): boolean => portZones(space).length > 0;
/** True when a path of sea zones (without intermediate ports) connects two ports. */
export const seaPathBetweenPorts = (fromPort: string, toPort: string): boolean => {
    const starts = portZones(fromPort);
    const goals = new Set(portZones(toPort));
    if (starts.some((zone) => goals.has(zone))) return true;
    const visited = new Set(starts);
    const queue = [...starts];
    while (queue.length > 0) {
        const zone = queue.shift()!;
        for (const next of SEA_ZONE_BY_ID[zone].adjacent) {
            if (goals.has(next)) return true;
            if (visited.has(next)) continue;
            visited.add(next);
            queue.push(next);
        }
    }
    return false;
};

/** Rule 15.1: the attacker needs more non-corsair naval units than the port's defenders. */
export const navalBlockadeSatisfied = (G: VQGame, p: Power, space: string): boolean => {
    const state = G.spaces[space];
    if (state === undefined) return true;
    const defenders = ownersWithNaval(G, space)
        .filter((owner) => !friendlyController(G, p, owner))
        .reduce((total, owner) => {
            const stack = state.naval[owner];
            return total + (stack ? stack.galley + stack.galleon + stack.racebuilt : 0);
        }, 0);
    if (defenders === 0) return true;
    let attackers = 0;
    for (const zone of portZones(space)) {
        const stack = G.seaZones[zone].naval[p];
        if (stack !== undefined) attackers += stack.galley + stack.galleon + stack.racebuilt;
        if (G.armada?.location === zone) attackers += Math.floor(G.armada.strength / 2);
    }
    return attackers > defenders;
};


export const zonePorts = (zone: SeaZoneID): string[] => SEA_PORTS[zone] ?? [];

export const navalAdjacent = (a: string, b: string): boolean => {
    const aZone = isSeaZone(a);
    const bZone = isSeaZone(b);
    if (aZone && bZone) {
        return seaAdjacent(a as SeaZoneID, b as SeaZoneID);
    }
    if (!aZone && bZone) {
        return portZones(a).includes(b as SeaZoneID);
    }
    if (aZone && !bZone) {
        return portZones(b).includes(a as SeaZoneID);
    }
    return false;
};

export const isFortifiedSpace = (G: VQGame, id: string): boolean => {
    if (G.scenario === "tutorial") return TUTORIAL_KEYS.includes(id) || TUTORIAL_FORTRESSES.includes(id);
    const def = SPACE_BY_ID[id];
    if (def === undefined) {
        return false;
    }
    return def.kind !== "open" || G.spaces[id].fortress;
};

export const capitalOf = (G: VQGame, p: Power): string | undefined => {
    const controlledCap = CAPITAL_SPACES[p].find((id) => {
        const c = G.spaces[id].control;
        return c === p || (isPower(c) && allied(G, p, c));
    });
    if (controlledCap !== undefined) {
        return controlledCap;
    }
    return KEY_SPACES.find((id) => G.spaces[id].control === p);
};

/** Bring leaders waiting in the pool onto the map (Spring Deployment, 10.4). */
const isDefaultLeader = (id: string): boolean => id.startsWith("default-");

export const removeDefaultLeader = (G: VQGame, p: Power): void => {
    const def = DEFAULT_LEADER_BY_POWER[p];
    if (def === undefined) return;
    const state = G.leaders[def.id];
    if (state === undefined) return;
    if (G.spaces[state.location] !== undefined) {
        G.spaces[state.location].leaders = G.spaces[state.location].leaders.filter((id) => id !== def.id);
    } else if (G.seaZones[state.location as SeaZoneID] !== undefined) {
        G.seaZones[state.location as SeaZoneID].leaders = G.seaZones[state.location as SeaZoneID].leaders.filter((id) => id !== def.id);
    }
    delete G.leaders[def.id];
    pushLog(G, `${def.name} leaves play because a standard army leader arrived.`);
};

/** Rule 5.1: add a default army leader after the last standard army leader is removed. */
export const ensureDefaultLeader = (G: VQGame, p: Power): void => {
    const def = DEFAULT_LEADER_BY_POWER[p];
    if (def === undefined || G.leaders[def.id] !== undefined) return;
    const standardInPlay = Object.keys(G.leaders).some((id) => {
        const leader = LEADER_BY_ID[id];
        const state = G.leaders[id];
        return id !== def.id && leader?.power === p && leader.kind === "army" &&
            state.location !== "pool" && state.location !== "offMap";
    });
    if (standardInPlay) return;
    G.leaders[def.id] = {id: def.id, location: "pool", returnTurn: G.year + 1};
    pushLog(G, `${powerLabel(p)} places a Default Leader on the Turn Track.`);
};

export const arriveLeaders = (G: VQGame): void => {
    for (const p of POWERS) {
        if (ownerOf(G, p) === undefined) continue;
        const cap = capitalOf(G, p);
        const ids = Object.keys(G.leaders);
        for (const id of ids) {
            const def = LEADER_BY_ID[id];
            const st = G.leaders[id];
            if (def === undefined || def.power !== p || isDefaultLeader(id) || st.location !== "pool" ||
                (st.returnTurn ?? 0) > G.year) continue;
            if (cap === undefined || G.spaces[cap] === undefined || !friendlyControlled(G, p, cap) || G.spaces[cap].unrest) continue;
            G.spaces[cap].leaders.push(id);
            G.leaders[id] = {id, location: cap};
            pushLog(G, `${def.name} arrives in ${SPACE_BY_ID[cap].name}.`);
        }
        const standardInPlay = Object.keys(G.leaders).some((id) => {
            const leader = LEADER_BY_ID[id];
            const state = G.leaders[id];
            return leader?.power === p && leader.kind === "army" && !isDefaultLeader(id) &&
                state.location !== "pool" && state.location !== "offMap";
        });
        if (standardInPlay) {
            removeDefaultLeader(G, p);
            continue;
        }
        const defaultDef = DEFAULT_LEADER_BY_POWER[p];
        const defaultState = defaultDef === undefined ? undefined : G.leaders[defaultDef.id];
        if (defaultDef !== undefined && defaultState !== undefined && defaultState.location === "pool" &&
            (defaultState.returnTurn ?? 0) <= G.year &&
            cap !== undefined && G.spaces[cap] !== undefined && friendlyControlled(G, p, cap) && !G.spaces[cap].unrest) {
            G.spaces[cap].leaders.push(defaultDef.id);
            G.leaders[defaultDef.id] = {id: defaultDef.id, location: cap};
            pushLog(G, `${defaultDef.name} arrives in ${SPACE_BY_ID[cap].name}.`);
        }
    }
};

export const isHomeSpace = (id: string, p: Power): boolean =>
    SPACE_BY_ID[id]?.home === p;

export const nearestFriendlyFortified = (G: VQGame, p: Power, from: string): string | undefined => {
    const queue = [from];
    const seen = new Set([from]);
    while (queue.length > 0) {
        const cur = queue.shift() as string;
        if (cur !== from && friendlyControlled(G, p, cur) && isFortifiedSpace(G, cur) && !G.spaces[cur].unrest && !spaceHasEnemyLand(G, p, cur)) {
            return cur;
        }
        for (const n of landNeighbors(cur)) {
            if (seen.has(n.id)) {
                continue;
            }
            const ns = G.spaces[n.id];
            if (!friendlyControlled(G, p, n.id) || ns.unrest || spaceHasEnemyLand(G, p, n.id)) {
                continue;
            }
            seen.add(n.id);
            queue.push(n.id);
        }
    }
    return undefined;
};

export const nearestFriendlyPort = (G: VQGame, p: Power, fromZone: SeaZoneID): string | undefined => {
    for (const port of zonePorts(fromZone)) {
        if (friendlyControlled(G, p, port) && !G.spaces[port].unrest) {
            return port;
        }
    }
    return undefined;
};

/**
 * Line of communication (rules 12.1), simplified to land paths plus one sea
 * hop through a sea zone containing friendly naval units.
 */
export const hasLOC = (G: VQGame, p: Power, target: string): boolean => {
    if (G.scenario === "tutorial") {
        if (!tutorialSpaceAllowed(target)) return false;
        const starts = SPACES.filter((space) => tutorialSpaceAllowed(space.id) && isFortifiedSpace(G, space.id) &&
            friendlyController(G, p, space.home) && friendlyControlled(G, p, space.id) && !G.spaces[space.id].unrest).map((space) => space.id);
        const queue = [...starts];
        const visited = new Set(queue);
        while (queue.length) {
            const current = queue.shift()!;
            if (current === target) return true;
            const neighbors = isSeaZone(current) ? [...SEA_ZONE_BY_ID[current].adjacent, ...zonePorts(current as SeaZoneID)] :
                [...landNeighbors(current).map((neighbor) => neighbor.id), ...portZones(current)];
            for (const next of neighbors) {
                if (visited.has(next)) continue;
                if (next === target) return true;
                if (isSeaZone(next)) {
                    if (!ownersWithNaval(G, next).some((owner) => friendlyController(G, p, owner)) ||
                        ownersWithNaval(G, next).some((owner) => !friendlyController(G, p, owner))) continue;
                } else if (!tutorialSpaceAllowed(next) || !friendlyControlled(G, p, next) || G.spaces[next].unrest ||
                    spaceHasEnemyLand(G, p, next) || spaceHasEnemyNaval(G, p, next)) continue;
                visited.add(next);
                queue.push(next);
            }
        }
        return false;
    }
    if (SPACE_BY_ID[target] === undefined) {
        return false;
    }
    const starts: string[] = [];
    for (const def of SPACES) {
        if (friendlyControlled(G, p, def.id) && isFortifiedSpace(G, def.id) && !G.spaces[def.id].unrest) {
            starts.push(def.id);
        }
    }
    const passable = (id: string): boolean =>
        friendlyControlled(G, p, id) && !G.spaces[id].unrest && !spaceHasEnemyLand(G, p, id);
    const queue = starts.slice();
    const seen = new Set<string>(starts);
    while (queue.length > 0) {
        const cur = queue.shift() as string;
        if (cur === target) {
            return true;
        }
        for (const n of landNeighbors(cur)) {
            if (seen.has(n.id)) {
                continue;
            }
            if (n.id === target) {
                return true;
            }
            if (passable(n.id)) {
                seen.add(n.id);
                queue.push(n.id);
            }
        }
    }
    // A single sea hop from a friendly port to the target port.
    const zones = portZones(target);
    for (const z of zones) {
        const friendlyShips = ownersWithNavalInZone(G, z).some((c) => isPower(c) && friendly(G, p, c) && navalCount(G.seaZones[z].naval[c]) > 0);
        if (!friendlyShips) {
            continue;
        }
        for (const port of zonePorts(z)) {
            if (port !== target && passable(port)) {
                return true;
            }
        }
    }
    return false;
};

export const ownersWithNavalInZone = (G: VQGame, zone: SeaZoneID): Controller[] =>
    Object.keys(G.seaZones[zone].naval) as Controller[];

export const canControlSpace = (G: VQGame, p: Power, space: string): { ok: boolean; reason?: string } => {
    const s = G.spaces[space];
    const def = SPACE_BY_ID[space];
    if (s === undefined || def === undefined) {
        return {ok: false, reason: "unknown space"};
    }
    if (isFortifiedSpace(G, space)) {
        return {ok: false, reason: "fortified spaces need a siege"};
    }
    if (s.control === p) {
        return {ok: false, reason: "already controlled"};
    }
    if (spaceHasEnemyLand(G, p, space)) {
        return {ok: false, reason: "enemy units present"};
    }
    if (!hasLOC(G, p, space)) {
        return {ok: false, reason: "no line of communication"};
    }
    const friendlyPresent = ownersWithLand(G, space).some((c) => isPower(c) && friendly(G, p, c) && landCount(G.spaces[space].land[c]) > 0);
    if (friendlyPresent) {
        return {ok: true};
    }
    const adjacentFriendly = landNeighbors(space).some((n) => !n.pass && ownersWithLand(G, n.id).some((c) => isPower(c) && friendly(G, p, c) && landCount(G.spaces[n.id].land[c]) > 0));
    if (!adjacentFriendly) {
        return {ok: false, reason: "no friendly units in or adjacent to the space"};
    }
    const enemyAdjacent = landNeighbors(space).some((n) => !n.pass && spaceHasEnemyLand(G, p, n.id));
    if (enemyAdjacent) {
        return {ok: false, reason: "enemy units adjacent"};
    }
    return {ok: true};
};

// --------------------------------------------------------------------------
// Religion
// --------------------------------------------------------------------------

const PROTESTANT_POWERS: Controller[] = ["england", "protestant", "scotland"];
const CATHOLIC_POWERS: Controller[] = ["spain", "france", "papacy", "portugal", "venice", "ireland"];

export const unitReligion = (c: Controller): Religion | "unaligned" => {
    if (PROTESTANT_POWERS.includes(c)) {
        return "protestant";
    }
    if (CATHOLIC_POWERS.includes(c)) {
        return "catholic";
    }
    return "unaligned";
};

const spaceHasReligionUnits = (G: VQGame, space: string, religion: Religion): boolean => {
    const s = G.spaces[space];
    if (religion === "catholic" && G.espionage?.jesuits.includes(space)) return true;
    for (const c of Object.keys(s.land) as Controller[]) {
        if (unitReligion(c) === religion && (s.land[c]?.regular ?? 0) > 0) {
            return true;
        }
    }
    for (const c of Object.keys(s.naval) as Controller[]) {
        if (unitReligion(c) === religion && navalCount(s.naval[c]) > 0) {
            return true;
        }
    }
    return false;
};

export const religionCandidates = (G: VQGame, side: Religion, area: ReligionArea): string[] => {
    const other: Religion = side === "protestant" ? "catholic" : "protestant";
    const inArea = SPACES.filter((s) => s.area === area);
    const remainingOther = inArea.filter((s) => G.spaces[s.id].religion === other).length;
    if (remainingOther <= 1) {
        return [];
    }
    return inArea.filter((s) => {
        const st = G.spaces[s.id];
        if (st.religion !== other || st.unrest) {
            return false;
        }
        // Adjacent (or port-connected) space already of the target religion.
        const adjacent = landNeighbors(s.id).some((n) => G.spaces[n.id].religion === side && !G.spaces[n.id].unrest)
            || (s.ports ?? []).some((z) => zonePorts(z).some((port) => port !== s.id && G.spaces[port].religion === side && !G.spaces[port].unrest));
        if (!adjacent) {
            return false;
        }
        return true;
    }).map((s) => s.id);
};

const pickCandidate = (G: VQGame, ctx: Ctx, side: Religion, area: ReligionArea, allowUnits: boolean): string | undefined => {
    let candidates = religionCandidates(G, side, area);
    if (!allowUnits) {
        candidates = candidates.filter((id) => !spaceHasReligionUnits(G, id, side === "protestant" ? "catholic" : "protestant"));
    }
    if (candidates.length === 0) {
        return undefined;
    }
    // Prefer keys, then randomly among the best.
    const keys = candidates.filter((id) => SPACE_BY_ID[id].kind === "key");
    const pool = keys.length > 0 ? keys : candidates;
    const shuffled = shuffle(ctx, pool.slice());
    return shuffled[0];
};

/**
 * Resolve a batch of conversion attempts (rules 18.5), auto-allocating the
 * dice. Returns a short report for the log.
 */
export const resolveConversions = (
    G: VQGame,
    ctx: Ctx,
    p: Power,
    side: Religion,
    area: ReligionArea,
    attempts: number,
    autoSix = false,
    extraUnrest = 0,
    rollOptions: {fivesAsSix?: boolean; threesAsFour?: boolean} = {},
): string => {
    const dice: number[] = [];
    for (let i = 0; i < attempts; i++) {
        dice.push(i === 0 && autoSix ? 6 : die(ctx, 6));
    }
    const adjusted = dice.map((d) => rollOptions.fivesAsSix && d === 5 ? 6 :
        rollOptions.threesAsFour && d === 3 ? 4 : d);
    const ones = adjusted.filter((d) => d === 1).length;
    const minor = adjusted.filter((d) => d === 4 || d === 5).length;
    const major = adjusted.filter((d) => d === 6).length;
    const converted: string[] = [];
    for (let i = 0; i < major; i++) {
        const target = pickCandidate(G, ctx, side, area, true);
        if (target === undefined) {
            break;
        }
        G.spaces[target].religion = side;
        converted.push(target);
    }
    for (let i = 0; i < minor; i++) {
        const target = pickCandidate(G, ctx, side, area, false);
        if (target === undefined) {
            break;
        }
        G.spaces[target].religion = side;
        converted.push(target);
    }
    const unrestTokens = Math.min(ones + extraUnrest, converted.length > 0 ? converted.length : 0);
    for (let i = 0; i < unrestTokens; i++) {
        const target = converted[i % converted.length];
        if (target !== undefined) {
            G.spaces[target].unrest = true;
        }
    }
    G.lastRolls = `${side} conversions in ${AREA_NAMES[area].en}: [${dice.join(", ")}]`;
    pushLog(G, `${powerLabel(p)}: ${G.lastRolls}`);
    if (converted.length > 0) {
        pushLog(G, `Converted: ${converted.map((id) => SPACE_BY_ID[id].name).join(", ")}${unrestTokens > 0 ? `; unrest in ${unrestTokens} space(s)` : ""}.`);
    } else {
        pushLog(G, "No conversions possible.");
    }
    return G.lastRolls;
};

// --------------------------------------------------------------------------
// Battles and sieges
// --------------------------------------------------------------------------

const retreatDestination = (G: VQGame, p: Power, from: string, avoid: string[]): string | undefined => {
    const options = landNeighbors(from)
        .map((n) => n.id)
        .filter((id) => !avoid.includes(id))
        .filter((id) => !G.spaces[id].unrest)
        .filter((id) => !spaceHasEnemyLand(G, p, id))
        .filter((id) => friendlyControlled(G, p, id) || G.spaces[id].control === "independent");
    if (options.length === 0) {
        return undefined;
    }
    // Prefer fortified friendly spaces.
    options.sort((a, b) => Number(isFortifiedSpace(G, b)) - Number(isFortifiedSpace(G, a)));
    return options[0];
};

export const retreatLand = (G: VQGame, p: Power, from: string, owners: Controller[], leaders: string[], captor: Power, avoid: string[] = []): boolean => {
    const dest = retreatDestination(G, p, from, avoid);
    if (dest === undefined) {
        for (const c of owners) {
            delete G.spaces[from].land[c];
        }
        captureLeaders(G, from, owners, captor);
        pushLog(G, `${powerLabel(p)} has no retreat; its force is destroyed.`);
        return false;
    }
    for (const c of owners) {
        const st = G.spaces[from].land[c];
        if (st === undefined) {
            continue;
        }
        const tgt = ensureLand(G, dest, c);
        tgt.regular += st.regular;
        tgt.merc += st.merc;
        tgt.cav += st.cav;
        delete G.spaces[from].land[c];
    }
    moveLeaders(G, from, dest, leaders);
    pushLog(G, `${powerLabel(p)} retreats to ${SPACE_BY_ID[dest].name}.`);
    return true;
};

export interface BattleResult {
    attackerHits: number;
    defenderHits: number;
    attackerDice: number;
    defenderDice: number;
    winner: "attacker" | "defender";
}

export const fieldBattle = (
    G: VQGame,
    ctx: Ctx,
    space: string,
    attacker: Power,
    defenderOwners: Controller[],
    from: string,
    /** Rule 16.3.4: transported units are eliminated, not retreated, if the battle is lost. */
    transported = false,
): BattleResult => {
    const attackerUnits = totalLand(G, space, [attacker]);
    const defenderUnits = totalLand(G, space, defenderOwners);
    const aDice = attackerUnits + bestBattle(G, space, [attacker], "army");
    const dDice = defenderUnits + bestBattle(G, space, defenderOwners, "army") + 1;
    const aRolls = roll(ctx, aDice);
    const dRolls = roll(ctx, dDice);
    const aHits = hits(aRolls);
    const dHits = hits(dRolls);
    G.lastRolls = `Field battle: ${powerLabel(attacker)} ${aHits} hits (${aDice} dice) vs ${defenderUnits} defenders ${dHits} hits (${dDice} dice)`;
    pushLog(G, G.lastRolls);
    removeLandLosses(G, space, defenderOwners, aHits);
    removeLandLosses(G, space, [attacker], dHits);
    const winner: "attacker" | "defender" = aHits > dHits ? "attacker" : "defender";
    const defenderLeaders = leadersAt(G, space).filter((id) => {
        const def = LEADER_BY_ID[id];
        return def !== undefined && defenderOwners.includes(def.power);
    });
    const attackerLeaders = leadersAt(G, space).filter((id) => LEADER_BY_ID[id]?.power === attacker);

    if (winner === "attacker") {
        const defendersLeft = totalLand(G, space, defenderOwners);
        const attackerLeft = totalLand(G, space, [attacker]);
        if (defendersLeft === 0) {
            captureLeaders(G, space, defenderOwners, attacker);
        } else if (isFortifiedSpace(G, space)) {
            const inside = Math.min(4, defendersLeft);
            pushLog(G, `${inside} defender(s) withdraw into the fortifications.`);
        } else {
            const defenderMajor = defenderOwners.find((c) => isPower(c)) as Power | undefined;
            if (defenderMajor !== undefined) {
                retreatLand(G, defenderMajor, space, defenderOwners, defenderLeaders, attacker, [from]);
            } else {
                // Independent / minor units do not retreat.
                for (const c of defenderOwners) {
                    delete G.spaces[space].land[c];
                }
                pushLog(G, "The independent garrison is destroyed.");
            }
        }
        const defendersAfter = totalLand(G, space, defenderOwners);
        if (isFortifiedSpace(G, space) && attackerLeft > defendersAfter) {
            G.spaces[space].siege = {by: attacker, sinceImpulse: G.impulse};
            pushLog(G, `${SPACE_BY_ID[space].name} is under siege.`);
        } else if (isFortifiedSpace(G, space) && attackerLeft > 0 && defendersAfter > 0 && G.spaces[from] !== undefined) {
            // Not enough troops to besiege: the formation withdraws.
            const st = G.spaces[space].land[attacker];
            if (st !== undefined) {
                const tgt = ensureLand(G, from, attacker);
                tgt.regular += st.regular;
                tgt.merc += st.merc;
                tgt.cav += st.cav;
                delete G.spaces[space].land[attacker];
            }
            moveLeaders(G, space, from, attackerLeaders);
            pushLog(G, `${powerLabel(attacker)} cannot besiege ${SPACE_BY_ID[space].name} and withdraws.`);
        }
    } else {
        // Attacker loses. Survivors return to the space they came from.
        const attackerLeft = totalLand(G, space, [attacker]);
        if (transported) {
            // Rule 16.3.4: a lost field battle at the end of a naval
            // transport eliminates the transported units; leaders are captured.
            const st = G.spaces[space].land[attacker];
            const count = landCount(st);
            if (st !== undefined) delete G.spaces[space].land[attacker];
            captureLeaders(G, space, [attacker], defenderOwners.find((c) => isPower(c)) as Power ?? attacker);
            pushLog(G, `${powerLabel(attacker)} loses the battle at the end of a naval transport; ${count} transported unit(s) are eliminated.`);
        } else if (attackerLeft === 0) {
            captureLeaders(G, space, [attacker], defenderOwners.find((c) => isPower(c)) as Power ?? attacker);
        } else if (G.spaces[from] !== undefined) {
            const st = G.spaces[space].land[attacker];
            if (st !== undefined) {
                const tgt = ensureLand(G, from, attacker);
                tgt.regular += st.regular;
                tgt.merc += st.merc;
                tgt.cav += st.cav;
                delete G.spaces[space].land[attacker];
            }
            moveLeaders(G, space, from, attackerLeaders);
            pushLog(G, `${powerLabel(attacker)} retreats to ${SPACE_BY_ID[from].name}.`);
        }
    }
    return {attackerHits: aHits, defenderHits: dHits, attackerDice: aDice, defenderDice: dDice, winner};
};

export interface ReliefResult {
    attackerHits: number;
    defenderHits: number;
    attackerDice: number;
    defenderDice: number;
    winner: "attacker" | "defender";
}

/** Move up to `count` units of one power from `from` to `to` (mercenaries first). */
const transferLandUnits = (G: VQGame, from: string, to: string, p: Power, count: number): number => {
    const stack = G.spaces[from].land[p];
    if (stack === undefined || count <= 0) return 0;
    const taken = emptyLand();
    let left = count;
    for (const kind of ["merc", "cav", "regular"] as const) {
        const n = Math.min(left, stack[kind]);
        stack[kind] -= n;
        taken[kind] = n;
        left -= n;
        if (left === 0) break;
    }
    const moved = count - left;
    if (moved > 0) {
        const target = ensureLand(G, to, p);
        target.regular += taken.regular;
        target.merc += taken.merc;
        target.cav += taken.cav;
    }
    cleanupLand(G, from, p);
    return moved;
};

/**
 * Field battle fought by a relief force entering a besieged fortification
 * (rule 15.2).  All friendly units inside the fortification participate; on a
 * loss, up to 4 units remain inside and the rest fall back to the relief
 * force's origin.  The player choices (withholding units, which losses, which
 * units retreat inside) are resolved automatically for now.
 */
export const reliefBattle = (
    G: VQGame,
    ctx: Ctx,
    space: string,
    p: Power,
    from: string,
    reliefStack: LandStack,
    reliefLeaders: string[],
    pUnitsInside: number,
): ReliefResult => {
    const siege = G.spaces[space].siege;
    if (siege === undefined) {
        return {attackerHits: 0, defenderHits: 0, attackerDice: 0, defenderDice: 0, winner: "defender"};
    }
    const besieger = siege.by;
    const attackers = ownersWithLand(G, space).filter((c) => friendlyController(G, p, c));
    const defenders = ownersWithLand(G, space).filter((c) => !friendlyController(G, p, c));
    const attackerUnits = totalLand(G, space, attackers);
    const defenderUnits = totalLand(G, space, defenders);
    const aDice = attackerUnits + bestBattle(G, space, attackers, "army");
    const dDice = defenderUnits + bestBattle(G, space, defenders, "army") + 1;
    const aHits = hits(roll(ctx, aDice));
    const dHits = hits(roll(ctx, dDice));
    pushLog(G, `${powerLabel(p)} brings ${landCount(reliefStack)} relief unit(s) into ${SPACE_BY_ID[space].name}.`);
    G.lastRolls = `Relief battle at ${SPACE_BY_ID[space].name}: ${powerLabel(p)} ${aHits} hits (${aDice} dice) vs besiegers ${dHits} hits (${dDice} dice)`;
    pushLog(G, G.lastRolls);
    removeLandLosses(G, space, defenders, aHits);
    // Attacker losses come from the relief force first, then from allies inside.
    const pBefore = totalLand(G, space, [p]);
    removeLandLosses(G, space, [p], dHits);
    const pRemoved = pBefore - totalLand(G, space, [p]);
    const otherAttackers = attackers.filter((c) => c !== p);
    if (dHits > pRemoved) removeLandLosses(G, space, otherAttackers, dHits - pRemoved);
    const winner: "attacker" | "defender" = aHits > dHits ? "attacker" : "defender";
    const besiegerLeaders = leadersAt(G, space).filter((id) => LEADER_BY_ID[id]?.power === besieger);
    if (winner === "attacker") {
        const defendersLeft = totalLand(G, space, defenders);
        if (defendersLeft === 0) {
            captureLeaders(G, space, defenders, p);
        } else {
            retreatLand(G, besieger, space, defenders, besiegerLeaders, p, [from]);
        }
        delete G.spaces[space].siege;
        pushLog(G, `${powerLabel(p)} wins the relief battle; the siege of ${SPACE_BY_ID[space].name} is broken.`);
        return {attackerHits: aHits, defenderHits: dHits, attackerDice: aDice, defenderDice: dDice, winner};
    }
    // The relief force loses.  Units that were already inside may retreat back
    // inside (at most 4); the relief force falls back to where it came from.
    const pUnits = totalLand(G, space, [p]);
    // Equal hits: any participating unit may retreat inside (max 4).  A
    // decisive loss: only units that started the impulse inside may stay.
    const keepLimit = Math.min(4, aHits === dHits ? pUnits : pUnitsInside);
    const movedOut = pUnits > 0 ? transferLandUnits(G, space, from, p, Math.max(0, pUnits - keepLimit)) : 0;
    if (totalLand(G, space, [p]) === 0) {
        captureLeaders(G, space, [p], besieger);
    } else if (movedOut > 0) {
        const retreating = reliefLeaders.filter((id) => G.spaces[space].leaders.includes(id));
        if (retreating.length > 0) moveLeaders(G, space, from, retreating);
    }
    const insideAfter = ownersWithLand(G, space).filter((c) => c !== besieger);
    const besiegersLeft = totalLand(G, space, [besieger]);
    const defendersLeft = totalLand(G, space, insideAfter);
    if (besiegersLeft === 0) {
        if (besiegerLeaders.length > 0) captureLeaders(G, space, [besieger], p);
        delete G.spaces[space].siege;
    } else if (besiegersLeft <= defendersLeft) {
        retreatLand(G, besieger, space, [besieger], besiegerLeaders, p, [from]);
        delete G.spaces[space].siege;
        pushLog(G, `The siege of ${SPACE_BY_ID[space].name} is broken.`);
    }
    pushLog(G, `${powerLabel(p)} loses the relief battle at ${SPACE_BY_ID[space].name}${movedOut > 0 ? ` and falls back to ${SPACE_BY_ID[from].name}` : ""}.`);
    return {attackerHits: aHits, defenderHits: dHits, attackerDice: aDice, defenderDice: dDice, winner};
};

/**
 * Automatic land avoid-battle attempts (13.3).  Each defending major power
 * attempts to move its whole stack to the first legal adjacent space; the
 * player choices are resolved automatically.
 */
export const attemptLandAvoidBattle = (
    G: VQGame,
    ctx: Ctx,
    active: Power,
    space: string,
    from: string,
): boolean => {
    if (G.scenario === "tutorial" || G.spaces[space].siege !== undefined) return false;
    let moved = false;
    const defenders = ownersWithLand(G, space)
        .filter((owner): owner is Power => isPower(owner) && !friendlyController(G, active, owner));
    for (const owner of defenders) {
        const stack = G.spaces[space].land[owner];
        if (stack === undefined || landCount(stack) === 0) continue;
        const destinations = landNeighbors(space)
            .filter((neighbor) => !neighbor.pass && neighbor.id !== from)
            .map((neighbor) => neighbor.id)
            .filter((id) => {
                const state = G.spaces[id];
                if (state === undefined || state.unrest) return false;
                if (state.control !== owner && !(isPower(state.control) && friendlyController(G, owner, state.control))) return false;
                return ownersWithLand(G, id).every((other) => friendlyController(G, owner, other));
            });
        if (destinations.length === 0) continue;
        const leaders = G.spaces[space].leaders.filter((id) =>
            LEADER_BY_ID[id]?.power === owner && LEADER_BY_ID[id]?.kind === "army");
        const ottomanCavalry = owner === "ottoman" && stack.cav > 0 ? 1 : 0;
        const enemyCavalry = owner !== "ottoman" && (G.spaces[space].land.ottoman?.cav ?? 0) > 0 ? -1 : 0;
        const telescope = G.powers[owner].scienceBonuses.includes("telescope") ? 1 : 0;
        const modifier = bestBattle(G, space, [owner], "army") + ottomanCavalry + enemyCavalry + telescope;
        const dice = roll(ctx, 2);
        const total = dice[0] + dice[1] + modifier;
        pushLog(G, `${powerLabel(owner)} avoid-battle at ${SPACE_BY_ID[space].name}: [${dice.join(",")}] + ${modifier} = ${total}.`);
        if (total < 9) continue;
        const destination = destinations[0];
        const target = ensureLand(G, destination, owner);
        target.regular += stack.regular;
        target.merc += stack.merc;
        target.cav += stack.cav;
        delete G.spaces[space].land[owner];
        moveLeaders(G, space, destination, leaders);
        pushLog(G, `${powerLabel(owner)} avoids battle and moves to ${SPACE_BY_ID[destination].name}.`);
        moved = true;
    }
    return moved;
};

/**
 * Automatic land interception (rule 13.2): an enemy stack adjacent to the
 * destination may attempt to intercept.  Formations are selected
 * automatically (up to the best leaders' command capacity); every eligible
 * stack may roll once, and the first success joins the destination.
 */
export const attemptLandInterception = (
    G: VQGame,
    ctx: Ctx,
    active: Power,
    from: string,
    to: string,
): boolean => {
    if (G.scenario === "tutorial" || G.spaces[to].siege !== undefined || friendlyControlled(G, active, to)) return false;
    const destinationOwners = ownersWithLand(G, to);
    if (G.interceptedThisImpulse?.impulse !== G.impulse) G.interceptedThisImpulse = {impulse: G.impulse, spaces: []};
    const used = G.interceptedThisImpulse.spaces;
    const candidates: {space: string; power: Power}[] = [];
    for (const link of landNeighbors(to)) {
        if (link.pass || link.id === from || used.includes(link.id)) continue;
        const state = G.spaces[link.id];
        if (state === undefined || state.siege !== undefined) continue;
        for (const owner of ownersWithLand(G, link.id)) {
            if (!isPower(owner) || !atWar(G, owner, active)) continue;
            if (destinationOwners.length > 0 && !destinationOwners.every((c) => friendlyController(G, owner, c))) continue;
            const control = G.spaces[to].control;
            if (isPower(control) && control !== owner && !allied(G, owner, control) && !atWar(G, owner, control)) continue;
            candidates.push({space: link.id, power: owner});
        }
    }
    candidates.sort((a, b) => POWERS.indexOf(a.power) - POWERS.indexOf(b.power) || a.space.localeCompare(b.space));
    for (const candidate of candidates) {
        const source = G.spaces[candidate.space];
        const stack = source.land[candidate.power];
        if (stack === undefined || landCount(stack) === 0) continue;
        if (!used.includes(candidate.space)) used.push(candidate.space);
        const leaders = source.leaders
            .filter((id) => LEADER_BY_ID[id]?.power === candidate.power && LEADER_BY_ID[id]?.kind === "army")
            .sort((a, b) => (LEADER_BY_ID[b].battle ?? 0) - (LEADER_BY_ID[a].battle ?? 0))
            .slice(0, 2);
        const capacity = Math.max(4, leaders.reduce((sum, id) => sum + (LEADER_BY_ID[id].command ?? 0), 0));
        const moving = emptyLand();
        let remaining = capacity;
        for (const kind of ["regular", "merc", "cav"] as const) {
            const n = Math.min(remaining, stack[kind]);
            moving[kind] = n;
            remaining -= n;
        }
        if (landCount(moving) === 0) continue;
        const ottomanCavalry = candidate.power === "ottoman" && moving.cav > 0 ? 1 : 0;
        const enemyCavalry = candidate.power !== "ottoman" && (G.spaces[to].land.ottoman?.cav ?? 0) > 0 ? -1 : 0;
        const telescope = G.powers[candidate.power].scienceBonuses.includes("telescope") ? 1 : 0;
        const modifier = bestBattle(G, candidate.space, [candidate.power], "army") + ottomanCavalry + enemyCavalry + telescope;
        const dice = roll(ctx, 2);
        const total = dice[0] + dice[1] + modifier;
        pushLog(G, `${powerLabel(candidate.power)} interception from ${SPACE_BY_ID[candidate.space].name}: [${dice.join(",")}] + ${modifier} = ${total}.`);
        if (total < 9) continue;
        const target = ensureLand(G, to, candidate.power);
        for (const kind of ["regular", "merc", "cav"] as const) {
            stack[kind] -= moving[kind];
            target[kind] += moving[kind];
        }
        cleanupLand(G, candidate.space, candidate.power);
        moveLeaders(G, candidate.space, to, leaders);
        pushLog(G, `${powerLabel(candidate.power)} intercepts the move into ${SPACE_BY_ID[to].name}.`);
        return true;
    }
    return false;
};

export const assaultSpace = (G: VQGame, ctx: Ctx, p: Power, space: string): boolean => {
    const s = G.spaces[space];
    const siege = s.siege;
    if (siege === undefined || siege.by !== p) {
        return false;
    }
    const defenders = ownersWithLand(G, space).filter((c) => c !== p && (isPower(c) ? atWar(G, p, c) : true));
    const defendersUnits = totalLand(G, space, defenders);
    const attackerUnits = totalLand(G, space, [p]);
    const aDice = (defendersUnits > 0 ? Math.ceil(attackerUnits / 2) : attackerUnits) + bestBattle(G, space, [p], "army");
    const defendingPower = defenders.find(isPower);
    const ravelin = defendingPower !== undefined && G.powers[defendingPower].scienceBonuses.includes("ravelin") ? 1 : 0;
    const dDice = defendersUnits + bestBattle(G, space, defenders, "army") + 1 + ravelin;
    const aHits = hits(roll(ctx, aDice));
    const dHits = hits(roll(ctx, dDice));
    G.lastRolls = `Assault on ${SPACE_BY_ID[space].name}: ${aHits} hits (${aDice} dice) vs ${dHits} hits (${dDice} dice)`;
    pushLog(G, G.lastRolls);
    removeLandLosses(G, space, defenders, aHits);
    removeLandLosses(G, space, [p], dHits);
    const defendersLeft = totalLand(G, space, defenders);
    const attackerLeft = totalLand(G, space, [p]);
    if (defendersLeft === 0 && aHits > 0 && attackerLeft > 0) {
        s.control = p;
        delete s.siege;
        // Naval units sheltering in a captured port are eliminated.
        for (const c of ownersWithNaval(G, space)) {
            if (c !== p) {
                delete s.naval[c];
            }
        }
        captureLeaders(G, space, defenders, p);
        pushLog(G, `${powerLabel(p)} captures ${SPACE_BY_ID[space].name}!`);
        return true;
    }
    if (attackerLeft <= defendersLeft) {
        delete s.siege;
        const leaders = leadersAt(G, space).filter((id) => LEADER_BY_ID[id].power === p);
        retreatLand(G, p, space, [p], leaders, isPower(s.control) ? s.control : p);
        pushLog(G, "The siege is broken.");
    } else {
        s.siege = {by: p, sinceImpulse: G.impulse};
    }
    return false;
};

// --------------------------------------------------------------------------
// Rebellion
// --------------------------------------------------------------------------

export const rebellionTargets = (G: VQGame): string[] =>
    SPACES.filter((def) => {
        if (def.area !== "france" && def.area !== "netherlands") {
            return false;
        }
        const s = G.spaces[def.id];
        if (s.religion !== "protestant" || s.siege !== undefined) {
            return false;
        }
        return def.area === "france" ? s.control === "france" : s.control === "spain";
    }).map((d) => d.id);

export const resolveRebellion = (G: VQGame, ctx: Ctx, p: Power, space: string, cp: number): boolean => {
    if (p !== "protestant" || cp < 2 || cp > 5) {
        return false;
    }
    const def = SPACE_BY_ID[space];
    if (def === undefined || (def.area !== "france" && def.area !== "netherlands")) {
        return false;
    }
    const s = G.spaces[space];
    const enemyPower: Power = def.area === "france" ? "france" : "spain";
    if (s.control !== enemyPower || s.religion !== "protestant") {
        return false;
    }
    if (def.area === "france" && allied(G, p, "france")) {
        return false;
    }
    const catholicOwners = ownersWithLand(G, space).filter((c) => unitReligion(c) === "catholic");
    let successful = true;
    if (catholicOwners.length > 0) {
        const diceN = cp + (def.home === "protestant" ? 1 : 0);
        const r = roll(ctx, diceN);
        const hitN = hits(r);
        G.lastRolls = `Rebellion dice: [${r.join(", ")}] = ${hitN} hit(s)`;
        pushLog(G, G.lastRolls);
        let remaining = hitN;
        for (const c of catholicOwners) {
            const st = s.land[c];
            if (st === undefined) {
                continue;
            }
            while (remaining > 0 && st.regular > 0) {
                st.regular -= 1;
                remaining -= 1;
            }
            cleanupLand(G, space, c);
        }
        if (ownersWithLand(G, space).some((c) => unitReligion(c) === "catholic" && landCount(s.land[c]) > 0)) {
            successful = false;
        }
    }
    if (!successful) {
        pushLog(G, "The rebellion fails.");
        return false;
    }
    // Displace non-Catholic units and leaders.
    for (const c of ownersWithLand(G, space)) {
        if (c !== "protestant" && unitReligion(c) !== "catholic") {
            const dest = nearestFriendlyFortified(G, isPower(c) ? c : "spain", space);
            if (dest !== undefined) {
                const st = s.land[c];
                if (st !== undefined) {
                    const tgt = ensureLand(G, dest, c);
                    tgt.regular += st.regular;
                    tgt.merc += st.merc;
                    tgt.cav += st.cav;
                    delete s.land[c];
                }
            }
        }
    }
    s.control = "protestant";
    pushLog(G, `The Protestant seizes ${def.name}.`);
    // Adjacent spaces with Protestant influence.
    let flips = cp;
    for (const n of landNeighbors(space)) {
        if (flips <= 0) {
            break;
        }
        const ns = G.spaces[n.id];
        if (SPACE_BY_ID[n.id].area === def.area && ns.religion === "protestant" && !spaceHasReligionUnits(G, n.id, "catholic")) {
            ns.control = "protestant";
            flips -= 1;
        }
    }
    addLand(G, space, "protestant", "regular", Math.floor(cp / 2));
    if (enemyPower === "france") {
        setWar(G, "protestant", "france");
    } else {
        setWar(G, "protestant", "spain");
    }
    return true;
};

// --------------------------------------------------------------------------
// Winter, marriages, victory
// --------------------------------------------------------------------------

const applyRulerDeath = (G: VQGame, id: string): void => {
    if (id === "elizabeth") {
        G.powers.england.ruler = "elizabethDead";
        G.powers.england.cards = G.powers.england.cards.filter((card) => card !== "vq-036");
        removeCardFromGame(G, "vq-036");
        if (G.espionage?.mary === "captured") {
            G.espionage.mary = "dead";
            const mary = G.royals.find((royal) => royal.id === "maryScots");
            if (mary !== undefined) {mary.alive = false; mary.status = "dead";}
            addVp(G, "england", -1);
            G.doWCostEnglandSpain = Math.max(1, G.doWCostEnglandSpain - 3);
            pushLog(G, "Mary Queen of Scots is executed after Elizabeth's death (−1 VP).");
        }
        pushLog(G, "Elizabeth I dies; England drops to 1 Admin and 0 card bonus.");
    } else if (id === "henryIII") {
        const state = G.leaders.henryIII;
        if (state !== undefined) {
            if (G.spaces[state.location] !== undefined) {
                G.spaces[state.location].leaders = G.spaces[state.location].leaders.filter((leader) => leader !== "henryIII");
            } else if (G.seaZones[state.location as SeaZoneID] !== undefined) {
                G.seaZones[state.location as SeaZoneID].leaders = G.seaZones[state.location as SeaZoneID].leaders.filter((leader) => leader !== "henryIII");
            }
            delete G.leaders.henryIII;
        }
        pushLog(G, "Henry III is murdered; France drops to 1 Admin and 0 card bonus.");
    } else if (id === "philip") {
        pushLog(G, "Philip II is murdered; Spain drops to 1 Admin and 0 card bonus.");
    } else if (id === "charlesIX") {
        pushLog(G, "Charles IX is murdered; France drops to 0 Admin and 0 card bonus until Henry III takes the throne.");
    } else if (id === "rudolf") {
        pushLog(G, "Rudolf II is murdered; the Holy Roman Empire drops to 1 Admin and 0 card bonus.");
    } else if (id === "maryScots") {
        if (G.espionage !== undefined) G.espionage.mary = "dead";
        pushLog(G, "Mary Queen of Scots dies.");
    }
};

export const resolveMarriages = (G: VQGame, ctx: Ctx): void => {
    for (const b of G.betrothals) {
        const male = G.royals.find((r) => r.id === b.male);
        const female = G.royals.find((r) => r.id === b.female);
        if (male === undefined || female === undefined || !male.alive || !female.alive || male.married || female.married) {
            continue;
        }
        const dice = [die(ctx, 6), die(ctx, 6)];
        // Don Carlos rerolls the highest die; Anna of Austria may reroll the
        // lowest (automatic when the reroll improves it).
        if (male.id === "donCarlos" || female.id === "donCarlos") {
            const high = dice[0] >= dice[1] ? 0 : 1;
            dice[high] = die(ctx, 6);
        }
        if (male.id === "annaAustria" || female.id === "annaAustria") {
            const low = dice[0] <= dice[1] ? 0 : 1;
            const reroll = die(ctx, 6);
            if (reroll > dice[low]) dice[low] = reroll;
        }
        const samePower = male.power === female.power;
        const ratings = samePower
            ? Math.max(male.eligibility ?? 0, female.eligibility ?? 0)
            : (male.eligibility ?? 0) + (female.eligibility ?? 0);
        const total = dice[0] + dice[1] + ratings;
        G.lastRolls = `Marriage roll: ${dice[0]}+${dice[1]}+${ratings}=${total}`;
        pushLog(G, `${male.name} & ${female.name}: ${G.lastRolls}`);
        const involved = [...new Set([male.power, female.power])];
        const grantVp = (amount: number): void => {
            for (const p of involved) addVp(G, p, amount);
        };
        const grantCardMarker = (amount: number): void => {
            for (const p of involved) G.powers[p].marriageCardModifier = (G.powers[p].marriageCardModifier ?? 0) + amount;
        };
        if (total >= 15) {
            grantVp(2);
            male.married = true;
            female.married = true;
            G.marriages += 1;
            pushLog(G, "Founders of a Dynasty: each power gains 2 Wedding VP.");
        } else if (total === 14) {
            grantVp(1);
            grantCardMarker(1);
            male.married = true;
            female.married = true;
            G.marriages += 1;
            pushLog(G, "True Love: each power gains 1 Wedding VP and a +1 Card marker.");
        } else if (total === 13) {
            grantVp(1);
            male.married = true;
            female.married = true;
            G.marriages += 1;
            pushLog(G, "Several Children: each power gains 1 Wedding VP.");
        } else if (total === 12) {
            grantCardMarker(1);
            male.married = true;
            female.married = true;
            G.marriages += 1;
            pushLog(G, "Benevolent Rulers: each power gains a +1 Card marker.");
        } else if (total === 10 || total === 11) {
            male.married = true;
            female.married = true;
            G.marriages += 1;
            pushLog(G, "No Issue: the marriage produces no effect.");
        } else if (total === 9) {
            pushLog(G, "Last Minute Cancellation: both royals return to the pool.");
        } else if (total === 8) {
            grantCardMarker(-1);
            male.married = true;
            female.married = true;
            G.marriages += 1;
            pushLog(G, "Always Feuding: each power gains a -1 Card marker.");
        } else if (total === 7) {
            female.alive = false;
            female.status = "dead";
            male.married = true;
            G.marriages += 1;
            applyRulerDeath(G, female.id);
            pushLog(G, `Death in Childbirth: ${female.name} dies.`);
        } else {
            male.alive = false;
            male.status = "dead";
            female.married = true;
            G.marriages += 1;
            applyRulerDeath(G, male.id);
            pushLog(G, `Rumors of Murder: ${male.name} is murdered.`);
        }
        if (total !== 9) {
            // Valois marriage bonus: +1 VP for each Valois royal who weds.
            for (const royal of [male, female]) {
                if (royal.family === "valois") addVp(G, "france", 1);
            }
            const ids = [male.id, female.id];
            if (ids.includes("annaSaxony")) {
                G.powers[male.power].marriageCardModifier = (G.powers[male.power].marriageCardModifier ?? 0) + 1;
            }
            if (ids.includes("charlesII") && (female.power === "england" || female.power === "protestant")) {
                G.powers[female.power].marriageCardModifier = (G.powers[female.power].marriageCardModifier ?? 0) - 1;
            }
            if (ids.includes("louiseColigny") && (male.power === "england" || male.power === "protestant")) {
                G.powers[male.power].marriageCardModifier = (G.powers[male.power].marriageCardModifier ?? 0) + 1;
            }
            if (ids.includes("henryIV") && female.power === "france") {
                G.powers[male.power].marriageCardModifier = (G.powers[male.power].marriageCardModifier ?? 0) + 1;
            }
            if (ids.includes("isabellaClaraEugenia") &&
                ["philip", "charlesIX", "henryIII", "rudolf"].includes(male.id)) {
                G.powers[male.power].patronageModifier += 1;
            }
            const william = [male, female].find((royal) => royal.id === "williamOrange");
            if (william !== undefined && [7, 8, 10, 11, 12].includes(total)) {
                william.married = false;
                william.status = "available";
                william.eligibility = 2;
                william.turn = G.year + 1;
                pushLog(G, "William of Orange returns to the pool at eligibility 2 next turn.");
            }
        }
    }
    G.betrothals = [];
};

const bestPatronageVpAward = (
    G: VQGame,
    kind: "artist" | "scientist",
    maxVp: number,
    artistType?: "writer" | "painter" | "architect",
): PatronageVpAward | undefined => G.vpAwardsAvailable
    .map((id) => PATRONAGE_VP_AWARD_BY_ID[id])
    .filter((award): award is PatronageVpAward => award !== undefined && award.kind === kind && award.vp <= maxVp &&
        (kind === "scientist" || award.vp === 1 || award.artistType === artistType))
    .sort((a, b) => b.vp - a.vp)[0];

const claimPatronageVpAward = (G: VQGame, p: Power, awardId: string | undefined): number => {
    if (awardId === undefined || !G.vpAwardsAvailable.includes(awardId)) {
        return 0;
    }
    const award = PATRONAGE_VP_AWARD_BY_ID[awardId];
    if (award === undefined) {
        return 0;
    }
    G.vpAwardsAvailable = G.vpAwardsAvailable.filter((id) => id !== awardId);
    addVp(G, p, award.vp);
    pushLog(G, `${powerLabel(p)} claims ${award.nameEn} (+${award.vp} VP).`);
    return award.vp;
};

const eligibleScienceBonus = (G: VQGame, p: Power) =>
    G.scienceBonusesAvailable
        .map((id) => scienceBonusById(id))
        .find((bonus) => bonus !== undefined &&
            (bonus.eligible === "any" ||
                (bonus.eligible === "any-except-spain" && p !== "spain") ||
                (Array.isArray(bonus.eligible) && bonus.eligible.includes(p))));

const claimScienceBonus = (G: VQGame, p: Power): boolean => {
    const bonus = eligibleScienceBonus(G, p);
    if (bonus === undefined) {
        return false;
    }
    G.scienceBonusesAvailable = G.scienceBonusesAvailable.filter((id) => id !== bonus.id);
    G.powers[p].scienceBonuses.push(bonus.id);
    pushLog(G, `${powerLabel(p)} claims science bonus ${bonus.nameEn}.`);
    return true;
};

const removePatronFromPool = (G: VQGame, patronId: string): void => {
    G.patronsAvailable = G.patronsAvailable.filter((id) => id !== patronId);
};

/** Resolve the year's artists and scientists against the remaining award pool. */
export const resolvePatronage = (G: VQGame, ctx: Ctx): void => {
    const pending = G.pendingPatronage.slice().sort((a, b) => {
        const pa = patronDef(a.patronId);
        const pb = patronDef(b.patronId);
        if (pa?.kind !== pb?.kind) {
            return pa?.kind === "artist" ? -1 : 1;
        }
        const ratingDifference = (pb?.rating ?? 0) - (pa?.rating ?? 0);
        return ratingDifference || POWER_INDEX[a.power] - POWER_INDEX[b.power];
    });

    for (const attempt of pending) {
        const patron = patronDef(attempt.patronId);
        if (patron === undefined || patron.rating === null) {
            continue;
        }
        const cpBonus = attempt.cp - 2;
        const observatoryBonus = patron.kind === "scientist" && G.powers[attempt.power].scienceBonuses.includes("observatory") ? 2 : 0;
        const modifier = cpBonus + G.powers[attempt.power].patronageModifier + observatoryBonus;
        const d1 = die(ctx);
        const d2 = die(ctx);
        const result = d1 + d2 + patron.rating + modifier;
        G.lastRolls = `Patronage: ${patron.name} ${d1}+${d2}+rating ${patron.rating}+bonus ${modifier}=${result}`;
        pushLog(G, `${powerLabel(attempt.power)} ${G.lastRolls}`);

        if (result <= 6) {
            removePatronFromPool(G, patron.id);
            pushLog(G, `${patron.name} is removed from play (result 6 or less).`);
            continue;
        }
        if (result <= 8) {
            if (patron.rating === 1) {
                removePatronFromPool(G, patron.id);
                pushLog(G, `${patron.name} is removed from play (rating 1; result 7-8).`);
            } else {
                pushLog(G, `${patron.name} returns to the available pool (result 7-8).`);
            }
            continue;
        }
        if (result === 9) {
            pushLog(G, `${patron.name} returns to the available pool (result 9).`);
            continue;
        }

        let rewarded = false;
        if (patron.kind === "artist") {
            const maxVp = result >= 15 ? 3 : result >= 13 ? 2 : 1;
            const award = bestPatronageVpAward(G, "artist", maxVp, patron.artistType);
            rewarded = claimPatronageVpAward(G, attempt.power, award?.id) > 0;
        } else {
            const maxVp = result >= 13 ? 2 : 1;
            const bonusAvailable = eligibleScienceBonus(G, attempt.power) !== undefined;
            let vpClaimed = 0;
            if (result >= 15) {
                const award = bestPatronageVpAward(G, "scientist", 2);
                vpClaimed = claimPatronageVpAward(G, attempt.power, award?.id);
                rewarded = claimScienceBonus(G, attempt.power) || rewarded;
            } else if (result >= 13 && bonusAvailable &&
                G.vpAwardsAvailable.some((id) => PATRONAGE_VP_AWARD_BY_ID[id]?.kind === "scientist" && PATRONAGE_VP_AWARD_BY_ID[id]?.vp === 1)) {
                const oneVp = G.vpAwardsAvailable.find((id) => {
                    const award = PATRONAGE_VP_AWARD_BY_ID[id];
                    return award?.kind === "scientist" && award.vp === 1;
                });
                vpClaimed = claimPatronageVpAward(G, attempt.power, oneVp);
                rewarded = claimScienceBonus(G, attempt.power) || rewarded;
            } else if (result >= 13) {
                const award = bestPatronageVpAward(G, "scientist", 2);
                vpClaimed = claimPatronageVpAward(G, attempt.power, award?.id);
            } else {
                const oneVp = bestPatronageVpAward(G, "scientist", 1);
                vpClaimed = claimPatronageVpAward(G, attempt.power, oneVp?.id);
                if (vpClaimed === 0) {
                    rewarded = claimScienceBonus(G, attempt.power);
                }
            }
            rewarded = rewarded || vpClaimed > 0;
        }

        if (rewarded) {
            G.powers[attempt.power].patrons.push(patron.id);
            removePatronFromPool(G, patron.id);
            pushLog(G, `${patron.name} is finished and removed from the available pool.`);
        } else {
            pushLog(G, `${patron.name} returns to the available pool because no award was available.`);
        }
    }
    G.pendingPatronage = [];
};

// --------------------------------------------------------------------------
// Winter return home (rule 20.4)
// --------------------------------------------------------------------------

/** Adjacency used by the winter return paths: land links plus port/sea hops. */
const winterNeighbors = (id: string): string[] => {
    if (isSeaZone(id)) {
        const zone = SEA_ZONE_BY_ID[id as SeaZoneID];
        return [...zone.adjacent, ...zonePorts(id as SeaZoneID)];
    }
    return [...landNeighbors(id).map((neighbor) => neighbor.id), ...portZones(id)];
};

/** Shortest distance ignoring political control, as required for "nearest" (20.4). */
const winterDistance = (from: string, to: string): number | undefined => {
    if (from === to) return 0;
    const seen = new Set<string>([from]);
    const queue: {id: string; distance: number}[] = [{id: from, distance: 0}];
    while (queue.length > 0) {
        const current = queue.shift() as {id: string; distance: number};
        for (const next of winterNeighbors(current.id)) {
            if (seen.has(next)) continue;
            if (next === to) return current.distance + 1;
            seen.add(next);
            queue.push({id: next, distance: current.distance + 1});
        }
    }
    return undefined;
};

/**
 * True when a winter move can trace a path where every space after the origin
 * is friendly-controlled and free of unrest.  Enemy units are ignored and any
 * number of sea zones may be crossed (rule 20.4).
 */
const winterCleanPath = (G: VQGame, p: Power, from: string, to: string): boolean => {
    if (from === to) return true;
    const seen = new Set<string>([from]);
    const queue = [from];
    while (queue.length > 0) {
        const current = queue.shift() as string;
        for (const next of winterNeighbors(current)) {
            if (seen.has(next)) continue;
            if (!isSeaZone(next)) {
                const state = G.spaces[next];
                if (state === undefined || !friendlyControlled(G, p, next) || state.unrest) continue;
            }
            seen.add(next);
            if (next === to) return true;
            queue.push(next);
        }
    }
    return false;
};

/** Distance from a sea zone to a port, counted in sea-zone hops. */
const winterNavalDistance = (from: SeaZoneID, port: string): number | undefined => {
    const seen = new Set<SeaZoneID>([from]);
    const queue: {zone: SeaZoneID; distance: number}[] = [{zone: from, distance: 0}];
    while (queue.length > 0) {
        const current = queue.shift() as {zone: SeaZoneID; distance: number};
        if (zonePorts(current.zone).includes(port)) return current.distance + 1;
        for (const next of SEA_ZONE_BY_ID[current.zone].adjacent) {
            if (seen.has(next)) continue;
            seen.add(next);
            queue.push({zone: next, distance: current.distance + 1});
        }
    }
    return undefined;
};

const winterPortRank = (major: Controller, port: string): number =>
    isPower(major) && CAPITAL_SPACES[major].includes(port) ? 0 : 1;

/** Home capitals that can receive this power's land units (20.4 exceptions). */
const winterCapitalsFor = (G: VQGame, p: Power, origin?: string): string[] => {
    const controlled = CAPITAL_SPACES[p].filter((id) => G.spaces[id]?.control === p);
    if (p !== "protestant" || origin === undefined) return controlled;
    const dutch = SPACE_BY_ID[origin]?.area === "netherlands";
    return controlled.filter((id) => dutch ? id === "amsterdam" : id === "laRochelle");
};

const winterIsCapital = (p: Power, id: string): boolean => CAPITAL_SPACES[p].includes(id);

/** Remove units from a stack, choosing mercenaries, then cavalry, then regulars. */
const winterTakeUnits = (stack: LandStack, count: number): LandStack => {
    const taken = emptyLand();
    let left = count;
    for (const kind of ["merc", "cav", "regular"] as const) {
        const n = Math.min(left, stack[kind]);
        stack[kind] -= n;
        taken[kind] = n;
        left -= n;
        if (left === 0) break;
    }
    return taken;
};

/** Lose half of a moving stack, rounded up.  Returns the number lost. */
const winterAttrition = (units: LandStack): number => {
    const losses = Math.ceil(landCount(units) / 2);
    let left = losses;
    for (const kind of ["merc", "cav", "regular"] as const) {
        const n = Math.min(left, units[kind]);
        units[kind] -= n;
        left -= n;
        if (left === 0) break;
    }
    return losses;
};

const winterAddUnits = (G: VQGame, space: string, p: Power, units: LandStack): void => {
    if (landCount(units) === 0) return;
    const target = ensureLand(G, space, p);
    target.regular += units.regular;
    target.merc += units.merc;
    target.cav += units.cav;
};

const winterArmyLeaders = (G: VQGame, space: string, p: Power): string[] =>
    G.spaces[space].leaders.filter((id) =>
        LEADER_BY_ID[id]?.power === p && LEADER_BY_ID[id]?.kind === "army");

/** A displaced leader returns to a controlled capital, or waits in the pool. */
const winterLeadersHome = (G: VQGame, from: string, p: Power, leaders: string[]): void => {
    if (leaders.length === 0) return;
    const capital = CAPITAL_SPACES[p].find((id) => G.spaces[id]?.control === p);
    let moving = leaders;
    // Rule 20.10: if winter return would force Guise out of the French
    // religious struggle area, he is eliminated instead.
    if (p === "france" && moving.includes("guise") &&
        (capital === undefined || !inFrenchReligiousArea(capital))) {
        G.spaces[from].leaders = G.spaces[from].leaders.filter((id) => id !== "guise");
        delete G.leaders.guise;
        moving = moving.filter((id) => id !== "guise");
        pushLog(G, "The Duke of Guise cannot leave the French religious struggle area and is eliminated.");
    }
    if (moving.length === 0) return;
    moveLeaders(G, from, capital ?? "pool", moving);
    pushLog(G, `${powerLabel(p)} returns ${moving.length} leader(s) home for the winter.`);
};

const winterReturnNaval = (G: VQGame): void => {
    for (const zoneDef of SEA_ZONES) {
        const zone = G.seaZones[zoneDef.id];
        const controllers = (Object.keys(zone.naval) as Controller[])
            .filter((c) => navalCount(zone.naval[c]) > 0);
        const destinations: Partial<Record<Controller, string>> = {};
        for (const c of controllers) {
            const stack = zone.naval[c] as NavalStack;
            const major: Controller = isPower(c) ? c : minorAlly(G, c as MinorPower) ?? c;
            const ports = SPACES.filter((def) => G.spaces[def.id].control === major && isPort(def.id) && !isInlandPort(def.id))
                .map((def) => def.id);
            let best: {port: string; distance: number} | undefined;
            for (const port of ports) {
                const distance = winterNavalDistance(zoneDef.id, port);
                if (distance === undefined) continue;
                if (best === undefined || distance < best.distance ||
                    (distance === best.distance &&
                        (winterPortRank(major, port) < winterPortRank(major, best.port) ||
                            (winterPortRank(major, port) === winterPortRank(major, best.port) && port < best.port)))) {
                    best = {port, distance};
                }
            }
            if (best === undefined) {
                pushLog(G, `${controllerLabel(c)} fleet in ${zoneDef.name} has no port to return to and is eliminated.`);
                delete zone.naval[c];
                continue;
            }
            const target = ensureNaval(G, best.port, c);
            target.galley += stack.galley;
            target.galleon += stack.galleon;
            target.racebuilt += stack.racebuilt;
            target.corsair += stack.corsair;
            delete zone.naval[c];
            destinations[c] = best.port;
            pushLog(G, `${controllerLabel(c)} fleet returns from ${zoneDef.name} to ${SPACE_BY_ID[best.port].name}.`);
        }
        // A naval leader must return to a port with one of the units that
        // started the phase in this sea zone (rule 20.4).
        for (const id of [...zone.leaders]) {
            const def = LEADER_BY_ID[id];
            if (def === undefined || def.kind !== "naval") continue;
            const port = destinations[def.power];
            if (port !== undefined) {
                moveLeaders(G, zoneDef.id, port, [id]);
                pushLog(G, `${def.name} returns to ${SPACE_BY_ID[port].name} with the fleet.`);
                continue;
            }
            const hadFleet = controllers.some((c) =>
                (isPower(c) ? c : minorAlly(G, c as MinorPower)) === def.power);
            if (hadFleet) {
                const capital = CAPITAL_SPACES[def.power].find((cap) => G.spaces[cap]?.control === def.power);
                moveLeaders(G, zoneDef.id, capital ?? "pool", [id]);
                pushLog(G, `${def.name} loses the fleet and returns home.`);
            }
        }
    }
    if (G.armada !== undefined && isSeaZone(G.armada.location)) {
        const ports = SPACES.filter((def) => G.spaces[def.id].control === "spain" && isPort(def.id) && !isInlandPort(def.id))
            .map((def) => def.id)
            .map((port) => ({port, distance: winterNavalDistance(G.armada!.location as SeaZoneID, port)}))
            .filter((entry): entry is {port: string; distance: number} => entry.distance !== undefined)
            .sort((a, b) => a.distance - b.distance || a.port.localeCompare(b.port));
        if (ports.length === 0) {
            delete G.armada;
            pushLog(G, "The Armada has no port to return to and is eliminated.");
        } else {
            G.armada.location = ports[0].port;
            pushLog(G, `The Armada returns to ${SPACE_BY_ID[ports[0].port].name}.`);
        }
    }
};

const winterReturnLand = (G: VQGame, p: Power): void => {
    const origins = SPACES.map((def) => def.id)
        .filter((id) => landCount(G.spaces[id].land[p]) > 0);
    // 1. Overstacked fortifications send the excess to a home capital.
    for (const id of origins) {
        const state = G.spaces[id];
        const stack = state.land[p];
        if (stack === undefined || landCount(stack) === 0) continue;
        // Rule 23.1: the Morisco unit never moves during the Winter Phase.
        if (p === "ottoman" && G.morisco?.space === id) continue;
        if (!isFortifiedSpace(G, id) || state.control !== p || winterIsCapital(p, id) || landCount(stack) <= 4) continue;
        const capitals = winterCapitalsFor(G, p, id)
            .map((cap) => ({id: cap, distance: winterDistance(id, cap)}))
            .filter((candidate): candidate is {id: string; distance: number} => candidate.distance !== undefined)
            .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
        const excess = landCount(stack) - 4;
        if (capitals.length === 0) {
            removeLandLosses(G, id, [p], excess);
            cleanupLand(G, id, p);
            pushLog(G, `${powerLabel(p)} has no capital and loses ${excess} overstacked unit(s) in ${SPACE_BY_ID[id].name}.`);
            continue;
        }
        const capital = capitals[0];
        const moving = winterTakeUnits(stack, excess);
        const clean = winterCleanPath(G, p, id, capital.id);
        const lost = clean ? 0 : winterAttrition(moving);
        cleanupLand(G, id, p);
        winterAddUnits(G, capital.id, p, moving);
        pushLog(G, `${powerLabel(p)} returns ${excess - lost} overstacked unit(s) from ${SPACE_BY_ID[id].name} to ${SPACE_BY_ID[capital.id].name}${lost > 0 ? ` (${lost} lost to winter attrition)` : ""}.`);
    }
    // 2. Units outside friendly winter quarters must return home.
    for (const id of origins) {
        const state = G.spaces[id];
        const stack = state.land[p];
        if (stack === undefined || landCount(stack) === 0) continue;
        // Rule 23.1: the Morisco unit never moves during the Winter Phase.
        if (p === "ottoman" && G.morisco?.space === id) continue;
        // Friendly fortifications (including capitals) are valid winter quarters.
        if (state.control === p && isFortifiedSpace(G, id)) continue;
        const capitals = winterCapitalsFor(G, p, id);
        const destinations = SPACES.filter((def) => {
            if (def.id === id) return false;
            const target = G.spaces[def.id];
            if (target.control !== p || !isFortifiedSpace(G, def.id)) return false;
            if (winterIsCapital(p, def.id)) return capitals.includes(def.id);
            return landCount(target.land[p]) < 4;
        }).map((def) => def.id);
        const scored = destinations.map((dest) => ({
            dest,
            distance: winterDistance(id, dest) ?? Number.POSITIVE_INFINITY,
            clean: winterCleanPath(G, p, id, dest),
            capital: winterIsCapital(p, dest),
        })).filter((candidate) => Number.isFinite(candidate.distance));
        const nearestFort = Math.min(
            ...scored.filter((candidate) => !candidate.capital).map((candidate) => candidate.distance),
        );
        // The legal choices are the home capital(s) or the nearest fortification
        // with room; a clean path is chosen when one exists.
        const candidates = scored.filter((candidate) =>
            candidate.capital || candidate.distance === nearestFort);
        if (candidates.length === 0) {
            const leaders = winterArmyLeaders(G, id, p);
            const count = landCount(stack);
            delete state.land[p];
            winterLeadersHome(G, id, p, leaders);
            pushLog(G, `${powerLabel(p)} loses ${count} unit(s) in ${SPACE_BY_ID[id].name}: no winter quarters.`);
            continue;
        }
        candidates.sort((a, b) =>
            Number(b.clean) - Number(a.clean) ||
            a.distance - b.distance ||
            Number(b.capital) - Number(a.capital) ||
            a.dest.localeCompare(b.dest));
        const chosen = candidates[0];
        const lost = chosen.clean ? 0 : winterAttrition(stack);
        const leaders = winterArmyLeaders(G, id, p);
        if (landCount(stack) === 0) {
            cleanupLand(G, id, p);
            winterLeadersHome(G, id, p, leaders);
            pushLog(G, `${powerLabel(p)} loses ${lost} unit(s) to winter attrition in ${SPACE_BY_ID[id].name}.`);
            continue;
        }
        winterAddUnits(G, chosen.dest, p, stack);
        delete state.land[p];
        let movingLeaders = leaders;
        if (p === "france" && movingLeaders.includes("guise") && !inFrenchReligiousArea(chosen.dest)) {
            state.leaders = state.leaders.filter((leader) => leader !== "guise");
            delete G.leaders.guise;
            movingLeaders = movingLeaders.filter((leader) => leader !== "guise");
            pushLog(G, "The Duke of Guise cannot leave the French religious struggle area and is eliminated.");
        }
        moveLeaders(G, id, chosen.dest, movingLeaders);
        pushLog(G, `${powerLabel(p)} withdraws ${landCount(stack)} unit(s) from ${SPACE_BY_ID[id].name} to ${SPACE_BY_ID[chosen.dest].name}${lost > 0 ? ` (${lost} lost to winter attrition)` : ""}.`);
    }
};

// --------------------------------------------------------------------------
// Catholic League (rule 20.10)
// --------------------------------------------------------------------------

/**
 * French religious struggle area (2.3): French home spaces, Huguenot home
 * spaces in France, and Metz (explicitly included by 20.10).
 */
export const inFrenchReligiousArea = (id: string): boolean => {
    const def = SPACE_BY_ID[id];
    return def !== undefined && (def.home === "france" ||
        (def.home === "protestant" && def.area === "france") || id === "metz");
};

const frenchHomeSpaces = (): string[] =>
    SPACES.filter((def) => def.home === "france").map((def) => def.id);

const frenchKeySpaces = (): string[] =>
    SPACES.filter((def) => def.kind === "key" && inFrenchReligiousArea(def.id)).map((def) => def.id);

/** Remove a specific unit type, taking from the largest stacks first. */
const removeLandKind = (G: VQGame, p: Power, kind: keyof LandStack, count: number): number => {
    let left = count;
    const spaces = SPACES.filter((def) => (G.spaces[def.id].land[p]?.[kind] ?? 0) > 0)
        .sort((a, b) => (G.spaces[b.id].land[p]?.[kind] ?? 0) - (G.spaces[a.id].land[p]?.[kind] ?? 0) ||
            a.id.localeCompare(b.id));
    for (const def of spaces) {
        const stack = G.spaces[def.id].land[p];
        if (stack === undefined) continue;
        while (left > 0 && stack[kind] > 0) {
            stack[kind] -= 1;
            left -= 1;
        }
        cleanupLand(G, def.id, p);
        if (left === 0) break;
    }
    return count - left;
};

/** A fortress built at Reims before the League forms displaces its garrison (12.5). */
const displaceReimsGarrison = (G: VQGame): void => {
    const reims = G.spaces.reims;
    if (reims === undefined || !reims.fortress) return;
    for (const owner of ownersWithLand(G, "reims")) {
        const stack = reims.land[owner];
        if (stack === undefined) continue;
        if (!isPower(owner)) {
            delete reims.land[owner];
            continue;
        }
        const dest = nearestFriendlyFortified(G, owner, "reims");
        if (dest === undefined) {
            delete reims.land[owner];
            continue;
        }
        winterAddUnits(G, dest, owner, stack);
        delete reims.land[owner];
        const leaders = reims.leaders.filter((id) => LEADER_BY_ID[id]?.power === owner);
        if (leaders.length > 0) moveLeaders(G, "reims", dest, leaders);
    }
};

/**
 * Check for Catholic League formation at the end of Winter (rule 20.10).
 * Reims and the reduced French forces are applied immediately; Spain then
 * chooses the two additional unfortified French home spaces during the next
 * Diplomacy Phase (see chooseCatholicLeagueSpace).  If the choice is still
 * pending when Spring Deployment begins, resolvePendingCatholicLeague applies
 * a deterministic fallback.
 */
export const checkCatholicLeague = (G: VQGame, ctx: Ctx): boolean => {
    if (G.scenario === "tutorial" || G.catholicLeagueFormed === true || G.year < 3 || G.year > 6) {
        return false;
    }
    const keys = frenchKeySpaces().filter((id) => G.spaces[id].control === "protestant").length;
    const homes = frenchHomeSpaces().filter((id) => G.spaces[id].control === "protestant").length;
    let formed = false;
    if (keys >= 3) {
        formed = true;
        pushLog(G, `Catholic League check: the Protestants control ${keys} keys in France, so the League forms automatically.`);
    } else if (homes <= 5) {
        pushLog(G, `Catholic League check: ${homes} French home space(s) under Protestant control; not formed this year.`);
        return false;
    } else {
        const rolled = die(ctx);
        const total = rolled + homes;
        formed = total >= 12;
        pushLog(G, `Catholic League check: ${homes} French home space(s) + die ${rolled} = ${total}${formed ? " — formed!" : " — not formed."}`);
    }
    if (!formed) return false;

    displaceReimsGarrison(G);
    G.spaces.reims.control = "spain";
    G.spaces.reims.religion = "catholic";
    G.catholicLeagueSpaces = ["reims"];
    G.pendingCatholicLeague = {remaining: 2};
    pushLog(G, "Catholic League: Spain takes Reims; Spain must now choose 2 unfortified French home spaces.");

    const regularsBefore = SPACES.reduce((n, def) => n + (G.spaces[def.id].land.france?.regular ?? 0), 0);
    const mercsBefore = SPACES.reduce((n, def) => n + (G.spaces[def.id].land.france?.merc ?? 0), 0);
    const regularsRemoved = removeLandKind(G, "france", "regular", Math.ceil(regularsBefore / 3));
    const mercsRemoved = removeLandKind(G, "france", "merc", Math.ceil(mercsBefore / 3));
    if (regularsRemoved > 0 || mercsRemoved > 0) {
        pushLog(G, `Catholic League: France removes ${regularsRemoved} regular(s) and ${mercsRemoved} mercenar(y/ies).`);
    }
    if (regularsRemoved > 0) addLand(G, "reims", "spain", "regular", regularsRemoved);
    if (mercsRemoved > 0) addLand(G, "reims", "spain", "merc", mercsRemoved);
    const spanishRegulars = G.spaces.reims.land.spain?.regular ?? 0;
    if (spanishRegulars < 4) {
        addLand(G, "reims", "spain", "regular", 4 - spanishRegulars);
        pushLog(G, "Catholic League: Spain raises the Reims garrison to 4 regulars.");
    }
    G.spaces.reims.fortress = true;
    const guise = G.leaders.guise;
    if (guise !== undefined) {
        if (G.spaces[guise.location] !== undefined || G.seaZones[guise.location as SeaZoneID] !== undefined) {
            moveLeaders(G, guise.location, "reims", ["guise"]);
        } else if (!G.spaces.reims.leaders.includes("guise")) {
            G.spaces.reims.leaders.push("guise");
            G.leaders.guise = {id: "guise", location: "reims"};
        }
        pushLog(G, "Catholic League: the Duke of Guise joins the League in Reims.");
    }
    if (!atWar(G, "spain", "france")) setWar(G, "spain", "france");
    if (!atWar(G, "spain", "protestant")) setWar(G, "spain", "protestant");
    G.catholicLeagueNoDealsUntil = G.year + 1;
    G.catholicLeagueFormed = true;
    pushLog(G, "The Catholic League has formed; Spain may make no deals with France or the Protestant this coming Diplomacy Segment.");
    return true;
};

/** Unfortified French home spaces Spain may still take for the League. */
export const catholicLeagueSpaceOptions = (G: VQGame): string[] => {
    if (G.pendingCatholicLeague === undefined) return [];
    return SPACES.filter((def) => def.home === "france" && def.id !== "reims" &&
        !isFortifiedSpace(G, def.id) && !(G.catholicLeagueSpaces ?? []).includes(def.id))
        .map((def) => def.id);
};

export const applyCatholicLeagueSpace = (G: VQGame, id: string): void => {
    if (G.pendingCatholicLeague === undefined) return;
    G.spaces[id].control = "spain";
    G.spaces[id].religion = "catholic";
    G.catholicLeagueSpaces = [...(G.catholicLeagueSpaces ?? []), id];
    G.pendingCatholicLeague.remaining -= 1;
    pushLog(G, `Catholic League: Spain takes ${SPACE_BY_ID[id].name}.`);
    if (G.pendingCatholicLeague.remaining <= 0) {
        delete G.pendingCatholicLeague;
        pushLog(G, `Catholic League spaces: ${(G.catholicLeagueSpaces ?? []).map((space) => SPACE_BY_ID[space].name).join(", ")}.`);
    }
};

/** Fallback when Spain has not chosen by Spring Deployment. */
export const resolvePendingCatholicLeague = (G: VQGame): void => {
    if (G.pendingCatholicLeague === undefined) return;
    const priority = (id: string): number => {
        const control = G.spaces[id].control;
        return control === "protestant" ? 0 : control === "france" ? 1 : 2;
    };
    const sorted = [...catholicLeagueSpaceOptions(G)].sort((a, b) =>
        priority(a) - priority(b) ||
        (winterDistance("reims", a) ?? 999) - (winterDistance("reims", b) ?? 999) ||
        a.localeCompare(b));
    const remaining = G.pendingCatholicLeague.remaining;
    for (let i = 0; i < remaining; i++) {
        const id = sorted[i];
        if (id === undefined) break;
        applyCatholicLeagueSpace(G, id);
    }
    if (G.pendingCatholicLeague !== undefined) {
        pushLog(G, "Catholic League: no further unfortified French home spaces are available.");
        delete G.pendingCatholicLeague;
    }
};

export type HreReplacementChoice = "regular" | "mercs" | "marker";

export const applyHreReplacement = (G: VQGame, choice: HreReplacementChoice): boolean => {
    const pending = G.pendingHreReplacement;
    if (pending === undefined) return false;
    if (choice === "regular") {
        if (!pending.canRegular) return false;
        addLand(G, "vienna", "hre", "regular", 1);
        pushLog(G, "Holy Roman replacement: +1 regular in Vienna.");
    } else if (choice === "mercs") {
        if (!pending.canMercs) return false;
        addLand(G, "vienna", "hre", "merc", 2);
        pushLog(G, "Holy Roman replacement: +2 mercenaries in Vienna.");
    } else {
        if (!pending.canMarker || G.mercenariesForHire !== 0) return false;
        G.mercenariesForHire = 4;
        pushLog(G, "Holy Roman replacement: Mercenaries for Hire marker moves from 0 to 4.");
    }
    delete G.pendingHreReplacement;
    return true;
};

/** Fallback if the HRE choice was not made by Spring Deployment. */
export const resolvePendingHreReplacement = (G: VQGame): void => {
    const pending = G.pendingHreReplacement;
    if (pending === undefined) return;
    if (pending.canRegular) {applyHreReplacement(G, "regular"); return;}
    if (pending.canMercs) {applyHreReplacement(G, "mercs"); return;}
    if (pending.canMarker) {applyHreReplacement(G, "marker"); return;}
    delete G.pendingHreReplacement;
};

// --------------------------------------------------------------------------
// Morisco Revolt (card #28 / rule 20.1)
// --------------------------------------------------------------------------

export const placeMoriscoUnrest = (G: VQGame, origin?: string): string[] => {
    if (G.morisco === undefined) return [];
    const center = origin ?? G.morisco.space;
    const candidates = landWithin(center, 2).filter((id) =>
        id !== center && G.spaces[id] !== undefined && !G.spaces[id].unrest && ownersWithLand(G, id).length === 0);
    const chosen = candidates.slice(0, 2);
    for (const id of chosen) {
        G.spaces[id].unrest = true;
        pushLog(G, `Morisco Revolt: unrest in ${SPACE_BY_ID[id].name}.`);
    }
    if (chosen.length < 2) {
        pushLog(G, `Morisco Revolt: only ${chosen.length} unoccupied space(s) within 2 of ${SPACE_BY_ID[center]?.name ?? center}.`);
    }
    return chosen;
};

export const clearMorisco = (G: VQGame): void => {
    const morisco = G.morisco;
    if (morisco === undefined) return;
    const stack = G.spaces[morisco.space]?.land.ottoman;
    if (stack !== undefined) {
        const removed = Math.min(morisco.units, stack.regular);
        stack.regular -= removed;
        cleanupLand(G, morisco.space, "ottoman");
    }
    delete G.morisco;
    removeCardFromGame(G, "vq-028");
    pushLog(G, "Morisco Revolt ends: the Morisco unit is removed and card #28 leaves play.");
};

export const checkMoriscoStatus = (G: VQGame): void => {
    const morisco = G.morisco;
    if (morisco === undefined) return;
    if (!atWar(G, "ottoman", "spain")) {
        clearMorisco(G);
        return;
    }
    const count = G.spaces[morisco.space] === undefined ? 0 : landCount(G.spaces[morisco.space].land.ottoman);
    if (count <= 0) {
        clearMorisco(G);
        return;
    }
    morisco.units = Math.min(morisco.units, count);
};

/** Resolve card #28: the Morisco unit appears in Granada (rule 23.1). */
export const resolveMoriscoRevolt = (G: VQGame, _p: Power): boolean => {
    if (!atWar(G, "ottoman", "spain") || G.morisco !== undefined) return false;
    const granada = G.spaces.granada;
    if (granada === undefined) return false;
    captureLeaders(G, "granada", ownersWithLand(G, "granada"), "ottoman");
    granada.land = {};
    granada.unrest = true;
    addLand(G, "granada", "ottoman", "regular", 2);
    G.morisco = {space: "granada", units: 2};
    placeMoriscoUnrest(G, "granada");
    pushLog(G, "Morisco Revolt: Granada is cleared, unrest spreads, and 2 Morisco units appear.");
    return true;
};

const winterMorisco = (G: VQGame): void => {
    const morisco = G.morisco;
    if (morisco === undefined) return;
    if (!atWar(G, "ottoman", "spain")) {
        clearMorisco(G);
        return;
    }
    const state = G.spaces[morisco.space];
    if (state?.siege?.by === "ottoman" && isFortifiedSpace(G, morisco.space)) {
        pushLog(G, "Morisco Revolt: the Morisco unit is besieging a fortified space at Winter and is eliminated.");
        clearMorisco(G);
        return;
    }
    placeMoriscoUnrest(G, morisco.space);
    checkMoriscoStatus(G);
};

export const winter = (G: VQGame, ctx: Ctx): void => {
    if (G.scenario === "tutorial" && G.year === 2 && G.powers.ottoman.ruler === "suleiman") {
        G.deck = G.deck.filter((id) => id !== "vq-006");
        G.discard = G.discard.filter((id) => id !== "vq-006");
        G.futureDeck = G.futureDeck.filter((id) => id !== "vq-006");
        for (const power of POWERS) G.powers[power].cards = G.powers[power].cards.filter((id) => id !== "vq-006");
        G.powers.ottoman.ruler = "selimII";
        G.tutorialEffects!.cyprusTarget = ["cyprus", "candia", "corfu"].find((space) => G.spaces[space].control !== "ottoman");
        if (!G.removed.includes("vq-006")) G.removed.push("vq-006");
        pushLog(G, "Selim II succeeds Suleiman before Turn 3 (Scenario Book card clarification #6).");
    }
    winterMorisco(G);
    resolveMarriages(G, ctx);
    resolvePatronage(G, ctx);
    // English sea captains used as naval leaders return to the World Map pool.
    for (const [captain, leaderId] of Object.entries(SEA_CAPTAIN_LEADER_BY_CAPTAIN)) {
        const state = G.leaders[leaderId];
        if (state === undefined) continue;
        if (G.spaces[state.location] !== undefined) {
            G.spaces[state.location].leaders = G.spaces[state.location].leaders.filter((id) => id !== leaderId);
        } else if (G.seaZones[state.location as SeaZoneID] !== undefined) {
            G.seaZones[state.location as SeaZoneID].leaders = G.seaZones[state.location as SeaZoneID].leaders.filter((id) => id !== leaderId);
        }
        delete G.leaders[leaderId];
        if (!G.powers.england.seaCaptains.includes(captain)) G.powers.england.seaCaptains.push(captain);
        pushLog(G, `${captain} returns to England's sea captain pool.`);
    }
    const neutralized = G.informants.filter((i) => i.neutralized).length;
    G.informants = G.informants.filter((i) => !i.neutralized);
    G.assassinationUsed = [];
    if (G.espionage) {delete G.espionage.walsingham; delete G.espionage.maryBonusTurn; G.espionage.inspections = [];}
    for (const captain of Object.values(G.worldCaptains)) {
        captain.damaged = false;
    }
    if (neutralized > 0) pushLog(G, `${neutralized} neutralized informant(s) returned to their owners.`);
    // Captains finish their annual expedition in place; a colony already placed remains on the map.
    returnLoanedNaval(G);
    winterReturnNaval(G);
    for (const p of POWERS) {
        winterReturnLand(G, p);
        // Replacements at each controlled capital (rule 20.6).
        if (ownerOf(G, p) !== undefined && p === "hre") {
            const cap = CAPITAL_SPACES.hre[0];
            const state = G.spaces[cap];
            const friendlyCapital = (state.control === p || (isPower(state.control) && allied(G, p, state.control))) && !state.unrest;
            const canRegular = friendlyCapital;
            const canMercs = friendlyCapital;
            const canMarker = G.mercenariesForHire === 0;
            if (canRegular || canMercs || canMarker) {
                G.pendingHreReplacement = {canRegular, canMercs, canMarker};
                pushLog(G, "Holy Roman replacement: choose 1 regular, 2 mercenaries, or the Mercenaries for Hire marker 0→4.");
            }
        } else if (ownerOf(G, p) !== undefined) {
            for (const cap of CAPITAL_SPACES[p]) {
                const state = G.spaces[cap];
                if ((state.control === p || (isPower(state.control) && allied(G, p, state.control))) && !state.unrest) {
                    addLand(G, cap, p, "regular", 1);
                }
            }
        }
        G.powers[p].allies = [];
        G.powers[p].treasures = [];
        G.powers[p].cp = 0;
        G.powers[p].cardPlayed = false;
        G.powers[p].passed = false;
        G.powers[p].influence = {...G.minorInfluenceDefaults[p]};
    }
    awardPortugueseTreasures(G, ctx);
    G.minorDiplomacyResolved = [];
    G.piracyUsed = {};
    for (const target of G.majorDiplomacyResolved ?? []) {
        if (target === "ottoman") G.majorInfluence![target] = {spain: 1, england: 0, protestant: 0};
        if (target === "hre") G.majorInfluence![target] = {ottoman: 3, spain: 1, england: 0, france: 0, protestant: 0};
    }
    G.majorDiplomacyResolved = [];
    // Sieges with no besieging force left are lifted.
    for (const def of SPACES) {
        const s = G.spaces[def.id];
        if (s.siege === undefined) {
            continue;
        }
        const besiegers = totalLand(G, def.id, [s.siege.by]);
        const defenders = totalLand(G, def.id, ownersWithLand(G, def.id).filter((c) => c !== s.siege?.by) as Controller[]);
        if (besiegers === 0 || besiegers <= defenders) {
            delete s.siege;
        }
    }
    // The Virgin Queen bonus: up to 5 VP for years Elizabeth remains unmarried (21.2).
    const elizabeth = G.royals.find((r) => r.id === "elizabeth");
    const virginQueenVp = G.virginQueenVpAwarded ?? 0;
    if (elizabeth !== undefined && royalAvailable(elizabeth) && !elizabeth.married && virginQueenVp < 5) {
        addVp(G, "england", 1);
        G.virginQueenVpAwarded = virginQueenVp + 1;
        pushLog(G, `Elizabeth I remains unmarried: England gains 1 Virgin Queen VP (${G.virginQueenVpAwarded}/5).`);
    }
    // Aging (21.3): a royal at eligibility 0 leaves the marriage pool.
    for (const r of G.royals) {
        if (!royalAvailable(r) || (r.turn ?? 1) > G.year) {
            continue;
        }
        let next = r.eligibility ?? 0;
        if (r.gender === "female" || die(ctx) <= 4) {
            next = Math.max(0, next - 1);
        }
        if (next <= 0) {
            r.eligibility = 0;
            r.status = "aged";
            pushLog(G, `${r.name} is no longer eligible to marry.`);
        } else {
            r.eligibility = next;
        }
    }
    settleActivatedMajorVp(G);
    checkCatholicLeague(G, ctx);
    G.year += 1;
    G.checkVictory = true;
    if (hreReligiousPreferenceEnabled(G) && !G.hreReligiousPreferenceRevealed && hreReligiousVp(G) > 0) {
        const publicVictory = checkVictory(G);
        const secretVictory = checkVictory(G, true);
        if ((secretVictory?.winner === "hre" && publicVictory?.winner !== "hre") ||
            (publicVictory?.reason === "domination" && publicVictory.winner !== "hre" &&
                secretVictory?.reason !== "domination")) {
            G.hreReligiousPreferenceRevealed = true;
            pushLog(G, `Holy Roman reveals religious preference: ${HRE_RELIGIOUS_PREFERENCE_NAMES[G.hreReligiousPreference!]} (${hreReligiousVp(G)} VP).`);
        }
    }
    G.vpHistory[String(G.year - 1)] = Object.fromEntries(POWERS.map((p) => [p, powerVp(G, p)]));
    pushLog(G, G.year <= G.endTurn ? `Winter ends. Turn ${G.year} begins.` : `Winter ends. Scenario turn ${G.endTurn} is complete.`);
};

export const checkImmediateVictory = (G: VQGame): { winner: Power; reason: string } | undefined => {
    if (G.scenario === "tutorial") {
        return controlledKeys(G, "ottoman").length >= TUTORIAL_POWER_CARDS.ottoman.military
            ? {winner: "ottoman", reason: "military"} : undefined;
    }
    if (G.espionage?.catholicRebellionVictory) return {winner: "spain", reason: "catholicRebellion"};
    const n = protestantSpaceCount(G);
    if (n > 50) {
        return {winner: "protestant", reason: "protestantReligious"};
    }
    if (n <= 9) {
        const franceAndScotland = protestantSpacesInArea(G, "france") + protestantSpacesInArea(G, "scotland");
        return {winner: franceAndScotland <= 2 ? "france" : "spain", reason: "catholicReligious"};
    }
    for (const p of POWERS) {
        if (ownerOf(G, p) === undefined || isActivatedMajor(G, p)) continue;
        const keys = p === "protestant" ? protestantKeysOutsideNetherlands(G).length : controlledKeys(G, p).length;
        if (keys >= POWER_INFO[p].autoWinKeys && keys > G.militaryVictoryBaseline[p]) {
            return {winner: p, reason: "military"};
        }
    }
    return undefined;
};

export const checkVictory = (G: VQGame, includeSecretHreVp = false): { winner: Power; reason: string } | undefined => {
    const immediate = checkImmediateVictory(G);
    if (immediate !== undefined) {
        return immediate;
    }
    if (G.scenario === "tutorial") {
        if (G.checkVictory && powerVp(G, "ottoman") >= 20) return {winner: "ottoman", reason: "standard"};
        if (G.year > 3) return {winner: "spain", reason: "timeLimit"};
        return undefined;
    }
    const standings = victoryStandings(G, includeSecretHreVp);
    const top = standings[0];
    const second = standings[1];
    const tiedWinner = (): Power => {
        const tied = standings.filter((s) => s.vp === top.vp);
        if (tied.length === 1) {
            return top.power;
        }
        for (let year = G.year - 2; year >= G.startTurn; year--) {
            const hist = G.vpHistory[String(year)];
            if (hist === undefined) {
                continue;
            }
            const best = Math.max(...tied.map((t) => hist[t.power] ?? 0));
            const leaders = tied.filter((t) => (hist[t.power] ?? 0) === best);
            if (leaders.length === 1) {
                return leaders[0].power;
            }
        }
        return top.power;
    };
    if (G.year > G.endTurn) {
        return {winner: tiedWinner(), reason: "timeLimit"};
    }
    if (!G.checkVictory) {
        return undefined;
    }
    if (top.vp >= 25) {
        return {winner: tiedWinner(), reason: "standard"};
    }
    if (G.year > 4 && top.vp - second.vp >= 5) {
        return {winner: top.power, reason: "domination"};
    }
    return undefined;
};

// --------------------------------------------------------------------------
// Events
// --------------------------------------------------------------------------

export const resolveEvent = (G: VQGame, ctx: Ctx, p: Power, effect: CardDef["effect"]): void => {
    if (effect === undefined) {
        return;
    }
    const effects = Array.isArray(effect) ? effect : [effect];
    for (const e of effects) {
        resolveOneEvent(G, ctx, p, e);
    }
};

/** Resolve the subset of official card-table effects with deterministic targets. */
export const resolveOfficialCardEffect = (
    G: VQGame,
    ctx: Ctx,
    p: Power,
    card: CardDef,
    target?: string,
): boolean => {
    const effect = card.officialEffect;
    if (effect === undefined || effect.kind === "manual" || effect.kind === "combat") {
        return false;
    }
    switch (effect.kind) {
        case "conversion": {
            const area = target !== undefined && effect.areas.includes(target as ReligionArea)
                ? target as ReligionArea
                : effect.areas.length === 1 ? effect.areas[0] : undefined;
            if (area === undefined) return false;
            resolveConversions(G, ctx, p, effect.side, area, effect.dice, effect.autoSix, 0,
                {fivesAsSix: effect.fivesAsSix, threesAsFour: effect.threesAsFour});
            return true;
        }
        case "units": {
            if (!effect.placement?.includes("any controlled space")) return false;
            const candidates = SPACES.filter((def) => {
                const state = G.spaces[def.id];
                return state.control === p && !state.unrest && state.siege === undefined;
            }).map((def) => def.id);
            const space = target !== undefined && candidates.includes(target)
                ? target
                : candidates[0];
            if (space === undefined) return false;
            addLand(G, space, p, effect.unit, effect.count);
            pushLog(G, `${powerLabel(p)} places ${effect.count} ${effect.unit} unit(s) in ${SPACE_BY_ID[space].name}.`);
            return true;
        }
        case "draw": {
            const drawn = drawCards(G, ctx, p, effect.count);
            pushLog(G, `${powerLabel(p)} draws ${drawn.length} card(s).`);
            return true;
        }
        case "treasure":
            addTreasure(G, ctx, p, effect.count);
            pushLog(G, `${powerLabel(p)} gains ${effect.count} treasure(s).`);
            return true;
        case "vp": {
            const recipient = effect.power ?? p;
            addVp(G, recipient, effect.amount);
            pushLog(G, `${powerLabel(recipient)} gains ${effect.amount} VP.`);
            return true;
        }
        case "unrest": {
            const candidates = SPACES.filter((space) =>
                (effect.areas === undefined || effect.areas.includes(space.area as ReligionArea)) && !G.spaces[space.id].unrest);
            const chosen = shuffle(ctx, candidates.map((space) => space.id)).slice(0, effect.count);
            chosen.forEach((id) => { G.spaces[id].unrest = true; });
            pushLog(G, `Unrest is placed in ${chosen.map((id) => SPACE_BY_ID[id].name).join(", ") || "no eligible spaces"}.`);
            return true;
        }
        default:
            return false;
    }
};

const resolveOneEvent = (G: VQGame, ctx: Ctx, p: Power, e: EventEffect): void => {
    switch (e.kind) {
        case "conversion":
            resolveConversions(G, ctx, p, e.side, e.area, e.dice, e.autoSix, e.unrest ?? 0);
            break;
        case "unrestSpanish": {
            const candidates = SPACES.filter((s) => s.home === "spain" && !G.spaces[s.id].unrest);
            const picked = shuffle(ctx, candidates.map((s) => s.id)).slice(0, e.count);
            for (const id of picked) {
                G.spaces[id].unrest = true;
                pushLog(G, `Unrest in ${SPACE_BY_ID[id].name}.`);
            }
            break;
        }
        case "unrestArea": {
            const candidates = SPACES.filter((s) => s.area === e.area && !G.spaces[s.id].unrest);
            const picked = shuffle(ctx, candidates.map((s) => s.id)).slice(0, e.count);
            for (const id of picked) {
                G.spaces[id].unrest = true;
                pushLog(G, `Unrest in ${SPACE_BY_ID[id].name}.`);
            }
            break;
        }
        case "draw": {
            const drawn = drawCards(G, ctx, p, e.count);
            pushLog(G, `${powerLabel(p)} draws ${drawn.length} card(s).`);
            break;
        }
        case "treasure":
            addTreasure(G, ctx, p, e.count);
            pushLog(G, `${powerLabel(p)} gains ${e.count} treasure(s).`);
            break;
        case "vp": {
            const target = e.power ?? p;
            if (e.condition === "unmarriedElizabeth") {
                const elizabeth = G.royals.find((r) => r.id === "elizabeth");
                if (elizabeth === undefined || !elizabeth.alive || elizabeth.married) {
                    break;
                }
            }
            if (e.condition === "atWarEngland" && target === "spain" && !atWar(G, "spain", "england")) {
                break;
            }
            if (e.condition === "controlsDutchKeys" && target === "spain") {
                if (!DUTCH_KEYS.every((id) => G.spaces[id].control === "spain")) {
                    break;
                }
            }
            addVp(G, target, e.amount);
            pushLog(G, `${powerLabel(target)} gains ${e.amount} VP.`);
            break;
        }
        case "mercs": {
            const cap = capitalOf(G, p);
            if (cap !== undefined && friendlyControlled(G, p, cap) && !G.spaces[cap].unrest) {
                addLand(G, cap, p, "merc", e.count);
                pushLog(G, `${powerLabel(p)} raises ${e.count} mercenary unit(s) in ${SPACE_BY_ID[cap].name}.`);
            }
            break;
        }
        case "dowCost":
            G.doWCostEnglandSpain = Math.max(1, G.doWCostEnglandSpain + e.amount);
            pushLog(G, `England-Spain war cost is now ${G.doWCostEnglandSpain} CP.`);
            break;
        case "suez": {
            if (G.suezDone) {
                break;
            }
            const r = die(ctx, 6);
            const scienceBonus = G.powers.ottoman.scienceBonuses.includes("excavation") ? 2 : 0;
            const total = r + G.suezAttempts + scienceBonus;
            G.lastRolls = `Suez Canal attempt: ${r} + ${G.suezAttempts}${scienceBonus ? ` + ${scienceBonus} science` : ""} = ${total}`;
            pushLog(G, G.lastRolls);
            if (total >= 6) {
                G.suezDone = true;
                addVp(G, "ottoman", 2);
                G.powers.ottoman.cardModifier += 1;
                pushLog(G, "The Suez Canal is completed! Ottoman gains 2 VP and +1 card.");
            } else {
                G.suezAttempts += 1;
            }
            break;
        }
        case "armada": {
            const port = ["seville", "corunna"].find((id) => G.spaces[id].control === "spain") ?? "seville";
            addNaval(G, port, "spain", "galleon", 2);
            addVp(G, "spain", 1);
            pushLog(G, `The Armada is reinforced with 2 galleons in ${SPACE_BY_ID[port].name} (+1 VP).`);
            break;
        }
        case "discard": {
            const hand = G.powers[p].cards.filter((id) => cardById(id).kind !== "home");
            const picked = shuffle(ctx, hand).slice(0, e.count);
            for (const id of picked) {
                removeCardFromHand(G, p, id);
                discardCard(G, p, id, false);
            }
            pushLog(G, `${powerLabel(p)} discards ${picked.length} card(s).`);
            break;
        }
        case "influence": {
            const minor = MINOR_POWERS.find((m) => (G.powers[p].influence[m] ?? 0) < 9) ?? "papacy";
            G.powers[p].influence[minor] = (G.powers[p].influence[minor] ?? 0) + e.count;
            pushLog(G, `${powerLabel(p)} gains ${e.count} influence with ${minor}.`);
            break;
        }
        default:
            break;
    }
};

export const patronTaken = (G: VQGame, id: string): boolean =>
    POWERS.some((p) => G.powers[p].patrons.includes(id));
