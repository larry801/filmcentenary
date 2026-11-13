import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
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
    MINOR_NAVAL_LIMITS,
    MINOR_NAMES,
    MINOR_POWERS,
    MINOR_REGULAR_LIMITS,
    MERC_LIMITS,
    NAVAL_LIMITS,
    GALLEY_LIMITS,
    GALLEON_LIMITS,
    CORSAIR_LIMITS,
    OTTOMAN_CAVALRY_LIMIT,
    REGULAR_LIMITS,
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
    SpaceDef,
    VQGame,
    VQLocale,
    VictoryReason,
    WinterLossChoice,
    isPower,
    emptyLand,
    emptyNaval,
    spaceHomes,
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
    inlandPortLink,
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
import {canActivateMajor, isActivatedMajor, ownerOf, participatingPowers, playerCount, samePlayer} from "./ownership";
import {TUTORIAL_FORTRESSES, TUTORIAL_KEYS, TUTORIAL_POWER_CARDS, tutorialFortressVp, tutorialSpaceAllowed} from "./tutorial";
import {moveError} from "./movePolicy";

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
        const removed = G.log.length - 250;
        G.log.splice(0, removed);
        // Keep the turn/phase and translation markers pointing at the
        // retained entries.
        if (G.logMarks !== undefined) {
            G.logMarks = G.logMarks
                .map((mark) => ({...mark, at: mark.at - removed}))
                .filter((mark) => mark.at >= 0);
        }
        if (G.logI18n !== undefined) {
            G.logI18n = G.logI18n
                .map((code) => ({...code, at: code.at - removed}))
                .filter((code) => code.at >= 0);
        }
    }
};

/**
 * Pushes a setup line twice: the plain fallback string (used by exports and by
 * code that only knows `G.log`) and a translation code the board can resolve
 * when it renders, which keeps setup notes in the viewer's language even when
 * the match was created under a different locale.
 */
export const pushSetupLog = (
    G: VQGame,
    key: NonNullable<VQGame["logI18n"]>[number]["key"],
    params: Record<string, string | number>,
    fallback: string,
): void => {
    pushLog(G, fallback);
    G.logI18n = [...(G.logI18n ?? []), {at: G.log.length - 1, key, params}];
};

export const powerLabel = (p: Power, locale: VQLocale = "zh_CN"): string => {
    const entry = POWER_NAMES[p];
    if (entry === undefined) return String(p);
    return entry[locale === "en" ? "en" : "zh"];
};

export const controllerLabel = (c: Controller, locale: VQLocale = "zh_CN"): string =>
    isPower(c)
        ? POWER_NAMES[c][locale === "en" ? "en" : "zh"]
        : c === "independent"
            ? (locale === "en" ? "Independent" : "独立")
            : MINOR_NAMES[c][locale === "en" ? "en" : "zh"];

/** Label for any controller (major, minor or independent). */
export const anyControllerLabel = (c: Controller): string =>
    isPower(c) ? POWER_NAMES[c].en : c === "independent" ? "Independent" : c.charAt(0).toUpperCase() + c.slice(1);

export const sortByImpulse = (list: Power[]): Power[] =>
    [...list].sort((a, b) => POWERS.indexOf(a) - POWERS.indexOf(b));

/**
 * Split the official-track surplus (spaces the Scenario Book counts but the
 * reduced map cannot draw) across the four struggle areas in proportion to
 * the displayed map count.  Largest remainders receive the leftover spaces.
 */
const apportionOffMapSpaces = (
    total: number,
    mapByArea: Record<ReligionArea, number>,
): Record<ReligionArea, number> => {
    const areas = Object.keys(mapByArea) as ReligionArea[];
    const mapTotal = areas.reduce((sum, area) => sum + mapByArea[area], 0);
    const result = {france: 0, netherlands: 0, england: 0, scotland: 0};
    if (total <= 0 || mapTotal <= 0) return result;
    const shares = areas.map((area) => {
        const exact = (total * mapByArea[area]) / mapTotal;
        return {area, whole: Math.floor(exact), remainder: exact - Math.floor(exact)};
    });
    let assigned = 0;
    for (const share of shares) {
        result[share.area] = share.whole;
        assigned += share.whole;
    }
    const order = shares.slice().sort((a, b) =>
        b.remainder - a.remainder ||
        mapByArea[b.area] - mapByArea[a.area] ||
        areas.indexOf(a.area) - areas.indexOf(b.area));
    for (let i = 0; assigned < total; i += 1) {
        result[order[i % order.length].area] += 1;
        assigned += 1;
    }
    return result;
};

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
        ...(numPlayers === 2 || numPlayers === 3 || numPlayers === 4 || numPlayers === 5 ? {
            // 2-player: Spain/France vs England/Protestant.  3-player: Spain,
            // England+Protestant and France.  4-player: one seat each for Spain,
            // England, France and Protestant.  5-player: one seat per power.
            // In all four the Ottoman starts as England's activated ally (except
            // 5-player) and the HRE starts inactive and activatable.
            playerPowers: numPlayers === 5
                ? {"0": ["ottoman" as Power], "1": ["spain" as Power], "2": ["england" as Power],
                    "3": ["france" as Power], "4": ["protestant" as Power]}
                : numPlayers === 4
                    ? {"0": ["spain" as Power], "1": ["england" as Power],
                        "2": ["france" as Power], "3": ["protestant" as Power]}
                    : numPlayers === 3
                        ? {"0": ["spain" as Power], "1": ["england" as Power, "protestant" as Power],
                            "2": ["france" as Power]}
                        : scenarioId === "tutorial" ? {"0": ["ottoman" as Power], "1": ["spain" as Power]} :
                            {"0": ["spain" as Power, "france" as Power], "1": ["england" as Power, "protestant" as Power]},
            activatedMajors: {},
            majorDiplomacyResolved: [],
            majorInfluence: numPlayers === 5
                ? {hre: {ottoman: 3, spain: 1, england: 1, france: 1, protestant: 1}}
                : {
                    ottoman: numPlayers === 3 || numPlayers === 4
                        ? {spain: 1, england: 0, france: 0, protestant: 0}
                        : {spain: 1, england: 0, protestant: 0},
                    hre: {ottoman: 3, spain: 1, england: scenarioId === "tutorial" ? 0 : 1, france: scenarioId === "tutorial" ? 0 : 1, protestant: scenarioId === "tutorial" ? 0 : 1},
                },
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
    // The printable map in this repository draws fewer Protestant spaces than
    // the Scenario Book's track (18/30).  Keep the difference as off-map
    // spaces per struggle area so conversions can reach the printed Catholic
    // victory threshold of 9 instead of stopping at the reduced map's floor.
    const mapByArea: Record<ReligionArea, number> = {
        france: protestantSpacesInArea(G, "france"),
        netherlands: protestantSpacesInArea(G, "netherlands"),
        england: protestantSpacesInArea(G, "england"),
        scotland: protestantSpacesInArea(G, "scotland"),
    };
    const offMapTotal = Math.max(0, G.protestantSpacesStart - G.protestantSpacesMapAtStart);
    G.protestantOffMapInitial = apportionOffMapSpaces(offMapTotal, mapByArea);
    G.protestantOffMapConverted = {france: 0, netherlands: 0, england: 0, scotland: 0};

    // Scenario Book p. 12: in the two- to five-player configurations the HRE
    // is not a player power.  Set its Papacy/Venice/Ireland influence markers
    // aside until an ally activates it; `activateMajor` places them again.
    if (G.playerPowers !== undefined && scenarioId !== "tutorial") {
        powers.hre.influence = {};
    }

    // The VP track starts at the printed scenario value.  Keep that value as an
    // offset so the dynamic base/religious scoring below still moves from it.
    for (const p of POWERS) {
        powers[p].bonusVp = scenario.vpStart[p] - (baseVp(G, p) + religiousSpecialVp(G, p)) -
            (scenarioId === "tutorial" && p === "ottoman" ? tutorialFortressVp(G) : 0);
    }
    if ((numPlayers === 2 || numPlayers === 3 || numPlayers === 4) && scenarioId !== "tutorial") {
        G.activatedMajors!.ottoman = {ally: "england", baseline: powerVp(G, "ottoman")};
    }

    pushSetupLog(G, "scenario", {id: scenarioId, start: scenario.startTurn, end: scenario.endTurn},
        `Virgin Queen: ${scenario.nameZh}（第 ${scenario.startTurn}-${scenario.endTurn} 回合）`);
    const vpStart = POWERS.map((p) => `${POWER_NAMES[p].short} ${scenario.vpStart[p]}`).join(" / ");
    pushSetupLog(G, "vpStart", {values: vpStart}, `VP 起始：${vpStart}`);
    pushSetupLog(G, "protestantSpaces", {count: scenario.protestantSpaces},
        `新教地区起始：${scenario.protestantSpaces}`);
    pushSetupLog(G, "spacesPlaced", {count: Object.keys(scenario.spaces).length},
        `已按 Scenario Book 设置 ${Object.keys(scenario.spaces).length} 个地区。`);
    if (scenario.notes !== undefined) {
        for (const [index, note] of scenario.notes.entries()) {
            const noteZh = scenario.notesZh?.[index];
            pushSetupLog(G, "scenarioNote", noteZh === undefined ? {note} : {note, noteZh}, `场景说明：${note}`);
        }
    }
    const unknownPatrons = G.patronsAvailable.filter((id) => patronDef(id)?.rating === null);
    if (unknownPatrons.length > 0) {
        pushSetupLog(G, "unknownPatrons", {count: unknownPatrons.length},
            `注意：${unknownPatrons.length} 位赞助人的评级未转录，冬季赞助结算需要手动处理。`);
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
    const scenario = scenarioSetup(G.scenario, playerCount(G));
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

/**
 * #87 installs Rudolf II as the HRE ruler and stores the stable ruler id
 * "rudolfII" (the royal pool id is "rudolf").  Accept the legacy spelling as
 * well so old saves and hand-built states remain valid.
 *
 * Once the royal is dead the ruler slot is stale: `applyRulerDeath` and the
 * assassination path must therefore be able to stop Patron of Arts from
 * re-placing the Prague marker.  A dead Rudolf is never the HRE ruler for
 * placement purposes even if the ruler string was not updated.
 */
export const rudolfIsHreRuler = (G: VQGame): boolean => {
    const named = G.powers.hre.ruler === "rudolfII" || G.powers.hre.ruler === "rudolf";
    if (!named) return false;
    return !G.royals.some((r) => (r.id === "rudolf" || r.id === "rudolfII") && !r.alive);
};

/** #35 FAQ: Rudolf's death (like his marriage) removes the Prague marker. */
export const removePragueCulturalCenterOnRudolfDeath = (G: VQGame): void => {
    if (G.pragueCulturalCenter !== undefined) {
        delete G.pragueCulturalCenter;
        pushLog(G, "Rudolf II dies; the +2 Prague Cultural Center marker is removed from the game.");
    }
};

export const keepsBothHomeCards = (G: VQGame, p: Power): boolean =>
    p === "ottoman" && suleimanIsOttomanRuler(G);

/** True when the active power still owes its secret Spring Home card choice. */
export const homeCardChoiceRequired = (G: VQGame, p: Power): boolean =>
    !keepsBothHomeCards(G, p) &&
    !G.powers[p].homeCardChoiceDone &&
    homeCardsInHand(G, p).length > 1;

/**
 * The secret religious preference is a six-player rule.  Spring Deployment
 * step 3 in the rules manual limits the choice to "the first turn of a
 * 6-player game", and Scenario Book p. 13 (Activated Major Powers, Additional
 * Considerations) tells players to skip the choice and its VP "in the 2 to
 * 5-player games".  Activating the non-player HRE in a smaller game gives the
 * ally control of a full power, but it does not add the six-player-only
 * preference; the Tutorial is likewise outside the rule.
 */
export const hreReligiousPreferenceEnabled = (G: VQGame): boolean =>
    G.scenario !== "tutorial" && playerCount(G) === 6;

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
    if (p === "hre" && (dead("rudolf") || dead("rudolfII"))) return {cardBonus: 0, admin: 1};
    if (G.powers[p].rulerAdmin !== undefined || G.powers[p].rulerCardBonus !== undefined) {
        return {
            cardBonus: G.powers[p].rulerCardBonus ?? POWER_INFO[p].ruler.cardBonus,
            admin: G.powers[p].rulerAdmin ?? POWER_INFO[p].ruler.admin,
        };
    }
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
    const navigation = (expedition.navigationBonus ?? captain.navigation) - (expedition.navigationPenalty ?? 0);
    delete expedition.navigationPenalty;
    const total = dice[0] + dice[1] + navigation + mapProjection;
    G.lastRolls = `Navigation (${captain.nameEn}): [${dice.join(",")}] + ${captain.navigation}` +
        `${mapProjection ? ` + ${mapProjection} Map Projection` : ""} = ${total}`;
    pushLog(G, G.lastRolls);
    if (total <= 6) {
        if (expedition.companion !== undefined) {
            pushLog(G, `${expedition.companion} is lost before ${captainId}; the companion absorbs the elimination.`);
            delete expedition.companion;
            return true;
        }
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
        const indianIndex = route.indexOf("indianOcean");
        let departedFromIndia = false;
        if (indianIndex >= 0) {
            const afterIndia = route.slice(indianIndex + 1);
            if (from === "guineaCoast") departedFromIndia = afterIndia.includes("southPacific");
            else if (from === "southPacific") departedFromIndia = afterIndia.includes("guineaCoast");
        }
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
    // 16.6: immediately add any loot treasures to the player's hand.
    if (expedition.treasureValues !== undefined) G.powers[expedition.power].treasures.push(...expedition.treasureValues);
    delete G.worldCaptains[captainId];
    G.seaCaptainReturn = {...(G.seaCaptainReturn ?? {}), [captainId]: {power: expedition.power, turn: G.year + 1}};
    pushLog(G, `${captainId} completes a circumnavigation; ${powerLabel(expedition.power)} gains ${vp} VP.`);
    return true;
};

export const resolveColonies = (G: VQGame, ctx: Ctx): void => {
    if (G.scenario === "tutorial") return;
    G.colonyRolls = [];
    for (const [settlement, power] of Object.entries(G.worldColonies)) {
        if (power === undefined) continue;
        const plantation = G.powers[power].scienceBonuses.includes("plantation") ? 1 : 0;
        const fort = G.worldFortresses?.[settlement] === power ? 1 : 0;
        const dice = roll(ctx, 2);
        const total = dice[0] + dice[1] + plantation + fort;
        G.lastRolls = `Colony ${settlement}: [${dice.join(",")}] + ${plantation} plantation + ${fort} fortress = ${total}`;
        pushLog(G, G.lastRolls);
        if (total <= 4) {
            delete G.worldColonies[settlement];
            if (G.worldControls[settlement] === power) delete G.worldControls[settlement];
            G.colonyRolls.push({settlement, power, total, result: "eliminated"});
            pushLog(G, `Colony ${settlement} is eliminated.`);
        } else if (total >= 12) {
            addTreasure(G, ctx, power, 1);
            addVp(G, power, 1);
            G.colonyRolls.push({settlement, power, total, result: "treasureVp"});
            pushLog(G, `Colony ${settlement} yields a treasure and 1 Virginia Dare VP.`);
        } else if (total >= 9) {
            addTreasure(G, ctx, power, 1);
            G.colonyRolls.push({settlement, power, total, result: "treasure"});
            pushLog(G, `Colony ${settlement} yields a treasure.`);
        } else {
            G.colonyRolls.push({settlement, power, total, result: "none"});
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

/** Portuguese galleons defending against world piracy (Rule 16.5). */
export const portugueseGalleonsFor = (G: VQGame, zone: string): number => {
    let total = 0;
    for (const space of SPACES) {
        if (space.ports === undefined) continue;
        const settlementZone = WORLD_SETTLEMENTS_FOR_ZONE(space.id);
        if (settlementZone !== zone) continue;
        total += G.spaces[space.id].naval.portugal?.galleon ?? 0;
    }
    return total;
};

// Zone of a Portuguese world settlement (kept in data/world.ts; duplicated
// here as a tiny lookup to avoid an import cycle).
const WORLD_SETTLEMENTS_FOR_ZONE = (spaceId: string): string | undefined => {
    if (spaceId === "lisbon" || spaceId === "oporto") return "northAtlantic";
    return undefined;
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
        if (loan.leader !== undefined && G.leaders[loan.leader] !== undefined) {
            moveLeaders(G, G.leaders[loan.leader].location, port, [loan.leader]);
            delete G.leaders[loan.leader].loanedTo;
        }
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
export const applyPendingCardDraws = (G: VQGame): Partial<Record<Power, number>> => {
    const bonuses: Partial<Record<Power, number>> = {};
    G.pendingCardDraws = (G.pendingCardDraws ?? []).filter((entry) => {
        if (entry.turn > G.year) return true;
        bonuses[entry.power] = (bonuses[entry.power] ?? 0) + entry.amount;
        return false;
    });
    return bonuses;
};

export const dealYear = (G: VQGame, ctx: Ctx): void => {
    returnSeaCaptains(G);
    rebuildArmada(G);
    refreshPortugueseTreasures(G, ctx);
    G.piracyActions = {};
    G.piracyZones = {};
    G.worldFortressesBuilt = 0;
    refreshJesuits(G);
    const cardDrawBonuses = applyPendingCardDraws(G);
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
        const n = drawCount(G, p) + (cardDrawBonuses[p] ?? 0);
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
    if (G.scenario !== "tutorial" && G.powers.spain.treasures.length === 0 && (G.spanishTreasureRow ?? []).length === 0) {
        G.spanishTreasureRow = Array.from({length: G.philippinesSpanish === true ? 5 : 4}, () => 1 + die(ctx, 5) - 1);
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
        SPACES.filter((s) => spaceHomes(s).includes("scotland") && G.spaces[s.id].religion === "catholic").length >= 3;
    const scotlandProtestant = minor === "scotland" &&
        SPACES.filter((s) => spaceHomes(s).includes("scotland") && G.spaces[s.id].religion === "protestant").length >= 3;
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
        for (const s of SPACES.filter((space) => spaceHomes(space).includes(minor))) {
            if (G.spaces[s.id].control === oldAlly) G.spaces[s.id].control = minor;
        }
        // Rule 24.4: return the minor's units home before the former ally
        // decides its next move (automated: nearest fortified home / port).
        returnCascadedMinorUnits(G, minor);
        pushLog(G, `${powerLabel(winner)} deactivates ${minor}.`);
    } else if (def.activateOrder.includes(winner) && oldAlly !== winner) {
        if (oldAlly !== undefined) {
            G.powers[oldAlly].alliedMinors = G.powers[oldAlly].alliedMinors.filter((m) => m !== minor);
            for (const s of SPACES.filter((space) => spaceHomes(space).includes(minor))) {
                if (G.spaces[s.id].control === oldAlly) G.spaces[s.id].control = minor;
            }
        }
        G.powers[winner].alliedMinors.push(minor);
        for (const s of SPACES.filter((space) => spaceHomes(space).includes(minor))) {
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

/**
 * #2 Ottoman Tribute targets.  The card threatens Spain, the Holy Roman
 * Empire or Venice; the target must not already be allied with the Ottoman.
 * Venice is a minor power (it has no seat), so it is a target only while it is
 * still unaligned and its diplomacy track has not been resolved.
 */
export type OttomanTributeTarget = Power | "venice";

export const ottomanTributeTargets = (G: VQGame): OttomanTributeTarget[] => {
    const options: OttomanTributeTarget[] = (["spain", "hre"] as Power[])
        .filter((target) => !allied(G, "ottoman", target));
    const venice = "venice";
    if (!G.powers.ottoman.warsMinors.includes(venice) &&
        !G.minorDiplomacyResolved.includes(venice) &&
        (!G.minorInfluenceBlocked.ottoman?.includes(venice))) {
        options.push(venice);
    }
    return options;
};

/** A major target that can choose tribute; Venice as a minor cannot. */
export const canPayOttomanTribute = (target: OttomanTributeTarget): target is Power => isPower(target) && target !== "ottoman";

/** The non-Home cards and treasures a power could hand over as tribute. */
export const tributeAssets = (G: VQGame, power: Power): {cards: string[]; treasures: number[]} => ({
    cards: G.powers[power].cards.filter((id) => cardById(id).kind !== "home"),
    treasures: G.powers[power].treasures,
});

/**
 * Applies the #2 war threat to a target that cannot (or will not) pay.
 * Venice is handled as a minor declaration of war, including the diplomatic
 * status check the rules trigger whenever a war starts in the Action Phase.
 */
export const declareOttomanTributeWar = (G: VQGame, ctx: Ctx, target: OttomanTributeTarget): void => {
    if (target === "venice") {
        if (!G.powers.ottoman.warsMinors.includes("venice")) {
            G.powers.ottoman.warsMinors.push("venice");
            pushLog(G, `${powerLabel("ottoman")} declares war on venice.`);
        }
        if (!G.minorInfluenceBlocked.ottoman.includes("venice")) G.minorInfluenceBlocked.ottoman.push("venice");
        delete G.powers.ottoman.influence.venice;
        delete G.minorInfluenceDefaults.ottoman.venice;
        resolveMinorDiplomacy(G, ctx, "venice", {exclude: ["ottoman"]});
        return;
    }
    setWar(G, "ottoman", target);
};

export const friendlyController = (G: VQGame, p: Power, owner: Controller): boolean => {
    if (owner === p) return true;
    if (isPower(owner)) return friendly(G, p, owner);
    if (owner === "independent") return false;
    return G.powers[p].alliedMinors.includes(owner as never);
};

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
        return Math.max(1, G.doWCostEnglandSpain - (G.elizabethExcommunicated ? 2 : 0));
    }
    return WAR_COST[[a, b].sort().join("-")] ?? 2;
};

export const canDeclareWar = (G: VQGame, a: Power, b: Power): boolean => {
    if (a === b || samePlayer(G, a, b) || atWar(G, a, b) || allied(G, a, b)) {
        return false;
    }
    // Rule 9.2 forbids Spain and the Protestant from *allying*, not from going
    // to war.  They may declare war on each other (and do when the Catholic
    // League forms), so no extra restriction belongs here.
    if (G.peaceMadeThisPhase?.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) {
        return false;
    }
    return true;
};

/**
 * Powers whose victory in a diplomatic check would deactivate the target
 * major power instead of taking control of it (Scenario Book p. 13).
 */
const majorDeactivatePowers = (target: Power): Power[] =>
    target === "ottoman" ? ["spain"] : target === "hre" ? ["ottoman"] : [];

/** Scenario Book p. 14: deactivating the HRE also deactivates these allies. */
const HRE_DEACTIVATION_MINORS: MinorPower[] = ["papacy", "venice", "ireland"];

type MinorHome = (typeof SPACES)[number];

/** Nearest home space by printed map position; ties break by space id. */
const nearestHomeSpace = (from: string, candidates: MinorHome[]): MinorHome | undefined => {
    const origin = SPACE_BY_ID[from];
    if (origin === undefined) return undefined;
    // Prefer graph distance (printed adjacency) when available; fall back to
    // Euclidean only as a tie-break proxy for disconnected candidates.
    const graphDist = (id: string): number => {
        const d = landDistance(from, id);
        return d ?? Number.POSITIVE_INFINITY;
    };
    return [...candidates].sort((first, second) => {
        const gd = graphDist(first.id) - graphDist(second.id);
        if (gd !== 0 && Number.isFinite(gd)) return gd;
        return Math.hypot(first.lon - origin.lon, first.lat - origin.lat) -
            Math.hypot(second.lon - origin.lon, second.lat - origin.lat) ||
            first.id.localeCompare(second.id);
    })[0];
};

/** Sea-zone hops from a space or sea zone to a port (sea zones count as spaces). */
const navalDistanceToPort = (from: string, port: string): number | undefined => {
    if (from === port) return 0;
    const startZones = isSeaZone(from) ? [from as SeaZoneID] : portZones(from);
    let nearest: number | undefined;
    for (const zone of startZones) {
        const distance = winterNavalDistance(zone, port);
        if (distance !== undefined && (nearest === undefined || distance < nearest)) nearest = distance;
    }
    return nearest;
};

/** Map point of a space or sea zone (sea zones use their printed label). */
const mapPoint = (id: string): {lon: number; lat: number} | undefined => {
    const space = SPACE_BY_ID[id];
    if (space !== undefined) return space;
    const zone = SEA_ZONE_BY_ID[id];
    return zone === undefined ? undefined : {lon: zone.label[0], lat: zone.label[1]};
};

const nearestMinorHomePort = (G: VQGame, minor: MinorPower, from: string): MinorHome | undefined => {
    const origin = mapPoint(from);
    return SPACES.filter((def) => spaceHomes(def).includes(minor) && G.spaces[def.id].control === minor && isPort(def.id))
        .map((def) => ({
            def,
            distance: navalDistanceToPort(from, def.id),
            geographic: origin === undefined ? Number.POSITIVE_INFINITY :
                Math.hypot(def.lon - origin.lon, def.lat - origin.lat),
        }))
        .filter((entry): entry is {def: MinorHome; distance: number; geographic: number} => entry.distance !== undefined)
        .sort((first, second) => first.distance - second.distance ||
            first.geographic - second.geographic || first.def.id.localeCompare(second.def.id))[0]?.def;
};

/** Nearest friendly-controlled port for a displaced major (rule 12.5). */
const nearestFriendlyPortFromSpace = (G: VQGame, owner: Power, from: string): string | undefined => {
    const origin = mapPoint(from);
    return SPACES.filter((def) => isPort(def.id) && friendlyControlled(G, owner, def.id))
        .map((def) => ({
            def,
            distance: navalDistanceToPort(from, def.id),
            geographic: origin === undefined ? Number.POSITIVE_INFINITY :
                Math.hypot(def.lon - origin.lon, def.lat - origin.lat),
        }))
        .filter((entry): entry is {def: MinorHome; distance: number; geographic: number} => entry.distance !== undefined)
        .sort((first, second) => first.distance - second.distance ||
            first.geographic - second.geographic || first.def.id.localeCompare(second.def.id))[0]?.def.id;
};

/**
 * Rule 12.5: a displaced unit moves to the nearest friendly-controlled
 * fortified space, counting sea zones as spaces and ignoring intervening
 * control.
 */
const nearestFriendlyFortifiedFrom = (G: VQGame, owner: Power, from: string): string | undefined => {
    const origin = mapPoint(from);
    return SPACES.filter((def) => def.id !== from && friendlyControlled(G, owner, def.id) && isFortifiedSpace(G, def.id))
        .map((def) => ({
            def,
            distance: winterDistance(from, def.id),
            geographic: origin === undefined ? Number.POSITIVE_INFINITY :
                Math.hypot(def.lon - origin.lon, def.lat - origin.lat),
        }))
        .filter((entry): entry is {def: MinorHome; distance: number; geographic: number} => entry.distance !== undefined)
        .sort((first, second) => first.distance - second.distance ||
            first.geographic - second.geographic || first.def.id.localeCompare(second.def.id))[0]?.def.id;
};

const moveLandStack = (G: VQGame, from: string, to: string, owner: Controller): void => {
    const source = G.spaces[from].land[owner];
    if (source === undefined) return;
    const target = ensureLand(G, to, owner);
    target.regular += source.regular;
    target.merc += source.merc;
    target.cav += source.cav;
    delete G.spaces[from].land[owner];
};

const moveNavalStack = (G: VQGame, from: string, to: string, owner: Controller): void => {
    const source = navalStateAt(G, from).naval[owner];
    if (source === undefined) return;
    const target = ensureNaval(G, to, owner);
    for (const kind of ["galley", "galleon", "racebuilt", "corsair"] as const) target[kind] += source[kind];
    delete navalStateAt(G, from).naval[owner];
};

const stackLeaders = (G: VQGame, location: string, owner: Power, kind: "army" | "naval"): string[] =>
    navalStateAt(G, location).leaders.filter((id) =>
        LEADER_BY_ID[id]?.power === owner && LEADER_BY_ID[id]?.kind === kind);

/**
 * Scenario Book p. 14 / rule 24.4: deactivating the HRE also deactivates the
 * Papacy, Venice or Ireland when they are its minor allies.  Their land units
 * return to the nearest friendly-controlled fortified home space (or the
 * nearest unfortified home space); naval units return to the nearest friendly-
 * controlled home port.  Units with no legal destination are eliminated.
 */
const returnCascadedMinorUnits = (G: VQGame, minor: MinorPower): void => {
    const homes = SPACES.filter((def) => spaceHomes(def).includes(minor) && G.spaces[def.id].control === minor);
    const fortifiedHomes = homes.filter((def) => isFortifiedSpace(G, def.id));
    for (const def of SPACES) {
        const stack = G.spaces[def.id].land[minor];
        if (stack === undefined || landCount(stack) === 0) continue;
        const destination = nearestHomeSpace(def.id, fortifiedHomes.length > 0 ? fortifiedHomes : homes);
        if (destination === undefined) {
            delete G.spaces[def.id].land[minor];
            pushLog(G, `${controllerLabel(minor)} land units in ${SPACE_BY_ID[def.id].name} are eliminated (no friendly home space).`);
            continue;
        }
        if (destination.id === def.id) continue;
        moveLandStack(G, def.id, destination.id, minor);
        pushLog(G, `${controllerLabel(minor)} land units return from ${SPACE_BY_ID[def.id].name} to ${SPACE_BY_ID[destination.id].name}.`);
    }
    for (const def of SPACES) {
        const stack = G.spaces[def.id].naval[minor];
        if (stack === undefined || navalCount(stack) === 0) continue;
        const destination = nearestMinorHomePort(G, minor, def.id);
        if (destination === undefined) {
            delete G.spaces[def.id].naval[minor];
            pushLog(G, `${controllerLabel(minor)} naval units in ${SPACE_BY_ID[def.id].name} are eliminated (no friendly home port).`);
            continue;
        }
        if (destination.id === def.id) continue;
        moveNavalStack(G, def.id, destination.id, minor);
        pushLog(G, `${controllerLabel(minor)} naval units return from ${SPACE_BY_ID[def.id].name} to ${SPACE_BY_ID[destination.id].name}.`);
    }
    for (const zone of SEA_ZONES) {
        const stack = G.seaZones[zone.id].naval[minor];
        if (stack === undefined || navalCount(stack) === 0) continue;
        const destination = nearestMinorHomePort(G, minor, zone.id);
        if (destination === undefined) {
            delete G.seaZones[zone.id].naval[minor];
            pushLog(G, `${controllerLabel(minor)} naval units in ${zone.name} are eliminated (no friendly home port).`);
            continue;
        }
        moveNavalStack(G, zone.id, destination.id, minor);
        pushLog(G, `${controllerLabel(minor)} naval units return from ${zone.name} to ${SPACE_BY_ID[destination.id].name}.`);
    }
};

/**
 * FAQ #74 (Scottish Lords Rebel): displace every land and naval unit in the
 * given spaces that is not friendly to the power that won the diplomatic
 * check.  Land units (with their army leaders) move to the nearest friendly-
 * controlled fortified space and naval units (with their naval leaders) to the
 * nearest friendly-controlled port.  Units with no legal destination are
 * eliminated and their leaders return to the pool.
 */
export const displaceNonFriendlyUnits = (G: VQGame, winner: Power, spaceIds: string[]): void => {
    for (const id of spaceIds) {
        const space = G.spaces[id];
        if (space === undefined) continue;
        const controllers = new Set<Controller>([
            ...Object.keys(space.land),
            ...Object.keys(space.naval),
        ] as Controller[]);
        for (const controller of controllers) {
            if (friendlyController(G, winner, controller)) continue;
            const owner = isPower(controller) ? controller :
                controller === "independent" ? undefined : minorAlly(G, controller);
            const land = space.land[controller];
            const naval = space.naval[controller];
            if (owner === undefined) {
                if (land !== undefined) delete space.land[controller];
                if (naval !== undefined) delete space.naval[controller];
                pushLog(G, `${controllerLabel(controller)} units in ${SPACE_BY_ID[id].name} are eliminated (no friendly power).`);
                continue;
            }
            if (land !== undefined && landCount(land) > 0) {
                const destination = nearestFriendlyFortifiedFrom(G, owner, id);
                const leaders = isPower(controller) ? stackLeaders(G, id, controller, "army") : [];
                if (destination !== undefined) {
                    moveLandStack(G, id, destination, controller);
                    if (leaders.length > 0) moveLeaders(G, id, destination, leaders);
                    pushLog(G, `${controllerLabel(controller)} land units withdraw from ${SPACE_BY_ID[id].name} to ${SPACE_BY_ID[destination].name}.`);
                } else {
                    delete space.land[controller];
                    if (leaders.length > 0) moveLeaders(G, id, "pool", leaders);
                    pushLog(G, `${controllerLabel(controller)} land units in ${SPACE_BY_ID[id].name} are eliminated (no friendly fortified space).`);
                }
            }
            if (naval !== undefined && navalCount(naval) > 0) {
                const destination = nearestFriendlyPortFromSpace(G, owner, id);
                const leaders = isPower(controller) ? stackLeaders(G, id, controller, "naval") : [];
                if (destination !== undefined) {
                    moveNavalStack(G, id, destination, controller);
                    if (leaders.length > 0) moveLeaders(G, id, destination, leaders);
                    pushLog(G, `${controllerLabel(controller)} naval units withdraw from ${SPACE_BY_ID[id].name} to ${SPACE_BY_ID[destination].name}.`);
                } else {
                    delete space.naval[controller];
                    if (leaders.length > 0) moveLeaders(G, id, "pool", leaders);
                    pushLog(G, `${controllerLabel(controller)} naval units in ${SPACE_BY_ID[id].name} are eliminated (no friendly port).`);
                }
            }
        }
    }
};

/**
 * Rule 24.4 displacement: after the former ally's control markers leave a
 * minor home space, units of other powers there move to the nearest friendly-
 * controlled fortified space (land) or port (naval).  The HRE's own units are
 * left for the ordinary deactivation relocation below.  Units without a legal
 * destination are removed (and any leaders return to the pool).
 */
const displaceFromHreMinorHomes = (G: VQGame, homeSpaces: string[], cascaded: Set<MinorPower>): void => {
    for (const id of homeSpaces) {
        const space = G.spaces[id];
        const controllers = new Set<Controller>([
            ...Object.keys(space.land),
            ...Object.keys(space.naval),
        ] as Controller[]);
        for (const controller of controllers) {
            // Independent units are not a power and the HRE's own units are
            // relocated by the ordinary deactivation pass below.  The units of
            // the cascaded minors are sent home by returnCascadedMinorUnits.
            if (controller === "independent" || controller === "hre" ||
                (!isPower(controller) && cascaded.has(controller))) continue;
            const owner = isPower(controller) ? controller : minorAlly(G, controller);
            const land = space.land[controller];
            const naval = space.naval[controller];
            if (owner === undefined) {
                if (land !== undefined) delete space.land[controller];
                if (naval !== undefined) delete space.naval[controller];
                pushLog(G, `${controllerLabel(controller)} units in ${SPACE_BY_ID[id].name} are eliminated (no friendly power).`);
                continue;
            }
            if (land !== undefined && landCount(land) > 0) {
                const destination = nearestFriendlyFortifiedFrom(G, owner, id);
                const leaders = isPower(controller) ? stackLeaders(G, id, controller, "army") : [];
                if (destination !== undefined) {
                    moveLandStack(G, id, destination, controller);
                    if (leaders.length > 0) moveLeaders(G, id, destination, leaders);
                    pushLog(G, `${controllerLabel(controller)} land units are displaced from ${SPACE_BY_ID[id].name} to ${SPACE_BY_ID[destination].name}.`);
                } else {
                    delete space.land[controller];
                    if (leaders.length > 0) moveLeaders(G, id, "pool", leaders);
                    pushLog(G, `${controllerLabel(controller)} land units in ${SPACE_BY_ID[id].name} are eliminated (no friendly fortified space).`);
                }
            }
            if (naval !== undefined && navalCount(naval) > 0) {
                const destination = nearestFriendlyPortFromSpace(G, owner, id);
                const leaders = isPower(controller) ? stackLeaders(G, id, controller, "naval") : [];
                if (destination !== undefined) {
                    moveNavalStack(G, id, destination, controller);
                    if (leaders.length > 0) moveLeaders(G, id, destination, leaders);
                    pushLog(G, `${controllerLabel(controller)} naval units are displaced from ${SPACE_BY_ID[id].name} to ${SPACE_BY_ID[destination].name}.`);
                } else {
                    delete space.naval[controller];
                    if (leaders.length > 0) moveLeaders(G, id, "pool", leaders);
                    pushLog(G, `${controllerLabel(controller)} naval units in ${SPACE_BY_ID[id].name} are eliminated (no friendly port).`);
                }
            }
        }
    }
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
    // Scenario Book p. 14: all cards and treasures in the deactivating power's
    // hand are immediately discarded (rule 24.4 / Activated Major Deactivation).
    if (state.treasures.length > 0) {
        pushLog(G, `${powerLabel(power)} discards ${state.treasures.length} treasure(s).`);
        state.treasures = [];
    }
    state.cp = 0;
    state.cardModifier = 0;
    G.majorDiplomacyResolved ??= [];
    if (!G.majorDiplomacyResolved.includes(power)) G.majorDiplomacyResolved.push(power);
    if (power === "hre") {
        const cascaded = new Set<MinorPower>();
        const freedHomeSpaces: string[] = [];
        for (const minor of state.alliedMinors) {
            for (const def of SPACES.filter((space) => spaceHomes(space).includes(minor))) {
                if (G.spaces[def.id].control === power) {
                    G.spaces[def.id].control = minor;
                    freedHomeSpaces.push(def.id);
                }
            }
            if (HRE_DEACTIVATION_MINORS.includes(minor)) {
                cascaded.add(minor);
                pushLog(G, `${minor} is deactivated with the Holy Roman Empire.`);
            }
        }
        state.alliedMinors = [];
        // Rule 24.4: first displace other powers from the home spaces whose
        // HRE control marker was just removed, then send the deactivated
        // minor powers' own units home (or eliminate them).
        displaceFromHreMinorHomes(G, freedHomeSpaces, cascaded);
        for (const minor of cascaded) returnCascadedMinorUnits(G, minor);
    }
    for (const def of SPACES) {
        for (const other of POWERS) {
            const relocate = other === power || G.spaces[def.id].control === power;
            if (!relocate) continue;
            const space = G.spaces[def.id];
            if (space.land[other]) {
                const destinations = SPACES.filter((candidate) => spaceHomes(candidate).includes(other) &&
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
                const destination = SPACES.find((candidate) => spaceHomes(candidate).includes(other) && candidate.id !== def.id &&
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
    if (!canActivateMajor(G, power) || isActivatedMajor(G, ally) || ownerOf(G, ally) === undefined || power === ally) return false;
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
    // Scenario Book p. 13: a declaration of war forces a status check, but the
    // declarer and every "Deactivate" power are removed from the candidates so
    // the winner becomes the new controlling ally.  The Deactivate powers stay
    // eligible for ordinary event-driven checks.
    const deactivators = aggressor === undefined ? [] : majorDeactivatePowers(target);
    const candidates = POWERS.filter((power) => power !== target && power !== aggressor &&
        !deactivators.includes(power) &&
        G.majorInfluence![target]![power] !== undefined &&
        (ownerOf(G, power) !== undefined || (G.scenario === "tutorial" && power === "ottoman")));
    const results = candidates.map((power) => ({power, result: die(ctx) + (G.majorInfluence![target]![power] ?? 0)}))
        .sort((first, second) => second.result - first.result || POWERS.indexOf(first.power) - POWERS.indexOf(second.power));
    if (!results.length) return;
    const winner = results[0].power;
    G.majorDiplomacyResolved ??= [];
    G.majorDiplomacyResolved.push(target);
    pushLog(G, `${powerLabel(target)} diplomacy: ${results.map((entry) => `${powerLabel(entry.power)} ${entry.result}`).join("; ")}.`);
    const deactivate = majorDeactivatePowers(target).includes(winner);
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

/** Land counters (regular/mercenary are two sides of the same physical counter). */
export const recordNavalLoss = (G: VQGame, owner: Controller, kind: keyof NavalStack, count = 1): void => {
    if (!isPower(owner)) return;
    G.navalLost ??= {};
    const stack = G.navalLost[owner] ?? {galley: 0, galleon: 0, racebuilt: 0, corsair: 0};
    stack[kind] += count;
    G.navalLost[owner] = stack;
};

export const navalLostCount = (G: VQGame, p: Power): number => navalCount(G.navalLost?.[p]);

export const navalForceCount = (G: VQGame, p: Power): number => {
    let total = 0;
    for (const zone of Object.values(G.seaZones)) total += navalCount(zone.naval[p]);
    for (const space of Object.values(G.spaces)) total += navalCount(space.naval[p]);
    return total;
};

export const navalForceCountController = (G: VQGame, c: Controller): number => {
    let total = 0;
    for (const zone of Object.values(G.seaZones)) total += navalCount(zone.naval[c]);
    for (const space of Object.values(G.spaces)) total += navalCount(space.naval[c]);
    return total;
};

export const navalLostCountController = (G: VQGame, c: Controller): number => navalCount(G.navalLost?.[c as Power]);

export const cavalryCount = (G: VQGame, p: Power): number =>
    Object.values(G.spaces).reduce((total, space) => total + (space.land[p]?.cav ?? 0), 0);

/** Total mercs for a major power (map + foreign wars + armada). */
export const mercCount = (G: VQGame, p: Power): number => {
    let total = 0;
    for (const space of Object.values(G.spaces)) total += space.land[p]?.merc ?? 0;
    total += G.foreignWars[p]?.units.merc ?? 0;
    if (p === "spain" && G.armada?.land !== undefined) total += G.armada.land.merc;
    return total;
};

/** Total naval units on the map of a given type for a major power. */
export const navalForceCountByKind = (G: VQGame, p: Power, kind: keyof NavalStack): number => {
    let total = 0;
    for (const zone of Object.values(G.seaZones)) total += zone.naval[p]?.[kind] ?? 0;
    for (const space of Object.values(G.spaces)) total += space.naval[p]?.[kind] ?? 0;
    return total;
};

/** Naval units sunk but still counted against the force-pool limit, by type. */
export const navalLostCountByKind = (G: VQGame, p: Power, kind: keyof NavalStack): number =>
    G.navalLost?.[p]?.[kind] ?? 0;

export const landForceCount = (G: VQGame, p: Power): number =>
    Object.values(G.spaces).reduce((total, space) => {
        const stack = space.land[p];
        return total + (stack === undefined ? 0 : stack.regular + stack.merc);
    }, 0);

export const landForceCountController = (G: VQGame, c: Controller): number =>
    Object.values(G.spaces).reduce((total, space) => {
        const stack = space.land[c];
        return total + (stack === undefined ? 0 : stack.regular + stack.merc);
    }, 0);

export const regularCount = (G: VQGame, p: Power): number => {
    let total = 0;
    for (const space of Object.values(G.spaces)) total += space.land[p]?.regular ?? 0;
    total += G.foreignWars[p]?.units.regular ?? 0;
    if (p === "spain" && G.armada?.land !== undefined) total += G.armada.land.regular;
    return total;
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
 * of spaces drawn on our reconstructed map.  The surplus is kept as off-map
 * spaces (`protestantOffMapInitial` / `protestantOffMapConverted`), so map
 * conversions and Catholic conversions of the missing spaces both move the
 * official marker.
 */
export const protestantSpaceCount = (G: VQGame): number => {
    const current = mapProtestantSpaceCount(G);
    if (G.protestantOffMapConverted === undefined) {
        return Math.max(0, G.protestantSpacesStart + (current - G.protestantSpacesMapAtStart));
    }
    const convertedOffMap = Object.values(G.protestantOffMapConverted).reduce((sum, n) => sum + n, 0);
    return Math.max(0, G.protestantSpacesStart + (current - G.protestantSpacesMapAtStart) - convertedOffMap);
};

/** Off-map Protestant spaces still counted by the printed track. */
export const protestantOffMapCount = (G: VQGame): number => {
    if (G.protestantOffMapInitial === undefined || G.protestantOffMapConverted === undefined) return 0;
    return Math.max(0, Object.values(G.protestantOffMapInitial).reduce((sum, n) => sum + n, 0) -
        Object.values(G.protestantOffMapConverted).reduce((sum, n) => sum + n, 0));
};

/** Off-map Protestant spaces still counted in one struggle area. */
export const protestantOffMapInArea = (G: VQGame, area: ReligionArea): number => {
    if (G.protestantOffMapInitial === undefined || G.protestantOffMapConverted === undefined) return 0;
    return Math.max(0, (G.protestantOffMapInitial[area] ?? 0) - (G.protestantOffMapConverted[area] ?? 0));
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
    // Protestant Spaces Card, "Special VP by Power".  Rows cover 5-space bands
    // starting at 10; above 50 the Protestant religious victory already ended
    // the game, so the last band is used as a clamp.
    const row = Math.max(0, Math.min(8, Math.floor((n - 10) / 5)));
    const table = {
        spain: [7, 6, 5, 4, 3, 2, 1, 0, 0],
        england: [0, 0, 1, 1, 2, 2, 3, 3, 3],
        protestant: [0, 1, 2, 3, 4, 5, 6, 7, 7],
    };
    switch (p) {
        case "spain":
        case "england":
        case "protestant":
            return table[p][row];
        case "hre":
            return G.hreReligiousPreferenceRevealed ? hreReligiousVp(G) : 0;
        default:
            return 0;
    }
};

/**
 * Rule 25.3: award Paris and Master of Central Europe bonus VP during the
 * Victory Determination Phase. Paris pays 2 VP only from Turn 5 onward when
 * the power's ruler/leader condition is met; otherwise 1 VP. Central Europe
 * pays the Holy Roman 1 VP while Prague, Vienna and Buda are all controlled
 * and free of unrest.
 */
export const awardAnnualLocationVp = (G: VQGame): void => {
    if (G.scenario === "tutorial") {
        return;
    }
    const paris = G.spaces.paris;
    if (paris !== undefined && !paris.unrest &&
        (paris.control === "france" || paris.control === "spain" || paris.control === "protestant")) {
        const power = paris.control;
        const late = G.year >= 5 && G.year <= 7;
        const doubles =
            (power === "france" && late && (G.powers.france.ruler === "charlesIX" || G.powers.france.ruler === "henryIII")) ||
            (power === "spain" && late && G.leaders.guise?.location === "paris") ||
            (power === "protestant" && late && G.leaders.navarre?.location === "paris");
        const vp = doubles ? 2 : 1;
        addVp(G, power, vp);
        pushLog(G, `${powerLabel(power)} gains ${vp} Paris VP.`);
    }
    if (["prague", "vienna", "buda"].every((id) => G.spaces[id]?.control === "hre" && !G.spaces[id].unrest)) {
        addVp(G, "hre", 1);
        pushLog(G, "The Holy Roman Empire gains 1 Master of Central Europe VP.");
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

/** All powers currently besieging this space (allied double-sieges included). */
export const besiegerOwners = (G: VQGame, space: string): Power[] => {
    const siege = G.spaces[space]?.siege;
    if (siege === undefined) return [];
    return siege.besiegers ?? [siege.by];
};

/** Controllers whose land stacks are inside the fortification (defender side). */
export const defenderOwners = (G: VQGame, space: string): Controller[] => {
    const siege = G.spaces[space]?.siege;
    const owners = ownersWithLand(G, space);
    if (siege === undefined) return owners;
    if (siege.inside !== undefined) return owners.filter((c) => siege.inside!.includes(c));
    // Derived inside: the space controller (or its allies) and any stack at
    // war with a besieger count as inside.  Allied third parties and neutral
    // passers-by do not.
    const besiegers = besiegerOwners(G, space);
    return owners.filter((c) => {
        if (besiegers.includes(c as Power)) return false;
        if (!isPower(c)) return true;
        return besiegers.some((b) => atWar(G, b, c));
    });
};

export const defenderLandCount = (G: VQGame, space: string): number =>
    totalLand(G, space, defenderOwners(G, space));

/** Add `power` to a space's besiegers, creating the siege if needed. */
export const addBesieger = (G: VQGame, space: string, power: Power): void => {
    const state = G.spaces[space];
    if (state === undefined) return;
    if (state.siege === undefined) {
        state.siege = {by: power, besiegers: [power], sinceImpulse: G.impulse};
    } else if (!besiegerOwners(G, space).includes(power)) {
        state.siege.besiegers = [...besiegerOwners(G, space), power];
        state.siege.by = state.siege.besiegers[0];
    }
};

/**
 * Rule 5.2: the maximum number of land units a single formation may contain,
 * based on its army leaders.  No leader caps the formation at 4 units; one
 * leader uses its Command Rating; two or more use the sum of the two highest
 * Command Ratings.  Army leaders themselves never count against the limit.
 */
export const formationCapacity = (leaders: string[]): number => {
    const commands = leaders
        .map((id) => LEADER_BY_ID[id]?.command ?? 0)
        .sort((a, b) => b - a)
        .slice(0, 2);
    return Math.max(4, commands.reduce((sum, command) => sum + command, 0));
};

export const enemyOwners = (G: VQGame, p: Power, space: string): Controller[] =>
    ownersWithLand(G, space).filter((c) => {
        if (friendlyController(G, p, c) || c === "independent") return false;
        return isPower(c) ? atWar(G, p, c) : true;
    });

export const spaceHasEnemyLand = (G: VQGame, p: Power, space: string): boolean =>
    enemyOwners(G, p, space).some((c) => landCount(G.spaces[space].land[c]) > 0);

export const spaceHasEnemyLeader = (G: VQGame, p: Power, space: string): boolean => {
    const leaders = G.spaces[space]?.leaders ?? [];
    return leaders.some((id) => {
        const owner = leaderPower(G, id);
        return owner !== undefined && owner !== p && !friendlyController(G, p, owner);
    });
};
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

export const leaderPower = (G: VQGame, id: string): Power | undefined =>
    G.leaders[id]?.loanedTo ?? LEADER_BY_ID[id]?.power;

export const bestBattle = (G: VQGame, loc: string, owners: Controller[], kind: "army" | "naval" = "army"): number => {
    let best = 0;
    for (const id of leadersAt(G, loc)) {
        const def = LEADER_BY_ID[id];
        if (def === undefined || def.kind !== kind) {
            continue;
        }
        const owner = leaderPower(G, id);
        if (owner !== undefined && owners.includes(owner)) {
            best = Math.max(best, def.battle);
        }
    }
    return best;
};

export const bestPiracy = (G: VQGame, loc: string, owners: Controller[]): number => {
    let best = 0;
    for (const id of leadersAt(G, loc)) {
        const def = LEADER_BY_ID[id];
        const owner = leaderPower(G, id);
        if (def !== undefined && owner !== undefined && owners.includes(owner)) {
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
    // Rule 15.1: an assault is prohibited outright while the power controlling
    // the fortified space has any non-corsair naval unit in an adjacent zone.
    const controller = state.control;
    for (const zone of portZones(space)) {
        const stack = G.seaZones[zone].naval[controller as Power];
        if (stack !== undefined && stack.galley + stack.galleon + stack.racebuilt > 0) {
            return false;
        }
        if (controller === "spain" && G.armada?.location === zone) {
            return false;
        }
    }
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

export const capitalSpacesFor = (G: VQGame, p: Power): string[] => {
    if (p === "hre" && G.hreCapital !== undefined) {
        return [G.hreCapital, ...CAPITAL_SPACES.hre.filter((id) => id !== G.hreCapital)];
    }
    if (p === "protestant" && G.protestantCapital !== undefined) {
        return [G.protestantCapital, ...CAPITAL_SPACES.protestant.filter((id) => id !== G.protestantCapital)];
    }
    return CAPITAL_SPACES[p];
};

export const capitalOf = (G: VQGame, p: Power): string | undefined => {
    const controlledCap = capitalSpacesFor(G, p).find((id) => {
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

/** A leader waiting on the Turn Track for a future Spring Deployment. */
export interface ScheduledLeaderEntry {
    id: string;
    power: Power;
    turn: number;
}

/**
 * Leaders in the pool whose arrival is scheduled after the current turn and
 * before the scenario ends.  This is the public Turn Track: the Leader Entry
 * Table (8.1) plus leaders returning from the pool (battle losses, Orange after
 * a rebellion).  Leaders held off-map have no `returnTurn` and are never
 * scheduled; default leaders are a fallback, not an entry.
 */
export const scheduledLeaderEntries = (G: VQGame): ScheduledLeaderEntry[] =>
    Object.keys(G.leaders)
        .filter((id) => {
            const def = LEADER_BY_ID[id];
            const state = G.leaders[id];
            return def !== undefined && !isDefaultLeader(id) && state.location === "pool" &&
                state.returnTurn !== undefined && state.returnTurn > G.year && state.returnTurn <= G.endTurn;
        })
        .map((id) => ({id, power: LEADER_BY_ID[id].power, turn: G.leaders[id].returnTurn!}))
        .sort((a, b) => a.turn - b.turn || POWER_INDEX[a.power] - POWER_INDEX[b.power] || a.id.localeCompare(b.id));

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

/** Home ports a returning naval leader may currently be placed in. */
export const homePortsFor = (G: VQGame, p: Power): string[] =>
    SPACES.filter((space) => spaceHomes(space).includes(p) && space.ports !== undefined &&
        G.spaces[space.id].siege === undefined && !G.spaces[space.id].unrest &&
        friendlyControlled(G, p, space.id)).map((space) => space.id);

export const placeArrivingLeader = (G: VQGame, id: string, destination: string): void => {
    const def = LEADER_BY_ID[id];
    G.spaces[destination].leaders.push(id);
    G.leaders[id] = {id, location: destination};
    pushLog(G, `${def?.name ?? id} arrives in ${SPACE_BY_ID[destination].name}.`);
};

/**
 * Safe fallback for a pending naval port choice: put the leader in the first
 * port that is still legal (normally the first option recorded on arrival).
 * If no port is legal the leader stays in the pool.
 */
export const autoPlaceNavalLeaderArrivals = (G: VQGame, p: Power): void => {
    const pending = (G.navalLeaderArrivals ?? []).filter((entry) => entry.power === p);
    if (pending.length === 0) return;
    for (const entry of pending) {
        const legal = homePortsFor(G, p);
        const destination = entry.ports.find((port) => legal.includes(port)) ?? legal[0];
        if (destination !== undefined) placeArrivingLeader(G, entry.leader, destination);
    }
    G.navalLeaderArrivals = (G.navalLeaderArrivals ?? []).filter((entry) => entry.power !== p);
    if (G.navalLeaderArrivals.length === 0) delete G.navalLeaderArrivals;
};

/**
 * Safe fallback for a skipped Tournament Orange choice: place him in the
 * Protestant capital.  If no friendly capital is available he stays in the pool
 * for a later Spring Deployment.
 */
export const autoResolveOrangeArrival = (G: VQGame): void => {
    if (!G.orangeArrivalPending) return;
    delete G.orangeArrivalPending;
    const cap = capitalOf(G, "protestant");
    if (cap !== undefined && G.spaces[cap] !== undefined && friendlyControlled(G, "protestant", cap) && !G.spaces[cap].unrest) {
        placeArrivingLeader(G, "orange", cap);
    }
};

/**
 * Bring leaders waiting in the pool onto the map (Spring Deployment, 10.4).
 * With `interactive`, naval leaders record a pending home-port choice for the
 * owning player instead of being placed immediately (the UI/choice stage then
 * calls chooseNavalLeaderPort). Without it, or when no port is legal, the
 * original automatic placement applies.
 */
export const arriveLeaders = (G: VQGame, options?: {interactive?: boolean}): void => {
    for (const p of POWERS) {
        if (ownerOf(G, p) === undefined) continue;
        const cap = capitalOf(G, p);
        const ids = Object.keys(G.leaders);
        for (const id of ids) {
            const def = LEADER_BY_ID[id];
            const st = G.leaders[id];
            if (def === undefined || def.power !== p || isDefaultLeader(id) || st.location !== "pool" ||
                (st.returnTurn ?? 0) > G.year) continue;
            if (def.kind === "naval") {
                const ports = homePortsFor(G, p);
                // No legal port: the leader keeps waiting in the pool.
                if (ports.length === 0) continue;
                if (options?.interactive) {
                    const pending = G.navalLeaderArrivals ?? [];
                    if (!pending.some((entry) => entry.leader === id)) {
                        G.navalLeaderArrivals = [...pending, {leader: id, power: p, ports}];
                        pushLog(G, `${def.name} returns from the pool; ${powerLabel(p)} must choose a home port.`);
                    }
                    continue;
                }
                placeArrivingLeader(G, id, ports[0]);
                continue;
            }
            // Tournament: Orange arrives with his entry-turn pool marker removed,
            // but the Protestant player may hold him back to lead a rebellion
            // (Scenario Book p. 9).  In interactive mode raise the flag and let
            // the player choose; non-interactive (and endPhaseTurn fallback)
            // places him in the capital automatically.
            if (options?.interactive && id === "orange" && G.scenario === "tournament" &&
                !G.orangeArrivalPending) {
                G.orangeArrivalPending = true;
                pushLog(G, "William of Orange has arrived; Protestant must choose to place him in the capital or hold him back for a rebellion.");
                continue;
            }
            const destination = cap;
            if (destination === undefined || G.spaces[destination] === undefined || !friendlyControlled(G, p, destination) || G.spaces[destination].unrest) continue;
            placeArrivingLeader(G, id, destination);
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

export const isHomeSpace = (id: string, p: Power): boolean => {
    const def = SPACE_BY_ID[id];
    return def !== undefined && spaceHomes(def).includes(p);
};

/** True when the space treats `p` as a home (any split-home half). */
export const spaceTreatsAsHome = (G: VQGame, def: SpaceDef, p: Power): boolean =>
    spaceHomes(def).includes(p) || (def.control === p && spaceHomes(def).includes(p));

/**
 * #18 City State Rebels (FAQ): an occupied, fortified home space is a legal
 * target only when its controller neither treats it as home nor is allied
 * with the home power that would receive the space if the garrison is wiped
 * out. An independent home power has no allies, so only the "treats it as
 * home" restriction can apply to those city states.
 */
export const isCityRebelsTarget = (G: VQGame, id: string): boolean => {
    const def = SPACE_BY_ID[id];
    const state = G.spaces[id];
    if (def === undefined || state === undefined || !isFortifiedSpace(G, id)) return false;
    // "Treats it as home": the controller is a home power for this space.
    if (spaceHomes(def).includes(state.control)) return false;
    // The receiving home is the home that would take the space when the
    // garrison is wiped — for a split-home space the non-initial half
    // (Protestant for both Dutch and Huguenot splits); otherwise the sole home.
    const receiver = cityRebelsReceiver(def);
    if (isPower(state.control)) {
        return !(isPower(receiver) && friendlyController(G, state.control as Power, receiver) ||
            (!isPower(receiver) && receiver !== "independent" && friendlyController(G, state.control as Power, receiver as never)));
    }
    return true;
};

export const cityRebelsReceiver = (def: SpaceDef): Controller =>
    def.homes !== undefined ? def.homes.find((h) => h !== def.home) ?? def.home : def.home;

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
 * Line of communication (rules 12.1): BFS over land + sea.  Land steps go
 * through friendly, unrest-free, enemy-free spaces; sea steps go through a
 * sea zone containing friendly naval units with no enemy naval units, then
 * out to its ports.  Any number of sea zones may be chained.
 */
export const hasLOC = (G: VQGame, p: Power, target: string): boolean => {
    if (G.scenario === "tutorial") {
        if (!tutorialSpaceAllowed(target)) return false;
        const starts = SPACES.filter((space) => tutorialSpaceAllowed(space.id) && isFortifiedSpace(G, space.id) &&
            spaceHomes(space).some((home) => friendlyController(G, p, home)) && friendlyControlled(G, p, space.id) && !G.spaces[space.id].unrest).map((space) => space.id);
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
    const passable = (id: string): boolean =>
        friendlyControlled(G, p, id) && !G.spaces[id].unrest && !spaceHasEnemyLand(G, p, id) &&
        !spaceHasEnemyNaval(G, p, id) && !spaceHasEnemyLeader(G, p, id);
    const starts: string[] = [];
    for (const def of SPACES) {
        if (friendlyControlled(G, p, def.id) && isFortifiedSpace(G, def.id) && !G.spaces[def.id].unrest &&
            spaceHomes(def).some((home) => friendlyController(G, p, home))) {
            starts.push(def.id);
        }
    }
    // Unified BFS over land + sea (Rule 12.1): land steps through friendly,
    // unrest-free, enemy-free land; sea steps through a sea zone containing
    // friendly naval units with no enemy naval units, then to its ports.
    // This generalises the previous one-sea-hop simplification to any
    // number of sea zones in the chain.
    const queue: string[] = starts.slice();
    const seen = new Set<string>(starts);
    const seaPassable = (zone: SeaZoneID): boolean => {
        if (spaceHasEnemyNaval(G, p, zone)) return false;
        // Blocked by enemy naval presence anywhere in the zone.
        if (ownersWithNaval(G, zone).some((owner) => !friendlyController(G, p, owner))) return false;
        return ownersWithNaval(G, zone).some((owner) => friendlyController(G, p, owner));
    };
    while (queue.length > 0) {
        const cur = queue.shift() as string;
        if (cur === target) return true;
        const neighbors: string[] = isSeaZone(cur)
            ? [...SEA_ZONE_BY_ID[cur as SeaZoneID].adjacent, ...zonePorts(cur as SeaZoneID)]
            : [...landNeighbors(cur).map((n) => n.id), ...portZones(cur)];
        for (const next of neighbors) {
            if (seen.has(next)) continue;
            if (next === target) return true;
            if (isSeaZone(next)) {
                if (!seaPassable(next as SeaZoneID)) continue;
            } else if (!passable(next)) {
                continue;
            }
            seen.add(next);
            queue.push(next);
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
    if (isPower(s.control) && s.control !== p && !atWar(G, p, s.control)) {
        return {ok: false, reason: "target must be independent or enemy-controlled"};
    }
    const friendlyPresent = ownersWithLand(G, space).some((c) => c === p && landCount(G.spaces[space].land[c]) > 0);
    if (friendlyPresent) {
        return {ok: true};
    }
    const adjacentFriendly = landNeighbors(space).some((n) => !n.pass && ownersWithLand(G, n.id).some((c) => c === p && landCount(G.spaces[n.id].land[c]) > 0));
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

export const religionCandidates = (G: VQGame, side: Religion, area: ReligionArea, base?: string[]): string[] => {
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
        const isSide = (id: string): boolean =>
            base !== undefined ? base.includes(id) : G.spaces[id].religion === side;
        // Adjacent (or port-connected) space already of the target religion.
        const adjacent = landNeighbors(s.id).some((n) => isSide(n.id) && !G.spaces[n.id].unrest)
            || (s.ports ?? []).some((z) => zonePorts(z).some((port) => port !== s.id && isSide(port) && !G.spaces[port].unrest));
        if (!adjacent) {
            return false;
        }
        return true;
    }).map((s) => s.id);
};

const pickCandidate = (G: VQGame, ctx: Ctx, side: Religion, area: ReligionArea, allowUnits: boolean, base?: string[]): string | undefined => {
    let candidates = religionCandidates(G, side, area, base);
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
export const checkCyprusVp = (G: VQGame, power: Power, location: string): void => {
    if (power !== "ottoman" || G.cyprusAwarded === true || G.cyprusTarget !== location) return;
    G.cyprusAwarded = true;
    addVp(G, "ottoman", 1);
    pushLog(G, "The Ottoman seizes the Cyprus VP target and gains 1 VP.");
};

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
    unrestOnOnes = false,
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
    let offMapConverted = 0;
    let offMapRestored = 0;
    // The reduced map may already be at an area's final Protestant space while
    // the printed track still counts spaces that are not drawn.  Catholic
    // conversions remove those off-map spaces so the official marker can fall
    // to the printed Catholic-victory threshold.
    if (G.protestantOffMapInitial === undefined) {
        const mapByArea: Record<ReligionArea, number> = {
            france: protestantSpacesInArea(G, "france"),
            netherlands: protestantSpacesInArea(G, "netherlands"),
            england: protestantSpacesInArea(G, "england"),
            scotland: protestantSpacesInArea(G, "scotland"),
        };
        G.protestantOffMapInitial = apportionOffMapSpaces(
            Math.max(0, G.protestantSpacesStart - G.protestantSpacesMapAtStart), mapByArea);
    }
    if (G.protestantOffMapConverted === undefined) {
        G.protestantOffMapConverted = {france: 0, netherlands: 0, england: 0, scotland: 0};
    }
    const convertOffMap = (): boolean => {
        if (side !== "catholic" || G.protestantOffMapInitial === undefined ||
            G.protestantOffMapConverted === undefined) return false;
        const remainingMap = SPACES.filter((s) => s.area === area &&
            G.spaces[s.id].religion === "protestant").length;
        if (remainingMap !== 1) return false;
        const remaining = (G.protestantOffMapInitial[area] ?? 0) - (G.protestantOffMapConverted[area] ?? 0);
        if (remaining <= 0) return false;
        G.protestantOffMapConverted[area] += 1;
        offMapConverted += 1;
        return true;
    };
    const restoreOffMap = (): boolean => {
        if (side !== "protestant" || G.protestantOffMapConverted === undefined) return false;
        // Only fall back to a missing (off-map) space when the map itself has
        // at most its final Catholic space in this area.  Otherwise the normal
        // adjacency and core-presence checks stay authoritative.
        const remainingCatholic = SPACES.filter((s) => s.area === area &&
            G.spaces[s.id].religion === "catholic").length;
        const convertedOffMap = G.protestantOffMapConverted[area] ?? 0;
        if (remainingCatholic > 1 || remainingCatholic + convertedOffMap <= 1) return false;
        G.protestantOffMapConverted[area] -= 1;
        offMapRestored += 1;
        return true;
    };
    for (let i = 0; i < major; i++) {
        const target = pickCandidate(G, ctx, side, area, true);
        if (target === undefined) {
            if (restoreOffMap() || convertOffMap()) continue;
            break;
        }
        G.spaces[target].religion = side;
        converted.push(target);
    }
    for (let i = 0; i < minor; i++) {
        const target = pickCandidate(G, ctx, side, area, false);
        if (target === undefined) {
            if (restoreOffMap() || convertOffMap()) continue;
            break;
        }
        G.spaces[target].religion = side;
        converted.push(target);
    }
    let unrestTokens = 0;
    if (unrestOnOnes) {
        const candidates = SPACES.filter((space) => space.area === area && !G.spaces[space.id].unrest);
        for (const space of candidates.slice(0, ones + extraUnrest)) {
            G.spaces[space.id].unrest = true;
            unrestTokens += 1;
        }
    } else {
        unrestTokens = Math.min((ones > 0 ? 1 : 0) + extraUnrest, converted.length);
        for (let i = 0; i < unrestTokens; i++) {
            const target = converted[i % converted.length];
            if (target !== undefined) {
                G.spaces[target].unrest = true;
            }
        }
    }
    G.lastRolls = `${side} conversions in ${AREA_NAMES[area].en}: [${dice.join(", ")}]`;
    pushLog(G, `${powerLabel(p)}: ${G.lastRolls}`);
    if (converted.length > 0) {
        pushLog(G, `Converted: ${converted.map((id) => SPACE_BY_ID[id].name).join(", ")}${unrestTokens > 0 ? `; unrest in ${unrestTokens} space(s)` : ""}.`);
    } else if (offMapConverted === 0 && offMapRestored === 0) {
        pushLog(G, "No conversions possible.");
    }
    if (offMapConverted > 0) {
        pushLog(G, `Converted off-map: ${offMapConverted} Protestant space(s).`);
    }
    if (offMapRestored > 0) {
        pushLog(G, `Restored off-map: ${offMapRestored} Protestant space(s).`);
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
        .filter((id) => friendlyControlled(G, p, id));
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

/**
 * Move `count` units out of a space to a legal adjacent retreat, or eliminate
 * them when no legal space exists (rule 14.1). Used for the surplus above the
 * four units that may withdraw into a fortification.
 */
const retreatSurplusLand = (
    G: VQGame,
    p: Power,
    space: string,
    owners: Controller[],
    count: number,
    avoid: string[],
): void => {
    let left = count;
    const dest = retreatDestination(G, p, space, avoid);
    if (dest === undefined) {
        for (const kind of ["cav", "merc", "regular"] as const) {
            for (const c of owners) {
                const st = G.spaces[space].land[c];
                if (st === undefined) continue;
                while (left > 0 && st[kind] > 0) {
                    st[kind] -= 1;
                    left -= 1;
                }
                if (landCount(st) === 0) delete G.spaces[space].land[c];
            }
        }
        pushLog(G, `${left} surplus defender(s) are eliminated for want of a retreat.`);
        return;
    }
    for (const kind of ["cav", "merc", "regular"] as const) {
        for (const c of owners) {
            const st = G.spaces[space].land[c];
            if (st === undefined) continue;
            const move = Math.min(left, st[kind]);
            if (move > 0) {
                ensureLand(G, dest, c)[kind] += move;
                st[kind] -= move;
                left -= move;
            }
            if (landCount(st) === 0) delete G.spaces[space].land[c];
        }
    }
    pushLog(G, `${count} surplus defender(s) retreat to ${SPACE_BY_ID[dest].name}.`);
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
    // Rule 14 step 8: if both sides are eliminated, the side that rolled more
    // dice retains 1 unit; on equal dice the defender retains it.
    if (totalLand(G, space, defenderOwners) === 0 && totalLand(G, space, [attacker]) === 0) {
        if (aDice > dDice) {
            ensureLand(G, space, attacker).regular += 1;
            pushLog(G, `${powerLabel(attacker)} retains 1 unit after both sides are eliminated.`);
        } else {
            const defender = defenderOwners.find(isPower) ?? defenderOwners[0];
            if (defender !== undefined) {
                ensureLand(G, space, defender).regular += 1;
                pushLog(G, `${controllerLabel(defender)} retains 1 unit after both sides are eliminated.`);
            }
        }
    }
    const winner: "attacker" | "defender" = aHits > dHits ? "attacker" : "defender";
    // Rule 13.1/13.3: track the losing formation so it may auto-avoid and may
    // not move again this impulse.
    const losers = winner === "attacker" ? defenderOwners : [attacker];
    if (G.lostBattleImpulse?.impulse !== G.impulse) G.lostBattleImpulse = {impulse: G.impulse, owners: []};
    for (const o of losers) {
        if (!G.lostBattleImpulse.owners.includes(o)) G.lostBattleImpulse.owners.push(o);
    }
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
            const surplus = defendersLeft - inside;
            if (surplus > 0) {
                const defenderMajor = defenderOwners.find((c) => isPower(c)) as Power | undefined;
                if (defenderMajor !== undefined) {
                    retreatSurplusLand(G, defenderMajor, space, defenderOwners, surplus, [from]);
                } else {
                    for (const c of defenderOwners) delete G.spaces[space].land[c];
                }
            }
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
            addBesieger(G, space, attacker);
            if (G.spaces[space].siege?.inside === undefined) {
                G.spaces[space].siege!.inside = ownersWithLand(G, space).filter((c) => defenderOwners.includes(c));
            }
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
    const besiegers = besiegerOwners(G, space);
    const besieger = siege.by;
    // Rule 15.2: only units friendly to the relief power and not a besieger
    // fight on the relief side; third-party besiegers fight with the defenders.
    // A siege without an explicit `inside` list treats non-besiegers at war
    // with a besieger as inside (the pre-existing besiegeRouen setup).
    const inside = siege.inside !== undefined ? new Set<Controller>(siege.inside) : undefined;
    const attackers = ownersWithLand(G, space).filter((c) => friendlyController(G, p, c) && !besiegers.includes(c as Power));
    const defenders = ownersWithLand(G, space).filter((c) => besiegers.includes(c as Power) || !friendlyController(G, p, c));
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
    // Interactive: let the player choose how many units stay inside.
    G.pendingReliefSplit = {space, from, power: p, keepLimit, pUnits};
    pushLog(G, `${powerLabel(p)} relief force is defeated; choose how many units stay inside (max ${keepLimit}).`);
    return {attackerHits: aHits, defenderHits: dHits, attackerDice: aDice, defenderDice: dDice, winner};
};

export const chooseReliefSplit = (G: VQGame, ctx: Ctx, args: {keep: number}): void | typeof INVALID_MOVE => {
    const pending = G.pendingReliefSplit;
    if (!pending) return INVALID_MOVE;
    const {space, from, power: p, keepLimit, pUnits} = pending;
    const keep = Math.max(0, Math.min(args.keep, keepLimit));
    const moveOut = Math.max(0, pUnits - keep);
    if (moveOut > 0) transferLandUnits(G, space, from, p, moveOut);
    const besieger = G.spaces[space].siege?.by;
    if (totalLand(G, space, [p]) === 0) {
        if (besieger !== undefined) captureLeaders(G, space, [p], besieger);
    } else if (moveOut > 0) {
        const reliefLeaders = G.spaces[space].leaders.filter((id) => (LEADER_BY_ID as any)[id]?.power === p && (LEADER_BY_ID as any)[id]?.kind === "army");
        if (reliefLeaders.length > 0) moveLeaders(G, space, from, reliefLeaders);
    }
    if (besieger !== undefined) {
        const besiegers = besiegerOwners(G, space);
        const insideAfter = defenderOwners(G, space);
        const besiegersLeft = totalLand(G, space, besiegers);
        const defendersLeft = totalLand(G, space, insideAfter);
        if (besiegersLeft === 0) {
            const besiegerLeaders = leadersAt(G, space).filter((id) => LEADER_BY_ID[id]?.power === besieger);
            if (besiegerLeaders.length > 0) captureLeaders(G, space, [besieger], p);
            delete G.spaces[space].siege;
        } else if (besiegersLeft <= defendersLeft) {
            const besiegerLeaders = leadersAt(G, space).filter((id) => LEADER_BY_ID[id]?.power === besieger);
            retreatLand(G, besieger, space, [besieger], besiegerLeaders, p, [from]);
            delete G.spaces[space].siege;
            pushLog(G, `The siege of ${SPACE_BY_ID[space].name} is broken.`);
        }
    }
    pushLog(G, `${keep} unit(s) stay inside; ${moveOut} fall back to ${SPACE_BY_ID[from]?.name ?? from}.`);
    delete G.pendingReliefSplit;
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
    if (G.scenario === "tutorial") return false;
    let moved = false;
    const defenders = ownersWithLand(G, space)
        .filter((owner): owner is Power => isPower(owner) && !friendlyController(G, active, owner));
    for (const owner of defenders) {
        // Rule 13.3: only units currently under siege may not avoid battle.
        const siege = G.spaces[space].siege;
        if (siege !== undefined && (siege.inside === undefined || siege.inside.includes(owner))) continue;
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
        const coveredByLostBattle = G.lostBattleImpulse?.impulse === G.impulse &&
            G.lostBattleImpulse.owners.includes(owner);
        const ottomanCavalry = owner === "ottoman" && stack.cav > 0 ? 1 : 0;
        const enemyCavalry = owner !== "ottoman" && (G.spaces[space].land.ottoman?.cav ?? 0) > 0 ? -1 : 0;
        const telescope = G.powers[owner].scienceBonuses.includes("telescope") ? 1 : 0;
        const modifier = bestBattle(G, space, [owner], "army") + ottomanCavalry + enemyCavalry + telescope;
        if (!coveredByLostBattle) {
            const dice = roll(ctx, 2);
            const total = dice[0] + dice[1] + modifier;
            pushLog(G, `${powerLabel(owner)} avoid-battle at ${SPACE_BY_ID[space].name}: [${dice.join(",")}] + ${modifier} = ${total}.`);
            if (total < 9) continue;
        } else {
            pushLog(G, `${powerLabel(owner)} automatically avoids battle after losing a field battle.`);
        }
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
    if (G.scenario === "tutorial" || friendlyControlled(G, active, to)) return false;
    const destinationOwners = ownersWithLand(G, to);
    if (G.interceptedThisImpulse?.impulse !== G.impulse) G.interceptedThisImpulse = {impulse: G.impulse, spaces: []};
    const used = G.interceptedThisImpulse.spaces;
    const candidates: {space: string; power: Power}[] = [];
    for (const link of landNeighbors(to)) {
        if (link.pass || link.id === from || used.includes(link.id)) continue;
        const state = G.spaces[link.id];
        if (state === undefined) continue;
        for (const owner of ownersWithLand(G, link.id)) {
            // Rule 13.2: only stacks currently under siege may not intercept.
            const siege = state.siege;
            if (siege !== undefined && (siege.inside === undefined || siege.inside.includes(owner))) continue;
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
        // Rule 13.2: the penalty applies when intercepting the Ottoman stack
        // that is moving, not Ottoman cavalry already sitting at the destination.
        const enemyCavalry = candidate.power !== "ottoman" && active === "ottoman" &&
            (G.spaces[from].land.ottoman?.cav ?? 0) > 0 ? -1 : 0;
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
    if (siege === undefined || !besiegerOwners(G, space).includes(p)) {
        return false;
    }
    // Rule 15.1: defenders are the units inside the fortification fighting the
    // besiegers, not every non-besieger stack (allied second besiegers and
    // third-party passers-by do not inflate defender dice).
    const defendersList = defenderOwners(G, space).filter((c) => c !== p);
    const defendersUnits = totalLand(G, space, defendersList);
    // Rule 15.1: only a single formation may assault, even when more friendly
    // units are present in the space.
    const attackerLeaders = G.spaces[space].leaders.filter(
        (id) => LEADER_BY_ID[id]?.power === p && LEADER_BY_ID[id]?.kind === "army");
    const attackerNonCavalry = (G.spaces[space].land[p]?.regular ?? 0) + (G.spaces[space].land[p]?.merc ?? 0);
    const desperate = G.powers[p].cards.includes("vq-007");
    const defending = defendersList.find(isPower);
    // #39 Flooding cannot prevent a #31 Treachery assault.  Treachery opens
    // its battle through `startBattle`, so the defensive auto-play shortcut
    // must not fire while such a battle is pending.
    if (G.pendingBattle?.treachery !== true && defending !== undefined && SPACE_BY_ID[space]?.area === "netherlands" &&
        G.powers[defending].cards.includes("vq-039")) {
        removeCardFromHand(G, defending, "vq-039");
        discardCard(G, defending, "vq-039", true);
        if (G.powers[p].cards.includes("vq-010")) {
            removeCardFromHand(G, p, "vq-010");
            discardCard(G, p, "vq-010", true);
            pushLog(G, "Siege Engineering cancels Flooding.");
        } else {
            const stack = s.land[p];
            if (stack !== undefined) stack.merc -= Math.ceil(stack.merc / 2);
            delete s.siege;
            pushLog(G, "Flooding lifts the siege and halves the attacker's mercenaries.");
            return false;
        }
    }
    const siegeEngineering = !desperate && G.powers[p].cards.includes("vq-010");
    if (desperate) {
        removeCardFromHand(G, p, "vq-007");
        discardCard(G, p, "vq-007", true);
        pushLog(G, "Desperate Assault makes attacker hits 4-6 and doubles defender dice.");
    } else if (siegeEngineering) {
        removeCardFromHand(G, p, "vq-010");
        discardCard(G, p, "vq-010", true);
        pushLog(G, "Siege Engineering adds 3 dice to the assault.");
    }
    let tilburyAttacker = 0;
    if (!desperate && !siegeEngineering && G.powers[p].cards.includes("vq-040")) {
        removeCardFromHand(G, p, "vq-040");
        discardCard(G, p, "vq-040", true);
        tilburyAttacker = p === "england" ? 4 : 2;
        pushLog(G, `Tilbury Speech adds ${tilburyAttacker} dice to the assault.`);
    }
    let tilburyDefender = 0;
    if (defending !== undefined && G.powers[defending].cards.includes("vq-040")) {
        removeCardFromHand(G, defending, "vq-040");
        discardCard(G, defending, "vq-040", true);
        tilburyDefender = defending === "england" ? 4 : 2;
        pushLog(G, `Tilbury Speech adds ${tilburyDefender} dice to the defense.`);
    }
    // Rule 15.1 step 3/4: cavalry units are ignored when adding assault dice
    // (they still count for the "1 or more defending land units" condition and
    // for breaking a siege under 15.3).
    const cavalryIn = (owners: Controller[]): number =>
        owners.reduce((total, c) => total + (G.spaces[space].land[c]?.cav ?? 0), 0);
    const attackerDiceUnits = Math.min(formationCapacity(attackerLeaders), attackerNonCavalry);
    const defenderDiceUnits = defendersUnits - cavalryIn(defendersList);
    const aDice = (defendersUnits > 0 ? Math.ceil(attackerDiceUnits / 2) : attackerDiceUnits) + bestBattle(G, space, [p], "army") + (siegeEngineering ? 3 : 0) + tilburyAttacker;
    const defendingPower = defendersList.find(isPower);
    const ravelin = defendingPower !== undefined && G.powers[defendingPower].scienceBonuses.includes("ravelin") ? 1 : 0;
    const dDice = (defenderDiceUnits + bestBattle(G, space, defendersList, "army") + 1 + ravelin) * (desperate ? 2 : 1) + tilburyDefender;
    const aRoll = roll(ctx, aDice);
    const aHits = desperate ? aRoll.filter((die) => die >= 4).length : hits(aRoll);
    const dHits = hits(roll(ctx, dDice));
    G.lastRolls = `Assault on ${SPACE_BY_ID[space].name}: ${aHits} hits (${aDice} dice) vs ${dHits} hits (${dDice} dice)`;
    pushLog(G, G.lastRolls);
    removeLandLosses(G, space, defendersList, aHits);
    removeLandLosses(G, space, [p], dHits);
    const defendersListLeft = totalLand(G, space, defendersList);
    const attackerLeft = totalLand(G, space, [p]);
    if (defendersListLeft === 0 && aHits > 0 && attackerLeft > 0) {
        s.control = p;
        delete s.siege;
        G.lastCapture = {space, attacker: p, impulse: G.impulse};
        // Rule 15.1 step 9: naval units and naval leaders in a captured port go
        // to the next turn of the Turn Track; they may be rebuilt later.
        for (const c of ownersWithNaval(G, space)) {
            if (c === p) continue;
            const stack = s.naval[c];
            if (stack !== undefined) {
                for (const kind of ["galley", "galleon", "racebuilt", "corsair"] as const) {
                    recordNavalLoss(G, c, kind, stack[kind]);
                }
            }
            delete s.naval[c];
        }
        const navalLeaders = leadersAt(G, space).filter((id) => {
            const def = LEADER_BY_ID[id];
            return def?.kind === "naval" && defendersList.includes(def.power);
        });
        for (const id of navalLeaders) {
            s.leaders = s.leaders.filter((leader) => leader !== id);
            G.leaders[id] = {id, location: "pool", returnTurn: G.year + 1};
        }
        captureLeaders(G, space, defendersList, p);
        pushLog(G, `${powerLabel(p)} captures ${SPACE_BY_ID[space].name}!`);
        return true;
    }
    if (attackerLeft <= defendersListLeft) {
        delete s.siege;
        const leaders = leadersAt(G, space).filter((id) => LEADER_BY_ID[id].power === p);
        retreatLand(G, p, space, [p], leaders, isPower(s.control) ? s.control : p);
        pushLog(G, "The siege is broken.");
    } else {
        s.siege = {by: p, besiegers: besiegerOwners(G, space), inside: [...defendersList], sinceImpulse: G.impulse};
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
        if (G.unionOfArras === true && def.area === "netherlands") {
            return false;
        }
        const s = G.spaces[def.id];
        if (s.religion !== "protestant" || s.siege !== undefined) {
            return false;
        }
        return def.area === "france" ? s.control === "france" : s.control === "spain";
    }).map((d) => d.id);

export const resolveRebellion = (G: VQGame, ctx: Ctx, p: Power, space: string, cp: number): boolean => {
    if (p !== "protestant" || cp < 2 || cp > 7) {
        return false;
    }
    const def = SPACE_BY_ID[space];
    if (def === undefined || (def.area !== "france" && def.area !== "netherlands") ||
        (G.unionOfArras === true && def.area === "netherlands")) {
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
    if (G.rebellionAreasThisImpulse?.impulse !== G.impulse) G.rebellionAreasThisImpulse = {impulse: G.impulse, areas: []};
    if (G.rebellionAreasThisImpulse.areas.includes(def.area)) return false;
    const catholicOwners = ownersWithLand(G, space).filter((c) => unitReligion(c) === "catholic");
    let successful = true;
    if (catholicOwners.length > 0) {
        const diceN = cp + (spaceHomes(def).includes("protestant") ? 1 : 0);
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
        if (ownersWithLand(G, space).some((c) => unitReligion(c) === "catholic" && (G.spaces[space].land[c]?.regular ?? 0) > 0)) {
            successful = false;
        }
    }
    if (!successful) {
        pushLog(G, "The rebellion fails.");
        return false;
    }
    // Displace non-Catholic units, leaders, and naval stacks.
    // Leaders of non-Protestant powers return to the pool.
    const displacedLeaders = (G.spaces[space].leaders ?? []).filter((id) => {
        const lp = leaderPower(G, id);
        return lp !== undefined && lp !== "protestant";
    });
    for (const id of displacedLeaders) {
        G.spaces[space].leaders = G.spaces[space].leaders.filter((l) => l !== id);
        if (G.leaders[id] !== undefined) G.leaders[id].location = "pool";
    }
    // Naval units of non-Protestant controllers retreat / are displaced.
    for (const c of [...ownersWithNaval(G, space)]) {
        if (c === "protestant") continue;
        delete G.spaces[space].naval[c];
    }
    for (const c of ownersWithLand(G, space)) {
        const st = G.spaces[space].land[c];
        const hasMercOrCav = st !== undefined && (st.merc > 0 || st.cav > 0);
        if (c !== "protestant" && (unitReligion(c) !== "catholic" || hasMercOrCav)) {
            const owner = isPower(c) ? c : (minorAlly(G, c as never) ?? "spain");
            const dest = nearestFriendlyFortified(G, owner, space);
            if (dest !== undefined) {
                const st2 = s.land[c];
                if (st2 !== undefined) {
                    const tgt = ensureLand(G, dest, c);
                    tgt.regular += st2.regular;
                    tgt.merc += st2.merc;
                    tgt.cav += st2.cav;
                    delete s.land[c];
                }
            } else {
                delete s.land[c];
            }
        }
    }
    s.control = "protestant";
    pushLog(G, `The Protestant seizes ${def.name}.`);
    // Adjacent spaces with Protestant influence.
    let flips = cp - 1;
    for (const n of landNeighbors(space)) {
        if (flips <= 0) {
            break;
        }
        const ns = G.spaces[n.id];
        if (SPACE_BY_ID[n.id].area === def.area && ns.religion === "protestant" && !spaceHasReligionUnits(G, n.id, "catholic") &&
            ns.control === enemyPower && ns.siege === undefined) {
            // Displace non-Protestant units.
            for (const c of [...ownersWithLand(G, n.id)]) {
                if (c === "protestant") continue;
                const dest = nearestFriendlyFortified(G, isPower(c) ? c : "spain", n.id);
                if (dest !== undefined) {
                    const st = ns.land[c];
                    if (st !== undefined) {
                        const tgt = ensureLand(G, dest, c);
                        tgt.regular += st.regular; tgt.merc += st.merc; tgt.cav += st.cav;
                        delete ns.land[c];
                    }
                }
            }
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
    // Rule 18.5 steps 7-8: designate a capital and place an available leader.
    if (G.protestantCapital === undefined && spaceHomes(def).includes("protestant") && isFortifiedSpace(G, space)) {
        G.protestantCapital = space;
        pushLog(G, `The Protestant designates ${SPACE_BY_ID[space].name} as its capital.`);
    }
    // Place an available army leader in the target space.  Only leaders who
    // have already arrived (8.1 Leader Entry Table / Turn Track) and are
    // waiting on the power card qualify; a removed leader never returns.
    const availableLeader = LEADERS.find((l) => l.power === "protestant" && l.kind === "army" &&
        G.leaders[l.id]?.location === "pool" && (G.leaders[l.id].returnTurn ?? 0) <= G.year);
    if (availableLeader !== undefined) {
        G.leaders[availableLeader.id] = {id: availableLeader.id, location: space};
        if (!G.spaces[space].leaders.includes(availableLeader.id)) {
            G.spaces[space].leaders.push(availableLeader.id);
        }
        pushLog(G, `${availableLeader.name} joins the rebellion in ${SPACE_BY_ID[space].name}.`);
    }
    if (G.rebellionAreasThisImpulse !== undefined) G.rebellionAreasThisImpulse.areas.push(def.area);
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
    } else if (id === "rudolf" || id === "rudolfII") {
        // #35 FAQ: the +2 Prague Cultural Center marker is removed not only
        // when Rudolf marries, but also when he dies (here through murder or
        // death in childbirth in the marriage table; assassination kills the
        // royal directly, so see the direct-death cleanup in espionage too).
        // The pool hosts both spellings: "rudolf" from the initial setup and
        // "rudolfII" from the scenario-book data.
        removePragueCulturalCenterOnRudolfDeath(G);
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
        // Scenario Book #95 clarification: Louise is treated as a royal of the
        // power that played the card, so only the higher eligibility is used.
        const louiseMarriage = female.id === "louiseLorraine" || male.id === "louiseLorraine";
        const samePower = male.power === female.power || louiseMarriage;
        const festivities = G.marriageFestivities === "france" &&
            (male.power === "france" || female.power === "france") ? 2 : 0;
        if (festivities > 0) delete G.marriageFestivities;
        const ratings = (samePower
            ? Math.max(male.eligibility ?? 0, female.eligibility ?? 0)
            : (male.eligibility ?? 0) + (female.eligibility ?? 0)) + festivities;
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
            if (male.id === "williamOrange") {
                // Rule 21.1: William is only removed if the result earns VP.
                male.married = false;
                male.status = "available";
                male.eligibility = 2;
                male.turn = G.year + 1;
                female.married = true;
                G.marriages += 1;
                pushLog(G, "William of Orange returns to the pool at eligibility 2 next turn.");
            } else {
                male.alive = false;
                male.status = "dead";
                female.married = true;
                G.marriages += 1;
                applyRulerDeath(G, male.id);
                // Rule 21.1: if the husband was an army leader, remove him from
                // the map and place a default leader if he was the only one.
                const leaderDef = LEADER_BY_ID[male.id];
                if (leaderDef !== undefined && leaderDef.kind === "army") {
                    const state = G.leaders[male.id];
                    if (state !== undefined) {
                        if (G.spaces[state.location] !== undefined) {
                            G.spaces[state.location].leaders = G.spaces[state.location].leaders.filter((l) => l !== male.id);
                        } else if (G.seaZones[state.location as SeaZoneID] !== undefined) {
                            G.seaZones[state.location as SeaZoneID].leaders = G.seaZones[state.location as SeaZoneID].leaders.filter((l) => l !== male.id);
                        }
                        delete G.leaders[male.id];
                    }
                    ensureDefaultLeader(G, leaderDef.power);
                }
                pushLog(G, `Rumors of Murder: ${male.name} is murdered.`);
            }
        }
        if (total !== 9) {
            // Valois marriage bonus: +1 VP for each Valois royal who weds.
            for (const royal of [male, female]) {
                if (royal.family === "valois") addVp(G, "france", 1);
            }
            const ids = [male.id, female.id];
            // #35 FAQ: Rudolf II's successful marriage removes the +2 Prague
            // Cultural Center marker from play.  Death removes it too (handled
            // in applyRulerDeath, since the marker check below would precede
            // the death branch for totals <= 7 and report "marries" for what
            // was a murder).  Only a surviving marriage therefore lands here.
            const rudolfMarried = (ids.includes("rudolf") || ids.includes("rudolfII")) &&
                male.alive && female.alive;
            if (rudolfMarried && G.pragueCulturalCenter !== undefined) {
                delete G.pragueCulturalCenter;
                pushLog(G, "Rudolf II marries; the +2 Prague Cultural Center marker is removed from the game.");
            }
            if (ids.includes("annaSaxony")) {
                G.powers[male.power].marriageCardModifier = (G.powers[male.power].marriageCardModifier ?? 0) + 1;
            }
            if (ids.includes("charlesII") && (female.power === "england" || female.power === "protestant")) {
                G.powers[female.power].marriageCardModifier = (G.powers[female.power].marriageCardModifier ?? 0) - 1;
            }
            if (ids.includes("louiseColigny") && (male.power === "england" || male.power === "protestant")) {
                G.powers[male.power].marriageCardModifier = (G.powers[male.power].marriageCardModifier ?? 0) + 1;
            }
            // #95 clarification/FAQ: Louise played by France is not a French
            // royal for Henry of Navarre's marriage bonus.
            if (ids.includes("henryIV") && female.power === "france" && female.id !== "louiseLorraine") {
                G.powers[male.power].marriageCardModifier = (G.powers[male.power].marriageCardModifier ?? 0) + 1;
            }
            if (ids.includes("isabellaClaraEugenia") &&
                ["philip", "charlesIX", "henryIII", "rudolf", "rudolfII"].includes(male.id)) {
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
export const restorePatrons = (G: VQGame): void => {
    for (const [patronId, turn] of Object.entries(G.patronReturn ?? {})) {
        if (turn > G.year) continue;
        if (!G.patronsAvailable.includes(patronId)) G.patronsAvailable.push(patronId);
        delete G.patronReturn![patronId];
    }
};

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
        const pragueBonus = G.pragueCulturalCenter === patron.id ? 2 : 0;
        const modifier = cpBonus + G.powers[attempt.power].patronageModifier + observatoryBonus + pragueBonus;
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

const winterPortRank = (G: VQGame, major: Controller, port: string): number =>
    isPower(major) && capitalSpacesFor(G, major).includes(port) ? 0 : 1;

/** Home capitals that can receive this power's land units (20.4 exceptions). */
const winterCapitalsFor = (G: VQGame, p: Power, origin?: string): string[] => {
    const controlled = capitalSpacesFor(G, p).filter((id) => G.spaces[id]?.control === p);
    if (p !== "protestant" || origin === undefined) return controlled;
    const dutch = SPACE_BY_ID[origin]?.area === "netherlands";
    return controlled.filter((id) => dutch ? id === "amsterdam" : id === "laRochelle");
};

const winterIsCapital = (G: VQGame, p: Power, id: string): boolean => capitalSpacesFor(G, p).includes(id);

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

/** Lose half of a moving stack, rounded up.  Returns the units removed. */
const winterAttrition = (units: LandStack): LandStack => {
    const losses = Math.ceil(landCount(units) / 2);
    let left = losses;
    const removed = emptyLand();
    for (const kind of ["merc", "cav", "regular"] as const) {
        const n = Math.min(left, units[kind]);
        units[kind] -= n;
        removed[kind] = n;
        left -= n;
        if (left === 0) break;
    }
    return removed;
};

/**
 * Record a winter attrition loss so its owner may pick the unit type during
 * the Card Draw phase.  The automatic losses are already applied; a skipped
 * choice therefore keeps the automatic composition.  `confirmOnly` marks a
 * removal that is already final (the Morisco regulars leaving play with card
 * #28), so the owner may only confirm it during Card Draw.
 */
const recordWinterLossChoice = (
    G: VQGame, p: Power, space: string, removed: LandStack, confirmOnly = false,
): void => {
    const amount = landCount(removed);
    if (amount === 0 || G.spaces[space] === undefined) return;
    const entry: WinterLossChoice = {power: p, space, amount, removed};
    if (confirmOnly) entry.confirmOnly = true;
    G.winterLossChoices = [...(G.winterLossChoices ?? []), entry];
};

/**
 * Safe fallback for a pending winter loss choice.  The automatic losses are
 * already on the board, so dropping the records keeps that composition.  With
 * no power given every pending choice is dropped (used when the Card Draw
 * phase ends or the next phase begins).
 */
export const autoResolveWinterLossChoices = (G: VQGame, p?: Power): void => {
    const pending = G.winterLossChoices;
    if (pending === undefined) return;
    const remaining = p === undefined ? [] : pending.filter((entry) => entry.power !== p);
    if (p !== undefined && remaining.length !== pending.length) {
        pushLog(G, `${powerLabel(p)} keeps the automatic winter loss composition.`);
    }
    if (remaining.length === 0) delete G.winterLossChoices;
    else G.winterLossChoices = remaining;
};

/**
 * Record a no-port naval elimination so its owner may confirm the lost ship
 * types during the Card Draw phase. Rule 20.4 removes the whole squadron, so
 * the automatic elimination is already applied and the record cannot save any
 * ship; a skipped choice keeps that automatic composition.
 */
const recordWinterNavalLossChoice = (G: VQGame, p: Power, zone: string, removed: NavalStack): void => {
    const amount = navalCount(removed);
    if (amount === 0 || G.seaZones[zone as SeaZoneID] === undefined) return;
    G.winterNavalLossChoices = [...(G.winterNavalLossChoices ?? []), {power: p, zone, amount, removed}];
};

/**
 * Safe fallback for a pending winter naval loss choice.  The automatic
 * elimination is already on the board, so dropping the records keeps the
 * automatic ship-type composition.  With no power given every pending naval
 * choice is dropped (used when Card Draw ends or the next phase begins).
 */
export const autoResolveWinterNavalLossChoices = (G: VQGame, p?: Power): void => {
    const pending = G.winterNavalLossChoices;
    if (pending === undefined) return;
    const remaining = p === undefined ? [] : pending.filter((entry) => entry.power !== p);
    if (p !== undefined && remaining.length !== pending.length) {
        pushLog(G, `${powerLabel(p)} keeps the automatic winter naval loss composition.`);
    }
    if (remaining.length === 0) delete G.winterNavalLossChoices;
    else G.winterNavalLossChoices = remaining;
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
                        (winterPortRank(G, major, port) < winterPortRank(G, major, best.port) ||
                            (winterPortRank(G, major, port) === winterPortRank(G, major, best.port) && port < best.port)))) {
                    best = {port, distance};
                }
            }
            if (best === undefined) {
                const removed = {...stack};
                pushLog(G, `${controllerLabel(c)} fleet in ${zoneDef.name} has no port to return to and is eliminated.`);
                delete zone.naval[c];
                // The whole squadron is gone (20.4). The owner still confirms
                // its ship-type composition during Card Draw; a skipped choice
                // keeps this automatic result.
                const owner = isPower(c) ? c : minorAlly(G, c as MinorPower);
                if (owner !== undefined) recordWinterNavalLossChoice(G, owner, zoneDef.id, removed);
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
        if (!isFortifiedSpace(G, id) || state.control !== p || winterIsCapital(G, p, id) || landCount(stack) <= 4) continue;
        const capitals = winterCapitalsFor(G, p, id)
            .map((cap) => ({id: cap, distance: winterDistance(id, cap)}))
            .filter((candidate): candidate is {id: string; distance: number} => candidate.distance !== undefined)
            .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
        const excess = landCount(stack) - 4;
        if (capitals.length === 0) {
            // No home capital can receive the excess, so it is destroyed.  Apply
            // the automatic composition now, then let the owner swap the unit
            // types during Card Draw; skipping the choice keeps that composition.
            const before = {...stack};
            removeLandLosses(G, id, [p], excess);
            cleanupLand(G, id, p);
            const surviving = G.spaces[id].land[p];
            if (surviving !== undefined) {
                const removed = emptyLand();
                for (const kind of ["regular", "merc", "cav"] as const) {
                    removed[kind] = before[kind] - surviving[kind];
                }
                recordWinterLossChoice(G, p, id, removed);
            }
            pushLog(G, `${powerLabel(p)} has no capital and loses ${excess} overstacked unit(s) in ${SPACE_BY_ID[id].name}.`);
            continue;
        }
        const capital = capitals[0];
        const moving = winterTakeUnits(stack, excess);
        const clean = winterCleanPath(G, p, id, capital.id);
        const removed = clean ? emptyLand() : winterAttrition(moving);
        const lost = landCount(removed);
        cleanupLand(G, id, p);
        winterAddUnits(G, capital.id, p, moving);
        if (lost > 0 && landCount(moving) > 0) recordWinterLossChoice(G, p, capital.id, removed);
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
            if (winterIsCapital(G, p, def.id)) return capitals.includes(def.id);
            return landCount(target.land[p]) < 4;
        }).map((def) => def.id);
        const scored = destinations.map((dest) => ({
            dest,
            distance: winterDistance(id, dest) ?? Number.POSITIVE_INFINITY,
            clean: winterCleanPath(G, p, id, dest),
            capital: winterIsCapital(G, p, dest),
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
            const removed = {...stack};
            const count = landCount(stack);
            delete state.land[p];
            winterLeadersHome(G, id, p, leaders);
            // Rule 20.4 eliminates the whole army.  Apply that now, then let
            // the owner confirm its composition during Card Draw; skipping the
            // confirmation keeps this automatic result.
            recordWinterLossChoice(G, p, id, removed);
            pushLog(G, `${powerLabel(p)} loses ${count} unit(s) in ${SPACE_BY_ID[id].name}: no winter quarters.`);
            continue;
        }
        candidates.sort((a, b) =>
            Number(b.clean) - Number(a.clean) ||
            a.distance - b.distance ||
            Number(b.capital) - Number(a.capital) ||
            a.dest.localeCompare(b.dest));
        const chosen = candidates[0];
        const removed = chosen.clean ? emptyLand() : winterAttrition(stack);
        const lost = landCount(removed);
        const leaders = winterArmyLeaders(G, id, p);
        if (landCount(stack) === 0) {
            cleanupLand(G, id, p);
            winterLeadersHome(G, id, p, leaders);
            pushLog(G, `${powerLabel(p)} loses ${lost} unit(s) to winter attrition in ${SPACE_BY_ID[id].name}.`);
            continue;
        }
        winterAddUnits(G, chosen.dest, p, stack);
        if (lost > 0) recordWinterLossChoice(G, p, chosen.dest, removed);
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
    return def !== undefined && (spaceHomes(def).includes("france") ||
        (spaceHomes(def).includes("protestant") && def.area === "france") || id === "metz");
};

const frenchHomeSpaces = (): string[] =>
    SPACES.filter((def) => spaceHomes(def).includes("france")).map((def) => def.id);

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
    return SPACES.filter((def) => spaceHomes(def).includes("france") && def.id !== "reims" &&
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
        id !== center && G.spaces[id] !== undefined && !G.spaces[id].unrest &&
        ownersWithLand(G, id).length === 0 && ownersWithNaval(G, id).length === 0 &&
        (G.spaces[id].leaders?.length ?? 0) === 0);
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

/**
 * Remove the Morisco unit and card #28.  The Morisco counters are regular
 * units, so the removal is recorded as a winter loss choice when it happens
 * during the Winter Phase (`recordWinterChoice`); the owner then confirms the
 * removed unit types in the following Card Draw phase.  That choice is
 * confirmation-only: the cards left play with the Morisco, so their regulars
 * cannot be swapped for other unit types in the surviving stack.  Peace and
 * status checks during the Action Phase keep the default and remove the unit
 * immediately, without leaving a choice that would block that phase.
 */
export const clearMorisco = (G: VQGame, recordWinterChoice = false): void => {
    const morisco = G.morisco;
    if (morisco === undefined) return;
    const space = morisco.space;
    const stack = G.spaces[space]?.land.ottoman;
    let removed = 0;
    if (stack !== undefined) {
        removed = Math.min(morisco.units, stack.regular);
        stack.regular -= removed;
        cleanupLand(G, space, "ottoman");
    }
    delete G.morisco;
    removeCardFromGame(G, "vq-028");
    pushLog(G, "Morisco Revolt ends: the Morisco unit is removed and card #28 leaves play.");
    if (recordWinterChoice && removed > 0) {
        // The automatic removal is already applied and final; the owner only
        // confirms it, so no surviving mercenary or cavalry can replace it.
        recordWinterLossChoice(G, "ottoman", space, {regular: removed, merc: 0, cav: 0}, true);
    }
};

export const checkMoriscoStatus = (G: VQGame, recordWinterChoice = false): void => {
    const morisco = G.morisco;
    if (morisco === undefined) return;
    if (!atWar(G, "ottoman", "spain")) {
        clearMorisco(G, recordWinterChoice);
        return;
    }
    const count = G.spaces[morisco.space] === undefined ? 0 : landCount(G.spaces[morisco.space].land.ottoman);
    if (count <= 0) {
        clearMorisco(G, recordWinterChoice);
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
        clearMorisco(G, true);
        return;
    }
    const state = G.spaces[morisco.space];
    if (state?.siege?.by === "ottoman" && isFortifiedSpace(G, morisco.space)) {
        pushLog(G, "Morisco Revolt: the Morisco unit is besieging a fortified space at Winter and is eliminated.");
        clearMorisco(G, true);
        return;
    }
    placeMoriscoUnrest(G, morisco.space);
    checkMoriscoStatus(G, true);
};

export const returnWorldCaptains = (G: VQGame): void => {
    for (const [id, expedition] of Object.entries(G.worldCaptains)) {
        if (!G.powers[expedition.power].seaCaptains.includes(id)) G.powers[expedition.power].seaCaptains.push(id);
        if (expedition.treasureValues !== undefined) G.powers[expedition.power].treasures.push(...expedition.treasureValues);
        delete G.worldCaptains[id];
        pushLog(G, `${id} returns to ${powerLabel(expedition.power)}'s sea captain pool at Winter.`);
    }
};

export const winter = (G: VQGame, ctx: Ctx): void => {
    // The attached-marriage window opened by #95 closes with the turn.
    delete G.louiseAttachment;
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
    for (const captain of Object.values(G.worldCaptains)) {
        captain.damaged = false;
    }
    if (neutralized > 0) pushLog(G, `${neutralized} neutralized informant(s) returned to their owners.`);
    // Captains finish their annual expedition in place; a colony already placed remains on the map.
    returnLoanedNaval(G);
    winterReturnNaval(G);
    for (const p of POWERS) {
        winterReturnLand(G, p);
        G.powers[p].allies = [];
        // Replacements at each controlled capital (rule 20.6).
        if (ownerOf(G, p) !== undefined && p === "hre") {
            const cap = capitalSpacesFor(G, "hre")[0];
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
            for (const cap of capitalSpacesFor(G, p)) {
                const state = G.spaces[cap];
                if ((state.control === p || (isPower(state.control) && allied(G, p, state.control))) && !state.unrest) {
                    addLand(G, cap, p, "regular", 1);
                }
            }
        }
        G.powers[p].treasures = [];
        G.powers[p].cp = 0;
        // Jilted compensation is immediate/current-turn only.
        delete G.powers[p].jiltedCp;
        G.powers[p].cardPlayed = false;
        G.powers[p].passed = false;
        // Keep the non-player HRE's Papacy/Venice/Ireland markers set aside
        // until it is activated (Scenario Book p. 12).
        G.powers[p].influence = G.scenario !== "tutorial" && G.playerPowers !== undefined && p === "hre" &&
            G.activatedMajors?.hre === undefined ? {} : {...G.minorInfluenceDefaults[p]};
    }
    // Rule 20.2 (discard unused treasures) precedes rule 20.4, so the treasures
    // brought home by returning sea captains are added after the hand reset and
    // survive into the next turn.
    returnWorldCaptains(G);
    // Rule 20.7: remaining Spanish row treasures enter the hand.
    G.powers.spain.treasures.push(...(G.spanishTreasureRow ?? []));
    G.spanishTreasureRow = [];
    if (G.espionage) {delete G.espionage.walsingham; delete G.espionage.maryBonusTurn; G.espionage.inspections = [];}
    awardPortugueseTreasures(G, ctx);
    G.minorDiplomacyResolved = [];
    G.piracyUsed = {};
    for (const target of G.majorDiplomacyResolved ?? []) {
        // 2-player removes France from the Ottoman column; 4-player keeps all
        // four influence tracks, so preserve that column on the winter reset.
        if (target === "ottoman") G.majorInfluence![target] = {
            spain: 1, england: 0, protestant: 0,
            ...(G.majorInfluence![target]?.france !== undefined ? {france: 0} : {}),
        };
        if (target === "hre") G.majorInfluence![target] = {ottoman: 3, spain: 1, england: 0, france: 0, protestant: 0};
    }
    G.majorDiplomacyResolved = [];
    // Sieges with no besieging force left are lifted (Rule 15.3).
    for (const def of SPACES) {
        const s = G.spaces[def.id];
        if (s.siege === undefined) {
            continue;
        }
        const besiegers = totalLand(G, def.id, besiegerOwners(G, def.id));
        const defenders = defenderLandCount(G, def.id);
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
    resolveMarriages(G, ctx);
    resolvePatronage(G, ctx);
    awardAnnualLocationVp(G);
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
            pushLog(G, `Holy Roman reveals religious preference: ${HRE_RELIGIOUS_PREFERENCE_NAMES[G.hreReligiousPreference!].zh} (${hreReligiousVp(G)} VP).`);
        }
    }
    G.vpHistory[String(G.year - 1)] = Object.fromEntries(POWERS.map((p) => [p, powerVp(G, p)]));
    pushLog(G, G.year <= G.endTurn ? `Winter ends. Turn ${G.year} begins.` : `Winter ends. Scenario turn ${G.endTurn} is complete.`);
};

/**
 * Every automatic victory condition currently met, in resolution order.
 * Rule 25.1 resolves simultaneous conditions by VP, so callers need the whole
 * list rather than only the first hit.
 */
export const automaticVictoryCandidates = (G: VQGame): { winner: Power; reason: VictoryReason }[] => {
    if (G.scenario === "tutorial") {
        return controlledKeys(G, "ottoman").length >= TUTORIAL_POWER_CARDS.ottoman.military
            ? [{winner: "ottoman", reason: "military"}] : [];
    }
    const candidates: { winner: Power; reason: VictoryReason }[] = [];
    if (G.espionage?.catholicRebellionVictory) candidates.push({winner: "spain", reason: "catholicRebellion"});
    const n = protestantSpaceCount(G);
    if (n > 50) {
        candidates.push({winner: "protestant", reason: "protestantReligious"});
    }
    if (n <= 9) {
        const franceAndScotland = protestantSpacesInArea(G, "france") + protestantSpacesInArea(G, "scotland") +
            protestantOffMapInArea(G, "france") + protestantOffMapInArea(G, "scotland");
        candidates.push({winner: franceAndScotland <= 3 ? "france" : "spain", reason: "catholicReligious"});
    }
    for (const p of POWERS) {
        if (ownerOf(G, p) === undefined || isActivatedMajor(G, p)) continue;
        const keys = p === "protestant" ? protestantKeysOutsideNetherlands(G).length : controlledKeys(G, p).length;
        if (keys >= POWER_INFO[p].autoWinKeys && keys > G.militaryVictoryBaseline[p]) {
            candidates.push({winner: p, reason: "military"});
        }
    }
    return candidates;
};

export const checkImmediateVictory = (G: VQGame, phase?: string): { winner: Power; reason: VictoryReason } | undefined => {
    // Rule 25.1: automatic victories are resolved in the Action Phase.  A key
    // gained during Diplomacy does not end the game unless it is still held
    // when the Action Phase begins.
    if (phase !== undefined && phase !== "action") return undefined;
    const candidates = automaticVictoryCandidates(G);
    const winners = [...new Set(candidates.map((c) => c.winner))];
    if (winners.length <= 1) return candidates[0];
    // Rule 25.1: two powers earning automatic victories from the same action
    // are resolved by current VP, then the Standard Victory tie-breaker
    // starting from the last completed turn.
    const best = Math.max(...winners.map((p) => powerVp(G, p)));
    const tied = winners.filter((p) => powerVp(G, p) === best);
    const winner = breakVpTie(G, tied, G.year - 1);
    return candidates.find((c) => c.winner === winner);
};

/** One comparison made while stepping back through the Victory Record Sheet. */
export interface VpTieBreakStep {
    /** Turn whose recorded end-of-turn VP broke (or failed to break) the tie. */
    year: number;
    /** Recorded VP for the powers that were still tied when the turn was read. */
    vp: Partial<Record<Power, number>>;
    /** Powers that remained tied after this comparison. */
    leaders: Power[];
}

export interface VpTieBreak {
    /** Powers tied on the score that triggered the tie-break, in Impulse Order. */
    tied: Power[];
    /** First turn examined (the turn before the one being decided). */
    fromYear: number;
    /** Comparisons that actually narrowed the tie, most recent first. */
    steps: VpTieBreakStep[];
    winner: Power;
    /** `history` when an earlier turn decided it, `impulseOrder` on an unbreakable tie. */
    decidedBy: "history" | "impulseOrder";
}

/**
 * Rule 25.3 tie-breaker.  Compare the tied powers' totals on the previous
 * turn; keep only the leaders and step back one turn at a time until a single
 * power remains.  A turn is only usable when every still-tied power has a
 * recorded total, so a partially filled Victory Record Sheet cannot silently
 * treat a missing total as zero.  Recorded totals exclude unrevealed HRE
 * religious VP (23.5).
 *
 * When the trail reaches the scenario's first turn without breaking the tie,
 * the rules define no further comparison.  Fall back to Impulse Order, the
 * convention the errata adopts for other unresolved ties, so the result stays
 * deterministic and explainable.
 */
export const vpTieBreak = (G: VQGame, tied: Power[], fromYear: number): VpTieBreak => {
    const candidates = [...new Set(tied)];
    let remaining = candidates;
    const steps: VpTieBreakStep[] = [];
    for (let year = fromYear; year >= G.startTurn && remaining.length > 1; year--) {
        const hist = G.vpHistory[String(year)];
        if (hist === undefined || !remaining.every((p) => hist[p] !== undefined)) continue;
        const best = Math.max(...remaining.map((p) => hist[p]!));
        const leaders = remaining.filter((p) => hist[p] === best);
        steps.push({
            year,
            vp: Object.fromEntries(remaining.map((p) => [p, hist[p]!])),
            leaders,
        });
        remaining = leaders;
    }
    const impulseOrder = [...remaining].sort((a, b) => POWERS.indexOf(a) - POWERS.indexOf(b));
    return {
        tied: [...candidates].sort((a, b) => POWERS.indexOf(a) - POWERS.indexOf(b)),
        fromYear,
        steps,
        winner: impulseOrder[0] ?? candidates[0],
        decidedBy: remaining.length === 1 ? "history" : "impulseOrder",
    };
};

export const breakVpTie = (G: VQGame, tied: Power[], fromYear: number): Power =>
    vpTieBreak(G, tied, fromYear).winner;

export const checkVictory = (G: VQGame, includeSecretHreVp = false, phase?: string): { winner: Power; reason: string } | undefined => {
    const immediate = checkImmediateVictory(G, phase);
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
    // Victory Determination runs after Winter advanced G.year, so the turn
    // just completed is G.year - 1 and the "previous turn" is G.year - 2.
    const tiedWinner = (): Power =>
        breakVpTie(G, standings.filter((s) => s.vp === top.vp).map((s) => s.power), G.year - 2);
    if (!G.checkVictory) {
        // Standard and Domination victories are only awarded in the Victory
        // Determination Phase; the time limit still applies if the phase was
        // somehow skipped.
        return G.year > G.endTurn ? {winner: tiedWinner(), reason: "timeLimit"} : undefined;
    }
    // Rule 25.3 order: check Standard, then Domination, and only then ask
    // whether the final turn has passed.  A power that reaches 25 VP through
    // Winter bonuses in Turn 7 wins a Standard Victory, not a Time Limit one.
    if (top.vp >= 25) {
        return {winner: tiedWinner(), reason: "standard"};
    }
    if (G.year > 4 && top.vp - second.vp >= 5) {
        return {winner: top.power, reason: "domination"};
    }
    if (G.year > G.endTurn) {
        return {winner: tiedWinner(), reason: "timeLimit"};
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
            const candidates = SPACES.filter((s) => spaceHomes(s).includes("spain") && !G.spaces[s.id].unrest);
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
            // Rule 24.5: the Influence track stops at 9; excess influence is lost.
            G.powers[p].influence[minor] = Math.min(9, (G.powers[p].influence[minor] ?? 0) + e.count);
            pushLog(G, `${powerLabel(p)} gains ${e.count} influence with ${minor}.`);
            break;
        }
        default:
            break;
    }
};

export const patronTaken = (G: VQGame, id: string): boolean =>
    POWERS.some((p) => G.powers[p].patrons.includes(id));

// --------------------------------------------------------------------------
// Legal action targets (map highlighting)
// --------------------------------------------------------------------------

/**
 * The board's action modes.  Every entry mirrors one `moves.ts` move; the UI
 * calls `legalTargets` with the currently selected mode to highlight only the
 * spaces that the current step can legally act on.
 */
export type LegalTargetMode =
    | "inspect" | "recruitRegular" | "recruitMerc" | "recruitCav"
    | "buildGalley" | "buildGalleon" | "buildRacebuilt" | "buildCorsair"
    | "moveLand" | "moveNaval" | "navalTransport" | "spring"
    | "control" | "assault" | "buildFortress" | "rebellion";

/** All land-space ids known to the running game, in scenario order. */
const legalTargetSpaceIds = (G: VQGame): string[] => Object.keys(G.spaces);

/** Rule 17.2 recruitment: mirrors the body of the `recruit` move. */
const canRecruitAt = (G: VQGame, p: Power, id: string, kind: "regular" | "merc" | "cav"): boolean => {
    const s = G.spaces[id];
    const def = SPACE_BY_ID[id];
    if (s === undefined || def === undefined) return false;
    const cost = kind === "regular" ? 2 : 1;
    if (G.powers[p].cp < cost) return false; // `spend()` in `recruit`.
    const homes = spaceHomes(def);
    // Tutorial seam: Spain may recruit in an HRE home when the HRE is its tutorial ally.
    if (G.scenario === "tutorial" && p === "spain" && G.tutorialHreAlly === "spain" && homes.includes("hre")) {
        return s.control === "hre" && !s.unrest && s.siege === undefined && kind !== "cav";
    }
    // Rule 24: regulars may be raised in an allied minor's home.
    const minorHome = homes.find((h) => !isPower(h) && h !== "independent" && G.powers[p].alliedMinors.includes(h as never));
    if (minorHome !== undefined) {
        return kind === "regular" && s.control === minorHome && !s.unrest && !spaceHasEnemyLand(G, p, id) &&
            landForceCountController(G, minorHome) < (MINOR_REGULAR_LIMITS[minorHome] ?? 12);
    }
    // Rule 17.2: a controlled home space not occupied by enemy units.
    if (s.control !== p || s.unrest || spaceHasEnemyLand(G, p, id)) return false;
    const spanishDutchHome = G.dutchSpanishHome === true && p === "spain" && def.area === "netherlands";
    if (!homes.includes(p) && !spanishDutchHome) return false;
    if (kind === "cav" && (p !== "ottoman" || cavalryCount(G, p) >= OTTOMAN_CAVALRY_LIMIT)) return false;
    if (kind === "merc" && mercCount(G, p) >= MERC_LIMITS[p]) return false;
    if (p === "ottoman" && (id === "algiers" || id === "tripoli")) return false;
    if (p === "spain" && (id === "oran" || id === "malta")) return false;
    if (landForceCount(G, p) >= REGULAR_LIMITS[p]) return false;
    return true;
};

/** Rule 16.7 naval construction: mirrors the body of the `buildNaval` move. */
const canBuildNavalAt = (G: VQGame, p: Power, port: string, kind: keyof NavalStack): boolean => {
    const s = G.spaces[port];
    const def = SPACE_BY_ID[port];
    if (s === undefined || def === undefined || !isPort(port) || isInlandPort(port)) return false;
    const cost = kind === "corsair" ? 1 : 2;
    if (G.powers[p].cp < cost) return false;
    const homes = spaceHomes(def);
    const minorHome = homes.find((h) => !isPower(h) && h !== "independent" && G.powers[p].alliedMinors.includes(h as never));
    if (minorHome !== undefined) {
        if (s.control !== minorHome || s.unrest || spaceHasEnemyLand(G, p, port)) return false;
    } else {
        if (s.control !== p || s.unrest || spaceHasEnemyLand(G, p, port)) return false;
        const spanishDutchHome = G.dutchSpanishHome === true && p === "spain" && def.area === "netherlands";
        if (!homes.includes(p) && !spanishDutchHome) return false;
    }
    if (kind === "racebuilt" && p !== "england") return false;
    if (kind === "corsair" && p !== "ottoman") return false;
    if (kind === "galley" && !["ottoman", "spain", "france", "hre"].includes(p)) return false;
    if (kind === "galleon" && !["spain", "england", "france", "protestant"].includes(p)) return false;
    if (p === "ottoman" && kind === "galley" && (port === "algiers" || port === "tripoli")) return false;
    if (minorHome === undefined && navalForceCount(G, p) + navalLostCount(G, p) >= NAVAL_LIMITS[p]) return false;
    // Per-ship-type force-pool limits (counter mix).
    if (minorHome === undefined) {
        const PER_TYPE: Partial<Record<keyof NavalStack, Record<Power, number>>> = {
            galley: GALLEY_LIMITS, galleon: GALLEON_LIMITS, corsair: CORSAIR_LIMITS,
        };
        const typeCap = PER_TYPE[kind];
        if (typeCap !== undefined) {
            const onMap = navalForceCountByKind(G, p, kind);
            const lost = navalLostCountByKind(G, p, kind);
            if (onMap + lost >= typeCap[p]) return false;
        }
    }
    if (kind === "galleon" && !portZones(port).some((z) =>
        z === "atlanticOcean" || z === "englishChannel" || z === "northSea" || z === "irishSea" || z === "bayOfBiscay")) {
        return false;
    }
    if (minorHome !== undefined &&
        navalForceCountController(G, minorHome) + navalLostCountController(G, minorHome) >= (MINOR_NAVAL_LIMITS[minorHome] ?? 4)) {
        return false;
    }
    return true;
};

/** Rule 17.2 fortress construction: mirrors the body of `buildFortress`. */
const canBuildFortressAt = (G: VQGame, p: Power, id: string): boolean => {
    const s = G.spaces[id];
    const def = SPACE_BY_ID[id];
    if (s === undefined || def === undefined) return false;
    if (G.powers[p].cp < 2) return false;
    const homes = spaceHomes(def);
    const alliedMinorHome = homes.some((h) => !isPower(h) && h !== "independent" && G.powers[p].alliedMinors.includes(h as never));
    const minorFortress = alliedMinorHome && s.control !== p && homes.includes(s.control);
    const minorFortressHome = homes.find((h) => !isPower(h) && h !== "independent");
    if (def.kind !== "open" || s.fortress) return false;
    if ((!minorFortress && s.control !== p) || (minorFortress && s.control !== minorFortressHome)) return false;
    if (s.unrest) return false;
    if (!minorFortress && !homes.includes(p)) return false;
    return true;
};

/** Rule 15.2 assault: mirrors the body of the `assault` move. */
const canAssaultAt = (G: VQGame, p: Power, id: string): boolean => {
    const s = G.spaces[id];
    if (s === undefined || s.siege === undefined || !besiegerOwners(G, id).includes(p)) return false;
    if (s.siege.sinceImpulse >= G.impulse) return false; // one impulse of siege first
    if (!hasLOC(G, p, id)) return false;
    // Rule 16.7: the inland-waterway link blocks an assault unless the
    // attacker holds the North Sea (or plays #10).
    const link = inlandPortLink(id);
    if (link !== undefined && G.spaces[link]?.control === s.control &&
        navalCount(G.seaZones.northSea.naval[p]) === 0 && !G.powers[p].cards.includes("vq-010")) return false;
    if (!navalBlockadeSatisfied(G, p, id)) return false;
    if (G.powers[p].cp < 1) return false;
    return true;
};

/** Rule 10.6: the capital a Spring Deployment may start from. */
const canSpringFrom = (G: VQGame, p: Power, from: string): boolean => {
    if (G.springDone.includes(p)) return false;
    const s = G.spaces[from];
    if (s === undefined || !capitalSpacesFor(G, p).includes(from)) return false;
    if (s.control !== p && !friendlyControlled(G, p, from)) return false;
    return landCount(s.land[p]) > 0;
};

/**
 * Rule 10.6: a sea zone may not be crossed during Spring Deployment while any
 * other major power has naval units in one of its ports, even an ally's.
 * Units loaned to the deploying power are already stacked as that power's
 * units (the `loanedNaval` record tracks their return), so they do not block.
 */
export const springSeaCrossingBlocked = (G: VQGame, p: Power, zone: SeaZoneID): boolean =>
    zonePorts(zone).some((port) => ownersWithNaval(G, port).some((owner) => isPower(owner) && owner !== p));

/**
 * Rule 10.6 destinations: trace a path of any length from the capital,
 * crossing at most one sea zone, with no passes, unrest, foreign units or
 * foreign leaders on the path.  Mirrors the BFS in `springDeploy`.
 */
export const springTargetsFrom = (G: VQGame, p: Power, from: string, unitCount?: number): Set<string> => {
    const out = new Set<string>();
    const source = G.spaces[from]?.land[p];
    if (source === undefined || landCount(source) === 0) return out;
    const pathSpaceAllowed = (id: string): boolean => {
        const state = G.spaces[id];
        if (state === undefined || !friendlyControlled(G, p, id) || state.unrest) return false;
        if (ownersWithLand(G, id).some((owner) => !friendlyController(G, p, owner))) return false;
        if (G.scenario === "tutorial") return tutorialSpaceAllowed(id);
        if (ownersWithNaval(G, id).some((owner) => !friendlyController(G, p, owner))) return false;
        return state.leaders.every((leader) => {
            const def = LEADER_BY_ID[leader];
            return def === undefined || friendlyController(G, p, def.power);
        });
    };
    const canCrossSea = (unitCount ?? landCount(source)) <= 5;
    const seen = new Set<string>([`${from}:false`]);
    const queue: {id: string; crossedSea: boolean}[] = [{id: from, crossedSea: false}];
    while (queue.length > 0) {
        const current = queue.shift() as {id: string; crossedSea: boolean};
        for (const neighbor of landNeighbors(current.id)) {
            if (neighbor.pass || !pathSpaceAllowed(neighbor.id)) continue;
            const key = `${neighbor.id}:${current.crossedSea}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.add(neighbor.id);
            queue.push({id: neighbor.id, crossedSea: current.crossedSea});
        }
        if (current.crossedSea || !canCrossSea) continue;
        for (const zone of portZones(current.id)) {
            // Other major powers' naval units in the zone's ports block the
            // crossing even when allied (10.6).
            if (G.scenario === "tutorial") {
                if (zonePorts(zone).some((port) => ownersWithNaval(G, port).some((owner) => owner !== p)) ||
                    ownersWithNaval(G, zone).some((owner) => owner !== p)) continue;
            } else {
                if (springSeaCrossingBlocked(G, p, zone)) continue;
                if (ownersWithNaval(G, zone).some((owner) => !friendlyController(G, p, owner))) continue;
            }
            for (const port of zonePorts(zone)) {
                if (port === current.id || !pathSpaceAllowed(port)) continue;
                const key = `${port}:true`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.add(port);
                queue.push({id: port, crossedSea: true});
            }
        }
    }
    out.delete(from); // `springDeploy` rejects a zero-length redeployment.
    return out;
};

/** Rule 5.2 land movement: mirrors the destination checks in `moveLand`. */
export const canMoveLandTo = (G: VQGame, p: Power, from: string, to: string, selectedOwner?: Controller): boolean => {
    const src = G.spaces[from];
    const dst = G.spaces[to];
    if (src === undefined || dst === undefined || from === to) return false;
    if (!landNeighbors(from).some((n) => n.id === to)) return false;
    const unitPowers = (Object.keys(src.land) as Controller[])
        .filter((owner) => (selectedOwner === undefined || selectedOwner === owner) && friendlyController(G, p, owner) && landCount(src.land[owner]) > 0);
    if (unitPowers.length === 0) return false;
    const defTo = SPACE_BY_ID[to];
    const spainIberianPenalty = p === "spain" && defTo !== undefined &&
        (spaceHomes(defTo).includes("ireland") || spaceHomes(defTo).includes("scotland")) &&
        warCost(G, "spain", "england") > 3;
    if (spainIberianPenalty) return false;
    const cost = passBetween(from, to) ? 2 : 1;
    if (G.powers[p].cp < cost) return false;
    return unitPowers.some((unitPower) => {
        // Rule 23.1: Morisco units may never move more than 2 spaces from Granada.
        if (p === "ottoman" && unitPower === "ottoman" && G.morisco?.space === from &&
            (landDistance("granada", to) ?? Number.POSITIVE_INFINITY) > 2) return false;
        if (G.lostBattleImpulse?.impulse === G.impulse && G.lostBattleImpulse.owners.includes(unitPower)) return false;
        // Units inside a besieged fortress may not march out; the besieger may.
        if (spaceHasEnemyLand(G, p, from) && src.siege !== undefined && !besiegerOwners(G, from).includes(p)) return false;
        const declaresWar = (p === "england" && defTo?.area === "netherlands" && dst.control === "spain") ||
            (p === "spain" && dst.control === "england" && spaceHomes(defTo).some((home) => home === "ireland" || home === "scotland"));
        const canEnter = declaresWar || friendlyControlled(G, p, to) || dst.control === "independent" ||
            (isPower(dst.control) ? atWar(G, p, dst.control) : atWarWithMinor(G, p, dst.control as MinorPower));
        const otherUnits = ownersWithLand(G, to).filter((owner) => !friendlyController(G, p, owner));
        if (!canEnter && (G.scenario === "tutorial" || otherUnits.length === 0)) return false;
        return true;
    });
};

/** Rule 16.1 naval movement: mirrors the destination checks in `moveNaval`. */
export const canMoveNavalTo = (G: VQGame, p: Power, from: string, to: string): boolean => {
    if (!isSeaZone(from) && G.spaces[from] === undefined) return false;
    if (!isSeaZone(to) && G.spaces[to] === undefined) return false;
    if (!navalAdjacent(from, to)) return false;
    if (isInlandPort(from) || isInlandPort(to)) return false;
    const stack = isSeaZone(from) ? G.seaZones[from as SeaZoneID].naval[p] : G.spaces[from].naval[p];
    const armadaHere = p === "spain" && G.armada?.location === from;
    if (navalCount(stack) === 0 && !armadaHere) return false;
    if (G.spaces[to] !== undefined) {
        const enemyNaval = ownersWithNaval(G, to).some((c) => isPower(c) && atWar(G, p, c));
        if (G.spaces[to].control !== p && !enemyNaval) return false;
    }
    // Each Naval Move action costs 1 CP, including a second action this impulse.
    if (G.powers[p].cp < 1) return false;
    const destinationHadEnemy = ownersWithNaval(G, to).some((owner) => !friendlyController(G, p, owner));
    if (stack === undefined && destinationHadEnemy) return false;
    return true;
};

/** Rule 16.3 naval transport: the sea zones reachable as the first leg. */
const transportZonesFrom = (G: VQGame, p: Power, from: string): Set<string> => {
    const out = new Set<string>();
    if (G.navalTransportImpulse === G.impulse) return out; // one formation per impulse
    const s = G.spaces[from];
    if (s === undefined || landCount(s.land[p]) === 0 || !isPort(from)) return out;
    if (s.siege !== undefined && s.siege.by !== p) return out;
    if (isInlandPort(from)) {
        // Rule 16.7: the inland leg is a direct 1 CP move through the North Sea
        // while the linked port (Flushing/Brielle) is controlled.
        const link = inlandPortLink(from);
        if (link !== undefined && G.spaces[link]?.control === p && G.powers[p].cp >= 1 &&
            navalCount(G.seaZones.northSea.naval[p]) > 0) {
            out.add("northSea");
        }
        return out;
    }
    if (G.powers[p].cp < 2) return out; // one sea zone costs 2 CP
    for (const zone of portZones(from)) {
        if (navalCount(G.seaZones[zone].naval[p]) > 0) out.add(zone);
    }
    return out;
};

/**
 * Return the space ids (and, for `moveNaval`/`navalTransport`, sea-zone ids)
 * that `mode` can legally act on for the current step.
 *
 * Movement modes follow the "choose origin, then target" flow: with no
 * `from` they return the legal origins, with a `from` the legal destinations.
 * The function is pure and allocation-light so the board may call it on every
 * render.  Global response windows and storm/harem restrictions are honoured
 * through the same `moveError` policy the moves themselves use.
 */
export const legalTargets = (
    G: VQGame,
    me: Power | undefined,
    mode: LegalTargetMode | string,
    from?: string | null,
): Set<string> => {
    const targets = new Set<string>();
    if (mode === "inspect") return targets; // nothing to highlight
    // Only the active power may act; stale seats and spectators get no targets.
    if (me === undefined || G.powers[me] === undefined || me !== G.activePower) return targets;
    const origin = from === undefined || from === null || from === "" ? null : from;
    const moveAllowed = (move: string, args: unknown): boolean => moveError(G, move, args) === undefined;

    switch (mode) {
        case "recruitRegular":
        case "recruitMerc":
        case "recruitCav": {
            const kind = mode === "recruitRegular" ? "regular" : mode === "recruitMerc" ? "merc" : "cav";
            for (const id of legalTargetSpaceIds(G)) {
                if (canRecruitAt(G, me, id, kind) && moveAllowed("recruit", {space: id, kind})) targets.add(id);
            }
            return targets;
        }
        case "buildGalley":
        case "buildGalleon":
        case "buildRacebuilt":
        case "buildCorsair": {
            const kind: keyof NavalStack = mode === "buildGalley" ? "galley" :
                mode === "buildGalleon" ? "galleon" : mode === "buildRacebuilt" ? "racebuilt" : "corsair";
            for (const id of legalTargetSpaceIds(G)) {
                if (canBuildNavalAt(G, me, id, kind) && moveAllowed("buildNaval", {port: id, kind})) targets.add(id);
            }
            return targets;
        }
        case "buildFortress": {
            for (const id of legalTargetSpaceIds(G)) {
                if (canBuildFortressAt(G, me, id) && moveAllowed("buildFortress", {space: id})) targets.add(id);
            }
            return targets;
        }
        case "control": {
            // Rule 12: exactly the `canControlSpace` check; the move itself
            // also charges 1 CP (see `controlSpace`).
            for (const id of legalTargetSpaceIds(G)) {
                if (canControlSpace(G, me, id).ok) targets.add(id);
            }
            return targets;
        }
        case "assault": {
            for (const id of legalTargetSpaceIds(G)) {
                if (canAssaultAt(G, me, id) && moveAllowed("assault", {space: id})) targets.add(id);
            }
            return targets;
        }
        case "rebellion": {
            // Rule 20.10: the Reformed rebellion in France/the Netherlands.
            if (me !== "protestant" || G.protestantRebellionBlockedTurn === G.year || G.powers[me].cp < 2) return targets;
            for (const id of rebellionTargets(G)) {
                if (moveAllowed("rebellion", {space: id, cp: 2})) targets.add(id);
            }
            return targets;
        }
        case "spring": {
            if (origin === null) {
                for (const capital of capitalSpacesFor(G, me)) {
                    if (canSpringFrom(G, me, capital) && moveAllowed("springDeploy", {from: capital})) {
                        targets.add(capital);
                    }
                }
                return targets;
            }
            if (!canSpringFrom(G, me, origin) || !moveAllowed("springDeploy", {from: origin})) return targets;
            for (const id of springTargetsFrom(G, me, origin)) {
                if (moveAllowed("springDeploy", {from: origin, to: id})) targets.add(id);
            }
            return targets;
        }
        case "moveLand": {
            if (origin === null) {
                // Origins: a friendly controller (self or ally) has land units.
                if (G.powers[me].cp < 1) return targets;
                for (const id of legalTargetSpaceIds(G)) {
                    const s = G.spaces[id];
                    if (s === undefined) continue;
                    const movable = (Object.keys(s.land) as Controller[]).filter((owner) =>
                        friendlyController(G, me, owner) && landCount(s.land[owner]) > 0 &&
                        !(G.lostBattleImpulse?.impulse === G.impulse && G.lostBattleImpulse.owners.includes(owner)));
                    if (movable.length === 0) continue;
                    if (spaceHasEnemyLand(G, me, id) && s.siege !== undefined && !besiegerOwners(G, id).includes(me)) continue;
                    if (!moveAllowed("moveLand", {from: id})) continue;
                    targets.add(id);
                }
                return targets;
            }
            if (G.powers[me].cp < 1) return targets;
            for (const neighbor of landNeighbors(origin)) {
                if (canMoveLandTo(G, me, origin, neighbor.id) && moveAllowed("moveLand", {from: origin, to: neighbor.id})) {
                    targets.add(neighbor.id);
                }
            }
            return targets;
        }
        case "moveNaval": {
            const canSailNow = G.powers[me].cp >= 1;
            if (!canSailNow || !moveAllowed("moveNaval", {})) return targets;
            if (origin === null) {
                // Origins: sea zones and ports holding this power's naval units.
                for (const zone of SEA_ZONES) {
                    if (navalCount(G.seaZones[zone.id].naval[me]) > 0) targets.add(zone.id);
                }
                for (const id of legalTargetSpaceIds(G)) {
                    const s = G.spaces[id];
                    if (s === undefined || isInlandPort(id)) continue;
                    if (navalCount(s.naval[me]) > 0) targets.add(id);
                }
                const armada = G.armada?.location;
                if (me === "spain" && armada !== undefined && !isInlandPort(armada) &&
                    (isSeaZone(armada) || G.spaces[armada] !== undefined)) {
                    targets.add(armada);
                }
                return targets;
            }
            const candidates = new Set<string>();
            if (isSeaZone(origin)) {
                for (const zone of SEA_ZONE_BY_ID[origin].adjacent) candidates.add(zone);
                for (const port of zonePorts(origin as SeaZoneID)) candidates.add(port);
            } else {
                for (const zone of portZones(origin)) candidates.add(zone);
            }
            for (const id of candidates) {
                if (canMoveNavalTo(G, me, origin, id) && moveAllowed("moveNaval", {from: origin, to: id})) targets.add(id);
            }
            return targets;
        }
        case "navalTransport": {
            if (!moveAllowed("navalTransport", origin === null ? {} : {from: origin})) return targets;
            if (origin === null) {
                // Origins: ports holding this power's land units.
                for (const id of legalTargetSpaceIds(G)) {
                    if (transportZonesFrom(G, me, id).size > 0) targets.add(id);
                }
                return targets;
            }
            for (const zone of transportZonesFrom(G, me, origin)) targets.add(zone);
            return targets;
        }
        default:
            return targets;
    }
};
