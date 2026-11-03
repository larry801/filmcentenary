import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Council of Troubles (card #50)", () => {
    it("places William of Orange on the Turn Track", () => {
        const G = game();
        G.powers.spain.cards = ["vq-050"];
        G.spaces.brussels.land.spain = {regular: 5, merc: 0, cav: 0};
        G.leaders.orange = {id: "orange", location: "edinburgh"};
        G.spaces.edinburgh.leaders = ["orange"];

        expect(playCard(G, context(), {cardId: "vq-050", asEvent: true})).toBeUndefined();

        expect(G.leaders.orange.location).toBe("pool");
        expect(G.leaders.orange.returnTurn).toBe(G.year + 1);
        expect(G.spaces.edinburgh.leaders).not.toContain("orange");
    });
});
