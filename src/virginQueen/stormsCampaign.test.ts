import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {moveNaval, respondAction} from "./moves";
import {setupGame} from "./util";

const context = (player: string): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context("0"), phase: "action"} as Ctx);

describe("Storms in a campaign game", () => {
    it("interrupts the action and blocks naval moves for the impulse", () => {
        const G = game();
        G.powers.spain.cards = ["vq-015"];
        G.pendingAction = {power: "ottoman", move: "moveLand", args: {from: "istanbul", to: "edirne"}};

        expect(respondAction(G, context("1"), {choice: "storms"})).toBeUndefined();

        expect(G.stormImpulse).toBe(G.impulse);
        expect(G.powers.spain.cards).not.toContain("vq-015");
        expect(moveNaval(G, context("0"), {from: "istanbul", to: "aegean", units: {galley: 1}})).toBe(INVALID_MOVE);
    });
});
