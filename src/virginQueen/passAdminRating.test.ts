import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {endImpulse, pass} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers: 6,
    events: {endTurn: () => {}},
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Pass — admin rating guard (rule 11)", () => {
    it("allows pass when hand size ≤ admin rating", () => {
        const G = game();
        const ctx = context();
        // Suleiman's Administrative Rating is 2.
        G.powers.ottoman.cards = ["vq-020", "vq-050"];
        G.foreignWars.ottoman = undefined;
        expect(pass(G, ctx)).toBeUndefined();
        expect(G.powers.ottoman.passed).toBe(true);
    });

    it("blocks pass when hand size > admin rating", () => {
        const G = game();
        const ctx = context();
        // Suleiman's Administrative Rating is 2; three cards block a pass.
        G.powers.ottoman.cards = ["vq-020", "vq-050", "vq-070"];
        G.foreignWars.ottoman = undefined;
        expect(pass(G, ctx)).toBe(INVALID_MOVE);
        expect(G.powers.ottoman.passed).toBeFalsy();
    });

    it("allows pass when hand is empty (mandatory pass)", () => {
        const G = game();
        const ctx = context();
        G.powers.ottoman.cards = [];
        G.foreignWars.ottoman = undefined;
        expect(pass(G, ctx)).toBeUndefined();
        expect(G.powers.ottoman.passed).toBe(true);
    });

    it("blocks ending an impulse without playing a card while a Mandatory Event is held", () => {
        const G = game();
        const ctx = context();
        G.powers.ottoman.cards = ["vq-006"];

        expect(endImpulse(G, ctx)).toBe(INVALID_MOVE);
        expect(G.powers.ottoman.passed).toBeFalsy();

        // After a card has been played the impulse may end normally.
        G.powers.ottoman.cardPlayed = true;
        expect(endImpulse(G, ctx)).toBeUndefined();
    });
});
