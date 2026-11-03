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

describe("Tridentine Catechism (card #70)", () => {
    it("makes four attempts in each of two areas", () => {
        const G = game();
        G.powers.spain.cards = ["vq-070"];
        for (const space of SPACES.filter((def) => def.area === "england" || def.area === "france")) {
            G.spaces[space.id].religion = "protestant";
        }

        expect(playCard(G, context(), {cardId: "vq-070", asEvent: true, target: "england"})).toBeUndefined();

        expect(G.log.filter((line) => line.includes("catholic conversions in")).length).toBe(2);
    });
});
