import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {chooseBattle, startBattle} from "./combat";
import {assault} from "./moves";
import {setWar} from "./util";
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

    it("is applied automatically in a campaign assault", () => {
        const dice = (withCard: boolean): number => {
            const G = setupGame({...context("3"), phase: "action"} as Ctx);
            G.impulse = 2;
            G.spaces.ghent.control = "spain";
            G.spaces.ghent.siege = {by: "france", sinceImpulse: 1};
            G.spaces.ghent.land.spain = {regular: 1, merc: 0, cav: 0};
            G.spaces.ghent.land.france = {regular: 6, merc: 0, cav: 0};
            G.spaces.brussels.control = "france";
            G.spaces.brussels.unrest = false;
            G.powers.spain.cards = [];
            setWar(G, "france", "spain");
            G.powers.france.cp = 10;
            if (withCard) G.powers.france.cards = ["vq-040"];
            assault(G, context("3"), {space: "ghent"});
            return Number(G.lastRolls.match(/\((\d+) dice\)/)?.[1] ?? 0);
        };
        expect(dice(true)).toBe(dice(false) + 2);
    });

    it("adds two dice for another power", () => {
        const dice = (withCard: boolean): number => {
            const G = setupGame({...context("0"), phase: "action"} as Ctx);
            G.spaces.paris.control = "france";
            G.spaces.paris.land.france = {regular: 1, merc: 0, cav: 0};
            G.spaces.calais.land.spain = {regular: 1, merc: 0, cav: 0};
            if (withCard) G.powers.france.cards = ["vq-040"];
            startBattle(G, context("0"), "field", "paris", "spain", ["france"], "calais");
            chooseBattle(G, context("3"), {choice: "fight"});
            chooseBattle(G, context("1"), {choice: "done"});
            if (withCard) chooseBattle(G, context("3"), {choice: "card:vq-040"});
            chooseBattle(G, context("3"), {choice: "done"});
            return G.pendingBattle!.rolls!.defender.length;
        };
        expect(dice(true)).toBe(dice(false) + 2);
    });
});
