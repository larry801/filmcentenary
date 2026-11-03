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

const attackDice = (withCard: boolean): number => {
    const G = setupGame({...context("0"), phase: "action"} as Ctx);
    G.spaces.london.control = "england";
    G.spaces.london.land.england = {regular: 1, merc: 0, cav: 0};
    G.spaces.calais.land.spain = {regular: 1, merc: 0, cav: 0};
    if (withCard) G.powers.spain.cards = ["vq-008"];
    startBattle(G, context("0"), "field", "london", "spain", ["england"], "calais");
    chooseBattle(G, context("2"), {choice: "fight"});
    if (withCard) chooseBattle(G, context("1"), {choice: "card:vq-008"});
    chooseBattle(G, context("1"), {choice: "done"});
    chooseBattle(G, context("2"), {choice: "done"});
    return G.pendingBattle!.rolls!.attacker.length;
};

describe("Elite Troops (card #8)", () => {
    it("adds three dice in a field battle", () => {
        expect(attackDice(true)).toBe(attackDice(false) + 3);
    });
});
