import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {SPACES} from "./mapData";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Union of Arras (card #109)", () => {
    it("removes Dutch mercenaries and secures five spaces", () => {
        const G = game();
        G.powers.spain.cards = ["vq-109"];
        G.spaces.brussels.land.spain = {regular: 2, merc: 3, cav: 0};

        expect(playCard(G, context(), {cardId: "vq-109", asEvent: true})).toBeUndefined();

        expect(G.spaces.brussels.land.spain?.regular).toBe(0);
        expect(G.spaces.brussels.land.spain?.merc).toBeLessThanOrEqual(4);
        expect(G.unionOfArras).toBe(true);
        expect(SPACES.filter((space) => space.area === "netherlands" && G.spaces[space.id].control === "spain").length).toBeGreaterThanOrEqual(5);
        expect(G.removed).toContain("vq-109");
    });
});
