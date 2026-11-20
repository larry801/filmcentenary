import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {chooseConversionNullify, playCard} from "./moves";
import {SPACES} from "./mapData";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "5",
    playerID: "5",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Iconoclastic Fury (card #55)", () => {
    it("places unrest on converted spaces for each rolled 1", () => {
        const G = game();
        G.powers.protestant.cards = ["vq-055"];
        for (const space of SPACES.filter((def) => def.area === "france")) {
            G.spaces[space.id].religion = "catholic";
            G.spaces[space.id].unrest = false;
        }

        expect(playCard(G, context(), {cardId: "vq-055", asEvent: true, target: "france"})).toBeUndefined();

        // The first die is an automatic 6 and the rest are 1s, so Step 4 now
        // pauses for the choice.  Keep the Unrest markers to test Step 7.
        expect(G.pendingConversion).toBeDefined();
        expect(chooseConversionNullify(G, context(), {downgrade: "none"})).toBeUndefined();

        expect(SPACES.filter((space) => space.area === "france" && G.spaces[space.id].unrest).length).toBeGreaterThan(0);
    });

    it("never places unrest on a space it did not convert", () => {
        const G = game();
        G.powers.protestant.cards = ["vq-055"];
        for (const space of SPACES.filter((def) => def.area === "france")) {
            G.spaces[space.id].religion = "protestant";
            G.spaces[space.id].unrest = false;
        }
        // No Catholic space is left to convert, so nothing may receive unrest
        // (rule 18.5 step 7: the marker must land on a converted space).
        expect(playCard(G, context(), {cardId: "vq-055", asEvent: true, target: "france"})).toBeUndefined();
        expect(SPACES.filter((space) => space.area === "france" && G.spaces[space.id].unrest)).toEqual([]);
    });
});
