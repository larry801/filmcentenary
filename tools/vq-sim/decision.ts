/**
 * Policy for the seeded Virgin Queen self-play harness.
 *
 * Decisions are driven by the same data the hotseat board uses:
 *
 *  * the stage boardgame.io put the seat in (`ctx.activePlayers`), which is
 *    exactly the set of buttons the pending panel renders, and
 *  * the phase panels (`CardDrawPanel`, `DiplomacyPanel`, `SpringPanel`,
 *    `ActionPhasePanel`) for national turns.
 *
 * The board never offers a move that is illegal in the current stage, so an
 * engine refusal here is a genuine board bug rather than a policy mistake.
 */
import {Ctx} from "boardgame.io";
import {
    Controller, LandStack, Power, POWERS, ReligionArea, VQGame, isPower, landCount, navalCount,
} from "../../src/virginQueen/constant/general";
import {cardById} from "../../src/virginQueen/constant/cards";
import {SEA_ZONE_BY_ID, SPACE_BY_ID, SPACES} from "../../src/virginQueen/mapData";
import * as M from "../../src/virginQueen/moves";
import {battleOptions} from "../../src/virginQueen/combat";
import {espionageOptions} from "../../src/virginQueen/espionage";
import {piracyOptions} from "../../src/virginQueen/piracy";
import {interceptionOptions} from "../../src/virginQueen/interception";
import {interceptionOrderOptions} from "../../src/virginQueen/navalCombat";
import {cardEventOptions} from "../../src/virginQueen/cardEvents";
import {tutorialEventOptions} from "../../src/virginQueen/tutorialEvents";
import {polishElectionBidOptions} from "../../src/virginQueen/polishElection";
import {eventBranchChoice, eventBranchTarget, effectiveBranchIds, branchParamValues} from "../../src/virginQueen/eventBranches";
import {eventTargetOptions} from "../../src/virginQueen/eventTargets";
import {abjurationOffers} from "../../src/virginQueen/abjuration";
import {
    catholicLeagueSpaceOptions, eligibleScienceBonuses, homeCardChoiceRequired, hreReligiousPreferenceRequired, landNeighbors, legalTargets,
    legalWinterLandReturnOptions, legalWinterLandReturnUnits, rebellionTargets,
} from "../../src/virginQueen/util";
import {passBlockReasons} from "../../src/virginQueen/moves";
import {defaultFormation, landMoveIssue, springMoveIssue, transportMoveIssue} from "../../src/virginQueen/movement";
import {isActivatedMajor, ownerOf} from "../../src/virginQueen/ownership";
import {MINOR_DIPLOMACY} from "../../src/virginQueen/data/minorDiplomacy";
import {MINOR_POWERS} from "../../src/virginQueen/constant/general";
import {WORLD_SETTLEMENTS} from "../../src/virginQueen/data/world";
import {assassinationTargets, doubleAgentTargets} from "../../src/virginQueen/espionage";
import {untimelyDeathTargets} from "../../src/virginQueen/cardEvents";
import {canPlayHolyLeague} from "../../src/virginQueen/holyLeague";

export interface Decision {
    move: string;
    args: unknown[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Probe a move on a clone, so the policy only ever names a legal argument.
 * Stage-restricted moves are probed with the stage they were called from.
 */
export const accepts = (G: VQGame, ctx: Ctx, seat: string, power: Power, move: string, args: unknown): boolean => {
    const fn = (M as unknown as Record<string, (G: VQGame, ctx: Ctx, args: unknown) => unknown>)[move];
    if (typeof fn !== "function") return false;
    const probeCtx = {...ctx, playerID: seat, activePlayers: null} as Ctx;
    try {
        return fn(clone(G), probeCtx, args) !== "INVALID_MOVE";
    } catch {
        return false;
    }
};

const pick = <T>(values: T[], chaos: number, rng: () => number): T | undefined => {
    if (values.length === 0) return undefined;
    if (chaos > 0 && rng() < chaos) return values[Math.floor(rng() * values.length)];
    return values[0];
};

/**
 * Pick one of the enumerated candidates and probe only that one.
 *
 * `accepts` copies the whole board before it tries a move, and `boardAction`
 * enumerates every recruit/build/move/influence/piracy target the board offers,
 * so probing each candidate up front cost hundreds of 40 KB JSON copies per
 * action — by far the largest part of a simulated match.  Here the candidates
 * are drawn first and only the drawn one is probed: with `chaos: 0` that is the
 * first candidate the engine accepts, exactly as before (a refused one is
 * dropped and the next in order tried) and no RNG is consumed.
 *
 * With chaos the draw now covers the whole enumeration instead of the
 * pre-filtered list, so a seed explores a slightly different action order —
 * a refused draw costs one probe and is dropped, which is also how the sweep
 * notices an enumerator offering something the engine rejects.
 */
const pickAccepted = (
    G: VQGame, ctx: Ctx, seat: string, power: Power, candidates: Decision[], chaos: number, rng: () => number,
): Decision | undefined => {
    let pool = candidates;
    while (pool.length > 0) {
        const chosen = pick(pool, chaos, rng);
        if (chosen === undefined) return undefined;
        if (accepts(G, ctx, seat, power, chosen.move, chosen.args[0])) return chosen;
        pool = pool.filter((candidate) => candidate !== chosen);
    }
    return undefined;
};

/** One decision for the seat; `power` is the power the engine is waiting on. */
export const decide = (
    G: VQGame, ctx: Ctx, seat: string, power: Power | undefined, chaos: number, rng: () => number,
): Decision => {
    if (power === undefined) return {move: "endPhaseTurn", args: []};
    const stage = (ctx.activePlayers as Record<string, string> | undefined)?.[seat];
    if (stage !== undefined) {
        const staged = stageDecision(G, ctx, seat, power, stage, chaos, rng);
        if (staged !== undefined) return staged;
    }
    switch (ctx.phase) {
        case "cardDraw": return cardDrawDecision(G, ctx, power, chaos, rng);
        case "diplomacy": return diplomacyDecision(G, ctx, power, chaos, rng);
        case "spring": return springDecision(G, ctx, power, chaos, rng);
        case "action": return actionDecision(G, ctx, seat, power, chaos, rng);
        default: return {move: "endPhaseTurn", args: []};
    }
};

// ---------------------------------------------------------------------------
// Stages declared in game.ts#choiceStages
// ---------------------------------------------------------------------------

const stageDecision = (
    G: VQGame, ctx: Ctx, seat: string, power: Power, stage: string, chaos: number, rng: () => number,
): Decision | undefined => {
    switch (stage) {
        case "espionageChoice": {
            const options = espionageOptions(G);
            return choose("chooseEspionage", "choice", options.map((option) => option.id), chaos, rng, "continue");
        }
        case "cardEvent": {
            const options = cardEventOptions(G, ctx.numPlayers ?? 6);
            return choose("chooseCardEvent", "choice", options.map((option) => option.id), chaos, rng, "continue");
        }
        case "activateMajor": return {move: "chooseMajorActivation", args: [{}]};
        case "abjurationChoice": {
            const offers = abjurationOffers(G);
            const offer = pick(offers, chaos, rng) ?? offers[0];
            return offer === undefined ? undefined : {move: "chooseAbjuration", args: [{power: offer.power}]};
        }
        case "tributeChoice": {
            const options = M.tributeOptions(G);
            return choose("chooseTribute", "choice", options.map((option) => option.id), chaos, rng);
        }
        case "rebelMoveChoice": {
            const pending = G.pendingRebelMove;
            if (pending === undefined) return undefined;
            // The engine only accepts an adjacent space (or "decline").
            const neighbors = landNeighbors(pending.space).map((neighbor) => neighbor.id);
            const to = pick(["decline", ...neighbors], chaos, rng) ?? "decline";
            return {move: "chooseRebelMove", args: [{to}]};
        }
        case "mutinyChoice": {
            const options = M.mutinyDiscardOptions(G);
            return choose("chooseMutinyDiscard", "card", options.map((option) => option.card), chaos, rng);
        }
        case "polishElectionBid": {
            const bidder = G.pendingPolishElection?.remaining[0];
            if (bidder === undefined) return undefined;
            const options = polishElectionBidOptions(G, bidder as never);
            const bid = pick(options.map((option) => option.value), chaos, rng);
            return {move: "choosePolishBid", args: [{bid: bid === "" || bid === undefined ? "pass" : bid}]};
        }
        case "cityRebelsLossChoice": {
            const options = M.cityRebelsLossOptions(G);
            const kinds = options.map((option) => option.kind);
            const kind = pick([...kinds, "auto" as const], chaos, rng) ?? "auto";
            return {move: "chooseCityRebelsLoss", args: [{kind}]};
        }
        case "battleChoice": {
            const options = battleOptions(G);
            return choose("chooseBattle", "choice", options.map((option) => option.id), chaos, rng, "fight");
        }
        case "tutorialEvent": {
            const options = tutorialEventOptions(G);
            return choose("chooseTutorialEvent", "choice", options.map((option) => option.id), chaos, rng);
        }
        case "piracyChoice": {
            const options = piracyOptions(G);
            return choose("choosePiracy", "choice", options.map((option) => option.id), chaos, rng);
        }
        case "actionResponse": {
            const pending = G.pendingAction;
            if (pending === undefined) return undefined;
            const responders = pending.responders ?? [pending.responder ?? pending.power];
            const responder = responders.find((candidate) => ownerOf(G, candidate) === seat) ?? responders[0];
            const options = M.actionResponseOptions(G, responder);
            return choose("respondAction", "choice", options.map((option) => option.id), chaos, rng, "continue", {responder});
        }
        case "foreignWarSetup": {
            const beneficiary = G.pendingForeignWar?.power;
            if (beneficiary === undefined) return undefined;
            const units = foreignWarUnits(G, beneficiary);
            if (units.length < 3) return {move: "endImpulse", args: []};
            return {move: "commitForeignWarForce", args: [{units: units.slice(0, 3)}]};
        }
        case "beaconResponse": {
            const defender = G.pendingBeacon?.defender;
            if (defender === undefined) return undefined;
            const canPlay = G.powers[defender].cards.includes("vq-014");
            return {move: "respondBeaconFires", args: [{choice: canPlay && chaos > 0 && rng() < chaos ? "play" : "decline"}]};
        }
        case "interceptionOrder": {
            const options = interceptionOrderOptions(G);
            const entry = pick(options, chaos, rng) ?? options[0];
            return entry === undefined ? {move: "autoInterceptionOrder", args: []} : {move: "chooseInterceptionOrder", args: [{from: entry.id}]};
        }
        case "gregorianResponse": {
            const responder = G.gregorianResponse?.responder;
            if (responder !== undefined && G.powers[responder].cards.includes("vq-101") && chaos > 0 && rng() < chaos) {
                const target = POWERS.find((candidate) => ownerOf(G, candidate) !== undefined && candidate !== responder);
                if (target !== undefined) {
                    return {move: "playCard", args: [{cardId: "vq-101", asEvent: true, target}]};
                }
            }
            return {move: "declineGregorianCalendar", args: []};
        }
        case "interceptChoice": {
            const options = interceptionOptions(G);
            return choose("chooseInterception", "choice", options.map((option) => option.id), chaos, rng, "done");
        }
        case "withdrawChoice": {
            return {move: "chooseWithdraw", args: [{withdraw: chaos <= 0 || rng() < chaos}]};
        }
        case "respondBetroth": {
            return chaos > 0 && rng() < chaos ? {move: "rejectBetroth", args: []} : {move: "acceptBetroth", args: []};
        }
        case "navalPortChoice": return navalPortDecision(G, power, chaos, rng) ?? {move: "endPhaseTurn", args: []};
        case "orangeArrivalChoice": return {move: "chooseOrangePlacement", args: [{place: chaos <= 0 || rng() < chaos}]};
        case "winterLossChoice": return winterLossDecision(G, power, chaos, rng) ?? {move: "endPhaseTurn", args: []};
        default: return undefined;
    }
};

/** `{move: <name>, args: [{<key>: value}]}` for a one-field choice list. */
const choose = (
    move: string, key: string, values: string[], chaos: number, rng: () => number, fallback?: string,
    extra: Record<string, unknown> = {},
): Decision | undefined => {
    const value = pick(values, chaos, rng) ?? fallback;
    if (value === undefined) return undefined;
    return {move, args: [{[key]: value, ...extra}]};
};

/** 3–8 land units for a foreign-war commitment, from unbesieged stacks. */
const foreignWarUnits = (G: VQGame, power: Power): {space: string; kind: keyof LandStack}[] => {
    const units: {space: string; kind: keyof LandStack}[] = [];
    for (const [spaceId, space] of Object.entries(G.spaces)) {
        if (space.siege !== undefined) continue;
        for (const kind of ["regular", "merc", "cav"] as const) {
            for (let index = 0; index < (space.land[power]?.[kind] ?? 0) && units.length < 8; index += 1) {
                units.push({space: spaceId, kind});
            }
            if (units.length >= 8) break;
        }
        if (units.length >= 8) break;
    }
    return units;
};

// ---------------------------------------------------------------------------
// Card Draw
// ---------------------------------------------------------------------------

const winterLossDecision = (G: VQGame, power: Power, chaos: number, rng: () => number): Decision | undefined => {
    const land = (G.winterLossChoices ?? []).find((entry) => entry.power === power);
    if (land !== undefined) {
        const stack = G.spaces[land.space]?.land[power];
        const kinds = land.confirmOnly ? ["auto"]
            : (["regular", "merc", "cav"] as const).filter((kind) => (stack?.[kind] ?? 0) >= land.amount);
        const kind = pick([...kinds], chaos, rng) ?? "auto";
        return {move: "chooseWinterLoss", args: [{space: land.space, kind}]};
    }
    const naval = (G.winterNavalLossChoices ?? []).find((entry) => entry.power === power);
    if (naval !== undefined) {
        const kinds = (Object.keys(naval.removed) as (keyof typeof naval.removed)[]).filter((kind) => naval.removed[kind] > 0);
        const kind = pick([...kinds, "auto" as const], chaos, rng) ?? "auto";
        return {move: "chooseWinterNavalLoss", args: [{zone: naval.zone, kind}]};
    }
    // Return revisions are optional.  Only explore them with some chaos so the
    // default sweep still exercises the automatic placement most of the time.
    const landReturn = (G.winterReturnChoices ?? []).find((entry) => entry.power === power);
    if (landReturn !== undefined && chaos > 0 && rng() < chaos / 2) {
        // Winter records can go stale as other stacks return to the same
        // fortress, so only offer destinations that still have room; with none
        // left the automatic placement is the only legal result.
        const options = legalWinterLandReturnOptions(G, power, landReturn);
        const to = pick(options, chaos, rng);
        if (to !== undefined) {
            const units = pick(legalWinterLandReturnUnits(G, power, landReturn, to), chaos, rng);
            return {move: "chooseWinterReturn", args: [{id: landReturn.id, to, ...(units === undefined ? {} : {units})}]};
        }
    }
    const navalReturn = (G.winterNavalReturnChoices ?? []).find((entry) => entry.power === power);
    if (navalReturn !== undefined && chaos > 0 && rng() < chaos / 2) {
        const port = pick(navalReturn.options, chaos, rng) ?? navalReturn.auto;
        return {move: "chooseWinterNavalReturn", args: [{id: navalReturn.id, port}]};
    }
    return undefined;
};

const cardDrawDecision = (G: VQGame, ctx: Ctx, power: Power, chaos: number, rng: () => number): Decision => {
    const winter = winterLossDecision(G, power, chaos, rng);
    if (winter !== undefined) return winter;
    return {move: "endPhaseTurn", args: []};
};

// ---------------------------------------------------------------------------
// Diplomacy (the DiplomacyPanel also renders the Catholic League and the HRE
// replacement, both of which are resolved from this phase only)
// ---------------------------------------------------------------------------

const diplomacyDecision = (G: VQGame, ctx: Ctx, power: Power, chaos: number, rng: () => number): Decision => {
    // Both pending choices belong to a specific power: Spain fills the Catholic
    // League, the HRE takes its winter replacement.  The panel renders only on
    // that seat, and the engine only accepts the move from it.
    if (G.pendingCatholicLeague !== undefined && power === "spain") {
        const options = catholicLeagueSpaceOptions(G);
        const space = pick(options, chaos, rng) ?? options[0];
        if (space !== undefined) return {move: "chooseCatholicLeagueSpace", args: [{space}]};
    }
    if (G.pendingHreReplacement !== undefined && power === "hre") {
        const pending = G.pendingHreReplacement;
        const choice = pending.canRegular ? "regular" : pending.canMercs ? "mercs" : "marker";
        return {move: "chooseHreReplacement", args: [{choice}]};
    }
    if (chaos > 0 && rng() < chaos) {
        const diplomatic = diplomacyMoves(G, ctx, power);
        const move = pick(diplomatic, chaos, rng);
        if (move !== undefined) return move;
    }
    return {move: "endPhaseTurn", args: []};
};

/** Diplomacy actions the panel offers, each probed on a clone. */
const diplomacyMoves = (G: VQGame, ctx: Ctx, power: Power): Decision[] => {
    const moves: Decision[] = [];
    const playerPowers = POWERS.filter((candidate) => candidate !== power && ownerOf(G, candidate) !== undefined);
    const target = playerPowers[0];
    if (target !== undefined) {
        for (const move of ["makePeace", "formAlliance", "giveRandomCard", "giveTreasure"]) {
            if (accepts(G, ctx, ownerOf(G, power)!, power, move, {target})) moves.push({move, args: [{target}]});
        }
        if (accepts(G, ctx, ownerOf(G, power)!, power, "declareWar", {target})) moves.push({move: "declareWar", args: [{target}]});
    }
    for (const [id, leader] of Object.entries(G.leaders)) {
        if (leader.location === "captured" &&
            accepts(G, ctx, ownerOf(G, power)!, power, "returnCapturedLeader", {leaderId: id})) {
            moves.push({move: "returnCapturedLeader", args: [{leaderId: id}]});
        }
    }
    return moves;
};

// ---------------------------------------------------------------------------
// Spring Deployment
// ---------------------------------------------------------------------------

const navalPortDecision = (G: VQGame, power: Power, chaos: number, rng: () => number): Decision | undefined => {
    const entry = (G.navalLeaderArrivals ?? []).find((candidate) => candidate.power === power);
    if (entry === undefined) return undefined;
    const port = pick(entry.ports, chaos, rng) ?? entry.ports[0];
    return {move: "chooseNavalLeaderPort", args: [{leader: entry.leader, port}]};
};

const springDecision = (G: VQGame, ctx: Ctx, power: Power, chaos: number, rng: () => number): Decision => {
    if (homeCardChoiceRequired(G, power)) {
        const homes = G.powers[power].cards.filter((id) => cardById(id).kind === "home");
        const choice = pick(homes, chaos, rng) ?? homes[0];
        if (choice !== undefined) return {move: "chooseHomeCard", args: [{cardId: choice}]};
    }
    if (hreReligiousPreferenceRequired(G, power)) {
        const preferences = ["catholic", "protestant", "balanced"] as const;
        return {move: "chooseHreReligiousPreference", args: [{preference: pick([...preferences], chaos, rng)}]};
    }
    const naval = navalPortDecision(G, power, chaos, rng);
    if (naval !== undefined) return naval;
    // Rule 10.4/Scenario: Orange's arrival is decided by the Protestant *turn*.
    // A reduced-player seat may own the Protestant while a different power is
    // active, and `chooseOrangePlacement` refuses then, so gate on the active
    // power for the same test `moveError` uses.
    if (G.orangeArrivalPending === true && power === "protestant" && G.activePower === "protestant") {
        return {move: "chooseOrangePlacement", args: [{place: chaos <= 0 || rng() < chaos}]};
    }
    if (!G.springDone.includes(power)) {
        const deployment = springMove(G, power, chaos, rng);
        if (deployment !== undefined) return deployment;
    }
    return {move: "endPhaseTurn", args: []};
};

/** One legal Spring Deployment, staged the way the board stages it. */
const springMove = (G: VQGame, power: Power, chaos: number, rng: () => number): Decision | undefined => {
    const origins = [...legalTargets(G, power, "spring")];
    const origin = pick(origins, chaos, rng);
    if (origin === undefined) return undefined;
    const formation = defaultFormation(G, origin, power);
    const destinations = [...legalTargets(G, power, "spring", origin)]
        .filter((to) => springMoveIssue(G, power, {from: origin, to, units: formation.units, leaders: formation.leaders}) === undefined);
    const to = pick(destinations, chaos, rng);
    if (to === undefined) return undefined;
    return {move: "springDeploy", args: [{from: origin, to, units: formation.units, leaders: formation.leaders}]};
};

// ---------------------------------------------------------------------------
// Action Phase
// ---------------------------------------------------------------------------

const actionDecision = (G: VQGame, ctx: Ctx, seat: string, power: Power, chaos: number, rng: () => number): Decision => {
    // Rule 18.5 step 4: after the conversion dice are rolled the power may
    // trade one "6" for a "5" to cancel an Unrest marker.  The panel renders
    // during the Action Phase and `moveError` refuses every other move while it
    // is open, so the policy has to answer it before it can end the impulse.
    // An event (Papal Bull, Calvinist Zeal, ...) can open the choice for a
    // power other than the active one; the board lets the active seat resolve
    // it on that power's behalf, which is what keeps the table moving.
    if (G.pendingConversion !== undefined) {
        const sixes = G.pendingConversion.dice
            .map((die, index) => ({die, index}))
            .filter((entry) => entry.die === 6);
        const downgrade = chaos > 0 && rng() < chaos && sixes.length > 0
            ? sixes[Math.floor(rng() * sixes.length)].index
            : "none";
        return {move: "chooseConversionNullify", args: [{downgrade}]};
    }
    // Rule 11: a Science Bonus treasure immediately claims an unclaimed bonus;
    // until it is claimed `moveError` blocks pass, endImpulse and everything else.
    if (G.pendingScienceTreasure?.power === power) {
        const bonuses = eligibleScienceBonuses(G, power);
        const bonus = (pick(bonuses, chaos, rng) ?? bonuses[0])?.id;
        if (bonus !== undefined) return {move: "chooseScienceTreasureBonus", args: [{bonus}]};
    }
    // Movement pendings have no stage; the action panel renders them inline.
    if (G.pendingReliefSplit?.power === power) {
        return {move: "chooseReliefSplit", args: [{keep: G.pendingReliefSplit.keepLimit}]};
    }
    if (G.pendingContinue?.power === power) {
        const origin = G.pendingContinue.origin;
        const destinations = [...legalTargets(G, power, "moveLand", G.pendingContinue.space)]
            .filter((to) => to !== origin);
        const to = pick(destinations, chaos, rng);
        if (to !== undefined) return {move: "continueMove", args: [{to}]};
        return {move: "stopContinue", args: []};
    }
    if (G.pendingNavalOrder?.attacker === power) {
        const enemy = pick(G.pendingNavalOrder.enemies, chaos, rng) ?? G.pendingNavalOrder.enemies[0];
        return {move: "chooseNavalOrder", args: [{enemy}]};
    }

    const ps = G.powers[power];
    const hand = ps.cards;
    const mandatory = hand.find((id) => cardById(id).officialKind === "mandatory");
    // Rule 11: a Mandatory Event must be played this turn.
    if (!ps.cardPlayed && mandatory !== undefined) {
        const target = eventTargets(G, power, mandatory, ctx.numPlayers ?? 6);
        const args = {cardId: mandatory, asEvent: true, ...(target?.target !== undefined ? {target: target.target} : {})};
        if (accepts(G, ctx, seat, power, "playCard", args)) return {move: "playCard", args: [args]};
        // Refused: playing it is impossible but the pass is blocked too.  Keep
        // asking for the card so the harness reports the deadlock instead of
        // hiding it behind a different move.
        return {move: "playCard", args: [args]};
    }
    // Rule 11: a Home card blocks passing, so use its ability.
    const home = hand.find((id) => cardById(id).kind === "home");
    if (!ps.cardPlayed && home !== undefined) {
        const target = eventTargets(G, power, home, ctx.numPlayers ?? 6);
        const args = {cardId: home, asEvent: true, ...(target?.target !== undefined ? {target: target.target} : {})};
        if (accepts(G, ctx, seat, power, "playCard", args)) return {move: "playCard", args: [args]};
    }
    // Rule 11: a hand above the ruler's Administrative Rating blocks passing.
    if (!ps.cardPlayed && hand.length > 0 && passBlockReasons(G, power).includes("admin")) {
        const card = hand.find((id) => cardById(id).kind !== "home" && cardById(id).officialKind !== "mandatory") ?? hand[0];
        return {move: "playCard", args: [{cardId: card}]};
    }
    // Play an Event card for its effect, so the event handlers are covered.
    // The card drawer only offers "As event" for non-Command cards, Mandatory
    // Events and the tutorial; a printed Combat/Response card is played from
    // its own timing window instead.
    if (!ps.cardPlayed && chaos > 0 && rng() < chaos) {
        const events = hand.filter((id) => {
            const def = cardById(id);
            const canPlayAsEvent = def.kind !== "command" || def.officialKind === "mandatory" || G.scenario === "tutorial";
            return canPlayAsEvent && def.kind !== "home" && def.officialKind !== "mandatory";
        });
        const card = pick(events, chaos, rng);
        if (card !== undefined) {
            const target = eventTargets(G, power, card, ctx.numPlayers ?? 6);
            if (target !== undefined && accepts(G, ctx, seat, power, "playCard",
                {cardId: card, asEvent: true, ...(target.target !== undefined ? {target: target.target} : {})})) {
                return {move: "playCard", args: [{cardId: card, asEvent: true, ...(target.target !== undefined ? {target: target.target} : {})}]};
            }
        }
    }
    // Bank CP from a card so the impulse can act.
    if (!ps.cardPlayed && ps.cp < 1) {
        const card = hand.find((id) => cardById(id).officialKind !== "mandatory" && cardById(id).cp > 0);
        if (card !== undefined) return {move: "playCard", args: [{cardId: card}]};
    }
    if (ps.cp > 0) {
        const action = boardAction(G, ctx, seat, power, chaos, rng);
        if (action !== undefined) return action;
    }
    if (ps.cardPlayed) return {move: "endImpulse", args: []};
    return {move: "pass", args: []};
};

/** Target grammar for playing `cardId` as an event, mirroring the card drawer. */
const eventTargets = (G: VQGame, power: Power, cardId: string, numPlayers: number): {target?: string} | undefined => {
    const def = cardById(cardId);
    const handler = def.officialEffect?.kind === "manual" ? def.officialEffect.handler : "";
    const branch = eventBranchChoice(G, cardId, power, numPlayers);
    if (branch !== undefined) {
        const ids = effectiveBranchIds(branch, []);
        const branches = branch.branches.filter((candidate) => ids.includes(candidate.id));
        const values: Record<string, Record<string, string>> = {};
        for (const entry of branches) values[entry.id] = branchParamValues(entry);
        return {target: eventBranchTarget(branches, values)};
    }
    if (handler === "walsingham") return {target: "defensive"};
    if (handler === "cipherKey") return {target: "remove"};
    if (handler === "doubleAgent") return {target: doubleAgentTargets(G, power)[0]};
    if (handler === "untimelyDeath") return {target: untimelyDeathTargets(G)[0] ?? "none"};
    if (handler === "warInPersia" || handler === "warWithPoland") return {target: "3"};
    if (handler === "holyLeague") return canPlayHolyLeague(G, power) ? {target: "papacy"} : undefined;
    if (["menendez", "polishElection", "armyMutiny", "sirEdwardStafford", "germanRecruitment", "irishRebellion",
        "scottishLordsRebel", "sultanaSafiye", "donAntonioOfPortugal"].includes(handler)) return {target: undefined};
    const options = eventTargetOptions(G, cardId, power);
    const first = options.find((option) => option.value !== "");
    return {target: first?.value};
};

/** Every board action the map or the action panel offers right now. */
const boardAction = (G: VQGame, ctx: Ctx, seat: string, power: Power, chaos: number, rng: () => number): Decision | undefined => {
    const candidates: Decision[] = [];
    const add = (move: string, args: unknown): void => {
        candidates.push({move, args: [args]});
    };

    for (const id of legalTargets(G, power, "recruitRegular")) add("recruit", {space: id, kind: "regular"});
    for (const id of legalTargets(G, power, "recruitMerc")) add("recruit", {space: id, kind: "merc"});
    for (const id of legalTargets(G, power, "recruitCav")) add("recruit", {space: id, kind: "cav"});
    for (const id of legalTargets(G, power, "buildGalley")) add("buildNaval", {port: id, kind: "galley"});
    for (const id of legalTargets(G, power, "buildGalleon")) add("buildNaval", {port: id, kind: "galleon"});
    for (const id of legalTargets(G, power, "buildRacebuilt")) add("buildNaval", {port: id, kind: "racebuilt"});
    for (const id of legalTargets(G, power, "buildCorsair")) add("buildNaval", {port: id, kind: "corsair"});
    for (const id of legalTargets(G, power, "buildFortress")) add("buildFortress", {space: id});
    for (const id of legalTargets(G, power, "control")) add("controlSpace", {space: id});
    for (const id of legalTargets(G, power, "assault")) add("assault", {space: id});

    for (const from of legalTargets(G, power, "moveLand")) {
        const source = G.spaces[from];
        if (source === undefined) continue;
        const owners = (Object.keys(source.land) as Controller[]).filter((owner) => landCount(source.land[owner]) > 0);
        for (const owner of owners) {
            const formation = defaultFormation(G, from, owner);
            for (const to of legalTargets(G, power, "moveLand", from)) {
                if (landMoveIssue(G, power, {from, to, units: formation.units, leaders: formation.leaders}, owner) !== undefined) continue;
                add("moveLand", {from, to, units: formation.units, leaders: formation.leaders, unitPower: owner});
            }
        }
    }
    for (const from of legalTargets(G, power, "moveNaval")) {
        for (const to of legalTargets(G, power, "moveNaval", from)) add("moveNaval", {from, to});
    }
    for (const from of legalTargets(G, power, "navalTransport")) {
        const [zone] = [...legalTargets(G, power, "navalTransport", from)];
        if (zone === undefined) continue;
        const firstZone = zone;
        for (const port of SPACES) {
            if (port.id === from || !(port.ports ?? []).includes(firstZone as never)) continue;
            if (port.control !== power) continue;
            const route = [firstZone, ...seaRoute(G, firstZone, port.ports ?? [], power)];
            if (route.length === 0) continue;
            const formation = defaultFormation(G, from, power, true);
            if (transportMoveIssue(G, power, {from, to: port.id, zones: route, units: formation.units, leaders: formation.leaders}) !== undefined) continue;
            add("navalTransport", {from, to: port.id, zones: route, units: formation.units, leaders: formation.leaders});
        }
    }

    if (G.scenario !== "tutorial") {
        for (const space of rebellionTargets(G)) add("rebellion", {space, cp: 2});
        for (const area of ["england", "france", "netherlands", "scotland"] as ReligionArea[]) {
            add("preach", {area});
            add("suppress", {area});
        }
        for (const minor of MINOR_POWERS) {
            if (MINOR_DIPLOMACY[minor].eligible.includes(power) && !G.minorInfluenceBlocked[power].includes(minor) &&
                !G.minorDiplomacyResolved.includes(minor) && (G.powers[power].influence[minor] ?? 0) < 9) {
                add("influence", {target: minor});
            }
        }
        for (const target of ["ottoman", "hre"] as Power[]) {
            if (G.majorInfluence?.[target]?.[power] !== undefined && !G.majorDiplomacyResolved?.includes(target)) {
                add("influence", {target});
            }
        }
        for (const zone of Object.keys(G.seaZones)) {
            for (const target of POWERS) if (target !== power) add("piracy", {zone, target});
        }
        for (const patron of G.patronsAvailable) add("patronize", {patron, cp: 2});
        if (G.year >= 3) {
            for (const target of POWERS) {
                if (target === power || isActivatedMajor(G, target)) continue;
                add("plantInformant", {target});
                add("gainIntelligence", {target});
            }
            for (const target of assassinationTargets(G, power)) add("assassinate", {target, cp: 2});
            if (power === "spain") add("englishCatholicRebellion", {cp: 3});
        }
        for (const settlement of WORLD_SETTLEMENTS) add("buildWorldFortress", {settlement: settlement.id});
    }
    return pickAccepted(G, ctx, seat, power, candidates, chaos, rng);
};

/** First short sea leg from `zone` to any port in `ports`, using own fleets. */
const seaRoute = (G: VQGame, zone: string, ports: readonly string[], power: Power): string[] => {
    const want = new Set(ports);
    const queue: {zone: string; path: string[]}[] = [{zone, path: []}];
    const seen = new Set([zone]);
    while (queue.length > 0) {
        const current = queue.shift()!;
        if (want.has(current.zone)) return current.path;
        for (const next of SEA_ZONE_BY_ID[current.zone]?.adjacent ?? []) {
            const zoneState = G.seaZones[next as keyof VQGame["seaZones"]];
            const stack = zoneState?.naval[power];
            if (seen.has(next) || stack === undefined || navalCount(stack) === 0) continue;
            seen.add(next);
            queue.push({zone: next, path: [...current.path, next]});
        }
    }
    return [];
};
