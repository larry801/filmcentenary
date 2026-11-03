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
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Convention of Estates (card #79)", () => {
    it("converts three Netherlands spaces", () => {
        const G = game();
        if (!G.powers.protestant.cards.includes("vq-079")) G.powers.protestant.cards.push("vq-079");
        for (const space of SPACES.filter((def) => def.area === "netherlands")) {
            G.spaces[space.id].religion = "catholic";
        }

        expect(playCard(G, context(), {cardId: "vq-079", asEvent: true})).toBeUndefined();

        expect(SPACES.filter((space) => space.area === "netherlands" && G.spaces[space.id].religion === "protestant")).toHaveLength(3);
        expect(G.removed).toContain("vq-079");
    });
});
