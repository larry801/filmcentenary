import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Selim II (card #6)", () => {
    it("takes the throne and marks the Cyprus VP target", () => {
        const G = game();
        G.powers.ottoman.cards = ["vq-006"];
        G.spaces.candia.control = "venice";

        expect(playCard(G, context(), {cardId: "vq-006", asEvent: true})).toBeUndefined();

        expect(G.powers.ottoman.ruler).toBe("selimII");
        expect(G.powers.ottoman.rulerAdmin).toBe(2);
        expect(G.powers.ottoman.rulerCardBonus).toBe(1);
        expect(G.cyprusTarget).toBe("candia");
    });
});
