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
    G.spaces.rotterdam.control = "spain";
    G.spaces.rotterdam.land.spain = {regular: 2, merc: 0, cav: 0};
    G.spaces.rotterdam.land.france = {regular: 4, merc: 0, cav: 0};
    if (withCard) G.powers.france.cards = ["vq-007"];
    startBattle(G, context("0"), "assault", "rotterdam", "france", ["spain"], "rotterdam");
    if (withCard) chooseBattle(G, context("3"), {choice: "card:vq-007"});
    chooseBattle(G, context("3"), {choice: "done"});
    chooseBattle(G, context("1"), {choice: "done"});
    return G.pendingBattle!.rolls!.defender.length;
};

describe("Desperate Assault (card #7)", () => {
    it("doubles defender dice", () => {
        expect(defenseDice(true)).toBe(defenseDice(false) * 2);
    });
});
