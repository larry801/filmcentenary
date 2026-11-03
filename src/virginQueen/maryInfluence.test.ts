import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {maryInfluence, playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Mary Queen of Scots response (card #89)", () => {
    it("is removed when played for CP after Mary dies", () => {
        const G = game();
        G.powers.france.cards = ["vq-089"];
        G.espionage!.mary = "dead";
        const mary = G.royals.find((royal) => royal.id === "maryScots");
        if (mary !== undefined) mary.alive = false;

        expect(playCard(G, context(), {cardId: "vq-089"})).toBeUndefined();
        expect(G.removed).toContain("vq-089");
    });

    it("adds 4 French influence in Scotland", () => {
        const G = game();
        G.powers.france.cards = ["vq-089"];
        G.powers.france.influence.scotland = 0;
        const mary = G.royals.find((royal) => royal.id === "maryScots");
        if (mary === undefined) G.royals.push({id: "maryScots", name: "Mary", power: "france", gender: "female", alive: true, married: false});
        else {mary.alive = true; G.espionage!.mary = "scotland";}

        expect(maryInfluence(G, context())).toBeUndefined();

        expect(G.powers.france.influence.scotland).toBe(4);
        expect(G.powers.france.cards).not.toContain("vq-089");
    });
});
