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

describe("Day of the Barricades (card #112)", () => {
    it("seizes Paris when Spain controls two neighbors and Guise is nearby", () => {
        const G = game();
        G.powers.spain.cards = ["vq-112"];
        G.spaces.paris.control = "france";
        G.spaces.paris.land = {france: {regular: 2, merc: 0, cav: 0}};
        G.spaces.paris.leaders = [];
        G.spaces.paris.siege = undefined;
        const neighbors = ["orleans", "rouen"];
        for (const id of neighbors) G.spaces[id].control = "spain";
        G.spaces.orleans.land.spain = {regular: 4, merc: 0, cav: 0};
        G.leaders.guise = {id: "guise", power: "spain", kind: "army", location: "orleans", command: 2};

        expect(playCard(G, context(), {cardId: "vq-112", asEvent: true})).toBeUndefined();

        expect(G.spaces.paris.control).toBe("spain");
        expect(G.spaces.paris.land.spain?.regular).toBe(4);
        expect(G.leaders.guise.location).toBe("paris");
        expect(G.removed).toContain("vq-112");
    });
});
