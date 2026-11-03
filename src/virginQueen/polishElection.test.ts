import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "4",
    playerID: "4",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Polish Royal Election (card #86)", () => {
    it("can choose a specific treasure bid", () => {
        const G = game();
        G.powers.hre.cards = ["vq-086"];
        G.powers.france.cards = ["vq-001"];
        G.powers.france.treasures = [1];
        G.powers.spain.cards = [];
        G.powers.hre.treasures = [];
        G.powers.spain.treasures = [];
        const vp = G.powers.france.bonusVp;

        expect(playCard(G, context(), {cardId: "vq-086", asEvent: true, target: "france:treasure:1"})).toBeUndefined();

        expect(G.powers.france.bonusVp).toBe(vp + 2);
        expect(G.powers.france.cards).toContain("vq-001");
        expect(G.powers.france.treasures).not.toContain(1);
    });

    it("allows a treasure to be bid", () => {
        const G = game();
        G.powers.hre.cards = ["vq-086"];
        G.powers.france.cards = [];
        G.powers.france.treasures = [2];
        G.powers.spain.cards = [];
        G.powers.hre.treasures = [];
        G.powers.spain.treasures = [];
        const vp = G.powers.france.bonusVp;

        expect(playCard(G, context(), {cardId: "vq-086", asEvent: true})).toBeUndefined();

        expect(G.powers.france.bonusVp).toBe(vp + 2);
        expect(G.powers.france.treasures).not.toContain(2);
    });

    it("allows a home card to be bid", () => {
        const G = game();
        G.powers.hre.cards = ["vq-086"];
        G.powers.france.cards = ["vq-001"];
        G.powers.spain.cards = [];
        G.powers.hre.treasures = [];
        G.powers.spain.treasures = [];
        const vp = G.powers.france.bonusVp;

        expect(playCard(G, context(), {cardId: "vq-086", asEvent: true})).toBeUndefined();

        expect(G.powers.france.bonusVp).toBe(vp + 2);
        expect(G.powers.france.cards).not.toContain("vq-001");
    });

    it("ends the Polish war and elects the highest bidder", () => {
        const G = game();
        G.powers.hre.cards = ["vq-086"];
        G.powers.france.cards = [];
        G.powers.spain.cards = [];
        G.powers.hre.treasures = [];
        G.powers.spain.treasures = [];
        G.foreignWars.hre = {power: "hre", cardId: "vq-086", enemy: "Poland", enemyUnits: 3,
            units: {regular: 0, merc: 0, cav: 0}, winnerVp: false, status: "active"};
        const vp = G.powers.france.bonusVp;

        expect(playCard(G, context(), {cardId: "vq-086", asEvent: true})).toBeUndefined();

        expect(G.foreignWars.hre).toBeUndefined();
        expect(G.powers.france.bonusVp).toBe(vp + 2);
        expect(G.removed).toContain("vq-086");
    });
});
