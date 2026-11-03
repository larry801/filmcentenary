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
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Edmund Campion (card #107)", () => {
    it("places a Jesuit and makes conversion attempts", () => {
        const G = game();
        if (!G.powers.spain.cards.includes("vq-107")) G.powers.spain.cards.push("vq-107");
        for (const space of SPACES.filter((def) => def.area === "england")) {
            G.spaces[space.id].land = {};
            G.spaces[space.id].unrest = false;
        }

        expect(playCard(G, context(), {cardId: "vq-107", asEvent: true})).toBeUndefined();

        expect(G.espionage?.jesuits.length).toBeGreaterThan(0);
        expect(G.log.join("\n")).toContain("Edmund Campion");
    });
});
