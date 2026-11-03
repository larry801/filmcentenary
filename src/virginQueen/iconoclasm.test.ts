import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
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
    it("places unrest on each rolled 1 even without conversions", () => {
        const G = game();
        G.powers.protestant.cards = ["vq-055"];
        for (const space of SPACES.filter((def) => def.area === "france")) {
            G.spaces[space.id].religion = "catholic";
            G.spaces[space.id].unrest = false;
        }

        expect(playCard(G, context(), {cardId: "vq-055", asEvent: true, target: "france"})).toBeUndefined();

        expect(SPACES.filter((space) => space.area === "france" && G.spaces[space.id].unrest).length).toBeGreaterThan(0);
    });
});
