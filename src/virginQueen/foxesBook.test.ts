import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {SPACES} from "./mapData";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Foxe's Book of Martyrs (card #52)", () => {
    it("can focus the five attempts on one area", () => {
        const G = game();
        if (!G.powers.england.cards.includes("vq-052")) G.powers.england.cards.push("vq-052");
        G.spaces.paris.religion = "catholic";
        G.spaces.edinburgh.religion = "catholic";

        expect(playCard(G, context(), {cardId: "vq-052", asEvent: true, target: "scotland"})).toBeUndefined();

        expect(G.spaces.edinburgh.religion).toBe("protestant");
        expect(G.spaces.paris.religion).toBe("catholic");
    });

    it("converts two English Catholic spaces and makes five Protestant attempts", () => {
        const G = game();
        if (!G.powers.england.cards.includes("vq-052")) G.powers.england.cards.push("vq-052");
        G.spaces.london.religion = "catholic";
        G.spaces.york.religion = "catholic";
        for (const space of SPACES.filter((def) => def.area === "france").slice(0, 6)) {
            G.spaces[space.id].religion = "catholic";
        }

        expect(playCard(G, context(), {cardId: "vq-052", asEvent: true})).toBeUndefined();

        expect(G.spaces.london.religion).toBe("protestant");
        expect(G.spaces.york.religion).toBe("protestant");
        expect(G.log.filter((line) => line.includes("conversions in")).length).toBe(5);
    });
});
