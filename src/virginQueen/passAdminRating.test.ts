import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {pass} from "./moves";
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
        // Ottoman (player 0) has admin 4; give them 4 non-mandatory cards
        G.powers.ottoman.cards = ["vq-020", "vq-036", "vq-050", "vq-060"];
        G.foreignWars.ottoman = undefined;
        expect(pass(G, ctx)).toBeUndefined();
        expect(G.powers.ottoman.passed).toBe(true);
    });

    it("blocks pass when hand size > admin rating", () => {
        const G = game();
        const ctx = context();
        // Ottoman admin is 4; give them 5 non-mandatory cards
        G.powers.ottoman.cards = ["vq-020", "vq-036", "vq-050", "vq-060", "vq-070"];
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
});
