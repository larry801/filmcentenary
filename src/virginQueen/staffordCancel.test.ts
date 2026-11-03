import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {cancelWalsingham} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Sir Edward Stafford response (card #102)", () => {
    it("cancels Walsingham", () => {
        const G = game();
        G.powers.england.cards = ["vq-102"];
        G.espionage!.walsingham = "offensive";

        expect(cancelWalsingham(G, context())).toBeUndefined();

        expect(G.espionage?.walsingham).toBeUndefined();
        expect(G.powers.england.cards).not.toContain("vq-102");
    });
});
