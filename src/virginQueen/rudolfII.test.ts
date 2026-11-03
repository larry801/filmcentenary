import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {capitalOf, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "4",
    playerID: "4",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Rudolf II (card #87)", () => {
    it("takes the throne and moves the capital to Prague", () => {
        const G = game();
        if (!G.powers.hre.cards.includes("vq-087")) G.powers.hre.cards.push("vq-087");
        G.spaces.prague.control = "hre";

        expect(playCard(G, context(), {cardId: "vq-087", asEvent: true})).toBeUndefined();

        expect(G.powers.hre.ruler).toBe("rudolfII");
        expect(G.powers.hre.rulerAdmin).toBe(1);
        expect(G.powers.hre.rulerCardBonus).toBe(1);
        expect(G.hreCapital).toBe("prague");
        expect(capitalOf(G, "hre")).toBe("prague");
    });
});
