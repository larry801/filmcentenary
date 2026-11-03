import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (player: string): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context("0"), phase: "action"} as Ctx);

describe("Black Magic / Armada Pardon", () => {
    it("takes a random non-home card from another power", () => {
        const G = game();
        G.powers.england.cards = ["vq-071"];
        G.powers.spain.cards = ["vq-020"];

        expect(playCard(G, context("2"), {cardId: "vq-071", asEvent: true, target: "spain"})).toBeUndefined();

        expect(G.powers.spain.cards).toEqual([]);
        expect(G.powers.england.cards).toContain("vq-020");
    });

    it("grants Armada CP, with +1 for the Papacy alliance", () => {
        const G = game();
        G.powers.spain.cards = ["vq-104"];
        G.armada = {strength: 2, location: "seville"};
        G.powers.spain.alliedMinors = [];
        G.powers.spain.cp = 0;

        expect(playCard(G, context("1"), {cardId: "vq-104", asEvent: true})).toBeUndefined();
        expect(G.powers.spain.cp).toBe(4);

        const G2 = game();
        G2.powers.spain.cards = ["vq-104"];
        G2.armada = {strength: 2, location: "seville"};
        G2.powers.spain.alliedMinors = ["papacy"];
        G2.powers.spain.cp = 0;
        playCard(G2, context("1"), {cardId: "vq-104", asEvent: true});
        expect(G2.powers.spain.cp).toBe(5);
    });
});
