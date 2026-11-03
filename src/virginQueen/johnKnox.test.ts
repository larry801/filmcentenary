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
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("John Knox (card #60)", () => {
    it("converts all Scottish spaces except the chosen one", () => {
        const G = game();
        if (!G.powers.england.cards.includes("vq-060")) G.powers.england.cards.push("vq-060");
        const scotland = SPACES.filter((space) => space.area === "scotland");
        for (const space of scotland) G.spaces[space.id].religion = "catholic";

        expect(playCard(G, context(), {cardId: "vq-060", asEvent: true, target: "edinburgh"})).toBeUndefined();

        expect(G.spaces.edinburgh.religion).toBe("catholic");
        expect(scotland.filter((space) => space.id !== "edinburgh" && G.spaces[space.id].religion === "protestant")).toHaveLength(scotland.length - 1);
    });

    it("adds 4 influence when no Scottish space is chosen", () => {
        const G = game();
        if (!G.powers.england.cards.includes("vq-060")) G.powers.england.cards.push("vq-060");
        G.powers.england.influence.scotland = 0;

        expect(playCard(G, context(), {cardId: "vq-060", asEvent: true})).toBeUndefined();

        expect(G.powers.england.influence.scotland).toBe(4);
    });
});
