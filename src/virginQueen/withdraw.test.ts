import {Ctx} from "boardgame.io";
import {VQGame, landCount} from "./constant/general";
import {continueMove, moveLand, stopContinue} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const prepare = (G: VQGame): void => {
    G.powers.france.cp = 2;
    G.spaces.paris.land.france = {regular: 2, merc: 0, cav: 0};
    G.spaces.orleans.control = "england";
    G.spaces.orleans.land = {england: {regular: 3, merc: 0, cav: 0}};
    G.spaces.orleans.unrest = false;
    for (const id of ["bourges", "tours", "blois", "chartres"]) {
        if (G.spaces[id] !== undefined) {
            G.spaces[id].control = "france";
            G.spaces[id].land = {};
            G.spaces[id].unrest = false;
        }
    }
};

describe("withdraw into fortifications (rule 13.4)", () => {
    it("offers the attacker a 1 CP continuation after the defenders withdraw", () => {
        const G = game();
        prepare(G);

        expect(moveLand(G, context(), {from: "paris", to: "orleans", units: {regular: 2}, leaders: []})).toBeUndefined();

        expect(G.pendingContinue).toMatchObject({power: "france", origin: "paris", space: "orleans"});
        expect(G.spaces.orleans.land.france.regular).toBe(2);
        expect(G.powers.france.cp).toBe(1);
    });

    it("continues into an adjacent empty space and spends 1 CP", () => {
        const G = game();
        prepare(G);
        moveLand(G, context(), {from: "paris", to: "orleans", units: {regular: 2}, leaders: []});

        expect(continueMove(G, context(), {to: "bourges"})).toBeUndefined();

        expect(G.pendingContinue).toBeUndefined();
        expect(G.spaces.orleans.land.france).toBeUndefined();
        expect(G.spaces.bourges.land.france.regular).toBe(2);
        expect(G.powers.france.cp).toBe(0);
    });

    it("returns to the origin without spending CP", () => {
        const G = game();
        prepare(G);
        moveLand(G, context(), {from: "paris", to: "orleans", units: {regular: 2}, leaders: []});

        expect(stopContinue(G, context())).toBeUndefined();

        expect(G.pendingContinue).toBeUndefined();
        expect(G.spaces.orleans.land.france).toBeUndefined();
        expect(landCount(G.spaces.paris.land.france)).toBe(2);
        expect(G.powers.france.cp).toBe(1);
    });
});
