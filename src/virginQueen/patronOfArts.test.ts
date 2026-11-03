import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "4",
    playerID: "4",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Patron of Arts, option 2 (card #35)", () => {
    it("draws two cards and gives one to another power", () => {
        const G = game();
        G.powers.hre.cards = ["vq-035", "vq-020"];
        G.powers.france.cards = [];
        const hreHand = G.powers.hre.cards.length;

        expect(playCard(G, context(), {cardId: "vq-035", asEvent: true, target: "france"})).toBeUndefined();

        expect(G.powers.france.cards).toHaveLength(1);
        expect(G.powers.hre.cards).toHaveLength(hreHand - 1 + 2 - 1);
        expect(G.log.join("\n")).toContain("Patron of Arts");
    });
});
