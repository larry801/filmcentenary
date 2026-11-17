import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {isPower, Power, VQGame} from "./constant/general";
import {actingPower, ownerOf, samePlayer} from "./ownership";
import {moveError} from "./movePolicy";
import {
    executeNegotiation,
    formalConfirmer,
    formalProposer,
    negotiationState,
    NegotiationPromise,
    NegotiationTerm,
    validateNegotiation,
} from "./negotiation";

const currentPower = (G: VQGame, ctx: Ctx): Power => actingPower(G, ctx.currentPlayer);

/** Put both sides at the table; each may make exactly one move before control returns. */
const openTable = (G: VQGame, ctx: Ctx, proposer: Power, responder: Power): void => {
    const proposerOwner = ownerOf(G, proposer);
    const responderOwner = ownerOf(G, responder);
    if (proposerOwner === undefined || responderOwner === undefined) return;
    ctx.events?.setActivePlayers?.({
        value: {[proposerOwner]: "dealOffer", [responderOwner]: "dealResponse"},
        moveLimit: 1,
    });
};

const closeTable = (ctx: Ctx): void => {
    // An empty map clears both temporary stages, returning control to the
    // power whose Diplomacy turn opened the table.
    ctx.events?.setActivePlayers?.({value: {}});
};

const promisesOf = (value: NegotiationPromise[] | undefined): NegotiationPromise[] =>
    Array.isArray(value) ? value.slice(0, 4).map((promise) => ({
        from: promise.from,
        text: String(promise.text ?? "").slice(0, 160),
    })) : [];

/**
 * Rule 9.1 Negotiation Segment: open a private offer.  Only the binding
 * clauses travel in `terms`; `promises` are recorded with the offer but are
 * never enforced by the engine.
 */
export const proposeDeal = (
    G: VQGame,
    ctx: Ctx,
    args: {target: Power; terms: NegotiationTerm[]; promises?: NegotiationPromise[]},
): void | typeof INVALID_MOVE => {
    if (args === undefined || !Array.isArray(args.terms) || moveError(G, "proposeDeal", args)) return INVALID_MOVE;
    if (ctx.phase !== "diplomacy") return INVALID_MOVE;
    if (G.pendingBetrothal !== null) return INVALID_MOVE;
    if (G.negotiation?.offer !== null && G.negotiation?.offer !== undefined) return INVALID_MOVE;
    if (!isPower(args.target) || args.target === currentPower(G, ctx)) return INVALID_MOVE;
    const from = currentPower(G, ctx);
    if (samePlayer(G, from, args.target) || ownerOf(G, args.target) === undefined) return INVALID_MOVE;
    const terms = Array.isArray(args.terms) ? args.terms : [];
    const promises = promisesOf(args.promises);
    if (validateNegotiation(G, from, args.target, terms, promises).length > 0) return INVALID_MOVE;
    const state = negotiationState(G);
    state.offer = {
        id: `deal-${state.nextId++}`,
        from,
        to: args.target,
        terms,
        promises,
        year: G.year,
        turn: ctx.turn,
    };
    openTable(G, ctx, from, args.target);
};

/** The later power confirms the full deal, or declines it. */
export const respondDeal = (
    G: VQGame,
    ctx: Ctx,
    args: {offerId: string; action: "accept" | "reject"},
): void | typeof INVALID_MOVE => {
    if (args === undefined || (args.action !== "accept" && args.action !== "reject") ||
        moveError(G, "respondDeal", args)) return INVALID_MOVE;
    if (ctx.phase !== "diplomacy") return INVALID_MOVE;
    const offer = G.negotiation?.offer;
    if (offer === null || offer === undefined || offer.id !== args.offerId) return INVALID_MOVE;
    const responder = ctx.playerID ?? ctx.currentPlayer;
    if (ownerOf(G, offer.to) !== responder) return INVALID_MOVE;
    if (args.action === "reject") {
        G.negotiation!.offer = null;
        closeTable(ctx);
        return;
    }
    const issues = executeNegotiation(G, ctx, offer.from, offer.to, offer.terms, offer.promises);
    if (issues.length > 0) return INVALID_MOVE;
    G.negotiation!.history.push({
        id: offer.id,
        proposer: formalProposer(offer.from, offer.to),
        confirmer: formalConfirmer(offer.from, offer.to),
        terms: offer.terms,
        promises: offer.promises,
        year: offer.year,
        turn: offer.turn,
    });
    G.negotiation!.offer = null;
    closeTable(ctx);
};

/** Replace the open offer with a new one, reversing the direction of the table. */
export const counterDeal = (
    G: VQGame,
    ctx: Ctx,
    args: {offerId: string; terms: NegotiationTerm[]; promises?: NegotiationPromise[]},
): void | typeof INVALID_MOVE => {
    if (args === undefined || !Array.isArray(args.terms) || moveError(G, "counterDeal", args)) return INVALID_MOVE;
    if (ctx.phase !== "diplomacy") return INVALID_MOVE;
    const offer = G.negotiation?.offer;
    if (offer === null || offer === undefined || offer.id !== args.offerId) return INVALID_MOVE;
    const responder = ctx.playerID ?? ctx.currentPlayer;
    if (ownerOf(G, offer.to) !== responder) return INVALID_MOVE;
    const terms = Array.isArray(args.terms) ? args.terms : [];
    const promises = promisesOf(args.promises);
    if (validateNegotiation(G, offer.to, offer.from, terms, promises).length > 0) return INVALID_MOVE;
    const state = negotiationState(G);
    state.offer = {
        id: `deal-${state.nextId++}`,
        from: offer.to,
        to: offer.from,
        terms,
        promises,
        counterOf: offer.id,
        year: G.year,
        turn: ctx.turn,
    };
    openTable(G, ctx, offer.to, offer.from);
};

/** The proposer may take the offer off the table while the other side reads it. */
export const withdrawDeal = (
    G: VQGame,
    ctx: Ctx,
    args: {offerId: string},
): void | typeof INVALID_MOVE => {
    if (args === undefined || moveError(G, "withdrawDeal", args)) return INVALID_MOVE;
    if (ctx.phase !== "diplomacy") return INVALID_MOVE;
    const offer = G.negotiation?.offer;
    if (offer === null || offer === undefined || offer.id !== args.offerId) return INVALID_MOVE;
    const actor = ctx.playerID ?? ctx.currentPlayer;
    if (ownerOf(G, offer.from) !== actor) return INVALID_MOVE;
    G.negotiation!.offer = null;
    closeTable(ctx);
};
