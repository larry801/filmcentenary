import {Power, VQGame} from "./constant/general";
import {cardById} from "./constant/cards";
import {samePlayer} from "./ownership";
import {allied, atWar, canDeclareWar, warCost} from "./util";

/**
 * UI-side legality for the three diplomatic state changes offered by the
 * Diplomacy panel.  The engine remains the authority; this helper exists so
 * the board can disable impossible buttons and explain why instead of
 * submitting a move that boardgame.io silently rejects.
 */
export type DiplomacyAction = "declareWar" | "makePeace" | "formAlliance";

export type DiplomacyBlock =
    | "samePower"
    | "alreadyAtWar"
    | "notAtWar"
    | "alreadyAllied"
    | "spainEnglandNeverPeace"
    | "spainEnglandAllianceCost"
    | "spainProtestantNeverAlliance"
    | "franceBothAlliances"
    | "catholicLeague"
    | "peaceThisPhase"
    | "cannotAfford";

export interface DiplomacyActionState {
    ok: boolean;
    reason?: DiplomacyBlock;
}

const OK: DiplomacyActionState = {ok: true};
const GIFT_OK: GiftState = {ok: true};
const blocked = (reason: DiplomacyBlock): DiplomacyActionState => ({ok: false, reason});

/** Rule 20.10: Spain may make no deals with France/the Protestant for a year. */
const leagueBlocksDeals = (G: VQGame, a: Power, b: Power): boolean =>
    G.catholicLeagueNoDealsUntil === G.year &&
    ((a === "spain" && (b === "france" || b === "protestant")) ||
        (b === "spain" && (a === "france" || a === "protestant")));

const isSpainEngland = (a: Power, b: Power): boolean =>
    (a === "spain" && b === "england") || (a === "england" && b === "spain");

const isSpainProtestant = (a: Power, b: Power): boolean =>
    (a === "spain" && b === "protestant") || (a === "protestant" && b === "spain");

/**
 * Mirrors `payWarCost`: Home cards and Mandatory Events cannot pay for a
 * declaration, but treasures may top the total up.
 */
export const canAffordWarCost = (G: VQGame, p: Power, cost: number): boolean => {
    const cards = G.powers[p].cards.reduce((total, id) => {
        const def = cardById(id);
        return def.kind === "home" || def.officialKind === "mandatory" ? total : total + def.cp;
    }, 0);
    const treasures = G.powers[p].treasures.reduce((total, value) => total + value, 0);
    return cards + treasures >= cost;
};

export const diplomacyActionState = (
    G: VQGame,
    p: Power,
    target: Power,
    action: DiplomacyAction,
): DiplomacyActionState => {
    if (p === target || samePlayer(G, p, target)) return blocked("samePower");

    if (action === "declareWar") {
        // Rule 9.2 only forbids Spain and the Protestant from allying; wars
        // between them are legal (the Catholic League starts one).
        if (atWar(G, p, target)) return blocked("alreadyAtWar");
        if (allied(G, p, target)) return blocked("alreadyAllied");
        if (G.peaceMadeThisPhase?.some(([x, y]) => (x === p && y === target) || (x === target && y === p))) {
            return blocked("peaceThisPhase");
        }
        if (!canDeclareWar(G, p, target)) return blocked("samePower");
        if (!canAffordWarCost(G, p, warCost(G, p, target))) return blocked("cannotAfford");
        return OK;
    }

    if (action === "makePeace") {
        if (!atWar(G, p, target)) return blocked("notAtWar");
        // Rule 9.5: England and Spain may never agree to peace.
        if (isSpainEngland(p, target)) return blocked("spainEnglandNeverPeace");
        if (leagueBlocksDeals(G, p, target)) return blocked("catholicLeague");
        return OK;
    }

    if (atWar(G, p, target)) return blocked("alreadyAtWar");
    if (allied(G, p, target)) return blocked("alreadyAllied");
    // Rule 9.2: Spain and the Protestant may never ally.
    if (isSpainProtestant(p, target)) return blocked("spainProtestantNeverAlliance");
    // Rule 9.2: Spain-England alliance is barred while their DOW cost is <= 3.
    if (isSpainEngland(p, target) && warCost(G, p, target) <= 3) return blocked("spainEnglandAllianceCost");
    // Rule 9.2: France may ally Spain or the Protestant, never both at once.
    if (p === "france") {
        if ((target === "spain" && G.powers.france.allies.includes("protestant")) ||
            (target === "protestant" && G.powers.france.allies.includes("spain"))) {
            return blocked("franceBothAlliances");
        }
    }
    if (leagueBlocksDeals(G, p, target)) return blocked("catholicLeague");
    return OK;
};

export const diplomacyBlockText = (
    reason: DiplomacyBlock,
    text: {
        samePower: string;
        alreadyAtWar: string;
        notAtWar: string;
        alreadyAllied: string;
        spainEnglandNeverPeace: string;
        spainEnglandAllianceCost: string;
        spainProtestantNeverAlliance: string;
        franceBothAlliances: string;
        catholicLeague: string;
        peaceThisPhase: string;
        cannotAfford: string;
    },
): string => text[reason];

/** Rule 9.1 gifts: at most 2 cards / 2 treasures / 4 mercenaries per target. */
export type GiftKind = "cards" | "treasures" | "mercenaries";

export type GiftBlock = "alreadyAtWar" | "limit" | "reciprocal" | "unavailable" | "ottomanMercs";

export interface GiftState {
    ok: boolean;
    reason?: GiftBlock;
}

const giftCount = (G: VQGame, from: Power, to: Power, kind: GiftKind): number =>
    G.diplomacyGifts?.[`${from}->${to}`]?.[kind] ?? 0;

const reciprocalGift = (G: VQGame, from: Power, to: Power, kind: GiftKind): boolean =>
    (G.diplomacyGifts?.[`${to}->${from}`]?.[kind] ?? 0) > 0;

export const giftState = (
    G: VQGame,
    p: Power,
    target: Power,
    kind: GiftKind,
    space?: string | null,
): GiftState => {
    if (atWar(G, p, target)) return {ok: false, reason: "alreadyAtWar"};
    const limit = kind === "mercenaries" ? 4 : 2;
    if (giftCount(G, p, target, kind) >= limit) return {ok: false, reason: "limit"};
    if (reciprocalGift(G, p, target, kind)) return {ok: false, reason: "reciprocal"};
    if (kind === "cards") {
        return G.powers[p].cards.some((id) => cardById(id).kind !== "home")
            ? GIFT_OK : {ok: false, reason: "unavailable"};
    }
    if (kind === "treasures") {
        return G.powers[p].treasures.length > 0 ? GIFT_OK : {ok: false, reason: "unavailable"};
    }
    // Rule 9.1: the Ottoman may not give mercenaries, and neither the Ottoman
    // nor the Holy Roman Empire may receive them.
    if (p === "ottoman") return {ok: false, reason: "ottomanMercs"};
    if (target === "ottoman" || target === "hre") return {ok: false, reason: "unavailable"};
    const fromTrack = p === "hre" && (G.mercenariesForHire ?? 0) > 0;
    const fromSpace = space !== undefined && space !== null && (G.spaces[space]?.land[p]?.merc ?? 0) > 0;
    return fromTrack || fromSpace ? GIFT_OK : {ok: false, reason: "unavailable"};
};
