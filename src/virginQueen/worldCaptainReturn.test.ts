import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {returnWorldCaptains, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "winter",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("winter world captain return", () => {
    it("returns active expeditions to their power's pool", () => {
        const G = game();
        G.powers.england.seaCaptains = [];
        G.worldCaptains.drake = {power: "england", location: "spanishMain", damaged: false, colony: false};

        returnWorldCaptains(G);

        expect(G.worldCaptains.drake).toBeUndefined();
        expect(G.powers.england.seaCaptains).toContain("drake");
    });
});
