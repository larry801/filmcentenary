import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "5",
    playerID: "5",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Paris is Worth a Mass (card #111)", () => {
    it("takes Paris and moves the Huguenot capital there", () => {
        const G = game();
        G.powers.protestant.cards = ["vq-111"];
        G.spaces.paris.control = "france";
        G.spaces.paris.land = {};
        G.spaces.orleans.control = "protestant";
        G.spaces.orleans.land.protestant = {regular: 5, merc: 0, cav: 0};
        G.spaces.rouen.control = "protestant";
        G.leaders.navarre = {id: "navarre", power: "protestant", kind: "army", location: "orleans", command: 8};

        expect(playCard(G, context(), {cardId: "vq-111", asEvent: true})).toBeUndefined();

        expect(G.spaces.paris.control).toBe("protestant");
        expect(G.protestantCapital).toBe("paris");
        expect(G.removed).toContain("vq-111");
    });
});
