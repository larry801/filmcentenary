import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Eloquent Ambassador (card #20)", () => {
    it("adds three influence and resolves the minor", () => {
        const G = game();
        G.powers.france.cards = ["vq-020"];
        G.powers.france.influence.venice = 0;

        expect(playCard(G, context(), {cardId: "vq-020", asEvent: true, target: "venice"})).toBeUndefined();

        expect(G.powers.france.influence.venice).toBeGreaterThanOrEqual(3);
        expect(G.minorDiplomacyResolved).toContain("venice");
    });
});
