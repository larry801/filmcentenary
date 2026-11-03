import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (values: number[]): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context([]), phase: "action"} as Ctx);

const prepare = (G: VQGame): void => {
    if (!G.powers.england.cards.includes("vq-062")) G.powers.england.cards.push("vq-062");
    G.worldCaptains.hawkins = {power: "england", location: "northAtlantic", damaged: false, colony: false};
    G.powers.england.seaCaptains = G.powers.england.seaCaptains.filter((id) => id !== "hawkins");
};

describe("Northwest Passage (card #62)", () => {
    it("is safe when the first die is at or below Navigation", () => {
        const G = game();
        prepare(G);

        expect(playCard(G, context([1]), {cardId: "vq-062", asEvent: true, target: "hawkins"})).toBeUndefined();

        expect(G.worldCaptains.hawkins).toBeDefined();
    });

    it("loses carried treasure when the expedition ends", () => {
        const G = game();
        prepare(G);
        G.worldCaptains.hawkins.treasureValues = [3, 4];

        expect(playCard(G, context([6, 1]), {cardId: "vq-062", asEvent: true, target: "hawkins"})).toBeUndefined();

        expect(G.worldCaptains.hawkins).toBeUndefined();
        expect(G.log.join("\n")).toContain("2 treasure(s) are lost");
    });

    it("kills the navigator on a failed second roll of 5-6", () => {
        const G = game();
        prepare(G);

        expect(playCard(G, context([6, 6]), {cardId: "vq-062", asEvent: true, target: "hawkins"})).toBeUndefined();

        expect(G.worldCaptains.hawkins).toBeUndefined();
        expect(G.powers.england.seaCaptains).not.toContain("hawkins");
    });
});
