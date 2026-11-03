import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {assault} from "./moves";
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
    G.impulse = 2;
    G.spaces.antwerp.control = "spain";
    G.spaces.antwerp.siege = {by: "france", sinceImpulse: 1};
    G.spaces.antwerp.land.spain = {regular: 1, merc: 0, cav: 0};
    G.spaces.antwerp.land.france = {regular: 6, merc: 0, cav: 0};
    G.spaces.brussels.control = "france";
    G.spaces.brussels.unrest = false;
    G.spaces.flushing.control = "spain";
    delete G.seaZones.northSea.naval.france;
    G.powers.spain.cards = [];
    G.powers.france.cp = 10;
};

const attackerDice = (withCard: boolean): number => {
    const G = game();
    G.impulse = 2;
    G.spaces.ghent.control = "spain";
    G.spaces.ghent.siege = {by: "france", sinceImpulse: 1};
    G.spaces.ghent.land.spain = {regular: 1, merc: 0, cav: 0};
    G.spaces.ghent.land.france = {regular: 6, merc: 0, cav: 0};
    G.spaces.brussels.control = "france";
    G.spaces.brussels.unrest = false;
    G.powers.spain.cards = [];
    G.powers.france.cp = 10;
    if (withCard) G.powers.france.cards = ["vq-010"];
    assault(G, context(), {space: "ghent"});
    return Number(G.lastRolls.match(/\((\d+) dice\)/)?.[1] ?? 0);
};

describe("Siege Engineering inland-waterway exception", () => {
    it("adds three dice to an assault", () => {
        expect(attackerDice(true)).toBe(attackerDice(false) + 3);
    });

    it("blocks the assault without Siege Engineering", () => {
        const G = game();
        prepare(G);
        expect(assault(G, context(), {space: "antwerp"})).toBe(INVALID_MOVE);
    });

    it("allows an assault without a North Sea fleet", () => {
        const G = game();
        prepare(G);
        G.powers.france.cards = ["vq-010"];

        expect(assault(G, context(), {space: "antwerp"})).toBeUndefined();
        expect(G.lastRolls).toContain("Assault on Antwerp");
    });
});
