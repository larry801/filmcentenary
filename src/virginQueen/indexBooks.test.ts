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

describe("Index of Prohibited Books (card #56)", () => {
    it("makes six Catholic conversion attempts", () => {
        const G = game();
        if (!G.powers.spain.cards.includes("vq-056")) G.powers.spain.cards.push("vq-056");
        for (const area of ["france", "netherlands", "scotland"] as const) {
            for (const space of SPACES.filter((def) => def.area === area).slice(0, 3)) {
                G.spaces[space.id].religion = "protestant";
            }
        }

        expect(playCard(G, context(), {cardId: "vq-056", asEvent: true})).toBeUndefined();

        expect(G.log.filter((line) => line.includes("conversions in")).length).toBe(6);
    });
});
