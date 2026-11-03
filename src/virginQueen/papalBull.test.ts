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

describe("Papal Bull (card #5)", () => {
    it("resolves the Papacy and makes Catholic attempts for its ally", () => {
        const G = game();
        G.powers.spain.cards = ["vq-005"];
        G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((minor) => minor !== "papacy");
        for (const power of ["ottoman", "spain", "england", "france", "hre", "protestant"] as const) {
            G.powers[power].influence.papacy = 0;
        }
        G.powers.spain.influence.papacy = 9;
        for (const space of SPACES.filter((def) => def.area === "france").slice(0, 3)) G.spaces[space.id].religion = "protestant";

        expect(playCard(G, context(), {cardId: "vq-005", asEvent: true})).toBeUndefined();

        expect(G.minorDiplomacyResolved).toContain("papacy");
        expect(G.log.some((line) => line.includes("Papal Bull"))).toBe(true);
    });
});
