/**
 * Rule-derived invariant catalogue for Virgin Queen.
 *
 * Every invariant names the rulebook section it comes from, so a violation in
 * the self-play harness reads as "rule 17.1 force pool" rather than "some
 * counter is wrong".  The catalogue is intentionally split into two tiers:
 *
 *  - `A` — bookkeeping the board itself relies on.  A violation is always a
 *    defect (a card in two zones, a counter created twice, a pending window
 *    nobody can answer).
 *  - `B` — a rule audit that is printed in the 2024 Living Rules but whose
 *    engine representation is looser than the printed text.  These still run by
 *    default; the property suite reports them with the rule citation.
 *
 * This module deliberately has no dependency on the harness, so the harness,
 * the card sweep and the mutation tests can all share it.
 */
import {Ctx} from "boardgame.io";
import {
    Controller,
    MINOR_NAVAL_LIMITS,
    MINOR_POWERS,
    MINOR_REGULAR_LIMITS,
    NAVAL_LIMITS,
    POWERS,
    Power,
    REGULAR_LIMITS,
    RELIGION_AREAS,
    TREASURE_TABLE,
    WALLOON_LIMIT,
    Treasure,
    VQGame,
    isPower,
    navalCount,
} from "../../src/virginQueen/constant/general";
import {CARD_BY_ID} from "../../src/virginQueen/constant/cards";
import {LEADER_BY_ID, leaderIsArmy, leaderIsNaval} from "../../src/virginQueen/constant/leaders";
import {SEA_ZONE_BY_ID, SPACE_BY_ID} from "../../src/virginQueen/mapData";
import {tutorialSpaceAllowed} from "../../src/virginQueen/tutorial";
import {isInlandPort} from "../../src/virginQueen/mapData";
import {ownerOf} from "../../src/virginQueen/ownership";
import {controlOf} from "./support";
import {
    automaticVictoryCandidates,
    defenderLandCount,
    landForceCountController,
    landPoolLimit,
    navalLostCount,
    navalPoolLimit,
    navalPoolUsed,
    vpBreakdown,
    victoryStandings,
} from "../../src/virginQueen/util";

export type InvariantTier = "A" | "B";

export interface InvariantViolation {
    /** Stable machine id, e.g. `cards.single-copy`. */
    id: string;
    /** Rulebook section, e.g. `6.2`. */
    rule: string;
    tier: InvariantTier;
    detail: string;
}

export type InvariantLevel = "cheap" | "full";

export interface InvariantSpec {
    id: string;
    rule: string;
    tier: InvariantTier;
    /**
     * When the check is worth paying for.  `cheap` walks one state without
     * recomputing the board (~0.005-0.05 ms); `full` derives VP standings or
     * force pools across the whole board (~0.05 ms, and it is the tier that
     * matters once the policy is no longer the bottleneck).  The property
     * harness runs `cheap` after every action and `full` at phase boundaries
     * and on a step cadence.
     */
    level: InvariantLevel;
    check: (G: VQGame, ctx?: Ctx) => string[];
}

const note = (problems: string[], id: string, rule: string, tier: InvariantTier, detail: string): void => {
    problems.push(`${id}|${rule}|${tier}|${detail}`);
};

/** Every card id the module knows about (Home, Event, Command and official). */
const knownCard = (id: string): boolean => CARD_BY_ID[id] !== undefined;

/** Physical zones a single deck copy may occupy. Home cards are extra. */
const cardZones = (G: VQGame): {where: string; cards: string[]}[] => {
    const zones: {where: string; cards: string[]}[] = [
        {where: "deck", cards: G.deck},
        {where: "discard", cards: G.discard},
        {where: "removed", cards: G.removed},
        {where: "futureDeck", cards: G.futureDeck},
        {where: "homeSetAside", cards: G.homeSetAside},
    ];
    for (const power of POWERS) {
        zones.push({where: `${power} hand`, cards: G.powers[power].cards});
        zones.push({where: `${power} homeCardSetAside`, cards: G.powers[power].homeCardSetAside ?? []});
    }
    return zones;
};

const KNOWN_TREASURE_MIX = (() => {
    const counts = new Map<string, number>();
    for (const treasure of TREASURE_TABLE) {
        counts.set(String(treasure), (counts.get(String(treasure)) ?? 0) + 1);
    }
    return counts;
})();

const treasureKey = (treasure: Treasure): string => String(treasure);

const isInteger = (value: unknown, min = 0): boolean =>
    typeof value === "number" && Number.isInteger(value) && value >= min;

// ---------------------------------------------------------------------------
// A-tier: structural bookkeeping
// ---------------------------------------------------------------------------

export const checkCardBookkeeping = (G: VQGame): string[] => {
    const problems: string[] = [];
    const seen = new Map<string, string>();
    for (const zone of cardZones(G)) {
        for (const id of zone.cards) {
            if (!knownCard(id)) {
                note(problems, "cards.known", "6.2", "A", `unknown card ${id} in ${zone.where}`);
                continue;
            }
            const previous = seen.get(id);
            if (previous !== undefined) {
                note(problems, "cards.single-copy", "6.2", "A", `card ${id} is in both ${previous} and ${zone.where}`);
            } else {
                seen.set(id, zone.where);
            }
        }
    }
    for (const power of POWERS) {
        for (const id of G.powers[power].homeCardSetAside ?? []) {
            const def = CARD_BY_ID[id];
            if (def !== undefined && def.kind !== "home") {
                note(problems, "cards.home-aside", "10.5", "A", `${id} is in ${power}'s face-down Home pile but is not a Home card`);
            }
            if (def?.power !== undefined && def.power !== power) {
                note(problems, "cards.home-aside", "10.5", "A", `${power} holds ${def.power}'s Home card ${id} face down`);
            }
        }
        for (const id of G.lockedCards?.[power] ?? []) {
            if (!knownCard(id)) note(problems, "cards.known", "6.2", "A", `${power} locks unknown card ${id}`);
        }
        for (const id of G.playedThisTurn?.[power] ?? []) {
            if (!knownCard(id)) note(problems, "cards.known", "6.2", "A", `${power} played unknown card ${id}`);
        }
    }
    return problems;
};

export const checkTreasureBookkeeping = (G: VQGame): string[] => {
    const problems: string[] = [];
    const used = new Map<string, number>();
    const add = (treasure: Treasure, where: string): void => {
        const key = treasureKey(treasure);
        if (!KNOWN_TREASURE_MIX.has(key)) {
            note(problems, "treasures.values", "6.3", "A", `unknown treasure ${key} in ${where}`);
            return;
        }
        used.set(key, (used.get(key) ?? 0) + 1);
    };
    for (const power of POWERS) {
        const treasures = G.powers[power].treasures;
        if (!Array.isArray(treasures)) {
            note(problems, "treasures.values", "6.3", "A", `${power} treasures is not an array`);
            continue;
        }
        for (const treasure of treasures) add(treasure, `${power} hand`);
    }
    (G.spanishTreasureRow ?? []).forEach((treasure) => add(treasure, "Spanish row"));
    (G.portugueseTreasures ?? []).forEach((treasure) => add(treasure, "Portuguese row"));
    for (const [captain, state] of Object.entries(G.worldCaptains)) {
        (state.treasureValues ?? []).forEach((treasure) => add(treasure, `${captain} hold`));
    }
    (G.treasurePool ?? []).forEach((treasure) => add(treasure, "pool"));
    (G.treasureDiscard ?? []).forEach((treasure) => {
        if (treasure === "vp") {
            note(problems, "treasures.vp-never-discarded", "6.3", "A", "the 1 VP treasure is in the discard pile");
        }
        add(treasure, "discard");
    });
    for (const [key, count] of used) {
        const limit = KNOWN_TREASURE_MIX.get(key) ?? 0;
        if (count > limit) {
            note(problems, "treasures.mix", "6.3", "A", `${count} x treasure ${key} in play, printed mix has ${limit}`);
        }
    }
    const total = [...used.values()].reduce((sum, count) => sum + count, 0);
    if (total > TREASURE_TABLE.length) {
        note(problems, "treasures.mix", "6.3", "A", `${total} treasure counters in play, printed mix has ${TREASURE_TABLE.length}`);
    }
    return problems;
};

export const checkCounters = (G: VQGame): string[] => {
    const problems: string[] = [];
    for (const power of POWERS) {
        const ps = G.powers[power];
        if (!isInteger(ps.cp)) note(problems, "counters.cp", "11", "A", `${power} cp=${String(ps.cp)}`);
        if (typeof ps.bonusVp !== "number" || !Number.isFinite(ps.bonusVp) || !Number.isInteger(ps.bonusVp)) {
            note(problems, "counters.vp", "25.2", "A", `${power} bonusVp=${String(ps.bonusVp)}`);
        }
        if (!Number.isInteger(ps.rulerCardBonus ?? 0)) {
            note(problems, "counters.ruler", "3.3", "A", `${power} rulerCardBonus=${String(ps.rulerCardBonus)}`);
        }
        for (const card of ps.cards) {
            if (!knownCard(card)) note(problems, "cards.known", "6.2", "A", `${power} hand holds unknown card ${card}`);
        }
        if (new Set(ps.cards).size !== ps.cards.length) {
            note(problems, "cards.hand-unique", "6.2", "A", `${power} hand lists a card twice`);
        }
        for (const [key, value] of Object.entries(ps.influence ?? {})) {
            if (!isInteger(value, 0) || (value as number) > 9) {
                note(problems, "influence.cap", "24.5", "A", `${power} influence ${key}=${String(value)}`);
            }
        }
        if ((ps.scmOnCard ?? 0) < 0 || !Number.isInteger(ps.scmOnCard ?? 0)) {
            note(problems, "markers.scm", "2.4", "A", `${power} scmOnCard=${String(ps.scmOnCard)}`);
        }
    }
    for (const [spaceId, space] of Object.entries(G.spaces)) {
        for (const [owner, stack] of Object.entries(space.land)) {
            for (const [kind, count] of Object.entries(stack ?? {})) {
                if (!isInteger(count)) {
                    note(problems, "units.land", "5.3", "A", `land ${spaceId} ${owner} ${kind}=${String(count)}`);
                }
            }
        }
        for (const [owner, stack] of Object.entries(space.naval)) {
            for (const [kind, count] of Object.entries(stack ?? {})) {
                if (!isInteger(count)) {
                    note(problems, "units.naval", "5.4", "A", `naval ${spaceId} ${owner} ${kind}=${String(count)}`);
                }
            }
        }
    }
    for (const [zoneId, zone] of Object.entries(G.seaZones)) {
        for (const [owner, stack] of Object.entries(zone.naval)) {
            for (const [kind, count] of Object.entries(stack ?? {})) {
                if (!isInteger(count)) {
                    note(problems, "units.naval", "5.4", "A", `sea ${zoneId} ${owner} ${kind}=${String(count)}`);
                }
            }
        }
    }
    for (const [power, lost] of Object.entries(G.navalLost ?? {})) {
        for (const [kind, count] of Object.entries(lost ?? {})) {
            if (!isInteger(count)) {
                note(problems, "units.naval-lost", "17.3", "A", `${power} navalLost ${kind}=${String(count)}`);
            }
        }
    }
    for (const [power, actions] of Object.entries(G.piracyActions ?? {})) {
        if (!isInteger(actions, 0) || (actions as number) > 3) {
            note(problems, "piracy.actions", "16.4", "A", `${power} piracyActions=${String(actions)}`);
        }
    }
    return problems;
};

export const checkZones = (G: VQGame): string[] => {
    const problems: string[] = [];
    for (const id of Object.keys(G.spaces)) {
        if (SPACE_BY_ID[id] === undefined) note(problems, "zones.space", "2.1", "A", `unknown space ${id}`);
    }
    for (const def of Object.values(SPACE_BY_ID)) {
        if (G.spaces[def.id] === undefined) note(problems, "zones.space", "2.1", "A", `space ${def.id} missing from state`);
    }
    for (const id of Object.keys(G.seaZones)) {
        if (SEA_ZONE_BY_ID[id] === undefined) note(problems, "zones.sea", "2.5", "A", `unknown sea zone ${id}`);
    }
    for (const def of Object.values(SEA_ZONE_BY_ID)) {
        if (G.seaZones[def.id as keyof VQGame["seaZones"]] === undefined) {
            note(problems, "zones.sea", "2.5", "A", `sea zone ${def.id} missing from state`);
        }
    }
    return problems;
};

export const checkLeaders = (G: VQGame): string[] => {
    const problems: string[] = [];
    const listed = new Map<string, string[]>();
    for (const [spaceId, space] of Object.entries(G.spaces)) {
        for (const leader of space.leaders) {
            const state = G.leaders[leader];
            if (state === undefined) note(problems, "leaders.known", "5.1", "A", `space ${spaceId} lists missing leader ${leader}`);
            else if (state.location !== spaceId) {
                note(problems, "leaders.location", "5.1", "A", `space ${spaceId} lists ${leader} whose location is ${state.location}`);
            }
            listed.set(leader, [...(listed.get(leader) ?? []), spaceId]);
        }
    }
    for (const [zoneId, zone] of Object.entries(G.seaZones)) {
        for (const leader of zone.leaders) {
            const state = G.leaders[leader];
            if (state === undefined) note(problems, "leaders.known", "5.1", "A", `sea zone ${zoneId} lists missing leader ${leader}`);
            else if (state.location !== zoneId) {
                note(problems, "leaders.location", "5.1", "A", `sea zone ${zoneId} lists ${leader} whose location is ${state.location}`);
            }
            listed.set(leader, [...(listed.get(leader) ?? []), zoneId]);
        }
    }
    for (const [id, places] of listed) {
        if (places.length > 1) {
            note(problems, "leaders.single-place", "5.1", "A", `leader ${id} is listed in ${places.join(", ")}`);
        }
    }
    const holding = new Set(["pool", "captured", "offMap", "foreignWar"]);
    for (const [id, state] of Object.entries(G.leaders)) {
        const onMap = listed.has(id);
        if (!holding.has(state.location) && !onMap) {
            note(problems, "leaders.location", "5.1", "A", `leader ${id} claims ${state.location} but is not listed there`);
        }
        if (onMap && holding.has(state.location)) {
            note(problems, "leaders.location", "5.1", "A", `leader ${id} is on the board but claims ${state.location}`);
        }
        if (state.location === "captured" && state.capturedBy === undefined) {
            note(problems, "leaders.captured", "14", "A", `leader ${id} is captured without a captor`);
        }
        if (state.location === "captured" && state.capturedBy !== undefined && !isPower(state.capturedBy)) {
            note(problems, "leaders.captured", "14", "A", `leader ${id} captured by ${state.capturedBy}`);
        }
        if (SEA_ZONE_BY_ID[state.location] !== undefined && !leaderIsNaval(id)) {
            note(problems, "leaders.kind", "5.1", "A", `army-only leader ${id} is in sea zone ${state.location}`);
        }
        const space = SPACE_BY_ID[state.location];
        if (space !== undefined && leaderIsNaval(id) && !leaderIsArmy(id) && (space.ports ?? []).length === 0) {
            note(problems, "leaders.kind", "5.1", "A", `naval leader ${id} is in inland space ${state.location}`);
        }
        if (!holding.has(state.location) && space === undefined && SEA_ZONE_BY_ID[state.location] === undefined) {
            note(problems, "leaders.location", "5.1", "A", `leader ${id} has unknown location ${state.location}`);
        }
        if (LEADER_BY_ID[id] === undefined) {
            note(problems, "leaders.known", "5.1", "A", `unknown leader id ${id}`);
        }
    }
    return problems;
};

export const checkNavalPlacement = (G: VQGame): string[] => {
    const problems: string[] = [];
    for (const [spaceId, space] of Object.entries(G.spaces)) {
        const def = SPACE_BY_ID[spaceId];
        const total = Object.values(space.naval).reduce((sum, stack) => sum + navalCount(stack), 0);
        if (total === 0) continue;
        if (def === undefined) continue;
        if ((def.ports ?? []).length === 0) {
            note(problems, "naval.port", "16.1", "A", `naval units in inland space ${spaceId}`);
        }
        if (isInlandPort(spaceId)) {
            note(problems, "naval.inland-port", "16.7", "A", `naval units in inland port ${spaceId}`);
        }
    }
    for (const [zoneId, zone] of Object.entries(G.seaZones)) {
        if (Object.values(zone.naval).some((stack) => navalCount(stack) > 0) && SEA_ZONE_BY_ID[zoneId] === undefined) {
            note(problems, "naval.port", "16.1", "A", `naval units in unknown sea zone ${zoneId}`);
        }
    }
    return problems;
};

export const checkControlAndReligion = (G: VQGame): string[] => {
    const problems: string[] = [];
    const controllers = new Set<string>([...POWERS, ...MINOR_POWERS, "independent"]);
    for (const [spaceId, space] of Object.entries(G.spaces)) {
        if (!controllers.has(space.control)) {
            note(problems, "control.valid", "2.2", "A", `space ${spaceId} control=${String(space.control)}`);
        }
        if (space.religion !== "catholic" && space.religion !== "protestant") {
            note(problems, "religion.valid", "2.3", "A", `space ${spaceId} religion=${String(space.religion)}`);
        }
        if (space.siege !== undefined) {
            const def = SPACE_BY_ID[spaceId];
            if (def !== undefined && def.kind === "open" && space.fortress !== true) {
                note(problems, "siege.fortified", "15", "B", `siege in unfortified space ${spaceId}`);
            }
            const besiegers = [space.siege.by, ...(space.siege.besiegers ?? [])];
            if (besiegers.some((power) => !isPower(power))) {
                note(problems, "siege.besieger", "15", "A", `siege of ${spaceId} has a non-major besieger`);
            }
            if (space.siege.sinceImpulse > G.impulse) {
                note(problems, "siege.clock", "15.1", "A", `siege of ${spaceId} started in impulse ${space.siege.sinceImpulse} > ${G.impulse}`);
            }
            if ((space.siege.assaultedIn?.impulse ?? -1) > G.impulse) {
                note(problems, "siege.clock", "15.1", "A", `assault on ${spaceId} recorded for a future impulse`);
            }
            // Rule 14.1/15.2: only the defenders inside the fortifications are
            // capped at 4; the besieging stack in the same space is not.  The
            // defender set is resolved through the siege record (`inside` when
            // present, otherwise the controller and its co-belligerents), which
            // needs valid besieger powers — so skip it if the siege is already
            // reported as impossible above.
            const validBesiegers = besiegers.every((power) => isPower(power));
            const garrison = validBesiegers ? defenderLandCount(G, spaceId) : 0;
            if (garrison > 4) {
                note(problems, "siege.garrison", "15", "B", `${garrison} units inside besieged ${spaceId}, printed maximum is 4`);
            }
        }
    }
    return problems;
};

export const checkDiplomacy = (G: VQGame): string[] => {
    const problems: string[] = [];
    for (const power of POWERS) {
        const ps = G.powers[power];
        const seen = new Set<Power>();
        for (const enemy of ps.wars) {
            if (!isPower(enemy)) note(problems, "diplomacy.wars", "9.4", "A", `${power} is at war with ${String(enemy)}`);
            if (enemy === power) note(problems, "diplomacy.wars", "9.4", "A", `${power} is at war with itself`);
            if (seen.has(enemy)) note(problems, "diplomacy.wars", "9.4", "A", `${power} lists the war with ${enemy} twice`);
            seen.add(enemy);
            if (isPower(enemy) && !G.powers[enemy].wars.includes(power)) {
                note(problems, "diplomacy.symmetry", "9.4", "A", `${power} is at war with ${enemy} but not the reverse`);
            }
        }
        const allies = new Set<Power>();
        for (const ally of ps.allies) {
            if (!isPower(ally)) note(problems, "diplomacy.allies", "9.2", "A", `${power} is allied with ${String(ally)}`);
            if (ally === power) note(problems, "diplomacy.allies", "9.2", "A", `${power} is allied with itself`);
            if (allies.has(ally)) note(problems, "diplomacy.allies", "9.2", "A", `${power} lists the alliance with ${ally} twice`);
            allies.add(ally);
            if (isPower(ally) && !G.powers[ally].allies.includes(power)) {
                note(problems, "diplomacy.symmetry", "9.2", "A", `${power} is allied with ${ally} but not the reverse`);
            }
            if (ps.wars.includes(ally)) {
                note(problems, "diplomacy.war-and-ally", "9.2", "A", `${power} is both at war and allied with ${ally}`);
            }
        }
        for (const minor of ps.alliedMinors) {
            if (!MINOR_POWERS.includes(minor)) {
                note(problems, "diplomacy.minors", "24.2", "A", `${power} allied with unknown minor ${String(minor)}`);
                continue;
            }
            const holders = POWERS.filter((candidate) => G.powers[candidate].alliedMinors.includes(minor));
            if (holders.length > 1) {
                note(problems, "diplomacy.minors", "24.2", "A", `minor ${minor} is allied to ${holders.join(", ")}`);
            }
        }
        for (const minor of ps.warsMinors) {
            if (!MINOR_POWERS.includes(minor)) {
                note(problems, "diplomacy.minors", "9.4", "A", `${power} at war with unknown minor ${String(minor)}`);
            }
            if (ps.alliedMinors.includes(minor)) {
                note(problems, "diplomacy.minors", "9.4", "A", `${power} is both at war and allied with ${minor}`);
            }
        }
    }
    for (const [major, entry] of Object.entries(G.activatedMajors ?? {})) {
        if (!isPower(major) || !isPower(entry.ally)) {
            note(problems, "diplomacy.activated", "23", "A", `activated major ${major} with ally ${String(entry.ally)}`);
            continue;
        }
        if (ownerOf(G, major) === undefined) {
            note(problems, "diplomacy.activated", "23", "A", `activated major ${major} has no seat`);
        }
    }
    return problems;
};

export const checkPiracy = (G: VQGame): string[] => {
    const problems: string[] = [];
    for (const [zone, listed] of Object.entries(G.piracyZones ?? {})) {
        if (SEA_ZONE_BY_ID[zone] === undefined) {
            note(problems, "piracy.zone", "16.4", "A", `piracy recorded in unknown zone ${zone}`);
        }
        if (listed === undefined) continue;
        const powers = listed;
        if (powers.length > 2) {
            note(problems, "piracy.zone-cap", "16.4", "A", `${powers.length} powers pirated in ${zone}, maximum is 2`);
        }
        if (new Set(powers).size !== powers.length) {
            note(problems, "piracy.zone-cap", "16.4", "A", `${zone} lists the same pirate twice`);
        }
        for (const power of powers) {
            if (!isPower(power)) note(problems, "piracy.zone", "16.4", "A", `${zone} lists non-major pirate ${String(power)}`);
        }
    }
    return problems;
};

export const checkEspionage = (G: VQGame): string[] => {
    const problems: string[] = [];
    const pairs = new Set<string>();
    for (const informant of G.informants ?? []) {
        if (!isPower(informant.owner) || !isPower(informant.target)) {
            note(problems, "espionage.informant", "19.2", "A", `informant ${String(informant.owner)}->${String(informant.target)}`);
            continue;
        }
        const key = `${informant.owner}->${informant.target}`;
        if (pairs.has(key)) note(problems, "espionage.informant", "19.2", "A", `two informants on ${key}`);
        pairs.add(key);
    }
    const used = new Set<Power>();
    for (const power of G.assassinationUsed ?? []) {
        if (used.has(power)) note(problems, "espionage.assassination", "19.3", "A", `${power} used assassination twice`);
        used.add(power);
    }
    return problems;
};

export const checkPatronage = (G: VQGame): string[] => {
    const problems: string[] = [];
    const keys = new Set<string>();
    for (const key of G.patronizedThisTurn ?? []) {
        if (keys.has(key)) note(problems, "patronage.once", "22", "A", `${key} patronized twice this turn`);
        keys.add(key);
    }
    const patrons = new Set<string>();
    for (const entry of G.pendingPatronage ?? []) {
        if (patrons.has(entry.patronId)) note(problems, "patronage.once", "22", "A", `patron ${entry.patronId} is pending twice`);
        patrons.add(entry.patronId);
    }
    for (const power of POWERS) {
        const own = G.powers[power].patrons;
        if (new Set(own).size !== own.length) note(problems, "patronage.once", "22", "A", `${power} lists a patron twice`);
    }
    return problems;
};

export const checkTurnStructure = (G: VQGame): string[] => {
    const problems: string[] = [];
    if (!Number.isInteger(G.year) || G.year < G.startTurn || G.year > G.endTurn + 1) {
        note(problems, "turn.year", "7", "A", `year=${G.year} outside ${G.startTurn}..${G.endTurn + 1}`);
    }
    if (!isInteger(G.impulse)) note(problems, "turn.impulse", "11", "A", `impulse=${G.impulse}`);
    if (!isInteger(G.turnsCompleted)) note(problems, "turn.counters", "7", "A", `turnsCompleted=${G.turnsCompleted}`);
    if (!isInteger(G.phaseTurns)) note(problems, "turn.counters", "7", "A", `phaseTurns=${G.phaseTurns}`);
    if (!isInteger(G.consecutivePasses) || G.consecutivePasses > POWERS.length) {
        note(problems, "turn.passes", "11", "A", `consecutivePasses=${G.consecutivePasses}`);
    }
    if ((G.virginQueenVpAwarded ?? 0) > 5 || !isInteger(G.virginQueenVpAwarded ?? 0)) {
        note(problems, "virgin-queen.cap", "21.2", "B", `virginQueenVpAwarded=${String(G.virginQueenVpAwarded)}`);
    }
    for (const [turn, row] of Object.entries(G.vpHistory ?? {})) {
        const number = Number(turn);
        if (!Number.isInteger(number) || number > G.endTurn) {
            note(problems, "vp.history", "25.3", "A", `vpHistory has turn ${turn}`);
        }
        for (const [power, value] of Object.entries(row ?? {})) {
            if (!isPower(power) || typeof value !== "number" || !Number.isInteger(value)) {
                note(problems, "vp.history", "25.3", "A", `vpHistory ${turn} ${power}=${String(value)}`);
            }
        }
    }
    for (const power of POWERS) {
        const breakdown = vpBreakdown(G, power);
        if (breakdown.total !== breakdown.baseVp + breakdown.religiousVp + breakdown.bonusVp +
            breakdown.fortressVp + breakdown.cyprusVp) {
            note(problems, "vp.derivation", "25.2", "A", `${power} VP does not add up`);
        }
        if (!Number.isInteger(breakdown.total)) note(problems, "vp.derivation", "25.2", "A", `${power} VP=${breakdown.total}`);
    }
    return problems;
};

export const checkForcePools = (G: VQGame): string[] => {
    const problems: string[] = [];
    // Rule 17.1: "Units may never be constructed in excess of the counters
    // available."  The engine models this as one unified pool per controller —
    // regulars, mercenaries and Ottoman cavalry share the same physical
    // counters (rule 5.3) — so the audit mirrors `landPoolLimit`/`navalPoolLimit`
    // rather than inventing separate allowances per unit type.
    //
    // The tutorial deliberately ignores the printed pools: `TUTORIAL_POWER_CARDS`
    // hands the Ottoman and Spanish players a fixed teaching set-up, so the
    // physical counter limit is not a meaningful audit there.
    if (G.scenario === "tutorial") return problems;
    for (const power of POWERS) {
        const land = landForceCountController(G, power);
        const landLimit = landPoolLimit(power);
        if (land > landLimit) {
            note(problems, "force.land", "17.1", "B", `${power} land units=${land} limit=${landLimit}`);
        }
        const naval = navalPoolUsed(G, power);
        const navalLimit = navalPoolLimit(power);
        if (naval > navalLimit) {
            note(problems, "force.naval", "17.3", "B", `${power} naval counters=${naval} (incl. pending rebuilds) limit=${navalLimit}`);
        }
    }
    for (const minor of MINOR_POWERS) {
        const land = landForceCountController(G, minor);
        const landLimit = MINOR_REGULAR_LIMITS[minor] ?? 12;
        if (land > landLimit) {
            note(problems, "force.minor", "24.3", "B", `${minor} land units=${land} limit=${landLimit}`);
        }
        const naval = navalPoolUsed(G, minor);
        const navalLimit = MINOR_NAVAL_LIMITS[minor] ?? 4;
        if (naval > navalLimit) {
            note(problems, "force.minor", "24.3", "B", `${minor} naval counters=${naval} limit=${navalLimit}`);
        }
    }
    // Rule 17.2(c): the three Walloon regular counters are a special Spanish
    // build allowance, not an extra unit type, so a fourth one is impossible.
    if ((G.walloonsBuilt ?? 0) < 0 || (G.walloonsBuilt ?? 0) > WALLOON_LIMIT) {
        note(problems, "force.walloons", "17.2", "B", `walloonsBuilt=${G.walloonsBuilt}`);
    }
    return problems;
};

export const checkReligion = (G: VQGame): string[] => {
    const problems: string[] = [];
    for (const area of RELIGION_AREAS) {
        const spaces = Object.entries(G.spaces).filter(([id]) => SPACE_BY_ID[id]?.area === area);
        // A scenario only uses part of the board.  The tutorial plays the
        // Ottoman-Spanish theatre and leaves the Protestant areas untouched, so
        // an area with no scenario space must not be audited: every space there
        // is still "Catholic" only because it was never set up.
        if (spaces.length < 2) continue;
        if (G.scenario === "tutorial" && spaces.every(([id]) => !tutorialSpaceAllowed(id))) continue;
        const catholic = spaces.filter(([, space]) => space.religion === "catholic").length;
        const protestant = spaces.length - catholic;
        // Rule 18.1: the final Catholic and the final Protestant space in an
        // area can never be flipped, so a struggle area always keeps both.
        if (catholic === 0) note(problems, "religion.core-presence", "18.1", "B", `${area} has no Catholic space left`);
        if (protestant === 0) note(problems, "religion.core-presence", "18.1", "B", `${area} has no Protestant space left`);
    }
    return problems;
};

// ---------------------------------------------------------------------------
// Pending decisions
// ---------------------------------------------------------------------------

/**
 * The power whose pending decision blocks play, if any.  Shared with the
 * self-play harness: an invariant violation here means the board has no button
 * that can answer the window.
 */
export const pendingDecider = (G: VQGame): Power | undefined => {
    const b = G.pendingBattle;
    if (b !== undefined) return b.responding;
    if (G.pendingEspionage !== undefined) return G.pendingEspionage.responding;
    if (G.pendingCardEvent !== undefined) {
        return G.pendingCardEvent.kind === "cancelEvent" ? G.pendingCardEvent.responding : "ottoman";
    }
    if (G.pendingTutorialEvent !== undefined) return G.pendingTutorialEvent.responding;
    if (G.pendingActivation !== undefined) return G.pendingActivation.ally;
    if (G.pendingTribute !== undefined) return G.pendingTribute.target;
    if (G.pendingAbjuration !== undefined) return "protestant";
    if (G.pendingCityRebels !== undefined) {
        // An allied minor's garrison is decided by the major that owns it, so
        // resolve through `controlOf` rather than the raw controller.
        return controlOf(G, G.pendingCityRebels.controller);
    }
    if (G.pendingMutiny !== undefined) return G.pendingMutiny.owner;
    if (G.pendingPolishElection !== undefined) return G.pendingPolishElection.remaining[0];
    if (G.pendingPiracy !== undefined) {
        return G.pendingPiracy.step === "losses" ? G.pendingPiracy.power : G.pendingPiracy.target;
    }
    if (G.pendingAction !== undefined) {
        return G.pendingAction.responder ?? G.pendingAction.responders?.[0] ?? G.pendingAction.power;
    }
    if (G.pendingBeacon !== undefined) return G.pendingBeacon.defender;
    if (G.pendingInterceptionOrder !== undefined) return G.pendingInterceptionOrder.defender;
    if (G.pendingIntercept !== undefined) return G.pendingIntercept.defender;
    if (G.pendingWithdraw !== undefined) return G.pendingWithdraw.defender;
    if (G.pendingReliefSplit !== undefined) return G.pendingReliefSplit.power;
    if (G.pendingContinue !== undefined) return G.pendingContinue.power;
    if (G.pendingForeignWar !== undefined) return G.pendingForeignWar.power;
    if (G.pendingRebelMove !== undefined) return G.pendingRebelMove.power;
    if (G.pendingBetrothal !== null && G.pendingBetrothal !== undefined) return G.pendingBetrothal.target;
    if (G.pendingNavalOrder !== undefined) return G.pendingNavalOrder.attacker;
    if (G.pendingNavalMoves !== undefined) return G.pendingNavalMoves.power;
    if (G.gregorianResponse !== undefined) return G.gregorianResponse.responder;
    // Windows the board renders without a boardgame.io stage.
    if (G.pendingConversion !== undefined) return G.pendingConversion.power;
    if (G.pendingScienceTreasure !== undefined) return G.pendingScienceTreasure.power;
    // Both Spring windows belong to the power whose national turn it is.  A
    // reduced-player seat owns several powers (the Ottoman seat also plays the
    // Protestant), so `activePower` — not "who owns the flag" — decides whether
    // the window is open now.  `moveError` blocks on exactly this test.
    const navalArrival = (G.navalLeaderArrivals ?? []).find((entry) => entry.power === G.activePower);
    if (navalArrival !== undefined) return navalArrival.power;
    if (G.orangeArrivalPending === true && G.activePower === "protestant") return "protestant";
    // Rule 20: only the power whose national turn it is must confirm its
    // winter losses (`moveError` blocks on exactly these).  Winter *return*
    // choices are optional (the automatic placement is already a legal result),
    // and a loss record for a power with no seat is resolved automatically at
    // `endPhaseTurn`, so neither blocks play.
    const winterPower = (entries: {power: Power}[] | undefined): Power | undefined =>
        entries?.find((entry) => entry.power === G.activePower)?.power;
    const landLoss = winterPower(G.winterLossChoices);
    if (landLoss !== undefined) return landLoss;
    const navalLoss = winterPower(G.winterNavalLossChoices);
    if (navalLoss !== undefined) return navalLoss;
    return undefined;
};

export const checkPendingWindows = (G: VQGame): string[] => {
    const problems: string[] = [];
    const decider = pendingDecider(G);
    if (decider !== undefined && ownerOf(G, decider) === undefined) {
        note(problems, "pending.owner", "7", "A", `pending decision for ${decider}, which has no controlling seat`);
    }
    // Rule 15.1: both sides of a battle are seats that must answer in turn.
    // `pendingDecider` only names the side whose step is open, so a seatless
    // counter-side is invisible at e.g. the attacker's card step; it would
    // deadlock as soon as the step passed to that side.  Checked on the stored
    // battle rather than the current step, so every state of the battle is
    // covered.
    const battle = G.pendingBattle;
    if (battle !== undefined) {
        for (const [role, power] of [["attacker", battle.attacker], ["defender", battle.defender]] as const) {
            if (ownerOf(G, power) === undefined) {
                note(problems, "pending.battle-seat", "15.1", "A",
                    `${role} ${power} of the ${battle.phase} battle at ${battle.location} has no controlling seat`);
            }
        }
    }
    return problems;
};

export const checkVictoryOutcome = (G: VQGame, ctx?: Ctx): string[] => {
    const problems: string[] = [];
    const gameover = ctx?.gameover as {winner?: string; power?: Power; reason?: string} | undefined;
    if (gameover === undefined) return problems;
    const power = gameover.power;
    if (power === undefined || !isPower(power)) {
        note(problems, "victory.power", "25", "A", `gameover names ${String(power)}`);
        return problems;
    }
    if (gameover.winner !== ownerOf(G, power)) {
        note(problems, "victory.seat", "25", "A", `gameover winner=${String(gameover.winner)} but ${power} is owned by ${String(ownerOf(G, power))}`);
    }
    const reason = gameover.reason;
    const standings = victoryStandings(G, false);
    const top = standings[0];
    const second = standings[1];
    switch (reason) {
        case "standard":
            if (top === undefined || top.vp < 25) {
                note(problems, "victory.standard", "25.3", "A", `standard victory with top VP ${top?.vp ?? "none"}`);
            }
            break;
        case "domination":
            if (top === undefined || second === undefined || top.vp - second.vp < 5 || G.year <= 4) {
                note(problems, "victory.domination", "25.3", "A",
                    `domination victory top=${top?.vp} second=${second?.vp} year=${G.year}`);
            }
            break;
        case "timeLimit":
            if (G.year <= G.endTurn) {
                note(problems, "victory.time-limit", "25.3", "A", `time limit victory in year ${G.year}`);
            }
            break;
        case "military":
        case "protestantReligious":
        case "catholicReligious":
        case "catholicRebellion": {
            const candidates = automaticVictoryCandidates(G);
            if (!candidates.some((candidate) => candidate.winner === power && candidate.reason === reason)) {
                note(problems, "victory.automatic", "25.1", "A",
                    `gameover ${reason}/${power} is not a current automatic victory (${JSON.stringify(candidates)})`);
            }
            break;
        }
        default:
            note(problems, "victory.reason", "25", "A", `unknown victory reason ${String(reason)}`);
    }
    return problems;
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const INVARIANTS: InvariantSpec[] = [
    {id: "cards", rule: "6.2", tier: "A", level: "cheap", check: checkCardBookkeeping},
    {id: "treasures", rule: "6.3", tier: "A", level: "cheap", check: checkTreasureBookkeeping},
    {id: "counters", rule: "5/11", tier: "A", level: "cheap", check: checkCounters},
    {id: "zones", rule: "2.1", tier: "A", level: "cheap", check: checkZones},
    {id: "leaders", rule: "5.1", tier: "A", level: "cheap", check: checkLeaders},
    {id: "naval", rule: "16.1", tier: "A", level: "cheap", check: checkNavalPlacement},
    {id: "control", rule: "2.2", tier: "A", level: "cheap", check: checkControlAndReligion},
    {id: "diplomacy", rule: "9.2", tier: "A", level: "cheap", check: checkDiplomacy},
    {id: "piracy", rule: "16.4", tier: "A", level: "cheap", check: checkPiracy},
    {id: "espionage", rule: "19.2", tier: "A", level: "cheap", check: checkEspionage},
    {id: "patronage", rule: "22", tier: "A", level: "cheap", check: checkPatronage},
    {id: "pending", rule: "7", tier: "A", level: "cheap", check: checkPendingWindows},
    {id: "victory", rule: "25", tier: "A", level: "cheap", check: checkVictoryOutcome},
    // Board-wide derivations: six `vpBreakdown`s, fifteen force-pool counts or
    // four religion-area bucketing passes, so they run at phase boundaries and
    // on the full cadence instead of on every action.
    {id: "turn", rule: "7", tier: "A", level: "full", check: checkTurnStructure},
    // Rule audits whose representation is intentionally looser than the print.
    {id: "force", rule: "17.1", tier: "B", level: "full", check: checkForcePools},
    {id: "religion", rule: "18.1", tier: "B", level: "full", check: checkReligion},
];

export interface CheckOptions {
    /** Include B-tier rule audits (default true). */
    audit?: boolean;
    ctx?: Ctx;
    /** `cheap` skips the board-wide derivations; omit to run the whole catalogue. */
    level?: InvariantLevel;
}

/** Run the catalogue and return structured violations. */
export const checkRuleInvariants = (G: VQGame, options: CheckOptions = {}): InvariantViolation[] => {
    const violations: InvariantViolation[] = [];
    for (const invariant of INVARIANTS) {
        if (invariant.tier === "B" && options.audit === false) continue;
        if (options.level === "cheap" && invariant.level === "full") continue;
        for (const entry of invariant.check(G, options.ctx)) {
            const [id, rule, tier, detail] = entry.split("|");
            violations.push({id, rule, tier: tier as InvariantTier, detail});
        }
    }
    return violations;
};

/** Compact strings for the harness and reports. */
export const ruleInvariantProblems = (G: VQGame, options: CheckOptions = {}): string[] =>
    checkRuleInvariants(G, options).map((violation) =>
        `[rule ${violation.rule} ${violation.id}${violation.tier === "B" ? " audit" : ""}] ${violation.detail}`);

/** The power a pending window belongs to (re-exported for the harness). */
export const pendingPower = (G: VQGame): Power | undefined => pendingDecider(G);

/** Controller of a minor garrison decision, for readable reports. */
export const controllerLabel = (controller: Controller): string => String(controller);
