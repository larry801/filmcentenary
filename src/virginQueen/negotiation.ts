import {Ctx} from "boardgame.io";
import {
    Power,
    POWERS,
    RoyalDef,
    VQGame,
    VQLocale,
    localizedName,
    spaceHomes,
} from "./constant/general";
import {cardById} from "./constant/cards";
import {LEADER_BY_ID} from "./constant/leaders";
import {SPACES, SPACE_BY_ID} from "./mapData";
import {royalAvailable} from "./scenario";
import {ownerOf, samePlayer} from "./ownership";
import {
    allied,
    atWar,
    capitalSpacesFor,
    catholicLeagueDealsBlocked,
    clearWar,
    die,
    displaceNonFriendlyUnits,
    landAdjacent,
    powerLabel,
    pushLog,
    seaPathBetweenPorts,
    warCost,
} from "./util";

export type NegotiationTermKind =
    | "peace"
    | "alliance"
    | "cards"
    | "treasures"
    | "mercenaries"
    | "yieldSpace"
    | "returnLeader"
    | "betrothal"
    | "navalLoan";

export type GiftKind = "cards" | "treasures" | "mercenaries";

export type NavalLoanShip = "galley" | "galleon" | "racebuilt";

/**
 * One structured clause of a negotiation.  Only clauses that change the
 * current game state are modelled here; promises about future turns are kept
 * in {@link NegotiationOffer.promises} and are never enforced.
 *
 * Every clause names the two powers it moves assets between.  `peace` and
 * `alliance` are symmetric and therefore carry no parties of their own.
 */
export type NegotiationTerm =
    | {kind: "peace"}
    | {kind: "alliance"}
    | {kind: GiftKind; from: Power; to: Power; count: number}
    | {kind: "yieldSpace"; from: Power; to: Power; space: string}
    | {kind: "returnLeader"; from: Power; to: Power; leaderId: string}
    | {kind: "betrothal"; male: string; female: string}
    | {
        kind: "navalLoan";
        from: Power;
        to: Power;
        fromPort: string;
        toPort: string;
        ship: NavalLoanShip;
        leader?: string;
    };

export interface NegotiationPromise {
    from: Power;
    text: string;
}

export interface NegotiationOffer {
    id: string;
    from: Power;
    to: Power;
    terms: NegotiationTerm[];
    promises: NegotiationPromise[];
    /** The counter offer this replaces, when the table has gone back and forth. */
    counterOf?: string;
    year: number;
    turn: number;
}

/** A concluded binding agreement; the binding clauses are public. */
export interface NegotiationRecord {
    id: string;
    /** Rule 9.1: the earlier power announces, the later power confirms. */
    proposer: Power;
    confirmer: Power;
    terms: NegotiationTerm[];
    promises: NegotiationPromise[];
    year: number;
    turn: number;
}

export interface NegotiationState {
    offer: NegotiationOffer | null;
    history: NegotiationRecord[];
    nextId: number;
}

export type NegotiationIssueCode =
    | "empty"
    | "samePower"
    | "noPlayer"
    | "duplicate"
    | "badCount"
    | "notParty"
    | "peaceUnavailable"
    | "catholicLeague"
    | "allianceUnavailable"
    | "allianceAtWar"
    | "allianceSpainProtestant"
    | "allianceSpainEnglandCost"
    | "allianceFranceBoth"
    | "giftLimit"
    | "giftReciprocal"
    | "giftAtWar"
    | "noCards"
    | "noTreasures"
    | "noMercenaries"
    | "mercGiveRestricted"
    | "mercReceiveRestricted"
    | "mercNoCapital"
    | "yieldUnavailable"
    | "leaderUnavailable"
    | "royalUnavailable"
    | "royalSameFamily"
    | "royalAtWar"
    | "royalCaptured"
    | "loanNoAlliance"
    | "loanReciprocal"
    | "loanNoPath"
    | "loanNoShip"
    | "promiseTooLong"
    | "tooManyPromises"
    | "executionFailed";

export interface NegotiationIssue {
    term?: number;
    code: NegotiationIssueCode;
    params?: Record<string, string | number>;
}

export interface NegotiationValidationOptions {
    /**
     * When the client only knows a redacted view, hand and treasure contents
     * are hidden.  The view carries counts so the builder can still make a
     * realistic offer; the server revalidates against the real state.
     */
    approxResources?: boolean;
    /** The client's own power; its hand is visible, so use the exact count. */
    viewer?: Power;
}

const TERM_LIMIT: Record<GiftKind, number> = {cards: 2, treasures: 2, mercenaries: 4};

export const negotiationState = (G: VQGame): NegotiationState => {
    if (G.negotiation === undefined) {
        G.negotiation = {offer: null, history: [], nextId: 1};
    }
    G.negotiation.history ??= [];
    G.negotiation.nextId ??= 1;
    if (G.negotiation.offer === undefined) G.negotiation.offer = null;
    return G.negotiation;
};

export const expireOpenOffer = (G: VQGame): void => {
    if (G.negotiation?.offer !== null && G.negotiation?.offer !== undefined) {
        G.negotiation.offer = null;
    }
};

/** Rule 9.1(d): an Independent home space adjacent or in the same sea zone. */
export const canYieldSpace = (G: VQGame, from: Power, to: Power, space: string): boolean => {
    const def = SPACE_BY_ID[space];
    const state = G.spaces[space];
    if (def === undefined || state === undefined || state.control !== from || from === to) return false;
    const homes = spaceHomes(def);
    const receiverHomes = SPACES.filter((candidate) => spaceHomes(candidate).includes(to)).map((candidate) => candidate.id);
    if (homes.includes(to)) return true;
    if (def.area === "france" &&
        ((from === "france" && to === "protestant") || (from === "protestant" && to === "france"))) {
        return true;
    }
    if (def.area === "netherlands" &&
        ((from === "spain" && to === "protestant") || (from === "protestant" && to === "spain"))) {
        return true;
    }
    return homes.includes("independent") &&
        (receiverHomes.some((id) => landAdjacent(id, space)) ||
            receiverHomes.some((id) => (SPACE_BY_ID[id]?.ports ?? []).some((zone) => (def.ports ?? []).includes(zone))));
};

const termParties = (term: NegotiationTerm): {from: Power; to: Power} | undefined =>
    term.kind === "peace" || term.kind === "alliance" || term.kind === "betrothal"
        ? undefined
        : {from: term.from, to: term.to};

const giftTerms = (terms: NegotiationTerm[], kind: GiftKind, from: Power, to: Power): number =>
    terms.reduce((sum, term) => term.kind === kind && term.from === from && term.to === to
        ? sum + term.count : sum, 0);

const hasTerm = (terms: NegotiationTerm[], kind: NegotiationTermKind): boolean =>
    terms.some((term) => term.kind === kind);

const royalById = (G: VQGame, id: string): RoyalDef | undefined =>
    G.royals.find((royal) => royal.id === id);

const handAvailable = (G: VQGame, power: Power, options: NegotiationValidationOptions): number => {
    const actual = G.powers[power].cards.filter((id) => cardById(id).kind !== "home").length;
    if (power === options.viewer || !options.approxResources || actual > 0) return actual;
    return G.handCounts?.[power] ?? 0;
};

const treasureAvailable = (G: VQGame, power: Power, options: NegotiationValidationOptions): number => {
    const actual = G.powers[power].treasures.length;
    if (power === options.viewer || !options.approxResources || actual > 0) return actual;
    return G.treasureCounts?.[power] ?? 0;
};

const mercenarySources = (G: VQGame, power: Power): {space: string; count: number}[] =>
    Object.keys(G.spaces)
        .sort()
        .map((space) => ({space, count: G.spaces[space].land[power]?.merc ?? 0}))
        .filter((entry) => entry.count > 0);

const mercenaryAvailable = (G: VQGame, power: Power): number =>
    mercenarySources(G, power).reduce((sum, entry) => sum + entry.count, 0) +
    (power === "hre" ? (G.mercenariesForHire ?? 0) : 0);

const eligibleCapital = (G: VQGame, power: Power): string | undefined =>
    capitalSpacesFor(G, power).find((id) => G.spaces[id]?.control === power && !G.spaces[id].unrest);

const religiouslyAvailable = (G: VQGame, royal: RoyalDef): boolean =>
    royalAvailable(royal) && (royal.turn ?? 1) <= G.year;

const betrothalIssue = (
    G: VQGame,
    male: RoyalDef | undefined,
    female: RoyalDef | undefined,
    from: Power,
    to: Power,
    peaceInDeal: boolean,
): NegotiationIssueCode | undefined => {
    if (male === undefined || female === undefined || male.gender !== "male" || female.gender !== "female" ||
        !religiouslyAvailable(G, male) || !religiouslyAvailable(G, female)) {
        return "royalUnavailable";
    }
    if (male.family !== undefined && female.family !== undefined && male.family === female.family) {
        return "royalSameFamily";
    }
    if (male.power === female.power) return "royalUnavailable";
    if (G.betrothals.some((entry) => entry.male === male.id || entry.female === female.id)) return "royalUnavailable";
    if ((male.power !== from || female.power !== to) && (male.power !== to || female.power !== from)) return "notParty";
    if (female.id === "maryScots" && G.espionage?.mary === "captured") return "royalCaptured";
    if (atWar(G, male.power, female.power) && !peaceInDeal) return "royalAtWar";
    return undefined;
};

/**
 * Pure legality check shared by the offer builder and the engine.  It does not
 * reserve resources: the rules let a power announce more agreements than can
 * all be confirmed, so the same clauses are checked again when the second
 * power confirms.
 */
export const validateNegotiation = (
    G: VQGame,
    from: Power,
    to: Power,
    terms: NegotiationTerm[],
    promises: NegotiationPromise[] = [],
    options: NegotiationValidationOptions = {},
): NegotiationIssue[] => {
    const issues: NegotiationIssue[] = [];
    if (from === to || samePlayer(G, from, to)) issues.push({code: "samePower"});
    if (ownerOf(G, from) === undefined || ownerOf(G, to) === undefined) issues.push({code: "noPlayer"});
    if (terms.length === 0) issues.push({code: "empty"});
    // Rule 20.10 bars every deal with France/the Protestant, not only an
    // alliance or a marriage.
    if (catholicLeagueDealsBlocked(G, from, to)) issues.push({code: "catholicLeague"});

    const peaceInDeal = hasTerm(terms, "peace");
    const allianceInDeal = hasTerm(terms, "alliance");
    const seen = new Set<string>();
    const knownKinds = new Set<NegotiationTermKind>([
        "peace", "alliance", "cards", "treasures", "mercenaries",
        "yieldSpace", "returnLeader", "betrothal", "navalLoan",
    ]);
    for (const [index, term] of terms.entries()) {
        if (!knownKinds.has(term.kind)) {
            issues.push({term: index, code: "empty"});
            continue;
        }
        const parties = termParties(term);
        if (parties !== undefined &&
            !((parties.from === from && parties.to === to) || (parties.from === to && parties.to === from))) {
            issues.push({term: index, code: "notParty"});
        }
        if ((term.kind === "cards" || term.kind === "treasures" || term.kind === "mercenaries") &&
            (!Number.isInteger(term.count) || term.count < 1 || term.count > TERM_LIMIT[term.kind])) {
            issues.push({term: index, code: "badCount", params: {limit: TERM_LIMIT[term.kind]}});
        }
        const key = term.kind === "betrothal"
            ? `betrothal:${term.male}:${term.female}`
            : term.kind === "yieldSpace"
                ? `yield:${term.space}`
                : term.kind === "returnLeader"
                    ? `return:${term.leaderId}`
                    : term.kind === "navalLoan"
                        ? `loan:${term.fromPort}:${term.toPort}:${term.ship}`
                        : `${term.kind}:${parties?.from ?? ""}:${parties?.to ?? ""}`;
        if (seen.has(key)) issues.push({term: index, code: "duplicate"});
        seen.add(key);
    }

    if (promises.length > 4) issues.push({code: "tooManyPromises"});
    for (const promise of promises) {
        if (promise.from !== from && promise.from !== to) issues.push({code: "notParty"});
        if (promise.text.trim().length === 0 || promise.text.length > 160) {
            issues.push({code: "promiseTooLong", params: {limit: 160}});
        }
    }

    if (peaceInDeal) {
        if (!atWar(G, from, to) || ((from === "england" && to === "spain") || (from === "spain" && to === "england"))) {
            issues.push({code: "peaceUnavailable"});
        }
    }

    if (allianceInDeal) {
        if (atWar(G, from, to) && !peaceInDeal) issues.push({code: "allianceAtWar"});
        if (allied(G, from, to)) issues.push({code: "allianceUnavailable"});
        if ((from === "spain" && to === "protestant") || (from === "protestant" && to === "spain")) {
            issues.push({code: "allianceSpainProtestant"});
        }
        if (((from === "spain" && to === "england") || (from === "england" && to === "spain")) &&
            warCost(G, from, to) <= 3) {
            issues.push({code: "allianceSpainEnglandCost"});
        }
        if (from === "france") {
            if ((to === "spain" && G.powers.france.allies.includes("protestant")) ||
                (to === "protestant" && G.powers.france.allies.includes("spain"))) {
                issues.push({code: "allianceFranceBoth"});
            }
        }
        if (to === "france") {
            if ((from === "spain" && G.powers.france.allies.includes("protestant")) ||
                (from === "protestant" && G.powers.france.allies.includes("spain"))) {
                issues.push({code: "allianceFranceBoth"});
            }
        }
    }

    for (const kind of ["cards", "treasures", "mercenaries"] as const) {
        const forward = giftTerms(terms, kind, from, to);
        const backward = giftTerms(terms, kind, to, from);
        const limit = TERM_LIMIT[kind];
        if (forward > 0 && backward > 0) issues.push({code: "giftReciprocal"});
        if (forward > limit || backward > limit) issues.push({code: "giftLimit", params: {limit}});
        // Rule 9.1: a kind may move in only one direction per turn.  The
        // reciprocal check therefore also consults gifts already executed.
        if (forward > 0 && (G.diplomacyGifts?.[`${to}->${from}`]?.[kind] ?? 0) > 0) {
            issues.push({code: "giftReciprocal"});
        }
        if (backward > 0 && (G.diplomacyGifts?.[`${from}->${to}`]?.[kind] ?? 0) > 0) {
            issues.push({code: "giftReciprocal"});
        }
        for (const [giver, taker, total] of [[from, to, forward], [to, from, backward]] as const) {
            if (total === 0) continue;
            const already = G.diplomacyGifts?.[`${giver}->${taker}`]?.[kind] ?? 0;
            if (already + total > limit) issues.push({code: "giftLimit", params: {limit}});
            if (atWar(G, giver, taker) && !peaceInDeal) issues.push({code: "giftAtWar"});
            // Compare the whole direction, not each clause: two clauses of 2
            // cards still need four cards in hand.
            if (kind === "cards" && handAvailable(G, giver, options) < total) issues.push({code: "noCards"});
            if (kind === "treasures" && treasureAvailable(G, giver, options) < total) issues.push({code: "noTreasures"});
            if (kind === "mercenaries") {
                if (giver === "ottoman") issues.push({code: "mercGiveRestricted"});
                if (taker === "ottoman" || taker === "hre") issues.push({code: "mercReceiveRestricted"});
                if (mercenaryAvailable(G, giver) < total) issues.push({code: "noMercenaries"});
                if (eligibleCapital(G, taker) === undefined) issues.push({code: "mercNoCapital"});
            }
        }
    }

    const loanDirections = new Set(terms.filter((term) => term.kind === "navalLoan")
        .map((term) => `${term.from}->${term.to}`));
    if (loanDirections.size > 1) issues.push({code: "loanReciprocal"});

    for (const [index, term] of terms.entries()) {
        if (term.kind === "yieldSpace" && !canYieldSpace(G, term.from, term.to, term.space)) {
            issues.push({term: index, code: "yieldUnavailable", params: {space: term.space}});
        }
        if (term.kind === "returnLeader") {
            const def = LEADER_BY_ID[term.leaderId];
            const state = G.leaders[term.leaderId];
            if (def === undefined || state === undefined || state.location !== "captured" ||
                def.kind !== "army" || def.power !== term.to ||
                (state.capturedBy !== undefined && state.capturedBy !== term.from)) {
                issues.push({term: index, code: "leaderUnavailable", params: {leader: term.leaderId}});
            } else {
                const hasCapital = capitalSpacesFor(G, def.power).some((id) => G.spaces[id]?.control === def.power);
                const hasHomeKey = SPACES.some((space) => space.kind === "key" && spaceHomes(space).includes(def.power) &&
                    G.spaces[space.id].control === def.power && !G.spaces[space.id].unrest);
                if (!hasCapital && !hasHomeKey) {
                    issues.push({term: index, code: "leaderUnavailable", params: {leader: term.leaderId}});
                }
            }
        }
        if (term.kind === "betrothal") {
            const issue = betrothalIssue(G, royalById(G, term.male), royalById(G, term.female), from, to, peaceInDeal);
            if (issue !== undefined) issues.push({term: index, code: issue});
        }
        if (term.kind === "navalLoan") {
            if (!allianceInDeal) issues.push({term: index, code: "loanNoAlliance"});
            if (G.loanedNaval?.some((loan) =>
                (loan.lender === term.from && loan.borrower === term.to) ||
                (loan.lender === term.to && loan.borrower === term.from))) {
                issues.push({term: index, code: "loanReciprocal"});
            }
            if (G.spaces[term.fromPort]?.control !== term.from || G.spaces[term.toPort]?.control !== term.to ||
                !seaPathBetweenPorts(term.fromPort, term.toPort)) {
                issues.push({term: index, code: "loanNoPath"});
            }
            if ((G.spaces[term.fromPort]?.naval[term.from]?.[term.ship] ?? 0) < 1) {
                issues.push({term: index, code: "loanNoShip"});
            }
            if (term.leader !== undefined) {
                const leader = G.leaders[term.leader];
                const def = LEADER_BY_ID[term.leader];
                if (leader === undefined || leader.location !== term.fromPort || def?.kind !== "naval" || def.power !== term.from) {
                    issues.push({term: index, code: "leaderUnavailable", params: {leader: term.leader}});
                }
            }
        }
    }

    return issues;
};

/** Earliest power in impulse order; this is the formal proposer (rule 9.1). */
export const formalProposer = (from: Power, to: Power): Power =>
    POWERS.indexOf(from) <= POWERS.indexOf(to) ? from : to;

export const formalConfirmer = (from: Power, to: Power): Power =>
    formalProposer(from, to) === from ? to : from;

const drawRandom = <T>(ctx: Ctx, values: T[]): T | undefined => {
    if (values.length === 0) return undefined;
    return values.splice(Math.min(values.length - 1, Math.max(0, die(ctx, values.length) - 1)), 1)[0];
};

const removeMercenaries = (G: VQGame, power: Power, count: number): void => {
    let remaining = count;
    if (power === "hre") {
        const fromTrack = Math.min(remaining, G.mercenariesForHire ?? 0);
        G.mercenariesForHire = (G.mercenariesForHire ?? 0) - fromTrack;
        remaining -= fromTrack;
    }
    for (const source of mercenarySources(G, power)) {
        if (remaining <= 0) break;
        const stack = G.spaces[source.space].land[power];
        if (stack === undefined) continue;
        const take = Math.min(remaining, stack.merc);
        stack.merc -= take;
        remaining -= take;
        if (stack.regular + stack.merc + stack.cav === 0) delete G.spaces[source.space].land[power];
    }
};

const returnLeader = (G: VQGame, leaderId: string): boolean => {
    const def = LEADER_BY_ID[leaderId];
    if (def === undefined) return false;
    const destination = capitalSpacesFor(G, def.power).find((id) => G.spaces[id]?.control === def.power) ??
        SPACES.find((space) => space.kind === "key" && spaceHomes(space).includes(def.power) &&
            G.spaces[space.id].control === def.power && !G.spaces[space.id].unrest)?.id;
    if (destination === undefined) return false;
    G.leaders[leaderId] = {id: leaderId, location: destination};
    if (!G.spaces[destination].leaders.includes(leaderId)) G.spaces[destination].leaders.push(leaderId);
    return true;
};

const applyTerm = (G: VQGame, ctx: Ctx, term: NegotiationTerm): void => {
    switch (term.kind) {
        case "peace":
        case "alliance":
            // Both are applied before the asset clauses so that a peace in the
            // same deal makes a marriage or alliance legal.
            return;
        case "cards": {
            for (let i = 0; i < term.count; i++) {
                const candidates = G.powers[term.from].cards.filter((id) => cardById(id).kind !== "home");
                const card = drawRandom(ctx, candidates);
                if (card === undefined) throw new Error("no card");
                G.powers[term.from].cards = G.powers[term.from].cards.filter((id) => id !== card);
                G.powers[term.to].cards.push(card);
            }
            const entry = (G.diplomacyGifts ??= {})[`${term.from}->${term.to}`] ??= {cards: 0, treasures: 0, mercenaries: 0};
            entry.cards += term.count;
            return;
        }
        case "treasures": {
            for (let i = 0; i < term.count; i++) {
                const value = drawRandom(ctx, G.powers[term.from].treasures);
                if (value === undefined) throw new Error("no treasure");
                G.powers[term.to].treasures.push(value);
            }
            const entry = (G.diplomacyGifts ??= {})[`${term.from}->${term.to}`] ??= {cards: 0, treasures: 0, mercenaries: 0};
            entry.treasures += term.count;
            return;
        }
        case "mercenaries": {
            removeMercenaries(G, term.from, term.count);
            const capital = eligibleCapital(G, term.to);
            if (capital === undefined) throw new Error("no capital");
            const stack = G.spaces[capital].land[term.to] ??= {regular: 0, merc: 0, cav: 0};
            stack.merc += term.count;
            const entry = (G.diplomacyGifts ??= {})[`${term.from}->${term.to}`] ??= {cards: 0, treasures: 0, mercenaries: 0};
            entry.mercenaries += term.count;
            return;
        }
        case "yieldSpace":
            G.spaces[term.space].control = term.to;
            displaceNonFriendlyUnits(G, term.to, [term.space]);
            return;
        case "returnLeader":
            if (!returnLeader(G, term.leaderId)) throw new Error("no leader destination");
            return;
        case "betrothal": {
            G.betrothals.push({male: term.male, female: term.female});
            return;
        }
        case "navalLoan": {
            const source = G.spaces[term.fromPort].naval[term.from];
            if (source === undefined || source[term.ship] < 1) throw new Error("no ship");
            source[term.ship] -= 1;
            if (source.galley + source.galleon + source.racebuilt + source.corsair === 0) {
                delete G.spaces[term.fromPort].naval[term.from];
            }
            const target = G.spaces[term.toPort].naval[term.to] ??= {galley: 0, galleon: 0, racebuilt: 0, corsair: 0};
            target[term.ship] += 1;
            if (term.leader !== undefined) {
                const leader = G.leaders[term.leader];
                if (leader === undefined) throw new Error("no loaned leader");
                G.spaces[term.fromPort].leaders = G.spaces[term.fromPort].leaders.filter((id) => id !== term.leader);
                G.spaces[term.toPort].leaders.push(term.leader);
                G.leaders[term.leader] = {id: term.leader, location: term.toPort, loanedTo: term.to};
            }
            G.loanedNaval = [...(G.loanedNaval ?? []), {lender: term.from, borrower: term.to, kind: term.ship,
                fromPort: term.fromPort, toPort: term.toPort, ...(term.leader !== undefined ? {leader: term.leader} : {})}];
            return;
        }
    }
};

/**
 * Execute every clause after one final legality check.  A failed check leaves
 * the game untouched, so a partially executed deal can never leak out of the
 * negotiation table.
 */
export const executeNegotiation = (
    G: VQGame,
    ctx: Ctx,
    from: Power,
    to: Power,
    terms: NegotiationTerm[],
    promises: NegotiationPromise[] = [],
): NegotiationIssue[] => {
    const issues = validateNegotiation(G, from, to, terms, promises);
    if (issues.length > 0) return issues;
    const snapshot = JSON.parse(JSON.stringify(G)) as VQGame;
    try {
        if (hasTerm(terms, "peace")) {
            clearWar(G, from, to);
            G.peaceMadeThisPhase = [...(G.peaceMadeThisPhase ?? []), [from, to]];
        }
        if (hasTerm(terms, "alliance")) {
            if (!G.powers[from].allies.includes(to)) G.powers[from].allies.push(to);
            if (!G.powers[to].allies.includes(from)) G.powers[to].allies.push(from);
        }
        // Apply clauses in an order that cannot invalidate an earlier one:
        // peace/alliance first, then marriages, assets, loans, and finally
        // control changes.  In particular, a mercenary gift is removed before
        // a yielded space can displace that stack, and a loan is announced
        // before its port changes hands.
        const order: NegotiationTermKind[] = [
            "betrothal", "cards", "treasures", "mercenaries", "navalLoan", "yieldSpace", "returnLeader",
        ];
        for (const kind of order) {
            for (const term of terms) {
                if (term.kind === kind) applyTerm(G, ctx, term);
            }
        }
        const proposer = formalProposer(from, to);
        const confirmer = formalConfirmer(from, to);
        pushLog(G, `${powerLabel(proposer)} and ${powerLabel(confirmer)} announce an agreement: ` +
            `${terms.map((term) => termText(term)).join("; ")}.`);
    } catch {
        for (const key of Object.keys(G)) {
            if (!(key in snapshot)) delete (G as unknown as Record<string, unknown>)[key];
        }
        Object.assign(G, snapshot);
        return [{code: "executionFailed"}];
    }
    return [];
};

export const negotiationTermText = (G: VQGame, term: NegotiationTerm, locale: VQLocale = "zh_CN"): string => {
    const name = (p: Power): string => powerLabel(p, locale);
    const place = (id: string): string => localizedName(SPACE_BY_ID[id] ?? {name: id}, locale);
    const leader = (id: string): string => {
        const def = LEADER_BY_ID[id];
        return def === undefined ? id : localizedName(def, locale);
    };
    const royal = (id: string): string => {
        const def = G.royals.find((candidate) => candidate.id === id);
        return def === undefined ? id : localizedName(def, locale);
    };
    switch (term.kind) {
        case "peace":
            return locale === "en" ? "peace" : "议和";
        case "alliance":
            return locale === "en" ? "a one-turn alliance" : "为期一回合的同盟";
        case "cards":
            return locale === "en"
                ? `${name(term.from)} gives ${term.count} random card(s) to ${name(term.to)}`
                : `${name(term.from)}向${name(term.to)}赠予 ${term.count} 张随机牌`;
        case "treasures":
            return locale === "en"
                ? `${name(term.from)} gives ${term.count} random treasure(s) to ${name(term.to)}`
                : `${name(term.from)}向${name(term.to)}赠予 ${term.count} 个随机宝藏`;
        case "mercenaries":
            return locale === "en"
                ? `${name(term.from)} gives ${term.count} mercenary/mercenaries to ${name(term.to)}`
                : `${name(term.from)}向${name(term.to)}赠予 ${term.count} 个雇佣兵`;
        case "yieldSpace":
            return locale === "en"
                ? `${name(term.from)} yields ${place(term.space)} to ${name(term.to)}`
                : `${name(term.from)}将${place(term.space)}的控制权让渡给${name(term.to)}`;
        case "returnLeader":
            return locale === "en"
                ? `${name(term.from)} returns ${leader(term.leaderId)} to ${name(term.to)}`
                : `${name(term.from)}将${leader(term.leaderId)}归还给${name(term.to)}`;
        case "betrothal":
            return locale === "en"
                ? `${royal(term.male)} and ${royal(term.female)} are betrothed`
                : `${royal(term.male)}与${royal(term.female)}订婚`;
        case "navalLoan":
            return locale === "en"
                ? `${name(term.from)} loans one ${term.ship} to ${name(term.to)} (${place(term.fromPort)} → ${place(term.toPort)})`
                : `${name(term.from)}向${name(term.to)}借出一艘${term.ship}（${place(term.fromPort)} → ${place(term.toPort)}）`;
    }
};

const termText = (term: NegotiationTerm): string => {
    // The public announcement uses English, matching the rest of the log.  A
    // compact form keeps the log readable without the game-state lookups that
    // `negotiationTermText` needs.
    const name = (p: Power): string => powerLabel(p, "en");
    switch (term.kind) {
        case "peace": return "peace";
        case "alliance": return "a one-turn alliance";
        case "cards": return `${name(term.from)} gives ${term.count} random card(s) to ${name(term.to)}`;
        case "treasures": return `${name(term.from)} gives ${term.count} random treasure(s) to ${name(term.to)}`;
        case "mercenaries": return `${name(term.from)} gives ${term.count} mercenary/mercenaries to ${name(term.to)}`;
        case "yieldSpace": return `${name(term.from)} yields ${term.space} to ${name(term.to)}`;
        case "returnLeader": return `${name(term.from)} returns ${term.leaderId} to ${name(term.to)}`;
        case "betrothal": return `${term.male} and ${term.female} are betrothed`;
        case "navalLoan": return `${name(term.from)} loans one ${term.ship} to ${name(term.to)}`;
        default: return "";
    }
};

/** Prompt-safe list of spaces either party may legally yield to the other. */
export const yieldableSpaces = (G: VQGame, from: Power, to: Power): string[] =>
    Object.keys(G.spaces).filter((space) => canYieldSpace(G, from, to, space)).sort();

/** Captured army leaders `from` may return to `to`. */
export const returnableLeaders = (G: VQGame, from: Power, to: Power): string[] =>
    Object.keys(G.leaders).filter((id) => {
        const def = LEADER_BY_ID[id];
        const state = G.leaders[id];
        return def?.kind === "army" && def.power === to && state.location === "captured" &&
            (state.capturedBy === undefined || state.capturedBy === from);
    }).sort();

/** Available male/female royal pairs between the two powers. */
export const royalPairs = (G: VQGame, a: Power, b: Power): {male: RoyalDef; female: RoyalDef}[] => {
    const available = G.royals.filter((royal) => religiouslyAvailable(G, royal));
    const pairs: {male: RoyalDef; female: RoyalDef}[] = [];
    for (const male of available.filter((royal) => royal.gender === "male" &&
        (royal.power === a || royal.power === b))) {
        for (const female of available.filter((royal) => royal.gender === "female" &&
            (royal.power === a || royal.power === b))) {
            if (male.power === female.power) continue;
            if (male.family !== undefined && female.family !== undefined && male.family === female.family) continue;
            if (G.betrothals.some((entry) => entry.male === male.id || entry.female === female.id)) continue;
            if ((male.power === a && female.power === b) || (male.power === b && female.power === a)) {
                pairs.push({male, female});
            }
        }
    }
    return pairs;
};

/** Ports and ships that can be loaned in a new alliance. */
export const loanOptions = (G: VQGame, from: Power, to: Power): {
    fromPort: string;
    toPort: string;
    ships: Record<NavalLoanShip, number>;
}[] => {
    if (G.loanedNaval?.some((loan) =>
        (loan.lender === from && loan.borrower === to) || (loan.lender === to && loan.borrower === from))) return [];
    const targets = SPACES.filter((space) => G.spaces[space.id]?.control === to && (space.ports?.length ?? 0) > 0);
    return SPACES.filter((space) => G.spaces[space.id]?.control === from && (space.ports?.length ?? 0) > 0)
        .map((space) => {
            const stack = G.spaces[space.id].naval[from];
            const toPort = targets.find((candidate) => seaPathBetweenPorts(space.id, candidate.id));
            if (stack === undefined || toPort === undefined) return undefined;
            return {
                fromPort: space.id,
                toPort: toPort.id,
                ships: {galley: stack.galley, galleon: stack.galleon, racebuilt: stack.racebuilt},
            };
        })
        .filter((entry): entry is {fromPort: string; toPort: string; ships: Record<NavalLoanShip, number>} =>
            entry !== undefined && (entry.ships.galley + entry.ships.galleon + entry.ships.racebuilt) > 0);
};
