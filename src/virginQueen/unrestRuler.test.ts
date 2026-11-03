import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {SPACES} from "./mapData";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Unrest in the Realm / Ruler Falls Ill", () => {
    it("places three unrest in Ottoman home spaces", () => {
        const G = game();
        G.powers.france.cards = ["vq-025"];
        for (const space of SPACES.filter((def) => def.home === "ottoman")) {
            G.spaces[space.id].land = {};
            G.spaces[space.id].unrest = false;
        }

        expect(playCard(G, context(), {cardId: "vq-025", asEvent: true, target: "ottoman"})).toBeUndefined();

        expect(SPACES.filter((space) => space.home === "ottoman" && G.spaces[space.id].unrest)).toHaveLength(3);
    });

    it("discards a random card from another power", () => {
        const G = game();
        G.powers.france.cards = ["vq-030"];
        G.powers.spain.cards = ["vq-020"];

        expect(playCard(G, context(), {cardId: "vq-030", asEvent: true, target: "spain"})).toBeUndefined();

        expect(G.powers.spain.cards).toHaveLength(0);
        expect(G.discard).toContain("vq-020");
    });
});
