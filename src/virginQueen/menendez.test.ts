import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (values: number[] = []): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const prepare = (G: VQGame): void => {
    if (!G.powers.spain.cards.includes("vq-061")) G.powers.spain.cards.push("vq-061");
};

describe("Menéndez de Avilés (card #61)", () => {
    it("removes a Florida colony on 3+", () => {
        const G = game();
        prepare(G);
        G.worldColonies.florida = "england";
        G.worldControls.florida = "england";

        expect(playCard(G, context([3]), {cardId: "vq-061", asEvent: true})).toBeUndefined();

        expect(G.worldColonies.florida).toBeUndefined();
        expect(G.worldControls.florida).toBe("spain");
    });

    it("succeeds automatically with an informant", () => {
        const G = game();
        prepare(G);
        G.worldColonies.florida = "england";
        G.informants = [{owner: "spain", target: "england", plantedImpulse: 1, neutralized: false}];

        expect(playCard(G, context([1]), {cardId: "vq-061", asEvent: true})).toBeUndefined();

        expect(G.worldColonies.florida).toBeUndefined();
        expect(G.worldControls.florida).toBe("spain");
    });

    it("can choose which settlement to fortify", () => {
        const G = game();
        prepare(G);
        delete G.worldColonies.florida;
        G.worldControls.atlanticCoast = "spain";
        G.worldControls.antillesColony = "spain";
        G.worldFortresses = {};

        expect(playCard(G, context([3]), {cardId: "vq-061", asEvent: true, target: "fortress:atlanticCoast"})).toBeUndefined();

        expect(G.worldFortresses?.atlanticCoast).toBe("spain");
        expect(G.worldFortresses?.antillesColony).toBeUndefined();
    });

    it("can choose the escort even when Florida is available", () => {
        const G = game();
        prepare(G);
        G.worldColonies.florida = "england";
        G.treasureFleetEscorts = 0;

        expect(playCard(G, context([3]), {cardId: "vq-061", asEvent: true, target: "escort"})).toBeUndefined();

        expect(G.treasureFleetEscorts).toBe(1);
        expect(G.worldColonies.florida).toBe("england");
    });

    it("adds a treasure-fleet escort when Florida is not available", () => {
        const G = game();
        prepare(G);
        G.worldColonies.florida = undefined;
        G.treasureFleetEscorts = 0;

        expect(playCard(G, context([3]), {cardId: "vq-061", asEvent: true})).toBeUndefined();

        expect(G.treasureFleetEscorts).toBe(1);
    });
});
