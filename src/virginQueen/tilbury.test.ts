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

const defenseDice = (withCard: boolean): number => {
    const G = setupGame({...context("0"), phase: "action"} as Ctx);
    G.spaces.london.control = "england";
    G.spaces.london.land.england = {regular: 1, merc: 0, cav: 0};
    G.spaces.calais.land.spain = {regular: 1, merc: 0, cav: 0};
    if (withCard) G.powers.england.cards = ["vq-040"];
    startBattle(G, context("0"), "field", "london", "spain", ["england"], "calais");
    chooseBattle(G, context("2"), {choice: "fight"});
    chooseBattle(G, context("1"), {choice: "done"});
    if (withCard) {
        chooseBattle(G, context("2"), {choice: "card:vq-040"});
    }
    chooseBattle(G, context("2"), {choice: "done"});
    return G.pendingBattle!.rolls!.defender.length;
};

describe("Tilbury Speech (card #40)", () => {
    it("adds four dice for England", () => {
        expect(defenseDice(true)).toBe(defenseDice(false) + 4);
    });
});
