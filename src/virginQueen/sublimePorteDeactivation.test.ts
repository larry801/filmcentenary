import {Ctx} from "boardgame.io";
import {CreateGameReducer, InitializeGame, ProcessGameConfig} from "boardgame.io/internal";
import {VirginQueenGameDef} from "./game";
import {ownerOf, participatingPowers} from "./ownership";
import {passBlockReasons} from "./moves";
import {setupGame} from "./util";

/**
 * A 4-player match controls the Ottoman as England's activated ally.  When the
 * Ottoman plays #37 Sublime Porte and Spain — the printed "Deactivate" power —
 * wins the status check, the Ottoman is deactivated *during its own impulse*.
 * `G.activePower` then named a power with no controlling seat: every seat was
 * blocked, `pass`/`endImpulse` refused, and the Action Phase could never end
 * (found by the seeded self-play sweep as an unfinished 4-player match).
 *
 * Two invariants must hold afterwards:
 *   1. the deactivated power is passable (Rule 11 restrictions come from the
 *      hand, which deactivation just emptied), and
 *   2. ending its turn hands play to a power that still has a seat.
 */
const setup = (ctx: Ctx) => {
    const G = setupGame(ctx, {scenario: "campaign"});
    // The Ottoman holds #37; Spain is the only real competitor on its track.
    G.powers.ottoman.cards = ["vq-037"];
    G.majorInfluence = {ottoman: {spain: 9, england: 0, france: 0, protestant: 0}};
    return G;
};

const game = () => ProcessGameConfig({...VirginQueenGameDef, seed: "vq-037-deactivate", setup} as never);

/** Drive to the Action Phase, confirming every national phase turn. */
const driveToAction = (reducer: ReturnType<typeof CreateGameReducer>, initial: any) => {
    let state = initial;
    for (let step = 0; step < 200 && state.ctx.phase !== "action"; step += 1) {
        const seat = ownerOf(state.G, state.G.activePower) ?? "1";
        state = reducer(state, {type: "MAKE_MOVE", payload: {type: "endPhaseTurn", args: [], playerID: seat}});
    }
    return state;
};

describe("#37 Sublime Porte deactivating the acting major", () => {
    it("leaves the deactivated power passable and hands play to a seated power", () => {
        const config = game();
        const reducer = CreateGameReducer({game: config, isClient: false});
        let state = driveToAction(reducer, InitializeGame({game: config, numPlayers: 4}));
        expect(state.ctx.phase).toBe("action");
        expect(state.G.activePower).toBe("ottoman");

        const actingSeat = state.ctx.currentPlayer;
        state = reducer(state, {type: "MAKE_MOVE", payload: {type: "playCard", args: [{cardId: "vq-037", asEvent: true}], playerID: actingSeat}});
        expect(state.transients?.error).toBeUndefined();

        // The status check gave the Ottoman to the printed Deactivate power.
        expect(ownerOf(state.G, "ottoman")).toBeUndefined();
        expect(state.G.activePower).toBe("ottoman");
        // Rule 11 restrictions must be gone with the hand.
        expect(passBlockReasons(state.G, "ottoman")).toEqual([]);

        const next = reducer(state, {type: "MAKE_MOVE", payload: {type: "pass", args: [], playerID: actingSeat}});
        expect(next.transients?.error).toBeUndefined();
        const seated = participatingPowers(next.G);
        expect(seated).not.toContain("ottoman");
        expect(ownerOf(next.G, next.G.activePower)).toBeDefined();
        expect(next.ctx.phase).toBe("action");
    });

    it("still advances past a deactivated active power when another power ends its turn", () => {
        const config = game();
        const reducer = CreateGameReducer({game: config, isClient: false});
        let state = driveToAction(reducer, InitializeGame({game: config, numPlayers: 4}));
        const actingSeat = state.ctx.currentPlayer;
        state = reducer(state, {type: "MAKE_MOVE", payload: {type: "playCard", args: [{cardId: "vq-037", asEvent: true}], playerID: actingSeat}});
        // Even if the deactivated power's seat never acts, the next turn order
        // must skip it rather than stall on it.
        const next = reducer(state, {type: "MAKE_MOVE", payload: {type: "endImpulse", args: [], playerID: actingSeat}});
        const owner = ownerOf(next.G, next.G.activePower);
        expect(owner).toBeDefined();
        expect(next.G.activePower).not.toBe("ottoman");
    });
});
