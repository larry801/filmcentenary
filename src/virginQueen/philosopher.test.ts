import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {patronById} from "./scenario";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Philosopher's Stone (card #64)", () => {
    it("cancels a pending scientist's work", () => {
        const G = game();
        G.powers.france.cards = ["vq-064"];
        const scientist = G.patronsAvailable.map((id) => patronById(G, id)).find((patron) => patron?.kind === "scientist");
        expect(scientist).toBeDefined();
        G.pendingPatronage = [{power: "france", patronId: scientist!.id, cp: 3}];

        expect(playCard(G, context(), {cardId: "vq-064", asEvent: true, target: scientist!.id})).toBeUndefined();

        expect(G.pendingPatronage).toEqual([]);
        expect(G.removed).toContain("vq-064");
    });
});
