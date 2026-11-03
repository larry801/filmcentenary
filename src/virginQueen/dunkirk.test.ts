import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Dunkirk Privateers (card #110)", () => {
    it("starts free North Sea piracy with four dice", () => {
        const G = game();
        G.powers.spain.cards = ["vq-110"];
        G.spaces.antwerp.control = "spain";
        G.spaces.antwerp.unrest = false;
        G.spaces.london.control = "england";
        G.spaces.london.unrest = false;

        expect(playCard(G, context(), {cardId: "vq-110", asEvent: true})).toBeUndefined();

        expect(G.pendingPiracy?.zone).toBe("northSea");
        expect(G.pendingPiracy?.power).toBe("spain");
        expect(G.pendingPiracy?.remaining).toBe(4);
        expect(G.lastRolls).toContain("Dunkirk Privateers");
    });
});
