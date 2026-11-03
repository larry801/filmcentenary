import {Ctx} from "boardgame.io";
import {RoyalDef, VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const ensureMary = (G: VQGame): RoyalDef => {
    let mary = G.royals.find((royal) => royal.id === "maryScots");
    if (mary === undefined) {
        mary = {id: "maryScots", name: "Mary", power: "france", gender: "female", eligibility: 3,
            alive: true, married: false, status: "available"};
        G.royals.push(mary);
    }
    return mary;
};

describe("Mary Queen of Scots card (#89)", () => {
    it("adds French influence and resolves Scotland", () => {
        const G = game();
        G.year = 3;
        ensureMary(G);
        if (!G.powers.france.cards.includes("vq-089")) G.powers.france.cards.push("vq-089");
        G.powers.france.influence.scotland = 0;
        G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((minor) => minor !== "scotland");

        expect(playCard(G, context(), {cardId: "vq-089", asEvent: true})).toBeUndefined();

        expect(G.powers.france.influence.scotland).toBe(3);
        expect(G.minorDiplomacyResolved).toContain("scotland");
    });

    it("is removed after play when Mary is dead", () => {
        const G = game();
        G.year = 3;
        ensureMary(G).alive = false;
        if (!G.powers.france.cards.includes("vq-089")) G.powers.france.cards.push("vq-089");

        expect(playCard(G, context(), {cardId: "vq-089", asEvent: true})).toBeUndefined();

        expect(G.removed).toContain("vq-089");
    });
});
