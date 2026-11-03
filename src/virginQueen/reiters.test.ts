import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {chooseBattle, startBattle} from "./combat";
import {setupGame} from "./util";

const context = (playerID: string): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context("0"), phase: "action"} as Ctx);

describe("Reiters (card #13)", () => {
    it("places two mercenaries for a non-Ottoman defender", () => {
        const G = game();
        G.powers.england.cards = ["vq-013"];
        G.spaces.london.control = "england";
        G.spaces.london.unrest = false;
        G.spaces.london.siege = undefined;
        G.spaces.london.land = {england: {regular: 1, merc: 0, cav: 0}};
        G.spaces.calais.land.spain = {regular: 1, merc: 0, cav: 0};

        startBattle(G, context("1"), "field", "london", "spain", ["england"], "calais");
        chooseBattle(G, context("2"), {choice: "fight"});
        chooseBattle(G, context("1"), {choice: "done"});
        expect(chooseBattle(G, context("2"), {choice: "card:vq-013"})).toBeUndefined();

        expect(G.spaces.london.land.england?.merc).toBe(2);
    });

    it("lets the Ottoman remove two mercenaries anywhere", () => {
        const G = game();
        G.powers.ottoman.cards = ["vq-013"];
        G.spaces.belgrade.land.ottoman = {regular: 1, merc: 0, cav: 0};
        G.spaces.belgrade.land.spain = {regular: 1, merc: 0, cav: 0};
        for (const space of Object.values(G.spaces)) {
            for (const stack of Object.values(space.land)) {
                if (stack !== undefined) stack.merc = 0;
            }
        }
        G.spaces.sofia.land.ottoman = {regular: 0, merc: 2, cav: 0};

        startBattle(G, context("1"), "field", "belgrade", "spain", ["ottoman"], "budapest");
        chooseBattle(G, context("0"), {choice: "fight"});
        chooseBattle(G, context("1"), {choice: "done"});
        expect(chooseBattle(G, context("0"), {choice: "card:vq-013"})).toBeUndefined();

        expect(G.spaces.sofia.land.ottoman?.merc).toBe(0);
    });
});
