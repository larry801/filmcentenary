/**
 * Trace shrinker for a property-suite failure.
 *
 * The harness is deterministic, so re-running a seed reproduces a failure — but
 * `shrinkFailure` only replays the whole prefix: it proves the failure
 * reproduces without making it any smaller, and it costs one full run per
 * violation.  This shrinker delta-debugs the recorded decision list instead:
 * it removes chunks of actions, replays the reduced list through the harness
 * (`forced`), and keeps every removal that still reports the same invariant id.
 * The result is a minimal action sequence a reader can replay by hand.
 *
 * A recorded action the engine no longer accepts after a removal falls back to
 * the policy, so a reduced trace always plays, and a reduction is only kept
 * when the violation still appears.  It is deliberately *not* run in CI
 * (`VQ_PROPERTY_SHRINK=off`): every replay is a full simulated match, so this
 * is a local triage tool.
 */
import {Ctx} from "boardgame.io";
import {VQGame} from "../../src/virginQueen/constant/general";
import {PropertyConfig, PropertyRun} from "./properties";
import {runSeededGame} from "./harness";
import {checkRuleInvariants} from "./invariants";

export interface ShrinkOutcome {
    /** The reduced decision list. */
    decisions: {move: string; args: unknown[]}[];
    /** Steps at which one of the target ids still fires. */
    hits: {step: number; ids: string[]}[];
    /** Replays the shrinker spent (each one is a simulated match). */
    replays: number;
    /** False when the replay budget ran out before no chunk could be removed. */
    minimal: boolean;
}

/** A-tier violation ids a state reports. */
const violationsOf = (G: VQGame, ctx: Ctx): string[] =>
    checkRuleInvariants(G, {ctx}).filter((violation) => violation.tier === "A")
        .map((violation) => violation.id);

/**
 * Minimise the decision prefix that produced `step`'s violation.
 *
 * `ids` is the violation-id set observed at that step; a reduction is kept only
 * when at least one of them still fires somewhere in the reduced run.
 */
export const shrinkTrace = (
    run: PropertyRun, step: number, ids: string[], maxReplays = 48,
): ShrinkOutcome => {
    const config: PropertyConfig = run.config;
    const decisions = run.result.events.slice(0, step + 1).map((event) => ({move: event.move, args: event.args}));
    let replays = 0;

    const replay = (candidate: {move: string; args: unknown[]}[]): {step: number; ids: string[]}[] => {
        const hits: {step: number; ids: string[]}[] = [];
        replays += 1;
        runSeededGame({
            seed: config.seed,
            scenario: config.scenario,
            numPlayers: config.numPlayers,
            chaos: config.chaos,
            maxSteps: candidate.length,
            forced: candidate,
            skipStructuralCheck: true,
            onState: (G, ctx, index) => {
                const found = violationsOf(G, ctx).filter((id) => ids.includes(id));
                if (found.length > 0) hits.push({step: index, ids: [...new Set(found)]});
            },
        });
        return hits;
    };

    let current = decisions;
    let hits = replay(current);
    if (hits.length === 0) {
        // The recorded prefix no longer reproduces through the forced replay
        // (a policy fallback changed the run); there is nothing to shrink.
        return {decisions: current, hits, replays, minimal: false};
    }

    let granularity = 2;
    while (current.length >= 2 && replays < maxReplays) {
        const chunk = Math.ceil(current.length / granularity);
        let reduced = false;
        for (let start = 0; start < current.length && replays < maxReplays; start += chunk) {
            const candidate = [...current.slice(0, start), ...current.slice(start + chunk)];
            if (candidate.length === 0) continue;
            const reducedHits = replay(candidate);
            if (reducedHits.length > 0) {
                current = candidate;
                hits = reducedHits;
                granularity = Math.max(2, granularity - 1);
                reduced = true;
                break;
            }
        }
        if (!reduced) {
            if (granularity >= current.length) break;
            granularity = Math.min(current.length, granularity * 2);
        }
    }

    // A last single-action pass: ddmin can leave isolated removable actions
    // behind when the chunking never lined up with them.
    for (let index = 0; index < current.length && replays < maxReplays; index += 1) {
        const candidate = [...current.slice(0, index), ...current.slice(index + 1)];
        if (candidate.length === 0) continue;
        const reducedHits = replay(candidate);
        if (reducedHits.length > 0) {
            current = candidate;
            hits = reducedHits;
            index -= 1;
        }
    }

    return {decisions: current, hits, replays, minimal: replays < maxReplays};
};

/** One-line description of a shrunk trace, for a test report. */
export const describeShrink = (outcome: ShrinkOutcome): string => {
    const ids = [...new Set(outcome.hits.flatMap((hit) => hit.ids))].join(",");
    const actions = outcome.decisions
        .map((decision) => `${decision.move}(${decision.args.map((arg) => JSON.stringify(arg)).join(",")})`);
    return `shrunk to ${outcome.decisions.length} action(s) [${ids}] at step ${outcome.hits[0]?.step ?? "?"}`
        + `${outcome.minimal ? "" : " (replay budget exhausted)"}; replay: ${actions.join(" -> ")}`;
};
