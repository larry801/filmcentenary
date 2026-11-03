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

describe("Portuguese Raid (card #77)", () => {
    it("removes a southern colony and draws a treasure when Lisbon is held", () => {
        const G = game();
        if (!G.powers.france.cards.includes("vq-077")) G.powers.france.cards.push("vq-077");
        G.worldColonies.southAmericaColony = "england";
        G.worldControls.southAmericaColony = "england";
        G.spaces.lisbon.control = "france";
        G.spaces.lisbon.unrest = false;
        const treasures = G.powers.france.treasures.length;

        expect(playCard(G, context(), {cardId: "vq-077", asEvent: true})).toBeUndefined();

        expect(G.worldColonies.southAmericaColony).toBeUndefined();
        expect(G.powers.france.treasures.length).toBe(treasures + 1);
    });
});
