import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {checkCyprusVp, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Cyprus VP target", () => {
    it("awards 1 VP once when the Ottoman captures the marked space", () => {
        const G = game();
        G.cyprusTarget = "candia";
        G.cyprusAwarded = false;
        const vp = G.powers.ottoman.bonusVp;

        checkCyprusVp(G, "ottoman", "candia");
        checkCyprusVp(G, "ottoman", "candia");

        expect(G.powers.ottoman.bonusVp).toBe(vp + 1);
        expect(G.cyprusAwarded).toBe(true);
    });
});
