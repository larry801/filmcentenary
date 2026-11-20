import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {ACTION_TYPES, buildNaval, playTreasure, recruit} from "./moves";
import {setupGame} from "./util";

const context = (playerID = "0"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

/**
 * Rule 11: "All other treasures have a value in CP (from 1 to 5). When they are
 * played these CP are expended to perform actions just as if you were playing a
 * card for CP. However, the actions chosen must all be of a different type than
 * those chosen if a card was played for CP earlier in the impulse (no such
 * restriction exists if a card was played as an event)."
 */
describe("treasure extension action types (rule 11)", () => {
    it("maps every action to the printed colour group", () => {
        expect(ACTION_TYPES.moveLand).toBe("land");
        expect(ACTION_TYPES.recruitRegular).toBe("land");
        expect(ACTION_TYPES.buildGalleon).toBe("naval");
        expect(ACTION_TYPES.moveNaval).toBe("naval");
        expect(ACTION_TYPES.piracy).toBe("naval");
        expect(ACTION_TYPES.preach).toBe("religious");
        expect(ACTION_TYPES.patronize).toBe("patronage");
        expect(ACTION_TYPES.gainIntelligence).toBe("espionage");
        expect(ACTION_TYPES.influence).toBe("diplomacy");
    });

    it("refuses to repeat a naval action after a naval card impulse", () => {
        const G = game();
        // A card was played for CP and the 2 CP went into a galley build.
        G.powers.ottoman.cp = 2;
        G.powers.ottoman.cardPlayed = true;
        expect(buildNaval(G, context(), {port: "istanbul", kind: "galley"})).toBeUndefined();
        expect(G.powers.ottoman.actionsThisImpulse).toEqual(["naval"]);

        // Extend the impulse with a treasure, then try another naval build.
        G.powers.ottoman.treasures = [3];
        expect(playTreasure(G, context(), {index: 0})).toBeUndefined();
        expect(G.powers.ottoman.cp).toBe(3);

        expect(buildNaval(G, context(), {port: "istanbul", kind: "galley"})).toBe(INVALID_MOVE);
        // A different type is still allowed.
        expect(recruit(G, context(), {space: "istanbul", kind: "regular"})).toBeUndefined();
    });

    it("allows any action type after a card played as an event", () => {
        const G = game();
        // An event play does not consume CP, so `cardActionCount` is 0.
        G.powers.ottoman.cp = 0;
        G.powers.ottoman.cardPlayed = true;
        G.powers.ottoman.actionsThisImpulse = [];
        G.powers.ottoman.treasures = [4];
        expect(playTreasure(G, context(), {index: 0})).toBeUndefined();
        expect(G.powers.ottoman.cardActionCount).toBe(0);

        expect(buildNaval(G, context(), {port: "istanbul", kind: "galley"})).toBeUndefined();
        expect(buildNaval(G, context(), {port: "istanbul", kind: "galley"})).toBeUndefined();
    });

    it("still blocks a second treasure in the same impulse", () => {
        const G = game();
        G.powers.ottoman.cp = 0;
        G.powers.ottoman.cardPlayed = true;
        G.powers.ottoman.treasures = [2, 2];
        expect(playTreasure(G, context(), {index: 0})).toBeUndefined();
        expect(playTreasure(G, context(), {index: 0})).toBe(INVALID_MOVE);
    });
});
