/**
 * The blocking-window list must match what the engine actually blocks.
 *
 * `pendingDecider` answers "which power has to act right now?".  The harness
 * uses that answer to pick the acting power, so naming a window the engine does
 * *not* block hands the turn to the wrong power.  That is not hypothetical: the
 * HRE winter replacement and the Catholic League choice are set during the
 * winter, live until the Spring phase resolves them, and `moveError` never
 * refuses a move because of them.  Listing them as deciding powers made the
 * 2-player sweep ask the HRE for a winter return while the active power was
 * Spain, and `chooseWinterReturn` (which reads the active power) refused it.
 *
 * Run explicitly (jest excludes tools/):
 *   npx jest --testPathPatterns "tools/vq-sim/pendingWindow" \
 *     --testPathIgnorePatterns "/node_modules/" --runInBand
 */
import {Ctx} from "boardgame.io";
import {VQGame} from "../../src/virginQueen/constant/general";
import {moveError} from "../../src/virginQueen/movePolicy";
import {pendingDecider} from "./invariants";
import {runSeededGame} from "./harness";

jest.setTimeout(600000);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A move no window lists as an answer, so `moveError` exposes any block. */
const PROBE = "buildLand";

test("the HRE winter replacement and Catholic League do not decide", () => {
    // Neither is a blocking window: `moveError` ignores them and the Spring
    // phase's onBegin auto-resolves whatever the HRE/Spain did not choose.
    let state: VQGame | undefined;
    runSeededGame({
        seed: "VQ-PENDING-1", numPlayers: 2, chaos: 0.35, maxSteps: 400, stopAfterTurn: 1,
        onState: (G) => { state = clone(G); },
    });
    if (state === undefined) throw new Error("no state captured");
    state.pendingHreReplacement = {canRegular: true, canMercs: true, canMarker: false};
    expect(moveError(state, PROBE)).toBeUndefined();
    expect(pendingDecider(state)).toBeUndefined();
    state.pendingCatholicLeague = {remaining: 2};
    expect(moveError(state, PROBE)).toBeUndefined();
    expect(pendingDecider(state)).toBeUndefined();
});

test("a conversion / science-bonus window does decide", () => {
    let state: VQGame | undefined;
    runSeededGame({
        seed: "VQ-PENDING-2", numPlayers: 6, chaos: 0, maxSteps: 300,
        onState: (G) => { state = clone(G); },
    });
    if (state === undefined) throw new Error("no state captured");
    state.pendingConversion = {power: "protestant", side: "protestant", area: "france",
        dice: [6, 5, 1], extraUnrest: 0, unrestOnOnes: false};
    // `moveError` is the contract: a window only decides when it blocks play.
    expect(moveError(state, PROBE)).toBeDefined();
    expect(pendingDecider(state)).toBe("protestant");
    delete state.pendingConversion;
    state.pendingScienceTreasure = {power: "spain"};
    expect(moveError(state, PROBE)).toBeDefined();
    expect(pendingDecider(state)).toBe("spain");
});

test("every state of a short match keeps the two lists in step", () => {
    // The sweep derives the acting power from `pendingDecider`; when it names a
    // power, play must really be blocked by some window.  Stage-based windows
    // (mutiny, Polish election, ...) are covered by `ctx.activePlayers` instead,
    // so the check only asserts the implication for the move-error windows.
    let checked = 0;
    runSeededGame({
        seed: "VQ-PENDING-3", numPlayers: 4, chaos: 0.5, maxSteps: 500,
        onState: (G: VQGame, ctx: Ctx) => {
            const decider = pendingDecider(G);
            if (decider === undefined) return;
            const blocked = moveError(G, PROBE) !== undefined;
            const staged = ctx.activePlayers !== undefined && ctx.activePlayers !== null;
            checked += 1;
            if (!blocked && !staged) {
                throw new Error(`pendingDecider named ${decider} but play is not blocked `
                    + `(phase=${ctx.phase} active=${G.activePower})`);
            }
        },
    });
    expect(checked).toBeGreaterThan(0);
});
