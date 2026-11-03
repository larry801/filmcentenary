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

describe("Knights of St. John (card #27)", () => {
    it("deploys two Knights regulars in Malta", () => {
        const G = game();
        G.powers.spain.cards = ["vq-027"];
        G.spaces.malta.control = "spain";
        G.spaces.malta.siege = undefined;
        G.spaces.malta.land = {};

        expect(playCard(G, context(), {cardId: "vq-027", asEvent: true})).toBeUndefined();

        expect(G.spaces.malta.land.independent?.regular).toBe(2);
    });
});
