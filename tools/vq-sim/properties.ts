/**
 * Property exploration for the Virgin Queen self-play harness.
 *
 * The seeded harness in `harness.ts` answers one question: "does the engine
 * accept the decision the hotseat board would offer?".  This module asks the
 * rule questions instead: after every single action, does the whole board still
 * satisfy the rulebook?  It is the generative (property-based) layer:
 *
 *   for every seed in a budget
 *     for every scenario / player count / chaos level
 *       for every action the policy takes
 *         assert the A-tier rule invariants      (a violation is a defect)
 *         assert the state survives a JSON trip   (boardgame.io only syncs JSON)
 *         assert `playerView` leaks nothing       (sampled)
 *     assert the final gameover agrees with rule 25
 *
 * Failures carry the exact seed and the *first* action that broke the rule, so
 * a report can be replayed deterministically:
 *
 *   runSeededGame({seed: "<seed>", ..., maxSteps: <step + 1>})
 *
 * The first failing step is already the shortest *prefix* (the run is
 * deterministic), so `shrinkFailure` re-runs it and confirms the violation.
 * Minimising the actions themselves lives in `shrink.ts`: it delta-debugs the
 * recorded decision list and replays the reduced trace through the harness's
 * `forced` decisions.
 */
import {Ctx} from "boardgame.io";
import {ScenarioID, POWERS, Power, VQGame} from "../../src/virginQueen/constant/general";
import {VirginQueenGameDef} from "../../src/virginQueen/game";
import {ownerOf} from "../../src/virginQueen/ownership";
import {runSeededGame, hashSeed, SimResult} from "./harness";
import {checkRuleInvariants, InvariantViolation} from "./invariants";

export interface PropertyConfig {
    label: string;
    seed: string;
    scenario?: ScenarioID;
    numPlayers: number;
    chaos: number;
    maxSteps?: number;
    /** Keep a JSON snapshot every N actions (0 disables). */
    sampleEvery?: number;
    /**
     * Run the board-wide derivations (`full` tier) and the strict JSON
     * round-trip every N actions, in addition to every phase boundary.  The
     * cheap tier still runs after every action.
     */
    fullEvery?: number;
}

export interface StepViolation {
    step: number;
    violations: InvariantViolation[];
}

export interface PrivacyFailure {
    step: number;
    viewer: string | null;
    detail: string;
}

export interface PropertyRun {
    config: PropertyConfig;
    result: SimResult;
    /** A-tier violations, first occurrence per invariant id. */
    violations: StepViolation[];
    /** B-tier rule audits, first occurrence per invariant id. */
    audits: StepViolation[];
    /** Steps whose state did not survive `JSON.parse(JSON.stringify(state))`. */
    roundTrip: {step: number; detail: string}[];
    privacy: PrivacyFailure[];
    /** Rule 25 disagreements on the final state. */
    outcome: string[];
    /** Sampled serialised states for follow-up checks. */
    samples: {step: number; state: string}[];
    /** Compact action trace, for determinism comparisons. */
    trace: string[];
}

const dedupeBy = (entries: StepViolation[]): StepViolation[] => {
    const seen = new Set<string>();
    return entries.filter((entry) => {
        const key = entry.violations.map((violation) => violation.id).join(",");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

/**
 * JSON-safety scan: one traversal that finds the first value a JSON round trip
 * would change — NaN/Infinity (become null), Map/Set (become {}), a class
 * instance (becomes a plain object), a function or symbol (dropped), or an
 * `undefined` array entry (becomes null).  It allocates nothing, so it can run
 * after every action; `roundTripProblem` keeps the strict stringify/parse
 * comparison for the full cadence.
 */
export const jsonSafetyProblem = (root: unknown): string | undefined => {
    const seen = new Set<object>();
    const walk = (value: unknown, path: string): string | undefined => {
        if (value === null || value === undefined) return undefined;
        const kind = typeof value;
        if (kind === "number") return Number.isFinite(value as number) ? undefined : `${path}: ${String(value)}`;
        if (kind === "string" || kind === "boolean") return undefined;
        if (kind !== "object") return `${path}: ${kind}`;
        const object = value as object;
        if (seen.has(object)) return undefined;
        seen.add(object);
        if (Array.isArray(object)) {
            for (let index = 0; index < object.length; index += 1) {
                if (object[index] === undefined) return `${path}[${index}]: undefined array entry`;
                const found = walk(object[index], `${path}[${index}]`);
                if (found !== undefined) return found;
            }
            return undefined;
        }
        const prototype = Object.getPrototypeOf(object);
        if (prototype !== Object.prototype && prototype !== null) {
            const name = (object as {constructor?: {name?: string}}).constructor?.name ?? "non-plain";
            return `${path}: ${name} instance`;
        }
        for (const key in object as Record<string, unknown>) {
            const found = walk((object as Record<string, unknown>)[key], `${path}.${key}`);
            if (found !== undefined) return found;
        }
        return undefined;
    };
    return walk(root, "$");
};

/**
 * Round-trip check.  boardgame.io ships the state as JSON, so anything that
 * does not survive `JSON.stringify` (Map, Set, Date, class instance, NaN,
 * Infinity, undefined in an array) would diverge between client and server.
 */
export const roundTripProblem = (G: VQGame): string | undefined => {
    const first = JSON.stringify(G);
    const second = JSON.stringify(JSON.parse(first));
    if (first === second) return undefined;
    // Locate the first differing path so the report is actionable.
    const walk = (a: unknown, b: unknown, path: string): string | undefined => {
        if (JSON.stringify(a) === JSON.stringify(b)) return undefined;
        if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
            return `${path}: ${String(a)} -> ${String(b)}`;
        }
        const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
        for (const key of keys) {
            const found = walk((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`);
            if (found !== undefined) return found;
        }
        return path;
    };
    return walk(JSON.parse(first), JSON.parse(second), "$") ?? "state does not survive a JSON round-trip";
};

/**
 * Rule 6.2/9.1 privacy: a viewer sees its own secrets and only counts for
 * everyone else's.  Returns human-readable leaks, or an empty list.
 */
export const privacyProblems = (G: VQGame, ctx: Ctx, viewer: string | null): string[] => {
    const problems: string[] = [];
    const playerView = VirginQueenGameDef.playerView as unknown as (
        state: VQGame, context: Ctx, playerID: string | null,
    ) => VQGame & {
        deckCount?: number;
        futureDeckCount?: number;
        discardCount?: number;
        treasurePoolCount?: number;
        handCounts?: Partial<Record<Power, number>>;
        treasureCounts?: Partial<Record<Power, number>>;
        homeCardSetAsideCounts?: Partial<Record<Power, number>>;
    };
    const view = playerView(G, ctx, viewer);
    for (const power of POWERS) {
        const mine = viewer !== null && ownerOf(G, power) === viewer;
        const publicView = view.powers[power];
        if (!mine) {
            if (publicView.cards.length > 0) {
                problems.push(`${power} hand is visible (${publicView.cards.length} card(s))`);
            }
            if (publicView.treasures.length > 0) {
                problems.push(`${power} treasures are visible (${publicView.treasures.length})`);
            }
            if ((publicView.homeCardSetAside ?? []).length > 0) {
                problems.push(`${power} secret Home set-aside is visible`);
            }
            if (view.handCounts?.[power] !== G.powers[power].cards.length) {
                problems.push(`${power} hand count ${String(view.handCounts?.[power])} != ${G.powers[power].cards.length}`);
            }
            if (view.treasureCounts?.[power] !== G.powers[power].treasures.length) {
                problems.push(`${power} treasure count ${String(view.treasureCounts?.[power])} != ${G.powers[power].treasures.length}`);
            }
        } else if (publicView.cards.join(",") !== G.powers[power].cards.join(",")) {
            problems.push(`viewer's own ${power} hand was redacted`);
        }
    }
    if (view.deck.length > 0 || view.futureDeck.length > 0 || view.discard.length > 0) {
        problems.push("deck/futureDeck/discard contents are visible");
    }
    if (view.deckCount !== G.deck.length) problems.push(`deckCount ${String(view.deckCount)} != ${G.deck.length}`);
    if (view.futureDeckCount !== G.futureDeck.length) {
        problems.push(`futureDeckCount ${String(view.futureDeckCount)} != ${G.futureDeck.length}`);
    }
    if (view.discardCount !== G.discard.length) {
        problems.push(`discardCount ${String(view.discardCount)} != ${G.discard.length}`);
    }
    if (view.treasurePool !== undefined) problems.push("face-down treasure pool values are visible");
    if (view.treasurePoolCount !== (G.treasurePool?.length ?? 0)) {
        problems.push(`treasurePoolCount ${String(view.treasurePoolCount)} != ${G.treasurePool?.length ?? 0}`);
    }
    // Nothing hidden may appear anywhere else in the payload (the log, a
    // pending marker, an event record).  Physical cards are unique, so an
    // unknown card id in the serialised view is always a leak.  A power
    // legitimately learns another hand through espionage (`inspections` holds
    // the cards the viewer is allowed to know), so those ids are subtracted
    // from the hidden set before the scan.
    const allowed = new Set<string>();
    for (const power of POWERS) {
        if (viewer !== null && ownerOf(G, power) === viewer) {
            G.powers[power].cards.forEach((id) => allowed.add(id));
            (G.powers[power].homeCardSetAside ?? []).forEach((id) => allowed.add(id));
        }
    }
    for (const inspection of G.espionage?.inspections ?? []) {
        if (viewer !== null && ownerOf(G, inspection.viewer) === viewer) {
            inspection.cards.forEach((id) => allowed.add(id));
        }
    }
    const hidden = new Set<string>([...G.deck, ...G.futureDeck]);
    for (const power of POWERS) {
        G.powers[power].cards.forEach((id) => hidden.add(id));
        (G.powers[power].homeCardSetAside ?? []).forEach((id) => hidden.add(id));
    }
    const payload = JSON.stringify(view);
    const leaked = [...hidden].filter((id) => !allowed.has(id) && payload.includes(`"${id}"`));
    if (leaked.length > 0) problems.push(`hidden card id(s) elsewhere in the view: ${leaked.slice(0, 5).join(", ")}`);
    return problems;
};

/** One generative run with every property evaluated per action. */
export const runProperty = (config: PropertyConfig): PropertyRun => {
    const violations: StepViolation[] = [];
    const audits: StepViolation[] = [];
    const roundTrip: {step: number; detail: string}[] = [];
    const privacy: PrivacyFailure[] = [];
    const samples: {step: number; state: string}[] = [];
    const trace: string[] = [];
    const sampleEvery = config.sampleEvery ?? 0;
    const fullEvery = config.fullEvery ?? 25;
    let lastPhase: string | undefined;
    let finalG: VQGame | undefined;
    let finalCtx: Ctx | undefined;
    const result = runSeededGame({
        seed: config.seed,
        scenario: config.scenario,
        numPlayers: config.numPlayers,
        chaos: config.chaos,
        maxSteps: config.maxSteps ?? 4000,
        // The rule catalogue covers the same bookkeeping with rule citations,
        // so the harness's own structural pass would be a second, redundant
        // walk of the same board on every action.
        skipStructuralCheck: true,
        trace: (_step, event) => {
            trace.push(`${event.move}|${JSON.stringify(event.args)}|${event.status}`);
        },
        onState: (G, ctx, step) => {
            finalG = G;
            finalCtx = ctx;
            const phaseChanged = lastPhase !== ctx.phase;
            lastPhase = ctx.phase;
            const level = phaseChanged || step % fullEvery === 0 ? "full" : "cheap";
            const found = checkRuleInvariants(G, {ctx, level});
            const hard = found.filter((violation) => violation.tier === "A");
            const audit = found.filter((violation) => violation.tier === "B");
            if (hard.length > 0) violations.push({step, violations: hard});
            if (audit.length > 0) audits.push({step, violations: audit});
            // The allocation-free scan runs on every action; the strict
            // stringify/parse comparison corroborates it on the full cadence.
            const unsafe = jsonSafetyProblem(G);
            const snapshot = unsafe ?? (level === "full" ? roundTripProblem(G) : undefined);
            if (snapshot !== undefined) roundTrip.push({step, detail: snapshot});
            if (sampleEvery > 0 && step % sampleEvery === 0) {
                samples.push({step, state: JSON.stringify(G)});
                const viewers = [null, ...new Set(POWERS.map((power) => ownerOf(G, power))
                    .filter((seat): seat is string => seat !== undefined))];
                for (const viewer of viewers) {
                    for (const detail of privacyProblems(G, ctx, viewer)) {
                        privacy.push({step, viewer, detail});
                    }
                }
            }
        },
    });
    // Rule 25: the final context must agree with the board.
    const outcome = finalG === undefined ? [] : checkRuleInvariants(finalG, {ctx: finalCtx})
        .filter((violation) => violation.id.startsWith("victory."))
        .map((violation) => `[rule ${violation.rule} ${violation.id}] ${violation.detail}`);
    return {config, result, violations: dedupeBy(violations), audits: dedupeBy(audits),
        roundTrip, privacy, outcome, samples, trace};
};

/**
 * Re-run a single seed up to `step + 1` actions, which is the shortest prefix
 * that still produces the failure.  Used to confirm a report is reproducible
 * and to hand the reader a minimal command.
 */
export const shrinkFailure = (config: PropertyConfig, step: number): PropertyRun => runProperty({
    ...config,
    maxSteps: step + 1,
    sampleEvery: 0,
});

/** Stable experiment id: same seed + config => same run. */
export const experimentId = (config: PropertyConfig): string =>
    `${config.label}/${config.seed}/${config.scenario ?? "campaign"}/${config.numPlayers}p/chaos=${config.chaos}/seed32=${hashSeed(config.seed)}`;
