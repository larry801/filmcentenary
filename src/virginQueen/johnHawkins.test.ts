import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("John Hawkins (card #59)", () => {
    it("grants England five CP", () => {
        const G = game();
        G.powers.england.cards = ["vq-059"];
        G.powers.england.cp = 0;

        expect(playCard(G, context(), {cardId: "vq-059", asEvent: true})).toBeUndefined();

        expect(G.powers.england.cp).toBe(5);
        expect(G.hawkinsBonus).toBe(true);
    });
});
