import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {atWar, regularCount, setWar, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "4",
    playerID: "4",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Holy Roman Intercession (card #34)", () => {
    it("joins one side, declares war on the other, and places unrest", () => {
        const G = game();
        setWar(G, "france", "spain");
        if (!G.powers.hre.cards.includes("vq-034")) G.powers.hre.cards.push("vq-034");
        const regulars = regularCount(G, "hre");
        expect(playCard(G, context(), {cardId: "vq-034", asEvent: true, target: "france:spain"})).toBeUndefined();

        expect(G.powers.hre.allies).toContain("france");
        expect(G.powers.france.allies).toContain("hre");
        expect(atWar(G, "hre", "spain")).toBe(true);
        expect(regularCount(G, "hre")).toBeGreaterThanOrEqual(regulars + 2);
        expect(G.lastRolls).toContain("unrest");
    });
});
