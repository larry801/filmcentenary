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
    it("takes the throne and marks the first non-Ottoman space (Cyprus first)", () => {
        const G = game();
        G.powers.ottoman.cards = ["vq-006"];
        G.spaces.candia.control = "venice";

        expect(playCard(G, context(), {cardId: "vq-006", asEvent: true})).toBeUndefined();

        expect(G.powers.ottoman.ruler).toBe("selimII");
        expect(G.powers.ottoman.rulerAdmin).toBe(2);
        expect(G.powers.ottoman.rulerCardBonus).toBe(1);
        // Printed order is Cyprus, Candia, Corfu, so Cyprus is marked first
        // even though the old `nicosia` id hid it.
        expect(G.cyprusTarget).toBe("cyprus");
    });

    it("falls through to Candia when Cyprus is already Ottoman", () => {
        const G = game();
        G.powers.ottoman.cards = ["vq-006"];
        G.spaces.cyprus.control = "ottoman";
        G.spaces.candia.control = "venice";

        expect(playCard(G, context(), {cardId: "vq-006", asEvent: true})).toBeUndefined();

        expect(G.cyprusTarget).toBe("candia");
    });
});
