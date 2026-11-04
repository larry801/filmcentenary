import {Ctx} from "boardgame.io";
import {RoyalDef, VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (player: string): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context("0"), phase: "action"} as Ctx);

const ensureCharles = (G: VQGame): RoyalDef => {
    let charles = G.royals.find((royal) => royal.id === "charlesIX");
    if (charles === undefined) {
        charles = {id: "charlesIX", name: "Charles IX", power: "france", gender: "male", eligibility: 3,
            alive: true, married: false, status: "available"};
        G.royals.push(charles);
    }
    return charles;
};

describe("ruler accession events", () => {
    it("Henry III succeeds Charles IX", () => {
        const G = game();
        if (!G.powers.france.cards.includes("vq-084")) G.powers.france.cards.push("vq-084");
        const charles = ensureCharles(G);
        G.betrothals = [{male: "charlesIX", female: "elizabeth"}];

        expect(playCard(G, context("3"), {cardId: "vq-084", asEvent: true})).toBeUndefined();

        expect(G.powers.france.ruler).toBe("henryIII");
        expect(G.powers.france.rulerAdmin).toBe(1);
        expect(G.powers.france.rulerCardBonus).toBe(1);
        expect(charles.alive).toBe(false);
        expect(G.betrothals).toEqual([]);
    });

    it("Murad III succeeds Selim II", () => {
        const G = game();
        if (!G.powers.ottoman.cards.includes("vq-085")) G.powers.ottoman.cards.push("vq-085");

        expect(playCard(G, context("0"), {cardId: "vq-085", asEvent: true})).toBeUndefined();

        expect(G.powers.ottoman.ruler).toBe("muradIII");
        expect(G.powers.ottoman.rulerAdmin).toBe(1);
        expect(G.powers.ottoman.rulerCardBonus).toBe(0);
    });

    it("Rudolf II succeeds Maximilian II with the rudolfII ruler id", () => {
        const G = game();
        if (!G.powers.hre.cards.includes("vq-087")) G.powers.hre.cards.push("vq-087");

        expect(playCard(G, context("4"), {cardId: "vq-087", asEvent: true})).toBeUndefined();

        expect(G.powers.hre.ruler).toBe("rudolfII");
        expect(G.powers.hre.rulerAdmin).toBe(1);
        expect(G.powers.hre.rulerCardBonus).toBe(1);
        expect(G.hreCapital).toBe("prague");
    });
});
