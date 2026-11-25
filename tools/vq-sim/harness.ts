/**
 * Seeded self-play harness for Virgin Queen.
 *
 * Drives the *real* boardgame.io reducer (seeded random plugin, phase/turn
 * flow, move validation, `playerView` redaction) and asks every seat for a
 * decision through the same helpers the hotseat board uses (`passBlockReasons`,
 * `legalTargets`, `battleOptions`, `espionageOptions`, ...).  A move the engine
 * refuses therefore reproduces a real hotseat bug: the board offered that
 * button too.
 */
import {Ctx} from "boardgame.io";
import {CreateGameReducer, InitializeGame, ProcessGameConfig} from "boardgame.io/internal";
import {VirginQueenGameDef} from "../../src/virginQueen/game";
import {setupGame} from "../../src/virginQueen/util";
import {ownerOf} from "../../src/virginQueen/ownership";
import {POWERS, Power, VQGame, ScenarioID} from "../../src/virginQueen/constant/general";
import {SPACE_BY_ID} from "../../src/virginQueen/mapData";
import {decide} from "./decision";
import {pendingDecider} from "./invariants";

export interface SimOptions {
    seed: string | number;
    scenario?: ScenarioID;
    numPlayers?: number;
    /** Hard cap on dispatched actions. */
    maxSteps?: number;
    /** Randomised choices instead of the first legal one, in [0, 1). */
    chaos?: number;
    /** Called for every dispatched action. */
    trace?: (step: number, event: SimEvent) => void;
    /** Stop once this rulebook turn (1-based) has finished. */
    stopAfterTurn?: number;
    /**
     * Called with the state produced by every dispatched action, including a
     * refused one (the state is then unchanged).  The property suites use this
     * to check the full rule catalogue after each step without changing the
     * default check that `sweep.test.ts` relies on.
     */
    onState?: (G: VQGame, ctx: Ctx, step: number) => void;
    /**
     * Skip the harness's own structural pass.  The property layer runs the
     * rule catalogue (`cheap` after every action, `full` on a cadence) over the
     * same board with rule citations, so the default pass would be a second,
     * redundant walk.  `sweep.test.ts` keeps the default.
     */
    skipStructuralCheck?: boolean;
    /**
     * Recorded decisions to replay instead of asking the policy, indexed by
     * step — the shrinker's input.  An entry the engine refuses at that point
     * falls back to the policy, so a reduced trace still plays.
     */
    forced?: {move: string; args: unknown[]}[];
}

export interface SimEvent {
    step: number;
    phase: string;
    turn: number;
    year: number;
    power: Power | null;
    move: string;
    args: unknown[];
    status: "ok" | "invalid" | "no-such-move" | "stall";
    error?: string;
}

export interface SimIssue {
    kind: "illegal" | "stall" | "invariant" | "exception" | "unfinished";
    step: number;
    turn: number;
    year: number;
    phase: string;
    power: Power | null;
    move?: string;
    args?: unknown[];
    detail: string;
}

export interface SimResult {
    seed: string | number;
    scenario: ScenarioID;
    numPlayers: number;
    steps: number;
    phase: string;
    turn: number;
    year: number;
    finished: boolean;
    gameover: unknown;
    issues: SimIssue[];
    events: SimEvent[];
    log: string[];
}

export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * The seat that must act now.  boardgame.io records pending response windows in
 * `ctx.activePlayers`; a national turn (Card Draw, Diplomacy, Spring, Action
 * impulse) uses `ctx.currentPlayer`.
 */
export const actingSeat = (G: VQGame, ctx: Ctx): string | null => {
    const value = ctx.activePlayers ?? {};
    const seats = Object.keys(value).filter((seat) => (value as Record<string, unknown>)[seat] !== undefined);
    if (seats.length > 0) {
        // One pending window can list several holders (a #16 window with more
        // than one responder); the engine always names the first in impulse
        // order inside the pending marker, so prefer a seat it names.
        const named = decidingPower(G);
        if (named !== undefined) {
            const owner = ownerOf(G, named);
            if (owner !== undefined && seats.includes(owner)) return owner;
        }
        return seats.sort((a, b) => Number(a) - Number(b))[0];
    }
    return ctx.currentPlayer ?? null;
};

/** The power whose pending decision blocks play, if any. */
export const decidingPower = (G: VQGame): Power | undefined => pendingDecider(G);

/**
 * Structural invariants that must hold after every action.  These are the
 * bookkeeping guarantees the board relies on (one physical copy per card, a
 * unit listed in exactly one place, no negative counters, a non-empty choice).
 */
export const checkInvariants = (G: VQGame): string[] => {
    const problems: string[] = [];
    const seen = new Map<string, string>();
    const note = (card: string, where: string): void => {
        const previous = seen.get(card);
        if (previous !== undefined) problems.push(`card ${card} is in both ${previous} and ${where}`);
        else seen.set(card, where);
    };
    G.deck.forEach((card) => note(card, "deck"));
    G.discard.forEach((card) => note(card, "discard"));
    G.removed.forEach((card) => note(card, "removed"));
    G.futureDeck.forEach((card) => note(card, "futureDeck"));
    G.homeSetAside.forEach((card) => note(card, "homeSetAside"));
    for (const power of POWERS) {
        const ps = G.powers[power];
        ps.cards.forEach((card) => note(card, `${power} hand`));
        // Face-down Spring set-asides are a separate zone from the hand.
        (ps.homeCardSetAside ?? []).forEach((card) => note(card, `${power} homeCardSetAside`));
        if (!Number.isInteger(ps.cp) || ps.cp < 0) problems.push(`${power} cp=${ps.cp}`);
        if (!Number.isFinite(ps.bonusVp)) problems.push(`${power} bonusVp=${ps.bonusVp}`);
        for (const value of ps.treasures) {
            if (typeof value === "number") {
                if (!Number.isInteger(value) || value < 1 || value > 5) problems.push(`${power} treasure=${value}`);
            } else if (!["drawCard", "scienceBonus", "vp"].includes(String(value))) {
                problems.push(`${power} treasure=${value}`);
            }
        }
    }
    // Rule 6.3: the 30 counters are physical, so total held + pool + discard can
    // never exceed the mix.  This catches a counter being created twice.
    if (G.treasurePool !== undefined) {
        const held = POWERS.reduce((total, power) => total + G.powers[power].treasures.length, 0) +
            (G.spanishTreasureRow ?? []).length +
            (G.portugueseTreasures ?? []).length +
            Object.values(G.worldCaptains).reduce((total, captain) => total + (captain.treasureValues ?? []).length, 0);
        const pool = G.treasurePool.length;
        const discard = (G.treasureDiscard ?? []).length;
        if (held + pool + discard > 30) problems.push(`treasure counters: ${held} held + ${pool} pool + ${discard} discard > 30`);
    }
    for (const [spaceId, space] of Object.entries(G.spaces)) {
        for (const [owner, stack] of Object.entries(space.land)) {
            for (const [kind, count] of Object.entries(stack ?? {})) {
                if (!Number.isInteger(count) || count < 0) problems.push(`land ${spaceId} ${owner} ${kind}=${count}`);
            }
        }
        for (const [owner, stack] of Object.entries(space.naval)) {
            for (const [kind, count] of Object.entries(stack ?? {})) {
                if (!Number.isInteger(count) || count < 0) problems.push(`naval ${spaceId} ${owner} ${kind}=${count}`);
            }
        }
        for (const leader of space.leaders) {
            const state = G.leaders[leader];
            if (state === undefined) problems.push(`space ${spaceId} lists missing leader ${leader}`);
            else if (state.location !== spaceId) {
                problems.push(`space ${spaceId} lists leader ${leader} whose location is ${state.location}`);
            }
        }
    }
    for (const [zoneId, zone] of Object.entries(G.seaZones)) {
        for (const [owner, stack] of Object.entries(zone.naval)) {
            for (const [kind, count] of Object.entries(stack ?? {})) {
                if (!Number.isInteger(count) || count < 0) problems.push(`sea ${zoneId} ${owner} ${kind}=${count}`);
            }
        }
    }
    const onMap = new Set<string>();
    for (const space of Object.values(G.spaces)) space.leaders.forEach((id) => onMap.add(id));
    for (const zone of Object.values(G.seaZones)) zone.leaders.forEach((id) => onMap.add(id));
    for (const [id, leader] of Object.entries(G.leaders)) {
        if (!onMap.has(id) && SPACE_BY_ID[leader.location] !== undefined) {
            problems.push(`leader ${id} claims ${leader.location} but is not listed there`);
        }
    }
    if (G.pendingBattle !== undefined) {
        if (!Number.isInteger(G.pendingBattle.hitCounts?.attacker ?? 0)) problems.push("battle hitCounts");
        if (!POWERS.includes(G.pendingBattle.responding)) problems.push(`battle responding=${G.pendingBattle.responding}`);
    }
    return problems;
};

/** Decide one action for the seat that must act. */
export interface Decision {
    move: string;
    args: unknown[];
}

const safeDecide = (G: VQGame, ctx: Ctx, seat: string, power: Power | undefined, chaos: number, rng: () => number): Decision => {
    try {
        return decide(G, ctx, seat, power, chaos, rng);
    } catch (error) {
        throw new Error(`decide threw for ${power ?? "?"} in ${ctx.phase}: ${(error as Error)?.stack ?? String(error)}`);
    }
};

export function runSeededGame(options: SimOptions): SimResult {
    const scenario = options.scenario ?? "campaign";
    const numPlayers = options.numPlayers ?? 6;
    const game = ProcessGameConfig({
        ...VirginQueenGameDef,
        seed: options.seed,
        setup: (ctx: Ctx) => setupGame(ctx, {scenario}),
    } as never);
    const reducer = CreateGameReducer({game, isClient: false});
    const rng = mulberry32(hashSeed(String(options.seed)));
    const maxSteps = options.maxSteps ?? 40000;

    let state: any = InitializeGame({game, numPlayers});
    const events: SimEvent[] = [];
    const issues: SimIssue[] = [];
    /** Repeated identical rejected decision detector (the hotseat board's escape). */
    let repeat = {key: "", count: 0};
    let steps = 0;

    for (; steps < maxSteps; steps += 1) {
        const G = state.G as VQGame;
        const ctx = state.ctx as Ctx;
        if (ctx.gameover !== undefined) break;
        if (options.stopAfterTurn !== undefined && G.year > options.stopAfterTurn && ctx.phase === "cardDraw") break;

        const seat = actingSeat(G, ctx);
        if (seat === null) {
            issues.push({kind: "stall", step: steps, turn: ctx.turn, year: G.year, phase: ctx.phase ?? "", power: null,
                detail: "no acting seat"});
            break;
        }
        // The engine's own `actingPower` rule: a pending window names the power
        // that must answer, otherwise the national turn belongs to
        // `G.activePower` (in reduced-player games the seat controlling it is
        // resolved through `ownerOf`, not the other way round).  Deriving the
        // power from the seat instead loses the acting power as soon as an
        // activated major is deactivated mid-turn.
        const pendingPower = decidingPower(G);
        const pendingOwner = pendingPower === undefined ? undefined : ownerOf(G, pendingPower);
        const power = pendingOwner === seat ? pendingPower : G.activePower;

        const forced = options.forced?.[steps];
        let decision: Decision;
        try {
            decision = forced === undefined
                ? safeDecide(G, ctx, seat, power, options.chaos ?? 0, rng)
                : {move: forced.move, args: forced.args};
        } catch (error) {
            issues.push({kind: "exception", step: steps, turn: ctx.turn, year: G.year, phase: ctx.phase ?? "",
                power: power ?? null, detail: String((error as Error)?.stack ?? error)});
            break;
        }

        const before = G;
        const action = {type: "MAKE_MOVE", payload: {type: decision.move, args: decision.args, playerID: seat}} as never;
        let next: any;
        try {
            next = reducer(state, action);
            if (forced !== undefined && next.transients?.error) {
                // The recorded action no longer applies after a shrink; ask the
                // policy instead so the reduced trace keeps playing.
                decision = safeDecide(G, ctx, seat, power, options.chaos ?? 0, rng);
                next = reducer(state, {type: "MAKE_MOVE",
                    payload: {type: decision.move, args: decision.args, playerID: seat}} as never);
            }
        } catch (error) {
            issues.push({kind: "exception", step: steps, turn: ctx.turn, year: G.year, phase: ctx.phase ?? "",
                power: power ?? null, move: decision.move, args: decision.args,
                detail: String((error as Error)?.stack ?? error)});
            break;
        }
        const changed = next.G !== before || next.ctx !== ctx;
        const event: SimEvent = {step: steps, phase: ctx.phase ?? "", turn: ctx.turn, year: G.year,
            power: power ?? null, move: decision.move, args: decision.args, status: "ok"};
        if (next.transients?.error) {
            event.status = "invalid";
            event.error = `${next.transients.error.type}: ${JSON.stringify(next.transients.error.payload ?? null)}`;
            issues.push({kind: "illegal", step: steps, turn: ctx.turn, year: G.year, phase: ctx.phase ?? "",
                power: power ?? null, move: decision.move, args: decision.args,
                detail: `${event.error} [${describeState(G, ctx)}]`});
        } else if (!changed) {
            event.status = "invalid";
            issues.push({kind: "illegal", step: steps, turn: ctx.turn, year: G.year, phase: ctx.phase ?? "",
                power: power ?? null, move: decision.move, args: decision.args,
                detail: `reducer returned the same state (move was a no-op) [${describeState(G, ctx)}]`});
        }
        events.push(event);
        options.trace?.(steps, event);
        state = next;
        options.onState?.(state.G as VQGame, state.ctx as Ctx, steps);
        if (event.status !== "ok") {
            // A rejected decision on an unchanged state is the board's "bot is
            // stuck" signal.  Report it once and escape with a legal fallback so
            // the rest of the match is still explored (the hotseat board does
            // the same through its own fallback buttons).
            const key = `${decision.move}|${JSON.stringify(decision.args)}|${ctx.phase}|${ctx.turn}`;
            repeat = repeat.key === key ? {key, count: repeat.count + 1} : {key, count: 1};
            if (repeat.count >= 3) {
                issues.push({kind: "stall", step: steps, turn: ctx.turn, year: G.year, phase: ctx.phase ?? "",
                    power: power ?? null, move: decision.move, args: decision.args,
                    detail: `the same decision was refused three times (deadlock) [${describeState(G, ctx)}]`});
                break;
            }
        } else {
            repeat = {key: "", count: 0};
        }

        const after = state.G as VQGame;
        const problems = options.skipStructuralCheck === true ? [] : checkInvariants(after);
        // A pending window whose deciding seat does not exist can never be
        // answered, which is exactly the class of bug this harness hunts: the
        // panel has no buttons and every seat is blocked from playing on.
        const orphan = decidingPower(after);
        if (orphan !== undefined && ownerOf(after, orphan) === undefined && options.skipStructuralCheck !== true) {
            problems.push(`pending decision for ${orphan}, which has no controlling seat`);
        }
        if (problems.length > 0) {
            issues.push({kind: "invariant", step: steps, turn: state.ctx.turn, year: after.year,
                phase: state.ctx.phase ?? "", power: power ?? null, move: decision.move, args: decision.args,
                detail: problems.slice(0, 8).join("; ")});
            break;
        }
    }

    const finalG = state.G as VQGame;
    return {
        seed: options.seed,
        scenario,
        numPlayers,
        steps,
        phase: state.ctx.phase ?? "",
        turn: state.ctx.turn,
        year: finalG.year,
        finished: state.ctx.gameover !== undefined,
        gameover: state.ctx.gameover ?? null,
        issues,
        events,
        log: finalG.log.slice(-40),
    };
}

/** Short, human-readable context for an issue report. */
export const describeState = (G: VQGame, ctx: Ctx): string => {
    const pending = [
        ["battle", G.pendingBattle !== undefined], ["espionage", G.pendingEspionage !== undefined],
        ["cardEvent", G.pendingCardEvent !== undefined], ["tutorialEvent", G.pendingTutorialEvent !== undefined],
        ["activation", G.pendingActivation !== undefined], ["tribute", G.pendingTribute !== undefined],
        ["abjuration", G.pendingAbjuration !== undefined], ["cityRebels", G.pendingCityRebels !== undefined],
        ["mutiny", G.pendingMutiny !== undefined], ["polish", G.pendingPolishElection !== undefined],
        ["piracy", G.pendingPiracy !== undefined], ["action", G.pendingAction !== undefined],
        ["beacon", G.pendingBeacon !== undefined], ["interceptionOrder", G.pendingInterceptionOrder !== undefined],
        ["intercept", G.pendingIntercept !== undefined], ["withdraw", G.pendingWithdraw !== undefined],
        ["relief", G.pendingReliefSplit !== undefined], ["continue", G.pendingContinue !== undefined],
        ["foreignWar", G.pendingForeignWar !== undefined], ["rebelMove", G.pendingRebelMove !== undefined],
        ["betrothal", G.pendingBetrothal !== null], ["navalOrder", G.pendingNavalOrder !== undefined],
        ["navalMoves", G.pendingNavalMoves !== undefined], ["catholicLeague", G.pendingCatholicLeague !== undefined],
        ["hreReplacement", G.pendingHreReplacement !== undefined], ["gregorian", G.gregorianResponse !== undefined],
    ].filter(([, active]) => active).map(([name]) => name);
    return `phase=${ctx.phase} turn=${ctx.turn} year=${G.year} active=${G.activePower} cp=${G.powers[G.activePower]?.cp} `
        + `pending=${pending.join(",") || "-"} activePlayers=${JSON.stringify(ctx.activePlayers ?? null)}`;
};

/** Stable 32-bit seed hash so `seed: "VQ-SIM-3"` is reproducible. */
export const hashSeed = (text: string): number => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
};
