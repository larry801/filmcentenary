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

describe("Holy League (card #24)", () => {
    it("adds influence to the Papacy and Venice and resolves them", () => {
        const G = game();
        G.powers.france.cards = ["vq-024"];
        G.powers.france.influence.papacy = 0;
        G.powers.france.influence.venice = 0;
        G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((minor) => minor !== "papacy" && minor !== "venice");

        expect(playCard(G, context(), {cardId: "vq-024", asEvent: true})).toBeUndefined();

        expect(G.powers.france.influence.papacy).toBeGreaterThanOrEqual(2);
        expect(G.powers.france.influence.venice).toBeGreaterThanOrEqual(2);
        expect(G.minorDiplomacyResolved).toContain("papacy");
        expect(G.minorDiplomacyResolved).toContain("venice");
    });
});
